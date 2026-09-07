/**
 * TIMORA - Alternative Comparator
 * Formats, ranks, and structures generated rescheduling options for administrator side-by-side review.
 */

export class AlternativeComparator {
  compareAlternatives(alternatives, disruption) {
    if (!alternatives || alternatives.length === 0) {
      return {
        disruptionId: disruption.id,
        disruptionType: disruption.disruptionType,
        optionsCount: 0,
        rankedAlternatives: [],
        topRecommendation: null
      };
    }

    const rankedAlternatives = alternatives.map(alt => {
      return {
        id: alt.id,
        rank: alt.rank,
        isRecommended: alt.rank === 1,
        name: alt.name,
        description: alt.description,
        changeCount: alt.changeCount,
        disruptionCost: alt.disruptionCost,
        studentDayQualityScore: alt.studentDayQualityScore,
        compositeScore: alt.compositeScore,
        hardConstraintCompliance: alt.hardConstraintCompliance,
        modifiedEntries: alt.modifiedEntries,
        costBreakdown: alt.costBreakdown,
        qualityBreakdown: alt.qualityBreakdown,
        fullTimetableEntries: alt.fullTimetableEntries
      };
    });

    return {
      disruptionId: disruption.id,
      disruptionType: disruption.disruptionType,
      optionsCount: rankedAlternatives.length,
      topRecommendation: rankedAlternatives[0],
      rankedAlternatives
    };
  }
}

export const alternativeComparator = new AlternativeComparator();
