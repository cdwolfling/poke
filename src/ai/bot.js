// ═══════════════════════════════════════════════════════════════════
// bot.js - Bot factory
// ═══════════════════════════════════════════════════════════════════

import { easyChoose } from './easyBot.js';
import { normalChoose } from './normalBot.js';
import { V3Choose } from './V3-search.js';
import { V3HighChoose } from './V3-high.js';
import { V4Choose } from './V4.js';

const BOT_STRATEGIES = {
  V1: easyChoose,
  V2: normalChoose,
  V3: V3Choose,
  'V3-high': V3HighChoose,
  V4: V4Choose,
};

/**
 * Factory: get a bot move for the given strategy.
 *
 * @param {'V1'|'V2'|'V3'} strategyName
 * @param {object} state - Full game state
 * @param {'p1'|'p2'} playerId - Which player this bot controls
 * @param {object|null} leadCard - Card that was led, or null if bot is leading
 * @returns {{ type: 'hand'|'face', index: number }|null}
 */
function getBotMove(strategyName, state, playerId, leadCard) {
  const fn = BOT_STRATEGIES[strategyName];
  if (!fn) {
    console.warn(`Unknown strategy "${strategyName}", falling back to "easy"`);
    return BOT_STRATEGIES.easy(state, playerId, leadCard);
  }
  return fn(state, playerId, leadCard);
}

export { getBotMove, BOT_STRATEGIES };
