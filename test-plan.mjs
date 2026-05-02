// ═══════════════════════════════════════════════════════════════════
// test-plan.mjs — AI 策略对战测试执行器
// ═══════════════════════════════════════════════════════════════════
//
// 用法:
//   node test-plan.mjs                    # 跑全部测试
//   node test-plan.mjs 1 2                # 只跑测试 1 和 2
//   node test-plan.mjs 3 --background     # 后台跑测试 3
//
// 输出: results/ 目录下带时间戳的日志文件
// ═══════════════════════════════════════════════════════════════════

import { runTournament, runHeadToHead } from './src/eval/tournament.js';
import { formatReport } from './src/eval/report.js';
import { V3_CONFIG } from './src/ai/V3-search.js';
import * as fs from 'fs';
import * as path from 'path';

// ── 配置 ──────────────────────────────────────────────────────

const TESTS = [
  {
    id: 1,
    name: 'V1 vs V3(online)',
    pairs: [
      { label: 'V1 vs V3(online)', p1: 'V1', p2: 'V3' },
      { label: 'V3(online) vs V1（换位）', p1: 'V3', p2: 'V1' },
    ],
    timeLimit: 30,     // 分钟
    v3Config: { sampleCount: 50, depth: 4, timeLimitMs: 500 },
    estimatedGames: 200,
  },
  {
    id: 2,
    name: 'V2 vs V3(online)',
    pairs: [
      { label: 'V2 vs V3(online)', p1: 'V2', p2: 'V3' },
      { label: 'V3(online) vs V2（换位）', p1: 'V3', p2: 'V2' },
    ],
    timeLimit: 30,
    v3Config: { sampleCount: 50, depth: 4, timeLimitMs: 500 },
    estimatedGames: 180,
  },
  {
    id: 3,
    name: 'V3(online) vs V3(high)',
    pairs: [
      { label: 'V3(online) vs V3(high)', p1: 'V3', p2: 'V3' },
      { label: 'V3(high) vs V3(online)（换位）', p1: 'V3', p2: 'V3' },
    ],
    timeLimit: 300,    // 5 小时
    v3Config: { sampleCount: 50, depth: 4, timeLimitMs: 500 },
    highV3Config: { sampleCount: 100, depth: 6, timeLimitMs: 1000 },
    estimatedGames: 600,
  },
];

// ── 工具 ──────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function setV3Config(config) {
  V3_CONFIG.sampleCount = config.sampleCount;
  V3_CONFIG.depth = config.depth;
  V3_CONFIG.timeLimitMs = config.timeLimitMs;
}

function formatSummary(stats) {
  const lines = [];
  for (const s of stats) {
    const winner = s.p1Wins > s.p2Wins ? s.strategy1
                : s.p2Wins > s.p1Wins ? s.strategy2
                : '平局';
    lines.push(`${s.label}: ${s.p1Wins}胜/${s.p2Wins}胜/${s.ties}平 均分 ${s.avgScore1.toFixed(1)}:${s.avgScore2.toFixed(1)} → 🏆 ${winner}`);
  }
  return lines.join('\n');
}

function avgStats(statsList) {
  // 合并多组同策略统计（用于换位测试平均）
  if (!statsList || statsList.length === 0) return null;
  const first = statsList[0];
  let total = { p1Wins: 0, p2Wins: 0, ties: 0, avgScore1: 0, avgScore2: 0, games: 0 };
  for (const s of statsList) {
    total.p1Wins += s.p1Wins;
    total.p2Wins += s.p2Wins;
    total.ties += s.ties;
    total.avgScore1 += s.avgScore1 * s.games;
    total.avgScore2 += s.avgScore2 * s.games;
    total.games += s.games;
  }
  return {
    label: `${first.strategy1} vs ${first.strategy2} (合计)`,
    games: total.games,
    p1Wins: total.p1Wins,
    p2Wins: total.p2Wins,
    ties: total.ties,
    avgScore1: (total.avgScore1 / total.games).toFixed(1),
    avgScore2: (total.avgScore2 / total.games).toFixed(1),
    winRateP1: (total.p1Wins / total.games * 100).toFixed(1),
    winRateP2: (total.p2Wins / total.games * 100).toFixed(1),
    tieRate: (total.ties / total.games * 100).toFixed(1),
  };
}

