// ═══════════════════════════════════════════════════════════════════
// card.js - Card types and utilities
// ═══════════════════════════════════════════════════════════════════

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLOR = { '♠': 'black', '♣': 'dark', '♥': 'pink', '♦': 'red' };
const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '小王', '大王'];
const TOTAL_ROUNDS = 27;
const TOTAL_POINTS = 100; // 4×5 + 4×10 + 4×K

/**
 * Create a card object.
 * @param {string} suit - '♠'|'♥'|'♦'|'♣'|''
 * @param {string} rank - '2'..'10'|'J'|'Q'|'K'|'A'|'小王'|'大王'
 * @returns {{ suit, rank, color }}
 */
function createCard(suit, rank) {
  const color =
    rank === '小王' ? 'joker-small'
    : rank === '大王' ? 'joker-big'
    : SUIT_COLOR[suit] || 'black';
  return { suit, rank, color };
}

/** Check if a card is a joker (小王 or 大王). */
function isJoker(card) {
  return card.rank === '小王' || card.rank === '大王';
}

/**
 * Get the score value of a card.
 * @returns {number} 0, 5, or 10
 */
function getCardScore(card) {
  if (isJoker(card)) return 0;
  if (card.rank === '5') return 5;
  if (card.rank === '10' || card.rank === 'K') return 10;
  return 0;
}

/**
 * Get the effective suit for comparison purposes.
 * Jokers always count as the dragon suit.
 * @param {object} card
 * @param {string} dragonSuit
 * @returns {string}
 */
function getEffectiveSuit(card, dragonSuit) {
  return isJoker(card) ? dragonSuit : card.suit;
}

/**
 * Check if a card is privileged (dragon suit or joker).
 * @param {object} card
 * @param {string} dragonSuit
 * @returns {boolean}
 */
function isPrivileged(card, dragonSuit) {
  return getEffectiveSuit(card, dragonSuit) === dragonSuit;
}

/**
 * Get numeric power for a card (used for comparison and AI).
 * Higher = stronger. Privileged cards get +100 offset.
 * @param {object} card
 * @param {string} dragonSuit
 * @returns {number}
 */
function getCardPower(card, dragonSuit) {
  return (isPrivileged(card, dragonSuit) ? 100 : 0) + RANK_ORDER.indexOf(card.rank);
}

/**
 * Convert a card to a short display label.
 * @param {object|null} card
 * @returns {string}
 */
function cardToLabel(card) {
  if (!card) return '—';
  if (isJoker(card)) return card.rank;
  return card.rank + card.suit;
}

export {
  SUITS,
  SUIT_COLOR,
  RANK_ORDER,
  TOTAL_ROUNDS,
  TOTAL_POINTS,
  createCard,
  isJoker,
  getCardScore,
  getEffectiveSuit,
  isPrivileged,
  getCardPower,
  cardToLabel,
};
