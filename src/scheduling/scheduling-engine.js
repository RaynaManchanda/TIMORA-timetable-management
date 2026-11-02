/**
 * TIMORA - Core Scheduling & Optimization Engine
 * Person 1: Rishank Mishra (Core Scheduling & Optimization)
 * Generates conflict-free timetables respecting credit requirements, room capacity, and student-day ergonomics.
 */

import { constraintModel } from './constraint-model.js';
import { timetableQualityEvaluator } from './timetable-quality-evaluator.js';
import { TIME_SLOTS } from '../constants/academic.js';

export class SchedulingEngine {
  constructor() {
    this.defaultDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  }

  /**
   * Preflight feasibility check.
   */
  preflightCheck(data) {
    return constraintModel.preflightCheck(data);
  }

  /**
   * Expand subjects and sections into individual schedulable session units.
   */
  buildRequiredSessions(subjects, sections, faculty) {
    const sessions = [];
    let sessionIdCounter = 1;

    for (const section of sections) {
      for (let subIdx = 0; subIdx < subjects.length; subIdx++) {
        const subject = subjects[subIdx];
        // Assigned faculty: explicitly mapped or round-robin
        const assignedFaculty = subject.facultyId
          ? faculty.find(f => f.id === subject.facultyId) || faculty[0]
          : faculty[subIdx % faculty.length] || faculty[0];

        // Determine session breakdown (lectures, tutorials, labs)
        const sessionBreakdown = [];
        if (subject.breakdown) {
          // If explicit breakdown provided, e.g. { lectures: 3, tutorials: 1 } or { lectures: 3, labs: 1 }
          for (let i = 0; i < (subject.breakdown.lectures || 0); i++) {
            sessionBreakdown.push({ type: 'LECTURE', name: `${subject.code || subject.name} Lecture ${i + 1}` });
          }
          for (let i = 0; i < (subject.breakdown.tutorials || 0); i++) {
            sessionBreakdown.push({ type: 'TUTORIAL', name: `${subject.code || subject.name} Tutorial` });
          }
          for (let i = 0; i < (subject.breakdown.labs || 0); i++) {
            sessionBreakdown.push({ type: 'LAB', name: `${subject.code || subject.name} Lab` });
          }
        } else if (subject.type === 'LAB') {
          const hours = subject.requiredHoursPerWeek || 2;
          for (let i = 0; i < hours; i++) {
            sessionBreakdown.push({ type: 'LAB', name: `${subject.code || subject.name} Lab ${i + 1}` });
          }
        } else {
          const hours = subject.requiredHoursPerWeek || 3;
          for (let i = 0; i < hours; i++) {
            sessionBreakdown.push({ type: 'LECTURE', name: `${subject.code || subject.name} Lecture ${i + 1}` });
          }
        }

        for (const item of sessionBreakdown) {
          sessions.push({
            id: `SES_${sessionIdCounter++}`,
            sectionId: section.id,
            sectionName: section.name,
            subjectId: subject.id,
            subjectCode: subject.code || subject.id,
            subjectName: subject.name,
            sessionType: item.type,
            facultyId: assignedFaculty ? assignedFaculty.id : 'F101',
            facultyName: assignedFaculty ? assignedFaculty.name : 'Faculty'
          });
        }
      }
    }

    return sessions;
  }

