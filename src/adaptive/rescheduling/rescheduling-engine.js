/**
 * TIMORA - Adaptive Rescheduling Engine
 * Generates feasible minimum-change rescheduling alternatives for the classes hit by a disruption.
 *
 * The engine is pure: the caller passes the active timetable and the reference data in `context`.
 * Every alternative resolves ALL affected classes, so approving one never silently drops a class.
 */

import { TEACHING_DAYS, TIME_SLOTS } from '../../constants/academic.js';
import { schedulingEngineAdapter } from '../../adapters/scheduling-engine-adapter.js';
import { disruptionCostEvaluator } from '../scoring/disruption-cost-evaluator.js';
import { studentDayQualityEvaluator } from '../scoring/student-day-evaluator.js';
import { DISRUPTION_TYPES } from '../disruption/disruption-model.js';

/** How many complete alternatives are offered to the administrator. */
const MAX_ALTERNATIVES = 8;
/** How many different relocation choices are explored per affected class. */
const CHOICES_PER_ENTRY = 6;
/** How many substitute teachers are tried for a faculty absence. */
const MAX_SUBSTITUTES = 5;

const FACULTY_TYPES = [DISRUPTION_TYPES.FACULTY_ABSENCE, DISRUPTION_TYPES.FACULTY_UNAVAILABILITY];

/**
 * Build the set of reserved "sectionId|Day|Slot" keys from section blocks.
 *
 * @param {{ sectionId: string, day: string, slotId: string }[]} blocks Section blocks (day in any case).
 * @returns {Set<string>}
 */
export function buildBlockKeys(blocks = []) {
  const keys = new Set();
  for (const block of blocks) {
    const day = block.day.charAt(0).toUpperCase() + block.day.slice(1).toLowerCase();
    keys.add(`${block.sectionId}|${day}|${block.slotId}`);
  }
  return keys;
}

/**
 * Check whether a placement is itself ruled out by the disruption (e.g. the absent teacher's day).
 *
 * @param {object} disruption Disruption summary from the impact result.
 * @param {object} candidate Candidate placement.
 * @param {object} original The class as it was scheduled.
 * @returns {boolean}
 */
function violatesDisruption(disruption, candidate, original) {
  const sameTime = candidate.dayOfWeek === disruption.dayOfWeek && (!disruption.slotId || candidate.slotId === disruption.slotId);

  if (FACULTY_TYPES.includes(disruption.type)) return sameTime && candidate.facultyId === disruption.affectedEntityId;
  if (disruption.type === DISRUPTION_TYPES.ROOM_UNAVAILABILITY) return sameTime && candidate.roomId === disruption.affectedEntityId;
  if (disruption.type === DISRUPTION_TYPES.HOLIDAY || disruption.type === DISRUPTION_TYPES.INSTITUTIONAL_EVENT) return sameTime;

  // Cancellations, swaps and make-up sessions must actually move the class.
  return (
    candidate.dayOfWeek === original.dayOfWeek &&
    candidate.slotId === original.slotId &&
    candidate.roomId === original.roomId &&
    candidate.facultyId === original.facultyId
  );
}

