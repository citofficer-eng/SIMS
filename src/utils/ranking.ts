import { Team } from '../types.ts';

/**
 * Calculate rankings with tie support.
 * Teams with the same score get the same rank.
 * Example: If scores are [100, 100, 80], ranks are [1, 1, 3]
 */
export const calculateRanksWithTies = (teams: Team[]): Team[] => {
    if (!teams.length) return teams;
    
    // Sort by score descending
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    
    // Assign ranks
    let currentRank = 1;
    let previousScore = sorted[0].score;
    
    return sorted.map((team, index) => {
        if (team.score !== previousScore) {
            currentRank = index + 1;
            previousScore = team.score;
        }
        return { ...team, rank: currentRank };
    });
};

/**
 * Sort teams by score (descending) and calculate their ranks
 */
export const getSortedTeamsWithRanks = (teams: Team[]): Team[] => {
    return calculateRanksWithTies(teams);
};
