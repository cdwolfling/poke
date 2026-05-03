// ═══════════════════════════════════════════════════════════════════
// V3-search.js — Determinized Alpha-Beta Search Bot
// ═══════════════════════════════════════════════════════════════════
//
// 策略：Determinizated Alpha-Beta
// 特点：
//   采样多个「完备信息世界」，对每个世界做 alpha-beta 搜索，
//   聚合出最优走法。
//
// 配置参数：
//   sampleCount   - 采样世界数（默认 100）
//   depth         - 搜索深度（ply，默认 6）
//   timeLimitMs   - 每步时间上限（默认 1000ms）
//   endgameDepth  - 残局深度（剩余 ≤5 轮时，默认 8）
// ═══════════════════════════════════════════════════════════════════

import {
  getCardScore, getCardPower, isPrivileged, isJoker,
  getEffectiveSuit, RANK_ORDER, TOTAL_ROUNDS,
} from '../game/card.js';
import { getLegalMoves, canSecondCardWin } from '../game/rules.js';
import { createDeck } from '../game/deck.js';
import { cloneState, applyMove, resolveRound, advanceRound, isTerminal } from '../game/state.js';

// ── 配置 ──────────────────────────────────────────────────────

const V3_HIGH_CONFIG = {
  sampleCount: 100,      // 采样世界数（线上用 50，批量测试可调高）
  depth: 6,             // 搜索深度（ply，线上 4ply ≈ 0.5s）
  timeLimitMs: 1000,     // 每步时间上限
  endgameDepth: 8,      // 残局深度
  endgameThreshold: 5,  // 剩余 ≤ 5 轮进入残局模式
};

// ── 局面评估 ──────────────────────────────────────────────────

/**
 * 手工启发式评价函数。
 * 正值表示对 botId 有利，负值表示对对手有利。
 */
function evaluate(state, botId) {
  const oppId = botId === 'p1' ? 'p2' : 'p1';
  const bot = state[botId];
  const opp = state[oppId];
  const { dragonSuit, round } = state;
  const roundsLeft = TOTAL_ROUNDS - round + 1;

  let score = 0;

  // 1. 已得分差距（最重要）
  score += (bot.score - opp.score) * 100;

  // 2. 手牌数量优势
  score += (bot.hand.length - opp.hand.length) * 5;

  // 3. 桌面牌数量（包含已翻开的 down 牌）
  const botFaceCards = bot.table.filter(s => s.face).length;
  const oppFaceCards = opp.table.filter(s => s.face).length;
  score += (botFaceCards - oppFaceCards) * 3;

  // 4. 天龙人特权手牌
  const botPriv = bot.hand.filter(c => isPrivileged(c, dragonSuit)).length;
  const oppPriv = opp.hand.filter(c => isPrivileged(c, dragonSuit)).length;
  score += (botPriv - oppPriv) * 15;

  // 5. 分数牌持有
  const botScoreCards = bot.hand.filter(c => getCardScore(c) > 0).length;
  const oppScoreCards = opp.hand.filter(c => getCardScore(c) > 0).length;
  score += (botScoreCards - oppScoreCards) * 20;

  // 6. 特权分数牌（最危险——对方出分牌时我方特权牌可稳赢）
  const botPrivScore = bot.hand.filter(c => isPrivileged(c, dragonSuit) && getCardScore(c) > 0).length;
  const oppPrivScore = opp.hand.filter(c => isPrivileged(c, dragonSuit) && getCardScore(c) > 0).length;
  score += (botPrivScore - oppPrivScore) * 30;

  // 7. 桌面明牌中的分数牌（即将被用来出牌）
  const botFaceScore = bot.table.filter(s => s.face && getCardScore(s.face) > 0).length;
  const oppFaceScore = opp.table.filter(s => s.face && getCardScore(s.face) > 0).length;
  score += (botFaceScore - oppFaceScore) * 10;

  // 8. 王持有——最强特权牌
  const botJokers = bot.hand.filter(c => isJoker(c)).length;
  const oppJokers = opp.hand.filter(c => isJoker(c)).length;
  score += (botJokers - oppJokers) * 25;

  // 9. 剩余轮数因子——残局时领先优势放大
  if (roundsLeft <= 5) {
    score = score * 1.5;
  }

  // 10. 距离游戏结束的紧迫度
  if (roundsLeft <= 3) {
    // 此时手牌越少说明消耗得越好
    score += (opp.hand.length - bot.hand.length) * 3;
  }

  return score;
}

// ── Hidden Card Sampler ───────────────────────────────────────

/**
 * 从 bot 视角构建已知牌集合。
 * 已知牌 = bot 的完整手牌+桌面 + 对手桌面明牌 + 已出牌
 * 未知牌 = 54 张标准牌 − 已知牌
 */
