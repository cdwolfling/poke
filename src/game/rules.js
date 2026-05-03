// ═══════════════════════════════════════════════════════════════════
// rules.js - Pure rule functions
// ═══════════════════════════════════════════════════════════════════

import { isJoker, getCardScore, getEffectiveSuit, isPrivileged, RANK_ORDER } from './card.js';

/**
 * Get all available playable cards for a player (hand + face-up table cards).
 * @param {{ hand: Array, table: Array }} player
 * @returns {Array<{type: 'hand'|'face', index: number, card: object}>}
 */
function getAvailableCards(player) {
  const cards = [];
  for (let i = 0; i < player.hand.length; i++) {
    cards.push({ type: 'hand', index: i, card: player.hand[i] });
  }
  for (let i = 0; i < player.table.length; i++) {
    if (player.table[i].face) {
      cards.push({ type: 'face', index: i, card: player.table[i].face });
    }
  }
  return cards;
}

/**
 * Get legal moves for a player given an optional lead card.
 * - If leadCard is null (player is leading), all available cards are legal.
 * - If leadCard is given (player is following), must follow suit.
 *   No matching suit → any card is legal.
 *
 * @param {{ hand: Array, table: Array }} player
 * @param {object|null} leadCard
 * @param {string} dragonSuit
 * @returns {Array<{type: 'hand'|'face', index: number, card: object}>}
 */
function getLegalMoves(player, leadCard, dragonSuit) {
  const available = getAvailableCards(player);
  if (!leadCard) return available;

  const leadSuit = getEffectiveSuit(leadCard, dragonSuit);
  const sameSuit = available.filter(a =>
    getEffectiveSuit(a.card, dragonSuit) === leadSuit
  );

  if (sameSuit.length > 0) return sameSuit;
  return available;
}

/**
 * Compare two cards. Both cards are already played.
 * Follows CouplesCardGame rules:
 *   - Privileged > non-privileged
 *   - Both privileged → higher rank wins
 *   - Both non-privileged, same effective suit → higher rank wins
 *   - Both non-privileged, different suit → first (lead) card wins
 *
 * @param {object} a - The first/lead card
 * @param {object} b - The second/follow card
 * @param {string} dragonSuit
 * @returns {number}  1 if a wins, -1 if b wins, 0 if tie
 */
function compareCards(a, b, dragonSuit) {
  if (!a || !b) return 0;

  const aP = isPrivileged(a, dragonSuit);
  const bP = isPrivileged(b, dragonSuit);

  if (aP && !bP) return 1;
  if (!aP && bP) return -1;

  if (aP && bP) {
    return compareRank(a, b);
  }

  const aSuit = getEffectiveSuit(a, dragonSuit);
  const bSuit = getEffectiveSuit(b, dragonSuit);

  if (aSuit === bSuit) return compareRank(a, b);

  // Different suits, both non-privileged → first card (lead) wins
  return 1;
}

/**
 * Rank comparison helper.
 * @returns {number} 1 if a > b, -1 if a < b, 0 if equal
 */
function compareRank(a, b) {
  const ia = RANK_ORDER.indexOf(a.rank);
  const ib = RANK_ORDER.indexOf(b.rank);
  if (ia > ib) return 1;
  if (ia < ib) return -1;
  return 0;
}

/**
 * Can the second card beat the lead/first card?
 * @param {object} leadCard
 * @param {object} secondCard
 * @param {string} dragonSuit
 * @returns {boolean}
 */
function canSecondCardWin(leadCard, secondCard, dragonSuit) {
  return compareCards(leadCard, secondCard, dragonSuit) < 0;
}

/**
 * Can the lead card hold against all possible replies from opponent?
 * (i.e., no opponent card can beat it)
 * This requires inspecting the opponent's visible cards.
 *
 * @param {object} leadCard
 * @param {{ hand: Array, table: Array }} opponent
 * @param {string} dragonSuit
 * @returns {boolean}
 */
function canLeadCardHold(leadCard, opponent, dragonSuit) {
  const replies = getLegalMoves(opponent, leadCard, dragonSuit);
  return replies.length === 0 ||
    replies.every(reply => compareCards(leadCard, reply.card, dragonSuit) > 0);
}

/**
 * Determine the dragon suit from the dealt state.
 * Dragon suit is determined by the first non-joker face card among:
 *   1. First player's table slot 0 face card
 *   2. Second player's table slot 0 face card
 *   3. First player's table slot 1 face card
 * Fallback: scan remaining first player face cards; if all jokers → '♠'
 *
 * @param {{ p1: {table: Array}, p2: {table: Array} }} dealState
 * @param {number} firstPlayer - 1 or 2
 * @returns {string}
 */
function determineDragonSuit(dealState, firstPlayer) {
  const fp = firstPlayer === 1 ? dealState.p1 : dealState.p2;
  const sp = firstPlayer === 1 ? dealState.p2 : dealState.p1;

  const candidates = [fp.table[0].face, sp.table[0].face, fp.table[1].face];
  for (const card of candidates) {
    if (card && !isJoker(card)) return card.suit;
  }

  // Fallback: scan remaining first-player face cards
  for (let i = 2; i < 10; i++) {
    if (fp.table[i].face && !isJoker(fp.table[i].face)) return fp.table[i].face.suit;
  }

  // All face cards are jokers (impossible with 54-card deck, but just in case)
  return '♠';
}

export {
  getAvailableCards,
  getLegalMoves,
  compareCards,
  compareRank,
  canSecondCardWin,
  canLeadCardHold,
  determineDragonSuit,
};