export class ReschedulingEngine {
  /**
   * Generate feasible alternative schedules for a given impact analysis result.
   *
   * @param {object} impactResult Result of the impact analyser.
   * @param {{ activeEntries?: object[], rooms: object[], faculty: object[], subjects: object[], timeSlots?: object[], days?: string[], blocks?: object[] }} context Reference data.
   * @returns {object[]} Ranked alternatives.
   */
  generateAlternatives(impactResult, context = {}) {
    const { affectedEntries, preservedEntries } = impactResult;
    const activeEntries = context.activeEntries ?? [...preservedEntries, ...affectedEntries];

    if (affectedEntries.length === 0) {
      return [
        {
          id: 'ALT_0',
          name: 'No Changes Needed',
          description: 'Disruption does not affect any active timetable entry.',
          modifiedEntries: [],
          changeCount: 0,
          disruptionCost: 0,
          studentDayQualityScore: 100,
          compositeScore: 60,
          hardConstraintCompliance: true,
          rank: 1,
          fullTimetableEntries: activeEntries
        }
      ];
    }

    const env = this.#buildEnvironment(impactResult, context, activeEntries);
    const alternatives = [];

    // Strategy 1: relocate every affected class; option k takes each class's k-th best new place.
    for (let choice = 0; choice < CHOICES_PER_ENTRY; choice += 1) {
      const plan = this.#planRelocation(env, affectedEntries, preservedEntries, choice);
      if (!plan) break;
      const duplicate = alternatives.some((alt) => alt.signature === plan.signature);
      if (!duplicate) alternatives.push(this.#describeRelocation(env, plan, alternatives.length));
    }

    // Strategy 2: keep the time and put another teacher in front of the class.
    if (FACULTY_TYPES.includes(env.disruption.type)) {
      for (const substitute of env.substitutes.slice(0, 40)) {
        if (alternatives.filter((alt) => alt.strategy === 'SUBSTITUTE').length >= MAX_SUBSTITUTES) break;
        const plan = this.#planSubstitution(env, affectedEntries, preservedEntries, substitute);
        if (plan) alternatives.push(this.#describeSubstitution(env, plan, substitute, alternatives.length));
      }
    }

    alternatives.sort((a, b) => b.compositeScore - a.compositeScore || a.changeCount - b.changeCount);
    const top = alternatives.slice(0, MAX_ALTERNATIVES);
    top.forEach((alt, index) => {
      alt.id = `ALT_${index + 1}`;
      alt.name = alt.name.replace(/^Option \d+/, `Option ${index + 1}`);
      alt.rank = index + 1;
      delete alt.signature;
    });
    return top;
  }

  /**
   * Prepare lookups shared by all strategies.
   */
  #buildEnvironment(impactResult, context, activeEntries) {
    const rooms = context.rooms ?? [];
    const faculty = context.faculty ?? [];
    const timeSlots = context.timeSlots ?? TIME_SLOTS;
    const disruption = {
      type: impactResult.disruptionType,
      dayOfWeek: impactResult.dayOfWeek,
      slotId: impactResult.slotId ?? null,
      affectedEntityId: impactResult.affectedEntityId ?? null
    };

    const adapterContext = {
      rooms: new Map(rooms.map((room) => [room.id, room])),
      subjects: new Map((context.subjects ?? []).map((subject) => [subject.id, subject])),
      blockKeys: context.blockKeys ?? buildBlockKeys(context.blocks)
    };

    const affectedFaculty = faculty.find((person) => person.id === disruption.affectedEntityId);
    const substitutes = faculty
      .filter((person) => person.id !== disruption.affectedEntityId && person.isActive !== false)
      .sort((a, b) => Number(b.department === affectedFaculty?.department) - Number(a.department === affectedFaculty?.department));

    return {
      disruption,
      activeEntries,
      rooms,
      substitutes,
      timeSlots,
      slotsById: new Map(timeSlots.map((slot) => [slot.id, slot])),
      roomsById: adapterContext.rooms,
      subjectsById: adapterContext.subjects,
      facultyById: new Map(faculty.map((person) => [person.id, person])),
      days: context.days ?? TEACHING_DAYS,
      adapterContext
    };
  }

  /**
   * Resolve every affected class by moving it to a free place. `choice` selects which of the
   * valid places each class takes (0 = the least disruptive one).
   */
  #planRelocation(env, affectedEntries, preservedEntries, choice) {
    const placed = [...preservedEntries];
    const moves = [];

    for (const original of affectedEntries) {
      const options = this.#relocationOptions(env, original, placed);
      const picked = options[Math.min(choice, options.length - 1)];
      if (!picked) return null;
      placed.push(picked);
      moves.push({ original, moved: picked });
    }

    return { placed, moves, signature: moves.map(({ moved }) => `${moved.id}:${moved.dayOfWeek}:${moved.slotId}:${moved.roomId}`).join('|') };
  }

  /**
   * Valid new places for one class, least disruptive first: same day before other days, original room first.
   */
  #relocationOptions(env, original, placed) {
    const days = [original.dayOfWeek, ...env.days.filter((day) => day !== original.dayOfWeek)].filter((day, i, all) => all.indexOf(day) === i);
    const rooms = [...env.rooms].sort((a, b) => Number(b.id === original.roomId) - Number(a.id === original.roomId));
    const options = [];

