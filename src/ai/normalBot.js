// ═══════════════════════════════════════════════════════════════════
// normalBot.js - Improved bot with card counting & table-first
// ═══════════════════════════════════════════════════════════════════

import {
  getCardScore, getCardPower, isPrivileged, isJoker,
  RANK_ORDER, SUITS, TOTAL_ROUNDS,
} from '../game/card.js';
import { getLegalMoves, canSecondCardWin } from '../game/rules.js';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function chooseLowestPower(cards, dragonSuit) {
  let best = cards[0];
  let bestPower = getCardPower(best.card, dragonSuit);
  for (let i = 1; i < cards.length; i++) {
    const power = getCardPower(cards[i].card, dragonSuit);
    if (power < bestPower) { bestPower = power; best = cards[i]; }
  }
  return best;
}

function chooseHighestPower(cards, dragonSuit) {
  let best = cards[0];
  let bestPower = getCardPower(best.card, dragonSuit);
  for (let i = 1; i < cards.length; i++) {
    const power = getCardPower(cards[i].card, dragonSuit);
    if (power > bestPower) { bestPower = power; best = cards[i]; }
  }
  return best;
}

function chooseLowestScoreCard(cards, dragonSuit) {
  let best = cards[0];
  for (let i = 1; i < cards.length; i++) {
    const bestScore = getCardScore(best.card);
    const score = getCardScore(cards[i].card);
    const bestPower = getCardPower(best.card, dragonSuit);
    const power = getCardPower(cards[i].card, dragonSuit);
    if (score < bestScore || (score === bestScore && power < bestPower)) best = cards[i];
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────
// Card Counting - track all seen cards
// ─────────────────────────────────────────────────────────────────

/**
 * Count all seen cards from the bot's perspective.
 * "Seen" = face-up table cards (both players), played cards, and own hand.
 * @param {object} state
 * @param {'p1'|'p2'} botId
 * @returns {Set<string>} Set of "rank+suit" strings of seen cards
 */
function getSeenCardKeys(state, botId) {
  const seen = new Set();

  const addCard = (card) => {
    if (!card) return;
    seen.add(isJoker(card) ? card.rank : card.rank + card.suit);
  };

  // Bot's own hand
  state[botId].hand.forEach(addCard);

  // Face-up table cards for both players
  ['p1', 'p2'].forEach(pid => {
    state[pid].table.forEach(slot => {
      if (slot.face) addCard(slot.face);
    });
  });

  // Played cards from history
  state.history.forEach(h => {
    addCard(h.p1);
    addCard(h.p2);
  });

  return seen;
}

/**
 * Get remaining unknown cards (all 54 minus seen).
 * @returns {Array<{rank:string, suit:string}>}
 */
function getUnknownCards(seenKeys) {
  const allCards = [];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  for (const suit of SUITS) {
    for (const rank of ranks) {
      allCards.push({ rank, suit, key: rank + suit });
    }
  }
  allCards.push({ rank: '小王', suit: '', key: '小王' });
  allCards.push({ rank: '大王', suit: '', key: '大王' });
  return allCards.filter(c => !seenKeys.has(c.key));
}

/**
 * Count remaining score cards in unknown cards.
 */
function countRemainingScoreCards(unknownCards) {
  let count = 0;
  let totalPoints = 0;
  // We can't determine exact ownership, but we know the pool
  for (const c of unknownCards) {
    const score = getCardScore(c);
    if (score > 0) { count++; totalPoints += score; }
  }
  return { count, totalPoints };
}

/**
 * Estimate if opponent is void in a suit (has no cards of that suit remaining).
 * If all cards of a suit are accounted for in seen cards + bot's own hand,
 * the opponent must be void.
 */
function estimateOpponentVoid(state, botId, seenKeys) {
  const oppId = botId === 'p1' ? 'p2' : 'p1';
  const voidSuits = new Set();

  for (const suit of SUITS) {
    const allRanks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const suitCardsTotal = 13;
    let seenSuitCount = 0;

    // Count how many of this suit we've seen
    for (const rank of allRanks) {
      if (seenKeys.has(rank + suit)) seenSuitCount++;
    }

    // Count how many of this suit the bot itself has
    const botHandSuit = state[botId].hand.filter(c => c.suit === suit).length;
    const botTableSuit = state[botId].table.filter(s => s.face && s.face.suit === suit).length;
    const botDownSuit = state[botId].table.filter(s => s.down && s.down.suit === suit).length;
    const botTotalSuit = botHandSuit + botTableSuit + botDownSuit;

    const known = seenSuitCount + botTotalSuit;

    // If all 13 cards of this suit are accounted for, opponent has none
    if (known >= suitCardsTotal) {
      voidSuits.add(suit);
    }

    // Also check if opponent's face table cards show they're out
    const oppFaceCards = state[oppId].table
      .filter(s => s.face)
      .map(s => s.face.suit);
    const oppHasThisSuit = oppFaceCards.some(s => s === suit);
    if (!oppHasThisSuit) {
      // Opponent might still have it in hand or down cards
    }
  }

  return voidSuits;
}

// ─────────────────────────────────────────────────────────────────
// Preference: prefer face/source from table over hand
// ─────────────────────────────────────────────────────────────────

/**
 * Given a choice between equivalent cards, prefer playing from
 * table (face cards) to reveal down cards.
 */
function preferTableOverHand(a, b) {
  if (a.type === 'face' && b.type === 'hand') return -1;
  if (a.type === 'hand' && b.type === 'face') return 1;
  return 0;
}

// ─────────────────────────────────────────────────────────────────
// chooseCard
// ─────────────────────────────────────────────────────────────────

/**
 * Normal bot with improved strategy:
 *   - Card counting (tracks all seen cards)
 *   - Table-first: prefer playing face-up table cards
 *   - Strategic dumping: play low-value cards when opponent leads high
 *   - Endgame aggression: race for points in final rounds
 *   - Void detection: infer opponent's empty suits
 *   - No opponent hand peeking
 *
 * @param {object} state
 * @param {'p1'|'p2'} playerId
 * @param {object|null} leadCard
 * @returns {{ type: 'hand'|'face', index: number }|null}
 */
function normalChoose(state, playerId, leadCard) {
  const player = state[playerId];
  const dragonSuit = state.dragonSuit;
  const opponent = playerId === 'p1' ? state.p2 : state.p1;
  const playable = getLegalMoves(player, leadCard, dragonSuit);

  if (playable.length === 0) return null;

  // Compute game context
  const seenKeys = getSeenCardKeys(state, playerId);
  const unknown = getUnknownCards(seenKeys);
  const remainingScore = countRemainingScoreCards(unknown);
  const roundsLeft = TOTAL_ROUNDS - state.round + 1;
  const isEndgame = roundsLeft <= 5;

  if (leadCard) {
    return chooseFollowCard(state, playerId, leadCard, playable, {
      seenKeys, unknown, remainingScore, roundsLeft, isEndgame,
    });
  } else {
    return chooseLeadCard(state, playerId, playable, {
      seenKeys, unknown, remainingScore, roundsLeft, isEndgame,
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// Following Strategy
// ─────────────────────────────────────────────────────────────────

function chooseFollowCard(state, playerId, leadCard, playable, ctx) {
  const dragonSuit = state.dragonSuit;
  const { isEndgame, remainingScore } = ctx;

  const winners = playable.filter(a => canSecondCardWin(leadCard, a.card, dragonSuit));
  const losers = playable.filter(a => !canSecondCardWin(leadCard, a.card, dragonSuit));
  const scoreWinners = winners.filter(a => getCardScore(a.card) > 0);
  const leadHasScore = getCardScore(leadCard) > 0;

  // ═══ Endgame: aggressive score capture ═══
  if (isEndgame || remainScoreCritical(remainingScore, leadHasScore)) {
    if (leadHasScore && winners.length > 0) {
      // Must capture — play lowest winner (prefer face to reveal cards)
      const best = chooseLowestPower(
        scoreWinners.length > 0 ? scoreWinners : winners,
        dragonSuit
      );
      // If table and hand options exist, prefer table
      const tableWinners = winners.filter(w => w.type === 'face');
      return tableWinners.length > 0
        ? applyTablePreference(best, tableWinners, dragonSuit)
        : best;
    }
    if (scoreWinners.length > 0) {
      return chooseLowestScoreCard(scoreWinners, dragonSuit);
    }
    // Lead card is non-score: try to lose with lowest non-score
    const nonScoreLosers = losers.filter(a => getCardScore(a.card) === 0);
    if (nonScoreLosers.length > 0) {
      return applyTablePreference(
        chooseHighestPower(nonScoreLosers, dragonSuit),
        nonScoreLosers,
        dragonSuit
      );
    }
    // Must lose with a score card — play lowest score card
    return chooseLowestScoreCard(losers.length > 0 ? losers : playable, dragonSuit);
  }

  // ═══ Normal play ═══
  // Lead card has points: try to capture if possible
  if (leadHasScore && winners.length > 0) {
    const best = scoreWinners.length > 0
      ? chooseLowestScoreCard(scoreWinners, dragonSuit)
      : chooseLowestPower(winners, dragonSuit);
    return applyTablePreference(best, winners, dragonSuit);
  }

  // Can win and it's with a score card: go for it
  if (scoreWinners.length > 0) {
    return chooseLowestScoreCard(scoreWinners, dragonSuit);
  }

  // Lead card is non-score and we can't win with score:
  // dump lowest non-score loser, prefer table cards
  const nonScoreLosers = losers.filter(a => getCardScore(a.card) === 0);
  if (nonScoreLosers.length > 0) {
    // Prefer playing higher-ranked losers over lower to save weak cards for later
    return applyTablePreference(
      chooseHighestPower(nonScoreLosers, dragonSuit),
      nonScoreLosers,
      dragonSuit
    );
  }

  // Default: play lowest losing card
  const def = losers.length > 0
    ? chooseLowestPower(losers, dragonSuit)
    : chooseLowestPower(playable, dragonSuit);
  return applyTablePreference(def, playable, dragonSuit);
}

// ─────────────────────────────────────────────────────────────────
// Leading Strategy
// ─────────────────────────────────────────────────────────────────

function chooseLeadCard(state, playerId, playable, ctx) {
  const dragonSuit = state.dragonSuit;
  const { isEndgame, remainingScore } = ctx;

  const opponent = playerId === 'p1' ? state.p2 : state.p1;
  const privileged = playable.filter(a => isPrivileged(a.card, dragonSuit));
  const scoreCards = playable.filter(a => getCardScore(a.card) > 0);

  // ═══ Endgame: maximize score ═══
  if (isEndgame) {
    // Lead with privileged score cards to safely gain points
    const privScore = privileged.filter(a => getCardScore(a.card) > 0);
    if (privScore.length > 0) {
      return chooseLowestScoreCard(privScore, dragonSuit);
    }
    // If no privileged score, lead with lowest privileged to get follow-suit advantage
    if (privileged.length > 0) {
      return chooseLowestPower(privileged, dragonSuit);
    }
    // Desperate: lead lowest score card
    if (scoreCards.length > 0) {
      return chooseLowestScoreCard(scoreCards, dragonSuit);
    }
    // Just play lowest
    return chooseLowestPower(playable, dragonSuit);
  }

  // ═══ Normal play ═══
  // Lead with privileged score cards (safe — opponent must follow suit or can't win)
  const privScore = privileged.filter(a => getCardScore(a.card) > 0);
  if (privScore.length > 0) {
    return chooseLowestScoreCard(privScore, dragonSuit);
  }

  // If all playable cards are score cards, play smallest (no choice)
  if (scoreCards.length > 0 && scoreCards.length === playable.length) {
    return chooseLowestScoreCard(playable, dragonSuit);
  }

  // Lead lowest privileged non-score (to bait opponent or set up control)
  const privNonScore = privileged.filter(a => getCardScore(a.card) === 0);
  if (privNonScore.length > 0) {
    return chooseLowestPower(privNonScore, dragonSuit);
  }

  // Lead lowest non-score, non-privileged card (dump weak cards)
  const nonScoreNonPriv = playable.filter(
    a => getCardScore(a.card) === 0 && !isPrivileged(a.card, dragonSuit)
  );
  if (nonScoreNonPriv.length > 0) {
    return applyTablePreference(
      chooseLowestPower(nonScoreNonPriv, dragonSuit),
      nonScoreNonPriv,
      dragonSuit
    );
  }

  // Fallback: lowest non-score, prefer table
  const nonScore = playable.filter(a => getCardScore(a.card) === 0);
  const chosen = nonScore.length > 0
    ? chooseLowestPower(nonScore, dragonSuit)
    : chooseLowestPower(playable, dragonSuit);
  return applyTablePreference(chosen, playable, dragonSuit);
}

// ─────────────────────────────────────────────────────────────────
// Utility: remainScoreCritical — check if remaining score is high
// ─────────────────────────────────────────────────────────────────

function remainScoreCritical(remainingScore, leadHasScore) {
  // If there are still many points unaccounted for, play more aggressively
  return remainingScore.totalPoints >= 40; // 40% of total 100 points still in play
}

// ─────────────────────────────────────────────────────────────────
// Table preference: if we have a choice, prefer table face cards
// to reveal down cards
// ─────────────────────────────────────────────────────────────────

/**
 * If there's a table-card option among the alternatives that's equivalent
 * in power/score, prefer it. Otherwise stick with the chosen card.
 */
function applyTablePreference(chosen, alternatives, dragonSuit) {
  if (chosen.type === 'face') return chosen; // already from table

  // Check if there's a face-up table card roughly equivalent to what we chose
  const powerChosen = getCardPower(chosen.card, dragonSuit);
  const tableCards = alternatives.filter(a => a.type === 'face');

  if (tableCards.length === 0) return chosen;

  // Prefer table cards that are close in power (±3 range) or lower power
  for (const tc of tableCards) {
    const powerTC = getCardPower(tc.card, dragonSuit);
    if (Math.abs(powerTC - powerChosen) <= 3) {
      return tc;
    }
  }

  // If no close match, just return the original choice
  return chosen;
}

export { normalChoose };
