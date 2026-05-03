// ═══════════════════════════════════════════════════════════════════
// report.js - Format tournament results as readable string
// ═══════════════════════════════════════════════════════════════════

/**
 * Format tournament stats as a human-readable report string.
 *
 * @param {Array<object>} stats - Output from runTournament()
 * @returns {string} Formatted report
 */
function formatReport(stats) {
  const lines = [];
  const separator = '═'.repeat(68);
  const divider = '─'.repeat(68);

  lines.push(separator);
  lines.push('  扑克牌对战 · AI 策略测试报告');
  lines.push(separator);

  for (const s of stats) {
    lines.push('');
    lines.push(`  📊 ${s.label}`);
    lines.push(divider);
    lines.push(`  总局数:       ${s.games}`);
    lines.push(`  玩家1 (${s.strategy1}):  ${s.p1Wins} 胜 (${s.winRateP1.toFixed(1)}%)`);
    lines.push(`  玩家2 (${s.strategy2}):  ${s.p2Wins} 胜 (${s.winRateP2.toFixed(1)}%)`);
    lines.push(`  平局:         ${s.ties} (${s.tieRate.toFixed(1)}%)`);
    lines.push('');
    lines.push(`  平均得分:     玩家1 ${s.avgScore1.toFixed(1)} vs 玩家2 ${s.avgScore2.toFixed(1)}`);
    lines.push(`  总分:         玩家1 ${s.totalScore1} vs 玩家2 ${s.totalScore2}`);
    lines.push('');
    lines.push(`  场均回合数:   ${s.avgRounds.toFixed(1)}`);
    lines.push(`  场均单局胜:   玩家1 ${s.avgRoundWinsP1.toFixed(1)} / 玩家2 ${s.avgRoundWinsP2.toFixed(1)} / 平 ${s.avgRoundTies.toFixed(1)}`);
  }

  lines.push('');
  lines.push(separator);

  return lines.join('\n');
}

/**
 * Format a single match result as a short summary string.
 * @param {object} result - Output from runMatch()
 * @returns {string}
 */
function formatSingleResult(result) {
  if (result.winner === null) return '比赛未完成';

  const winnerLabel = result.winner === 0
    ? '🤝 平局'
    : result.winner === 1
      ? '🏆 玩家1 胜'
      : '🏆 玩家2 胜';

  return `${winnerLabel} | ${result.score1}:${result.score2} | ` +
    `单局胜 ${result.p1Wins}:${result.p2Wins}:${result.ties} | ` +
    `${result.rounds} 回合`;
}

export { formatReport, formatSingleResult };
