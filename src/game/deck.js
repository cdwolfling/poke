// ═══════════════════════════════════════════════════════════════════
// deck.js - Deck creation, shuffle, dealing
// ═══════════════════════════════════════════════════════════════════

import { SUITS, SUIT_COLOR } from './card.js';

/**
 * Create a standard 54-card deck:
 * 4 suits × 13 ranks (2..A) + 小王 + 大王
 * @returns {Array<{suit, rank, color}>}
 */
function createDeck() {
  const deck = [];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ suit, rank, color: SUIT_COLOR[suit] });
    }
  }
  deck.push({ suit: '', rank: '小王', color: 'joker-small' });
  deck.push({ suit: '', rank: '大王', color: 'joker-big' });
  return deck;
}

/**
 * Fisher-Yates shuffle (returns new array).
 * @param {Array} deck
 * @returns {Array}
 */
function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/**
 * Deal cards to two players.
 *
 * Each player gets:
 *   - 10 down cards (face-down on table)
 *   - 10 face cards (face-up covering the down cards)
 *   - 7 hand cards
 *
 * Cards are dealt alternating between p1 and p2.
 *
 * @param {Array} [deck] - Optional pre-built deck; if omitted creates+shuffles one
 * @returns {{ p1: {table: Array, hand: Array}, p2: {table: Array, hand: Array} }}
 */
function dealCards(deck) {
  const d = deck ? shuffleDeck(deck) : shuffleDeck(createDeck());

  const p1 = { table: [], hand: [] };
  const p2 = { table: [], hand: [] };

  // Initialize 10 empty table slots per player
  for (let i = 0; i < 10; i++) {
    p1.table.push({ down: null, face: null });
    p2.table.push({ down: null, face: null });
  }

  let ci = 0;

  // Phase 1: 10 down cards each (alternating)
  for (let i = 0; i < 10; i++) {
    p1.table[i].down = d[ci++];
    p2.table[i].down = d[ci++];
  }

  // Phase 2: 10 face cards each (alternating)
  for (let i = 0; i < 10; i++) {
    p1.table[i].face = d[ci++];
    p2.table[i].face = d[ci++];
  }

  // Phase 3: 7 hand cards each (alternating)
  for (let i = 0; i < 7; i++) {
    p1.hand.push(d[ci++]);
    p2.hand.push(d[ci++]);
  }

  return { p1, p2 };
}

export { createDeck, shuffleDeck, dealCards };
