/**
 * TIMORA - Adaptive Rescheduling Engine
 * Generates feasible minimum-change rescheduling alternatives for affected timetable entries.
 */

import { DAYS_OF_WEEK, TIME_SLOTS, timetableRepository } from '../../repositories/timetable-repository.js';
import { schedulingEngineAdapter } from '../../adapters/scheduling-engine-adapter.js';
import { disruptionCostEvaluator } from '../scoring/disruption-cost-evaluator.js';
import { studentDayQualityEvaluator } from '../scoring/student-day-evaluator.js';

export class ReschedulingEngine {
  /**
   * Generate feasible alternative schedules for a given impact analysis result.
   */
  generateAlternatives(impactResult) {
    const { affectedEntries, preservedEntries } = impactResult;
    const currentActiveEntries = timetableRepository.getActiveVersion().entries;
    const alternatives = [];

    if (affectedEntries.length === 0) {
      return [{
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
        fullTimetableEntries: currentActiveEntries
      }];
    }

    const availableSlots = TIME_SLOTS.filter(s => !s.isLunchBreak);
    const availableRooms = timetableRepository.rooms;
    const availableFaculty = timetableRepository.faculty;

    let candidateIdCounter = 1;

    // Strategy 1: Targeted local move for each affected entry to an open slot/room
    affectedEntries.forEach((affectedEntry) => {
      // Try alternative time slots on the same day first, then other days
      const daysToTry = [affectedEntry.dayOfWeek, ...DAYS_OF_WEEK.filter(d => d !== affectedEntry.dayOfWeek)];

      for (const targetDay of daysToTry) {
        for (const slot of availableSlots) {
          // Try original room, then alternative suitable rooms
          for (const room of availableRooms) {
            // Build candidate entry modification
            const candidateEntry = {
              ...affectedEntry,
              dayOfWeek: targetDay,
              slotId: slot.id,
              roomId: room.id
            };

            // Check hard constraints with preserved entries + current candidate state
            const currentCandidateSet = [
              ...preservedEntries,
              candidateEntry
            ];

            const constraintValidation = schedulingEngineAdapter.validateHardConstraints({
              entry: candidateEntry,
              targetDay,
              targetSlotId: slot.id,
              targetRoomId: room.id,
              targetFacultyId: candidateEntry.facultyId,
              currentEntries: currentCandidateSet
            });

            if (constraintValidation.isValid) {
              // Calculate Disruption Cost
              const costResult = disruptionCostEvaluator.calculateCost({
                originalEntries: currentActiveEntries,
                candidateEntries: currentCandidateSet,
                affectedEntryIds: affectedEntries.map(e => e.id)
              });

              // Calculate Student-Day Quality
              const qualityResult = studentDayQualityEvaluator.evaluateQuality(currentCandidateSet);

              // Calculate Composite Score: (Quality * 0.6) - (Cost * 0.4)
              const compositeScore = Math.round((qualityResult.overallQualityScore * 0.6) - (costResult.totalCost * 0.4));

              const subject = timetableRepository.getSubjectById(affectedEntry.subjectId);
              const roomObj = timetableRepository.getRoomById(room.id);
              const facultyObj = timetableRepository.getFacultyById(affectedEntry.facultyId);
              const slotObj = timetableRepository.getTimeSlotById(slot.id);

              alternatives.push({
                id: `ALT_${candidateIdCounter++}`,
                name: `Option ${candidateIdCounter - 1}: Relocate to ${targetDay} ${slotObj.label}`,
                description: `Move ${subject ? subject.name : 'class'} from ${affectedEntry.dayOfWeek} ${affectedEntry.slotId} to ${targetDay} (${slotObj.label}) in ${roomObj.name}`,
                modifiedEntries: [
                  {
                    entryId: affectedEntry.id,
                    subjectName: subject ? subject.name : affectedEntry.subjectId,
                    sectionId: affectedEntry.sectionId,
                    facultyName: facultyObj ? facultyObj.name : affectedEntry.facultyId,
                    oldDay: affectedEntry.dayOfWeek,
                    newDay: targetDay,
                    oldSlot: affectedEntry.slotId,
                    newSlot: slot.id,
                    newSlotLabel: slotObj.label,
                    oldRoom: affectedEntry.roomId,
                    newRoom: room.id,
                    newRoomName: roomObj.name
                  }
                ],
                changeCount: 1,
                disruptionCost: costResult.totalCost,
                costBreakdown: costResult.breakdown,
                studentDayQualityScore: qualityResult.overallQualityScore,
                qualityBreakdown: qualityResult.breakdown,
                compositeScore,
                hardConstraintCompliance: true,
                fullTimetableEntries: currentCandidateSet
              });

              if (alternatives.length >= 10) break; // Limit top search candidates
            }
          }
          if (alternatives.length >= 10) break;
        }
        if (alternatives.length >= 10) break;
      }
    });

    // Strategy 2: If faculty absence, also search for substitute faculty on the same slot
    if (impactResult.disruptionType === 'FACULTY_ABSENCE' || impactResult.disruptionType === 'FACULTY_UNAVAILABILITY') {
      affectedEntries.forEach(affectedEntry => {
        availableFaculty.forEach(subFaculty => {
          if (subFaculty.id === affectedEntry.facultyId) return; // Skip absent faculty

          const candidateEntry = {
            ...affectedEntry,
            facultyId: subFaculty.id
          };

          const currentCandidateSet = [
            ...preservedEntries,
            candidateEntry
          ];

          const constraintValidation = schedulingEngineAdapter.validateHardConstraints({
            entry: candidateEntry,
            targetDay: affectedEntry.dayOfWeek,
            targetSlotId: affectedEntry.slotId,
            targetRoomId: affectedEntry.roomId,
            targetFacultyId: subFaculty.id,
            currentEntries: currentCandidateSet
          });

          if (constraintValidation.isValid) {
            const costResult = disruptionCostEvaluator.calculateCost({
              originalEntries: currentActiveEntries,
              candidateEntries: currentCandidateSet,
              affectedEntryIds: affectedEntries.map(e => e.id)
            });

            const qualityResult = studentDayQualityEvaluator.evaluateQuality(currentCandidateSet);
            const compositeScore = Math.round((qualityResult.overallQualityScore * 0.6) - (costResult.totalCost * 0.4));

            const subject = timetableRepository.getSubjectById(affectedEntry.subjectId);

            alternatives.push({
              id: `ALT_${candidateIdCounter++}`,
              name: `Option ${candidateIdCounter - 1}: Assign Substitute ${subFaculty.name}`,
              description: `Keep ${subject ? subject.name : 'class'} at ${affectedEntry.dayOfWeek} ${affectedEntry.slotId} and assign substitute ${subFaculty.name}`,
              modifiedEntries: [
                {
                  entryId: affectedEntry.id,
                  subjectName: subject ? subject.name : affectedEntry.subjectId,
                  sectionId: affectedEntry.sectionId,
                  oldFacultyId: affectedEntry.facultyId,
                  newFacultyId: subFaculty.id,
                  facultyName: subFaculty.name,
                  oldDay: affectedEntry.dayOfWeek,
                  newDay: affectedEntry.dayOfWeek,
                  oldSlot: affectedEntry.slotId,
                  newSlot: affectedEntry.slotId,
                  oldRoom: affectedEntry.roomId,
                  newRoom: affectedEntry.roomId
                }
              ],
              changeCount: 1,
              disruptionCost: costResult.totalCost,
              costBreakdown: costResult.breakdown,
              studentDayQualityScore: qualityResult.overallQualityScore,
              qualityBreakdown: qualityResult.breakdown,
              compositeScore,
              hardConstraintCompliance: true,
              fullTimetableEntries: currentCandidateSet
            });
          }
        });
      });
    }

    // Sort alternatives by composite score descending (highest quality, lowest disruption cost first)
    alternatives.sort((a, b) => b.compositeScore - a.compositeScore);

    // Assign ranking
    alternatives.forEach((alt, index) => {
      alt.rank = index + 1;
    });

    return alternatives;
  }
}

export const reschedulingEngine = new ReschedulingEngine();