    for (const day of days) {
      for (const slot of env.timeSlots) {
        for (const room of rooms) {
          const candidate = { ...original, dayOfWeek: day, slotId: slot.id, roomId: room.id };
          if (violatesDisruption(env.disruption, candidate, original)) continue;

          const check = schedulingEngineAdapter.validateHardConstraints({
            entry: candidate,
            currentEntries: placed,
            context: env.adapterContext
          });
          if (check.isValid) {
            options.push(candidate);
            if (options.length >= CHOICES_PER_ENTRY * 4) return options;
          }
        }
      }
    }
    return options;
  }

  /**
   * Keep every class where it is and replace the teacher of the affected ones.
   */
  #planSubstitution(env, affectedEntries, preservedEntries, substitute) {
    const placed = [...preservedEntries];
    const moves = [];

    for (const original of affectedEntries) {
      const candidate = { ...original, facultyId: substitute.id };
      const check = schedulingEngineAdapter.validateHardConstraints({
        entry: candidate,
        currentEntries: placed,
        context: env.adapterContext
      });
      if (!check.isValid) return null;
      placed.push(candidate);
      moves.push({ original, moved: candidate });
    }
    return { placed, moves };
  }

  /**
   * Score a plan and wrap it as an alternative.
   */
  #score(env, plan) {
    const cost = disruptionCostEvaluator.calculateCost({
      originalEntries: env.activeEntries,
      candidateEntries: plan.placed,
      affectedEntryIds: plan.moves.map(({ original }) => original.id)
    });
    const quality = studentDayQualityEvaluator.evaluateQuality(plan.placed);

    return {
      changeCount: plan.moves.length,
      disruptionCost: cost.totalCost,
      costBreakdown: cost.breakdown,
      studentDayQualityScore: quality.overallQualityScore,
      qualityBreakdown: quality.breakdown,
      compositeScore: Math.round(quality.overallQualityScore * 0.6 - cost.totalCost * 0.4),
      hardConstraintCompliance: true,
      fullTimetableEntries: plan.placed
    };
  }

  #describeRelocation(env, plan, index) {
    const modifiedEntries = plan.moves.map(({ original, moved }) => {
      const subject = env.subjectsById.get(original.subjectId);
      const room = env.roomsById.get(moved.roomId);
      const faculty = env.facultyById.get(original.facultyId);
      const slot = env.slotsById.get(moved.slotId);
      return {
        entryId: original.id,
        subjectName: subject?.name ?? original.subjectId,
        sectionId: original.sectionId,
        facultyId: original.facultyId,
        facultyName: faculty?.name ?? original.facultyId,
        oldDay: original.dayOfWeek,
        newDay: moved.dayOfWeek,
        oldSlot: original.slotId,
        newSlot: moved.slotId,
        newSlotLabel: slot?.label ?? moved.slotId,
        oldRoom: original.roomId,
        newRoom: moved.roomId,
        newRoomName: room?.name ?? moved.roomId
      };
    });

    const first = modifiedEntries[0];
    const subjectNames = [...new Set(modifiedEntries.map((m) => m.subjectName))].join(', ');
    return {
      id: `ALT_${index + 1}`,
      strategy: 'RELOCATE',
      signature: plan.signature,
      name:
        plan.moves.length === 1
          ? `Option ${index + 1}: Relocate to ${first.newDay} ${first.newSlotLabel}`
          : `Option ${index + 1}: Relocate ${plan.moves.length} classes (first to ${first.newDay} ${first.newSlotLabel})`,
      description: `Move ${subjectNames} (${plan.moves.length} class${plan.moves.length === 1 ? '' : 'es'}); first move: ${first.oldDay} ${first.oldSlot} to ${first.newDay} (${first.newSlotLabel}) in ${first.newRoomName}`,
      modifiedEntries,
      ...this.#score(env, plan)
    };
  }

  #describeSubstitution(env, plan, substitute, index) {
    const modifiedEntries = plan.moves.map(({ original }) => ({
      entryId: original.id,
      subjectName: env.subjectsById.get(original.subjectId)?.name ?? original.subjectId,
      sectionId: original.sectionId,
      oldFacultyId: original.facultyId,
      newFacultyId: substitute.id,
      facultyId: substitute.id,
      facultyName: substitute.name,
      oldDay: original.dayOfWeek,
      newDay: original.dayOfWeek,
      oldSlot: original.slotId,
      newSlot: original.slotId,
      oldRoom: original.roomId,
      newRoom: original.roomId
    }));

    return {
      id: `ALT_${index + 1}`,
      strategy: 'SUBSTITUTE',
      name: `Option ${index + 1}: Assign Substitute ${substitute.name}`,
      description: `Keep ${plan.moves.length} class${plan.moves.length === 1 ? '' : 'es'} at the same time and assign substitute ${substitute.name}`,
      modifiedEntries,
      ...this.#score(env, plan)
    };
  }
}

export const reschedulingEngine = new ReschedulingEngine();