  /**
   * Main Timetable Generation routine.
   */
  generateTimetable({
    subjects = [],
    faculty = [],
    rooms = [],
    sections = [],
    timeSlots = TIME_SLOTS,
    days = this.defaultDays,
    options = {},
    fixedEntries = [],
    blocks = []
  }) {
    // 1. Run Preflight Check
    const preflight = this.preflightCheck({ subjects, faculty, rooms, sections });
    if (!preflight.isFeasible) {
      return {
        status: 'INFEASIBLE',
        error: preflight.message,
        message: preflight.message,
        entries: [],
        qualityScore: 0,
        conflicts: preflight.errors
      };
    }

    // Maps for fast lookups
    const roomsMap = new Map(rooms.map(r => [r.id, r]));
    const sectionsMap = new Map(sections.map(s => [s.id, s]));
    const subjectsMap = new Map(subjects.map(sub => [sub.id, sub]));
    const facultyMap = new Map(faculty.map(f => [f.id, f]));
    const slotsMap = new Map(timeSlots.map(ts => [ts.id, ts]));

    // Filter out lunch break slots for classes
    const availableSlots = timeSlots.filter(ts => !ts.isLunchBreak);

    // 2. Build schedulable session units
    const sessionsToSchedule = this.buildRequiredSessions(subjects, sections, faculty);

    // Classes that stay as they are (other sections) take part in the conflict checks but are not output.
    const scheduledEntries = [];
    const conflictScope = () => [...fixedEntries, ...scheduledEntries];
    let entryCounter = 1001;

    // Time each section has reserved, and the sections that already have a fixed lunch hour.
    const dayName = (day) => day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
    const blockKeys = new Set(blocks.filter(b => b.kind !== 'LUNCH').map(b => `${b.sectionId}|${dayName(b.day)}|${b.slotId}`));
    const lunchBlockKeys = new Set(blocks.filter(b => b.kind === 'LUNCH').map(b => `${b.sectionId}|${dayName(b.day)}|${b.slotId}`));
    const lunchKeys = new Set(blocks.filter(b => b.kind === 'LUNCH').map(b => `${b.sectionId}|${dayName(b.day)}`));
    lunchBlockKeys.forEach(key => blockKeys.add(key));
    const lunchWindow = options.lunchWindow ?? ['S4', 'S5', 'S6'];

    // Helper: Find eligible rooms for a session
    const getEligibleRooms = (session) => {
      const section = sectionsMap.get(session.sectionId);
      const studentCount = section ? section.studentCount : 0;
      const isLab = session.sessionType === 'LAB';

      return rooms.filter(room => {
        if (room.capacity < studentCount) return false;
        if (isLab && room.type !== 'LAB') return false;
        return true;
      });
    };

    // 3. Scheduling Search (Greedy with Backtracking / Ergonomic Placement)
    // Order sessions to spread subject lectures across days
    const dayRoundRobin = [...days];

    for (const session of sessionsToSchedule) {
      let placed = false;
      const eligibleRooms = getEligibleRooms(session);

      if (eligibleRooms.length === 0) {
        return {
          status: 'INFEASIBLE',
          error: `No suitable room with capacity >= ${sectionsMap.get(session.sectionId)?.studentCount || 0} for session ${session.id}`,
          entries: [],
          qualityScore: 0,
          conflicts: [`No suitable room for session ${session.id}`]
        };
      }

      // Try days with lowest load for this section first to optimize student day
      const sortedDays = [...dayRoundRobin].sort((d1, d2) => {
        const count1 = scheduledEntries.filter(e => e.sectionId === session.sectionId && e.dayOfWeek === d1).length;
        const count2 = scheduledEntries.filter(e => e.sectionId === session.sectionId && e.dayOfWeek === d2).length;
        return count1 - count2;
      });

      // Try slots to minimize gaps (prefer adjacent to existing classes if any)
      for (const day of sortedDays) {
        if (placed) break;

        const sectionDayEntries = scheduledEntries.filter(e => e.sectionId === session.sectionId && e.dayOfWeek === day);

        // Sort slots: prefer slots adjacent to current classes to prevent gaps
        const preferredSlots = [...availableSlots].sort((s1, s2) => {
          const hasAdj1 = sectionDayEntries.some(e => Math.abs(e.slotId.localeCompare(s1.id)) === 1);
          const hasAdj2 = sectionDayEntries.some(e => Math.abs(e.slotId.localeCompare(s2.id)) === 1);
          if (hasAdj1 && !hasAdj2) return -1;
          if (!hasAdj1 && hasAdj2) return 1;
          return s1.slotNumber - s2.slotNumber;
        });

        for (const slot of preferredSlots) {
          if (placed) break;

          for (const room of eligibleRooms) {
            const check = constraintModel.validateCandidateAssignment({
              dayOfWeek: day,
              slotId: slot.id,
              facultyId: session.facultyId,
              roomId: room.id,
              sectionId: session.sectionId,
              subjectId: session.subjectId,
              sessionType: session.sessionType,
              currentEntries: conflictScope(),
              blockKeys,
              lunchKeys,
              lunchWindow,
              roomsMap,
              sectionsMap,
              subjectsMap,
              facultyMap,
              slotsMap
            });

            if (check.isValid) {
              const entry = {
                id: `E${entryCounter++}`,
                sectionId: session.sectionId,
                sectionName: session.sectionName,
                subjectId: session.subjectId,
                subjectCode: session.subjectCode,
                subjectName: session.subjectName,
                facultyId: session.facultyId,
                facultyName: session.facultyName,
                roomId: room.id,
                roomName: room.name,
                dayOfWeek: day,
                slotId: slot.id,
                slotLabel: slot.label,
                sessionType: session.sessionType
              };

              scheduledEntries.push(entry);
              placed = true;
              break;
            }
          }
        }
      }

      if (!placed) {
        return {
          status: 'INFEASIBLE',
          error: `Unable to find conflict-free slot for ${session.subjectCode} (${session.sessionType}) - Section ${session.sectionId}`,
          entries: scheduledEntries,
          qualityScore: 0,
          conflicts: [`Unscheduled session ${session.id}`]
        };
      }
    }

    // 4. Validate full timetable conflict-free
    const validation = constraintModel.validateFullTimetable(scheduledEntries, {
      rooms,
      faculty,
      sections,
      subjects,
      timeSlots
    });

    if (!validation.isValid) {
      return {
        status: 'INFEASIBLE',
        error: 'Timetable contains hard-constraint conflicts.',
        conflicts: validation.conflicts,
        entries: scheduledEntries,
        qualityScore: 0
      };
    }

    // 5. Evaluate Timetable Quality
    const qualityMetrics = timetableQualityEvaluator.evaluateQuality(scheduledEntries, {
      rooms,
      faculty,
      sections,
      timeSlots
    });

    return {
      status: 'OPTIMAL',
      message: 'Timetable generated successfully with status OPTIMAL.',
      totalRequiredSessions: sessionsToSchedule.length,
      scheduledSessionsCount: scheduledEntries.length,
      qualityScore: qualityMetrics.qualityScore,
      metrics: qualityMetrics,
      entries: scheduledEntries,
      conflicts: []
    };
  }
}

export const schedulingEngine = new SchedulingEngine();