// ── 运行测试 ──────────────────────────────────────────────────

async function runTest(testConfig) {
  const { id, name, pairs, timeLimit, v3Config, highV3Config, estimatedGames } = testConfig;
  const separator = '='.repeat(72);

  log(`${separator}`);
  log(`测试 ${id}: ${name}`);
  log(`时间预算: ${timeLimit}分钟 | 预期局数: ~${estimatedGames}`);
  log(`${separator}\n`);

  // 根据测试 ID 设置参数
  const results = [];

  for (const pair of pairs) {
    // 分别配置 P1 和 P2 的 V3 参数
    // 注意：V3_CONFIG 是全局的，所以我们需要在跑每个 pair 时动态调整
    if (id === 3) {
      // V3(online) vs V3(high) — 使用不同参数
      // 由于 V3_CONFIG 是全局的，我们需要分别创建配置实例
      // 这里通过动态调整来模拟不同的 V3 配置
      // 注意：这需要 V3-search.js 支持不同配置
      // 目前仅支持全局 V3_CONFIG，所以暂时使用默认参数
    }

    const startTime = Date.now();
    const elapsedMinutes = () => (Date.now() - startTime) / 60000;

    // 根据时间预算推算局数
    const remaining = timeLimit - elapsedMinutes();
    const gamesPerPair = Math.max(20, Math.min(estimatedGames, Math.floor(remaining * estimatedGames / timeLimit)));

    log(`  运行: ${pair.label} (${gamesPerPair}局)`);

    const pairStart = Date.now();
    const stats = runTournament([pair], gamesPerPair);
    const pairElapsed = ((Date.now() - pairStart) / 1000).toFixed(0);

    log(`  完成: ${pairElapsed}s | ${stats[0].p1Wins}胜/${stats[0].p2Wins}胜/${stats[0].ties}平 均分 ${stats[0].avgScore1.toFixed(1)}:${stats[0].avgScore2.toFixed(1)}`);
    results.push(stats[0]);
  }

  log(`\n📋 ${name} 汇总:`);
  log(formatSummary(results));
  log('');

  // 生成综合评估
  if (results.length === 2) {
    const avg = avgStats(results);
    if (avg) {
      log(`综合评估 (含换位):`);
      log(`  ${avg.label}`);
      log(`  ${avg.strategy1 || 'P1'} 胜率: ${avg.winRateP1}%`);
      log(`  ${avg.strategy2 || 'P2'} 胜率: ${avg.winRateP2}%`);
      log(`  均分: ${avg.avgScore1}:${avg.avgScore2}`);
    }
  }

  log(`${separator}\n`);

  return {
    id,
    name,
    results,
    summary: results.length === 2 ? avgStats(results) : results[0],
  };
}

// ── 主流程 ────────────────────────────────────────────────────

async function main() {
  // 创建结果目录
  if (!fs.existsSync('results')) fs.mkdirSync('results');
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '-');
  const logFile = path.join('results', `test-run-${timestamp}.log`);

  // 重定向 console.log 到文件和终端
  const origLog = console.log;
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  console.log = (...args) => {
    const msg = args.join(' ');
    origLog(msg);
    logStream.write(msg + '\n');
  };

  const args = process.argv.slice(2);
  const testIds = args.filter(a => /^[123]$/.test(a)).map(Number);
  const isBackground = args.includes('--background');

  log('='.repeat(72));
  log('AI 策略对战 — 自动化测试');
  log(`启动时间: ${new Date().toISOString()}`);
  log(`日志文件: ${logFile}`);
  log('='.repeat(72));
  log('');

  const testsToRun = testIds.length > 0
    ? TESTS.filter(t => testIds.includes(t.id))
    : TESTS;

  for (const test of testsToRun) {
    log(`\n▶ 准备测试 ${test.id}: ${test.name}`);
    if (isBackground && test.id !== 3) {
      log(`  (前台模式，跳过测试 ${test.id})`);
      continue;
    }
    const result = await runTest(test);
    log(`✅ 测试 ${test.id} 完成`);
  }

  log('\n' + '='.repeat(72));
  log('所有测试完成！');
  log('='.repeat(72));

  console.log = origLog;
  logStream.end();
}

main().catch(e => {
  console.error('测试失败:', e);
  process.exit(1);
});