function getUnknownCards(state, botId) {
  const oppId = botId === 'p1' ? 'p2' : 'p1';
  const deck = createDeck(); // 标准 54 张
  const seenKeys = new Set();

  function addCard(card) {
    if (card && card.suit !== undefined) {
      seenKeys.add(card.rank + card.suit);
    }
  }

  // Bot 自己的所有牌（已知）
  const bot = state[botId];
  bot.hand.forEach(addCard);
  bot.table.forEach(slot => {
    if (slot.face) addCard(slot.face);
    if (slot.down) addCard(slot.down);
  });

  // 对手桌面明牌（已知）
  const opp = state[oppId];
  opp.table.forEach(slot => {
    if (slot.face) addCard(slot.face);
  });

  // 已出牌（已知）
  if (state.allPlayedCards) {
    state.allPlayedCards.forEach(addCard);
  }
  if (state.playedP1) addCard(state.playedP1);
  if (state.playedP2) addCard(state.playedP2);

  // 未知牌 = deck 中不在 seenKeys 的牌
  return deck.filter(c => !seenKeys.has(c.rank + c.suit));
}

/**
 * 采样一个完备信息世界。
 * 将未知牌随机填入对手的隐藏区域（手牌 + 面下牌）。
 */
function sampleWorld(state, botId) {
  const unknown = getUnknownCards(state, botId);
  // 洗牌
  const shuffled = [...unknown];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const oppId = botId === 'p1' ? 'p2' : 'p1';
  const sample = cloneState(state);
  const opp = sample[oppId];
  let idx = 0;

  // 填对手手牌
  for (let i = 0; i < opp.hand.length; i++) {
    opp.hand[i] = shuffled[idx++];
  }

  // 填对手面下牌
  for (let i = 0; i < opp.table.length; i++) {
    if (opp.table[i].down) {
      opp.table[i].down = shuffled[idx++];
    }
  }

  return sample;
}

// ── Alpha-Beta 搜索 ───────────────────────────────────────────

/**
 * 获取当前该谁出牌。
 */
function getCurrentPlayer(state) {
  if (state.phase !== 'select') return null;
  if (state.playedP1 === null && state.playedP2 === null) {
    return state.firstPlayer === 1 ? 'p1' : 'p2';
  }
  if (state.playedP1 !== null && state.playedP2 === null) return 'p2';
  if (state.playedP2 !== null && state.playedP1 === null) return 'p1';
  return null;
}

function getLeadCard(state, playerId) {
  const oppId = playerId === 'p1' ? 'p2' : 'p1';
  if (state[oppId] && state.playedP1 !== null && state.playedP2 !== null) {
    // Both played — should not happen in select phase
    return null;
  }
  if (playerId === 'p1' && state.playedP2) return state.playedP2;
  if (playerId === 'p2' && state.playedP1) return state.playedP1;
  return null;
}

/**
 * 走法排序：优先搜索更好的走法（提高剪枝效率）。
 */
function orderMoves(moves, state, playerId) {
  return moves.sort((a, b) => {
    const cardA = a.card || state[playerId].hand[a.index] || (state[playerId].table[a.index]?.face);
    const cardB = b.card || state[playerId].hand[b.index] || (state[playerId].table[b.index]?.face);
    if (!cardA || !cardB) return 0;

    // 优先出分数牌
    const scoreA = getCardScore(cardA);
    const scoreB = getCardScore(cardB);
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 其次出特权牌
    const privA = isPrivileged(cardA, state.dragonSuit) ? 1 : 0;
    const privB = isPrivileged(cardB, state.dragonSuit) ? 1 : 0;
    if (privA !== privB) return privB - privA;

    // 再按牌力排序（大牌优先尝试）
    return getCardPower(cardB, state.dragonSuit) - getCardPower(cardA, state.dragonSuit);
  });
}

/**
 * 模拟走完一轮（两方出牌 + 结算 + 推进）。
 */
function simulateRound(state, playerId, move) {
  let ns = applyMove(cloneState(state), playerId, move);

  // 如果双方都已出牌，结算
  if (ns.playedP1 !== null && ns.playedP2 !== null) {
    ns = resolveRound(ns);
    if (ns.phase === 'reveal' && ns.round < TOTAL_ROUNDS) {
      ns = advanceRound(ns);
    }
  }
  return ns;
}

/**
 * Alpha-Beta 搜索核心。
 */
