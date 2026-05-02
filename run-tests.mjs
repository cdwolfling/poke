// ═══════════════════════════════════════════════════════════════════
// run-tests.mjs — 直接跑三组测试
// ═══════════════════════════════════════════════════════════════════
import fs from 'fs';
import { runTournament } from './src/eval/tournament.js';
import { formatReport } from './src/eval/report.js';
import { V3_CONFIG } from './src/ai/V3-search.js';

const MAIN_LOG = 'results/run.log';
const DETAIL_LOG = `results/test-${new Date().toISOString().slice(0,16).replace('T','-')}.log`;

function out(msg) {
  const t = new Date().toISOString().slice(11,19);
  const line = `[${t}] ${msg}`;
  process.stdout.write(line + '\n');  // unbuffered
  fs.appendFileSync(MAIN_LOG, line + '\n');
  fs.appendFileSync(DETAIL_LOG, line + '\n');
}

out('='.repeat(66));
out('AI 策略自动化测试 — 开始');
out(`日志: ${DETAIL_LOG}`);
out('='.repeat(66));

// 配置 V3(online) 参数
V3_CONFIG.sampleCount = 50;
V3_CONFIG.depth = 4;
V3_CONFIG.timeLimitMs = 500;

const NOW = Date.now();
const TIME_LIMIT = {
  1: 30 * 60 * 1000,  // 30 min
  2: 30 * 60 * 1000,  // 30 min
  3: 5 * 60 * 60 * 1000, // 5 hours
};

function elapsed() { return Date.now() - NOW; }

function runTest(id, pairs, maxGames) {
  const remaining = TIME_LIMIT[id] - elapsed();
  if (remaining <= 0) { out(`⏰ 测试${id} 时间不足，跳过`); return []; }
  
  // 根据剩余时间计算局数
  const gamesPerPair = Math.min(maxGames, Math.max(5, Math.floor(
    maxGames * remaining / TIME_LIMIT[id]
  )));
  
  out(`\n${'='.repeat(66)}`);
  out(`测试${id}: ${pairs.map(p=>p.label).join(' / ')}`);
  out(`每项 ${gamesPerPair} 局`);
  out(`${'='.repeat(66)}`);

  const results = [];
  for (const pair of pairs) {
    const start = Date.now();
    out(`  ▶ ${pair.label} (${gamesPerPair}局)...`);
    const stats = runTournament([pair], gamesPerPair);
    const secs = ((Date.now() - start) / 1000).toFixed(0);
    const s = stats[0];
    const winner = s.p1Wins > s.p2Wins ? pair.p1 : s.p2Wins > s.p1Wins ? pair.p2 : '平局';
    out(`  ✅ ${secs}s | ${s.p1Wins}胜/${s.p2Wins}胜/${s.ties}平 | 均分 ${s.avgScore1.toFixed(1)}:${s.avgScore2.toFixed(1)} → ${winner}`);
    results.push(stats[0]);
  }
  return results;
}

// ── 测试 1: V1 vs V3(online) ──
runTest(1, [
  { label: 'V1 vs V3(online)', p1: 'V1', p2: 'V3' },
  { label: 'V3(online) vs V1（换位）', p1: 'V3', p2: 'V1' },
], 200);

// ── 测试 2: V2 vs V3(online) ──
runTest(2, [
  { label: 'V2 vs V3(online)', p1: 'V2', p2: 'V3' },
  { label: 'V3(online) vs V2（换位）', p1: 'V3', p2: 'V2' },
], 180);

// ── 测试 3: V3(online) vs V3(high) ──
// 注：V3-high 使用独立 bot 文件，不受全局 V3_CONFIG 影响
// 其默认参数为 sampleCount=100, depth=6, timeLimitMs=1000, endgameDepth=8
runTest(3, [
  { label: 'V3(online) vs V3(high)', p1: 'V3', p2: 'V3-high' },
  { label: 'V3(high) vs V3(online)（换位）', p1: 'V3-high', p2: 'V3' },
], 300);

// ── 汇总 ──
out('\n' + '='.repeat(66));
out('所有测试完成！');
out(`总耗时: ${(elapsed()/60000).toFixed(0)} 分钟`);
out('='.repeat(66));


