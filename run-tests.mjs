// ═══════════════════════════════════════════════════════════════════
// run-tests.mjs — AI 策略对战测试
// 实时进度日志，每 10 局输出一次中间结果
// ═══════════════════════════════════════════════════════════════════
import fs from 'fs';
import { runMatch } from './src/eval/match.js';
import { V3_CONFIG } from './src/ai/V3-search.js';

const MAIN_LOG = 'results/run.log';
const DETAIL_LOG = `results/test-${new Date().toISOString().slice(0,16).replace('T','-')}.log`;

function out(msg) {
  const t = new Date().toISOString().slice(11,19);
  const line = `[${t}] ${msg}`;
  fs.appendFileSync(MAIN_LOG, line + '\n');
  fs.appendFileSync(DETAIL_LOG, line + '\n');
  process.stdout.write(line + '\n');
}

function logProgress(id, label, done, total, p1w, p2w, t, s1, s2, elapsed) {
  const pct = ((done / total) * 100).toFixed(0);
  const eta = (done > 0) ? ((elapsed / done) * (total - done) / 1000 / 60).toFixed(0) : '?';
  out(`  [${id}] ${label}: ${done}/${total} (${pct}%) | ${p1w}胜/${p2w}胜/${t}平 | 均分 ${(s1/done||0).toFixed(1)}:${(s2/done||0).toFixed(1)} | ETA ${eta}min`);
}

// ── 初始化 ──
out('='.repeat(66));
out('AI 策略自动化测试 — 开始');
out(`日志: ${DETAIL_LOG}`);
out('='.repeat(66));

V3_CONFIG.sampleCount = 50;
V3_CONFIG.depth = 4;
V3_CONFIG.timeLimitMs = 500;

// ── 测试执行器 ──
function runPair(label, strat1, strat2, games, reportEvery = 10) {
  out(`  ▶ ${label} (${games}局)...`);
  const start = Date.now();
  let p1w = 0, p2w = 0, ties = 0, s1 = 0, s2 = 0;
  let lastReport = 0;

  for (let g = 0; g < games; g++) {
    const r = runMatch(strat1, strat2);
    if (r.winner === 1) p1w++;
    else if (r.winner === 2) p2w++;
    else ties++;
    s1 += r.score1;
    s2 += r.score2;

    if (g - lastReport >= reportEvery || g === games - 1) {
      logProgress(games > 100 ? '批量' : '测试', label, g + 1, games, p1w, p2w, ties, s1, s2, Date.now() - start);
      lastReport = g;
    }
  }

  const secs = ((Date.now() - start) / 1000).toFixed(0);
  const winner = p1w > p2w ? strat1 : p2w > p1w ? strat2 : '平局';
  out(`  ✅ ${secs}s | ${p1w}胜/${p2w}胜/${ties}平 | 均分 ${(s1/games).toFixed(1)}:${(s2/games).toFixed(1)} → 🏆 ${winner}`);
  return { winner: p1w > p2w ? 1 : p2w > p1w ? 2 : 0, p1w, p2w, ties, score1: s1/games, score2: s2/games };
}

function runTest(id, pairs, games) {
  out(`\n${'='.repeat(66)}`);
  out(`测试${id}`);
  out(`${'='.repeat(66)}`);
  const results = [];
  for (const pair of pairs) {
    results.push(runPair(pair.label, pair.p1, pair.p2, games));
  }
  return results;
}

// ── 执行 ──
runTest(1, [
  { label: 'V1 vs V3(online)', p1: 'V1', p2: 'V3' },
  { label: 'V3(online) vs V1（换位）', p1: 'V3', p2: 'V1' },
], 200);

runTest(2, [
  { label: 'V2 vs V3(online)', p1: 'V2', p2: 'V3' },
  { label: 'V3(online) vs V2（换位）', p1: 'V3', p2: 'V2' },
], 180);

runTest(3, [
  { label: 'V3(online) vs V3(high)', p1: 'V3', p2: 'V3-high' },
  { label: 'V3(high) vs V3(online)（换位）', p1: 'V3-high', p2: 'V3' },
], 300);

out(`\n${'='.repeat(66)}`);
out('所有测试完成！');
out(`${'='.repeat(66)}`);
