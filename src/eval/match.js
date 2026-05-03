// ═══════════════════════════════════════════════════════════════════
// match.js - Run a single simulated match
// ═══════════════════════════════════════════════════════════════════

import { createState, applyMove, resolveRound, advanceRound, isTerminal, getWinner } from '../game/state.js';
import { getBotMove } from '../ai/bot.js';
import { getLegalMoves } from '../game/rules.js';

/**
 * Run a single AI-vs-AI match.
 * Pure simulation — no DOM, no user interaction.
 *
 * @param {'V1'|'V2'} strat1 - AI strategy for player 1
 * @param {'V1'|'V2'} strat2 - AI strategy for player 2
 * @returns {{ winner: number|null, score1: number, score2: number,
 *            rounds: number, p1Wins: number, p2Wins: number, ties: number }}
 */
function runMatch(strat1, strat2) {
  const state = createState({ p1: strat1, p2: strat2 });
  let ns = state;
  let p1RoundWins = 0;
  let p2RoundWins = 0;
  let roundTies = 0;

  while (!isTerminal(ns)) {
    if (ns.phase === 'select') {
      // Player 1 plays (AI)
      // P1 leads if firstPlayer=1, otherwise responds to P2's card
      const leadCardP1 = ns.firstPlayer === 1 ? null : ns.playedP2;
      const botMoveP1 = getBotMove(ns.strategies.p1, ns, 'p1', leadCardP1);
      if (botMoveP1) {
        ns = applyMove(ns, 'p1', botMoveP1);
      }

      // Player 2 plays (AI)
      // P2 leads if firstPlayer=2, otherwise responds to P1's card
      const leadCardP2 = ns.firstPlayer === 2 ? null : ns.playedP1;
      const botMoveP2 = getBotMove(ns.strategies.p2, ns, 'p2', leadCardP2);
      if (botMoveP2) {
        ns = applyMove(ns, 'p2', botMoveP2);
      }
    }

    if (ns.playedP1 && ns.playedP2) {
      ns = resolveRound(ns);
      if (ns.roundResult === 'p1') p1RoundWins++;
      else if (ns.roundResult === 'p2') p2RoundWins++;
      else roundTies++;
    }

    if (ns.phase === 'reveal') {
      ns = advanceRound(ns);
    }
  }

  const winner = getWinner(ns);

  return {
    winner,
    score1: ns.p1.score,
    score2: ns.p2.score,
    rounds: ns.round - 1,
    p1Wins: p1RoundWins,
    p2Wins: p2RoundWins,
    ties: roundTies,
    finalRound: ns.round,
    p1ScoreCards: ns.p1.scoreCards.length,
    p2ScoreCards: ns.p2.scoreCards.length,
  };
}

export { runMatch };