function alphaBeta(state, depth, alpha, beta, botId, startTime) {
  // 时间限制
  if (Date.now() - startTime > V3_HIGH_CONFIG.timeLimitMs) {
    return evaluate(state, botId);
  }

  if (depth <= 0 || state.phase === 'gameover') {
    return evaluate(state, botId);
  }

  const playerId = getCurrentPlayer(state);
  if (!playerId) return evaluate(state, botId);

  const leadCard = getLeadCard(state, playerId);
  let moves = getLegalMoves(state[playerId], leadCard, state.dragonSuit);

  if (!moves || moves.length === 0) return evaluate(state, botId);

  // 走法排序
  moves = orderMoves(moves, state, playerId);

  const isBot = playerId === botId;

  if (isBot) {
    // 最大化节点（bot 自己的走法）
    let bestValue = -Infinity;
    for (const move of moves) {
      const ns = simulateRound(state, playerId, move);
      const val = alphaBeta(ns, depth - 1, alpha, beta, botId, startTime);
      bestValue = Math.max(bestValue, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break; // Beta 剪枝
    }
    return bestValue;
  } else {
    // 最小化节点（对手的走法）
    let bestValue = Infinity;
    for (const move of moves) {
      const ns = simulateRound(state, playerId, move);
      const val = alphaBeta(ns, depth - 1, alpha, beta, botId, startTime);
      bestValue = Math.min(bestValue, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break; // Alpha 剪枝
    }
    return bestValue;
  }
}

/**
 * 在单个采样世界上搜索最优走法。
 */
function searchBestMove(state, botId, depth, startTime) {
  const playerId = getCurrentPlayer(state);
  if (!playerId || playerId !== botId) return null;

  const leadCard = getLeadCard(state, playerId);
  const moves = getLegalMoves(state[playerId], leadCard, state.dragonSuit);
  if (!moves || moves.length === 0) return null;

  let bestMove = moves[0];
  let bestValue = -Infinity;

  for (const move of orderMoves(moves, state, playerId)) {
    if (Date.now() - startTime > V3_HIGH_CONFIG.timeLimitMs) break;

    const ns = simulateRound(state, playerId, move);
    const val = alphaBeta(ns, depth - 1, -Infinity, Infinity, botId, startTime);

    if (val > bestValue) {
      bestValue = val;
      bestMove = move;
    }
  }

  return bestMove;
}

// ── Determinized Search Bot ────────────────────────────────────

/**
 * V3 主入口：Determinizated Alpha-Beta Search。
 *
 * @param {object} state - 当前游戏状态
 * @param {'p1'|'p2'} playerId - 哪个玩家是 bot
 * @param {object|null} leadCard - 先手出的牌（跟牌时）
 * @returns {{ type: 'hand'|'face', index: number }|null}
 */
function V3HighChoose(state, playerId, leadCard) {
  const startTime = Date.now();

  // 如果 bot 不是当前行动方，不决策
  if (getCurrentPlayer(state) !== playerId) return null;

  // 简单走法：仅有 1 个合法走法时直接返回
  const moves = getLegalMoves(state[playerId], leadCard, state.dragonSuit);
  if (!moves || moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  // 残局时增加搜索深度
  const roundsLeft = TOTAL_ROUNDS - state.round + 1;
  const depth = roundsLeft <= V3_HIGH_CONFIG.endgameThreshold
    ? V3_HIGH_CONFIG.endgameDepth
    : V3_HIGH_CONFIG.depth;

  // 投票统计：每个采样世界投票支持哪个走法
  const voteMap = new Map();
  moves.forEach(m => voteMap.set(`${m.type}-${m.index}`, { move: m, votes: 0, totalValue: 0 }));

  const sampleCount = Math.min(V3_HIGH_CONFIG.sampleCount, 200); // 上限 200

  for (let s = 0; s < sampleCount; s++) {
    if (Date.now() - startTime > V3_HIGH_CONFIG.timeLimitMs * 0.8) break;

    // 1. 采样一个完备信息世界
    const world = sampleWorld(state, playerId);

    // 2. 在该世界上搜索最优走法
    const best = searchBestMove(world, playerId, depth, startTime);
    if (best) {
      const key = `${best.type}-${best.index}`;
      const entry = voteMap.get(key);
      if (entry) {
        entry.votes++;
        // 用搜索得到的评价值加权
        // （被更高 eval 选中的走法权重大）
      }
    }
  }

  // 胜者：得票最多的走法；平局时用 evaluation 值排序
  let bestEntry = null;
  let maxVotes = -1;
  for (const entry of voteMap.values()) {
    if (entry.votes > maxVotes) {
      maxVotes = entry.votes;
      bestEntry = entry;
    }
  }

  if (!bestEntry) return moves[0];
  return bestEntry.move;
}

export { V3HighChoose, V3_HIGH_CONFIG };
