// ═══════════════════════════════════════════════════════════════════
// V4.js — 混合策略：V3 搜索先手 + V4 启发式后手
// ═══════════════════════════════════════════════════════════════════
//
// 核心发现：
//   - V3 search 在先手时比 V4 启发式强
//   - V4 启发式在后手时比 V3 search 强
//   - 结合两者 = 最佳策略
// ═══════════════════════════════════════════════════════════════════

import { V3Choose } from './V3-search.js';
import {
  getCardScore, getCardPower, isPrivileged, isJoker,
  getEffectiveSuit, TOTAL_ROUNDS,
} from '../game/card.js';
import { getLegalMoves, canSecondCardWin } from '../game/rules.js';

// ── 后手策略（启发式，比 V3 search 更强）──
function followChoose(state, playerId, leadCard) {
  const player = state[playerId];
  const { dragonSuit } = state;

  const playable = [
    ...player.hand.map((c, i) => ({ type: 'hand', index: i, card: c })),
    ...player.table
      .map((s, i) => s.face ? { type: 'face', index: i, card: s.face } : null)
      .filter(Boolean),
  ];

  if (playable.length === 0) return null;

  // 能赢的牌
  const winners = playable.filter(a => canSecondCardWin(leadCard, a.card, dragonSuit));

  if (winners.length > 0) {
    // 先手是分数牌 → 出最小的能赢的牌
    if (getCardScore(leadCard) > 0) {
      // 优先出分数牌中的赢家（用分数牌赢分数牌，但出最小的）
      const scoreWinners = winners.filter(a => getCardScore(a.card) > 0);
      if (scoreWinners.length > 0) {
        scoreWinners.sort((a, b) => getCardPower(a.card, dragonSuit) - getCardPower(b.card, dragonSuit));
        return scoreWinners[0];
      }
      // 没有分数牌赢家，出最小的赢家
      winners.sort((a, b) => getCardPower(a.card, dragonSuit) - getCardPower(b.card, dragonSuit));
      return winners[0];
    }

    // 先手不是分数牌 → 出最小的能赢的牌（节省大牌）
    winners.sort((a, b) => getCardPower(a.card, dragonSuit) - getCardPower(b.card, dragonSuit));
    return winners[0];
  }

  // 不能赢：出最小的非分数牌（弃牌保分）
  const nonScore = playable.filter(a => getCardScore(a.card) === 0);
  if (nonScore.length > 0) {
    nonScore.sort((a, b) => getCardPower(a.card, dragonSuit) - getCardPower(b.card, dragonSuit));
    return nonScore[0];
  }
  // 只剩分数牌，出最小的
  playable.sort((a, b) => getCardPower(a.card, dragonSuit) - getCardPower(b.card, dragonSuit));
  return playable[0];
}

// ── V4 主入口：先手用 V3 search，后手用启发式 ──
function V4Choose(state, playerId, leadCard) {
  if (!leadCard) {
    // 先手：用 V3 的搜索（更强）
    return V3Choose(state, playerId, leadCard);
  } else {
    // 后手：用启发式（更强）
    return followChoose(state, playerId, leadCard);
  }
}

export { V4Choose };
