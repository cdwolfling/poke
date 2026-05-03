// ═══════════════════════════════════════════════════════════════════
// tournament.js - Run multiple matches and aggregate stats
// ═══════════════════════════════════════════════════════════════════

import { runMatch } from './match.js';

/**
 * Strategy pair: { p1: string, p2: string }
 * e.g. { p1: 'V1', p2: 'V2' }
 */

/**
 * Run a tournament between strategy pairs.
 *
 * @param {Array<{ label: string, p1: string, p2: string }>} stratsPairs
 *   Each entry has a label and the two strategies to use.
 *   Example: [{ label: 'V1 vs V2', p1: 'V1', p2: 'V2' }]
 * @param {number} games - Number of matches to run per pair
 * @returns {Array<object>} Array of stats objects per pair
 */
function runTournament(stratPairs, games = 100) {
  const results = [];

  for (const pair of stratPairs) {
    let p1Wins = 0;
    let p2Wins = 0;
    let ties = 0;
    let totalScore1 = 0;
    let totalScore2 = 0;
    let roundWinsP1 = 0;
    let roundWinsP2 = 0;
    let roundTies = 0;
    let totalRounds = 0;

    for (let g = 0; g < games; g++) {
      const result = runMatch(pair.p1, pair.p2);

      if (result.winner === 1) p1Wins++;
      else if (result.winner === 2) p2Wins++;
      else ties++;

      totalScore1 += result.score1;
      totalScore2 += result.score2;
      roundWinsP1 += result.p1Wins;
      roundWinsP2 += result.p2Wins;
      roundTies += result.ties;
      totalRounds += result.rounds;
    }

    results.push({
      label: pair.label,
      strategy1: pair.p1,
      strategy2: pair.p2,
      games,
      p1Wins,
      p2Wins,
      ties,
      winRateP1: (p1Wins / games) * 100,
      winRateP2: (p2Wins / games) * 100,
      tieRate: (ties / games) * 100,
      avgScore1: totalScore1 / games,
      avgScore2: totalScore2 / games,
      avgRounds: totalRounds / games,
      avgRoundWinsP1: roundWinsP1 / games,
      avgRoundWinsP2: roundWinsP2 / games,
      avgRoundTies: roundTies / games,
      totalScore1,
      totalScore2,
    });
  }

  return results;
}

/**
 * Run a simple head-to-head between two strategies.
 * @param {string} strat1
 * @param {string} strat2
 * @param {number} games
 * @returns {object} Single pair stats
 */
function runHeadToHead(strat1, strat2, games = 100) {
  const results = runTournament([
    { label: `${strat1} vs ${strat2}`, p1: strat1, p2: strat2 },
  ], games);
  return results[0];
}

export { runTournament, runHeadToHead };
