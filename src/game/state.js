// ═══════════════════════════════════════════════════════════════════
// state.js - Pure state management (no mutations)
// ═══════════════════════════════════════════════════════════════════

import { createDeck, shuffleDeck, dealCards } from './deck.js';
import { getCardScore, RANK_ORDER, TOTAL_ROUNDS, isJoker } from './card.js';
import { compareCards, determineDragonSuit, getAvailableCards } from './rules.js';

/**
 * Move type: { type: 'hand'|'face', index: number }
 *   - hand: play from hand cards
 *   - face: play from table face-up cards
 */

// ─────────────────────────────────────────────────────────────────
// createState
// ─────────────────────────────────────────────────────────────────

/**
 * Create a fresh game state.
 * Deals cards, determines dragon suit, sets round 1.
 *
 * @param {{ p1: string, p2: string }} [strategies] - AI strategies ('V1'|'V2')
 * @returns {object} Complete game state
 */
function createState(strategies = { p1: 'V1', p2: 'V2' }) {
  const deck = shuffleDeck(createDeck());
  const deal = dealCards(deck);
  const dragonSuit = determineDragonSuit(deal, 1);

  return {
    round: 1,
    phase: 'select',           // 'select' | 'reveal' | 'gameover'
    firstPlayer: 1,            // 1 or 2 — who leads this round
    p1: {
      hand: [...deal.p1.hand],
      table: deal.p1.table.map(s => ({ down: s.down ? { ...s.down } : null, face: s.face ? { ...s.face } : null })),
      score: 0,
      scoreCards: [],
    },
    p2: {
      hand: [...deal.p2.hand],
      table: deal.p2.table.map(s => ({ down: s.down ? { ...s.down } : null, face: s.face ? { ...s.face } : null })),
      score: 0,
      scoreCards: [],
    },
    dragonSuit,
    playedP1: null,            // Card object played by p1 this round
    playedP2: null,            // Card object played by p2 this round
    playedP1Source: null,      // Move | null
    playedP2Source: null,      // Move | null
    roundResult: null,         // 'p1' | 'p2' | 'tie' | null
    roundScore: 0,             // Points at stake this round
    history: [],               // Last 3 rounds [{ round, p1: Card, p2: Card, winner, points }]
    selectedSource: null,      // Currently selected card in UI (Move | null)
    strategies: { ...strategies },
  };
}

// ─────────────────────────────────────────────────────────────────
// cloneState
// ─────────────────────────────────────────────────────────────────

/**
 * Deep-clone a state object.
 * @param {object} state
 * @returns {object}
 */
function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

// ─────────────────────────────────────────────────────────────────
// applyMove
// ─────────────────────────────────────────────────────────────────

/**
 * Apply a single move for a player: play a card from hand or table face.
 * Returns a NEW state (immutable).
 *
 * @param {object} state
 * @param {'p1'|'p2'} playerId
 * @param {{ type: 'hand'|'face', index: number }} move
 * @returns {object} new state
 */
function applyMove(state, playerId, move) {
  const ns = cloneState(state);
  const player = ns[playerId];
  let card;

  if (move.type === 'hand') {
    card = player.hand.splice(move.index, 1)[0];
    if (!card) return ns; // safety
  } else {
    // Face card from table
    const slot = player.table[move.index];
    if (!slot || !slot.face) return ns; // safety
    card = slot.face;
    slot.face = null;
  }

  if (playerId === 'p1') {
    ns.playedP1 = card;
    ns.playedP1Source = { type: move.type, index: move.index };
  } else {
    ns.playedP2 = card;
    ns.playedP2Source = { type: move.type, index: move.index };
  }

  ns.selectedSource = null;
  return ns;
}

// ─────────────────────────────────────────────────────────────────
// resolveRound
// ─────────────────────────────────────────────────────────────────

/**
 * Resolve the current round after both players have played.
 * Determines winner, assigns scores, updates history.
 * Sets phase → 'reveal'.
 *
 * @param {object} state
 * @returns {object} new state
 */
