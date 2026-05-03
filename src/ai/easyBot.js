// ═══════════════════════════════════════════════════════════════════
// easyBot.js - Simple heuristic bot
// ═══════════════════════════════════════════════════════════════════

import { getCardScore, getCardPower, isPrivileged } from '../game/card.js';
import { getLegalMoves, canSecondCardWin } from '../game/rules.js';

// ─────────────────────────────────────────────────────────────────
// Helper: choose lowest-power card from a list
// ─────────────────────────────────────────────────────────────────

function chooseLowestPower(cards, dragonSuit) {
  let best = cards[0];
  let bestPower = getCardPower(best.card, dragonSuit);
  for (let i = 1; i < cards.length; i++) {
    const power = getCardPower(cards[i].card, dragonSuit);
    if (power < bestPower) {
      bestPower = power;
      best = cards[i];
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────
// Helper: choose card with lowest score, tie-break with lowest power
// ─────────────────────────────────────────────────────────────────

function chooseLowestScoreCard(cards, dragonSuit) {
  let best = cards[0];
  for (let i = 1; i < cards.length; i++) {
    const bestScore = getCardScore(best.card);
    const score = getCardScore(cards[i].card);
    const bestPower = getCardPower(best.card, dragonSuit);
    const power = getCardPower(cards[i].card, dragonSuit);
    if (score < bestScore || (score === bestScore && power < bestPower)) {
      best = cards[i];
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────
// chooseCard
// ─────────────────────────────────────────────────────────────────

/**
 * Easy bot: simple heuristic strategy.
 * Uses ONLY visible information (no opponent hand peeking).
 *
 * Leading:
 *   1. Play privileged score cards (smallest first)
 *   2. Play lowest non-score card
 *   3. Play lowest score card if that's all that's left
 *
 * Following:
 *   1. If lead card has points and we can win, play lowest winner (prefer score cards)
 *   2. If we can play a scoring card that wins, play smallest
 *   3. Default: play lowest non-score card that loses
 *
 * @param {object} state - Full game state (bot only accesses own info + visible board)
 * @param {'p1'|'p2'} playerId - Which player this bot controls
 * @param {object|null} leadCard - The card that was led, or null if bot is leading
 * @returns {{ type: 'hand'|'face', index: number }} The chosen move, or null if none
 */
function easyChoose(state, playerId, leadCard) {
  const player = state[playerId];
  const dragonSuit = state.dragonSuit;
  const playable = getLegalMoves(player, leadCard, dragonSuit);

  if (playable.length === 0) return null;

  if (leadCard) {
    // ── Following ──
    const winners = playable.filter(a => canSecondCardWin(leadCard, a.card, dragonSuit));
    const scoreWinners = winners.filter(a => getCardScore(a.card) > 0);

    // If lead card has points and we can win, definitely try to capture
    if (getCardScore(leadCard) > 0 && winners.length > 0) {
      return scoreWinners.length > 0
        ? chooseLowestScoreCard(scoreWinners, dragonSuit)
        : chooseLowestPower(winners, dragonSuit);
    }

    // If we can win with a scoring card, play it
    if (scoreWinners.length > 0) {
      return chooseLowestScoreCard(scoreWinners, dragonSuit);
    }
  } else {
    // ── Leading ──
    const privileged = playable.filter(a => isPrivileged(a.card, dragonSuit));
    const scoreCards = playable.filter(a => getCardScore(a.card) > 0);

    // Prefer privileged score cards (safe to lead with)
    const privScore = privileged.filter(a => getCardScore(a.card) > 0);
    if (privScore.length > 0) {
      return chooseLowestScoreCard(privScore, dragonSuit);
    }

    // If all available cards are score cards, play the smallest
    if (scoreCards.length > 0 && scoreCards.length === playable.length) {
      return chooseLowestScoreCard(scoreCards, dragonSuit);
    }
  }

  // Default: play lowest power non-score card
  const nonScore = playable.filter(a => getCardScore(a.card) === 0);
  return chooseLowestPower(nonScore.length > 0 ? nonScore : playable, dragonSuit);
}

export { easyChoose };