function resolveRound(state) {
  const ns = cloneState(state);

  if (!ns.playedP1 || !ns.playedP2) return ns; // not ready

  const firstIsP1 = ns.firstPlayer === 1;
  const firstCard = firstIsP1 ? ns.playedP1 : ns.playedP2;
  const secondCard = firstIsP1 ? ns.playedP2 : ns.playedP1;

  const cmp = compareCards(firstCard, secondCard, ns.dragonSuit);

  let winner;
  if (cmp > 0) {
    winner = ns.firstPlayer;        // first card wins → first player wins
  } else if (cmp < 0) {
    winner = ns.firstPlayer === 1 ? 2 : 1;  // second card wins → other player
  } else {
    winner = 0;                     // tie
  }

  const roundScore = getCardScore(ns.playedP1) + getCardScore(ns.playedP2);
  ns.roundScore = roundScore;
  ns.roundResult = winner === 1 ? 'p1' : winner === 2 ? 'p2' : 'tie';

  // All score cards from both players go to the winner
  const wonScoreCards = [ns.playedP1, ns.playedP2].filter(c => getCardScore(c) > 0);

  if (winner === 1) {
    ns.p1.score += roundScore;
    ns.p1.scoreCards.push(...wonScoreCards);
    ns.firstPlayer = 1;
  } else if (winner === 2) {
    ns.p2.score += roundScore;
    ns.p2.scoreCards.push(...wonScoreCards);
    ns.firstPlayer = 2;
  }
  // tie: firstPlayer stays unchanged

  // Add to history (keep last 3)
  ns.history.push({
    round: ns.round,
    p1: { ...ns.playedP1 },
    p2: { ...ns.playedP2 },
    winner: ns.roundResult,
    points: roundScore,
  });
  if (ns.history.length > 3) ns.history.shift();

  ns.phase = 'reveal';
  return ns;
}

// ─────────────────────────────────────────────────────────────────
// advanceRound
// ─────────────────────────────────────────────────────────────────

/**
 * Advance to the next round after a reveal.
 * Flips down cards for played face slots, resets round state,
 * increments round, sets phase → 'select' (or 'gameover' if terminal).
 *
 * @param {object} state
 * @returns {object} new state
 */
function advanceRound(state) {
  const ns = cloneState(state);
  if (ns.phase !== 'reveal') return ns;

  // If a face card was played, reveal the down card under it
  if (ns.playedP1Source && ns.playedP1Source.type === 'face') {
    const idx = ns.playedP1Source.index;
    if (ns.p1.table[idx] && ns.p1.table[idx].down) {
      ns.p1.table[idx].face = ns.p1.table[idx].down;
      ns.p1.table[idx].down = null;
    }
  }
  if (ns.playedP2Source && ns.playedP2Source.type === 'face') {
    const idx = ns.playedP2Source.index;
    if (ns.p2.table[idx] && ns.p2.table[idx].down) {
      ns.p2.table[idx].face = ns.p2.table[idx].down;
      ns.p2.table[idx].down = null;
    }
  }

  // If hand is empty, flip all remaining down cards to face-up
  for (const pid of ['p1', 'p2']) {
    if (ns[pid].hand.length === 0) {
      for (const slot of ns[pid].table) {
        if (slot.down && !slot.face) {
          slot.face = slot.down;
          slot.down = null;
        }
      }
    }
  }

  // Clear round-specific fields
  ns.playedP1 = null;
  ns.playedP2 = null;
  ns.playedP1Source = null;
  ns.playedP2Source = null;
  ns.roundResult = null;
  ns.roundScore = 0;

  // Check game over
  if (ns.round >= TOTAL_ROUNDS) {
    ns.phase = 'gameover';
    return ns;
  }

  ns.round++;
  ns.phase = 'select';
  return ns;
}

// ─────────────────────────────────────────────────────────────────
// Terminal / Winner checks
// ─────────────────────────────────────────────────────────────────

/**
 * Check if the game has ended.
 * @param {object} state
 * @returns {boolean}
 */
function isTerminal(state) {
  if (state.phase === 'gameover') return true;
  if (state.round > TOTAL_ROUNDS) return true;
  // 一方无牌可出时游戏提前结束（getAvailableCards 含手牌+桌面明牌）
  return getAvailableCards(state.p1).length === 0 || getAvailableCards(state.p2).length === 0;
}

/**
 * Get the winner of a completed game.
 * @param {object} state
 * @returns {number|null} 1 = p1 wins, 2 = p2 wins, 0 = tie, null = game not over
 */
function getWinner(state) {
  if (!isTerminal(state)) return null;
  if (state.p1.score > state.p2.score) return 1;
  if (state.p2.score > state.p1.score) return 2;
  return 0;
}

export {
  createState,
  cloneState,
  applyMove,
  resolveRound,
  advanceRound,
  isTerminal,
  getWinner,
};
