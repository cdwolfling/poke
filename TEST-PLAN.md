# AI 策略对战 — 测试计划

> 目标：对比 V1/V2/V3(online)/V3(high) 四个策略的胜率
> 生成：2026-05-03

## 基准测试结果

| 对战 | 每局耗时 | 30分钟可跑 | 5小时可跑 |
|------|---------|-----------|----------|
| V1 vs V3(online) | ~9s | **~200局** | ~2000局 |
| V2 vs V3(online) | ~10s | **~180局** | ~1800局 |
| V3(online) vs V3(high) | ~30s* | ~60局 | **~600局** |

_*V3(online)=4ply/50samples/500ms, V3(high)=6ply/100samples/1000ms_

## 测试一：V1 vs V3(online)  — 30分钟

**目标：** 验证搜索机器人(V3)是否显著优于纯启发式(V1)

```
配置: V1(P1) vs V3(P2)
V3_CONFIG: sampleCount=50, depth=4, timeLimitMs=500ms
预期局数: ~200局
```

**输出：**
- V1 胜率 / V3 胜率 / 平局率
- 均分 V1:V3
- 胜率≥65% → V3 明显占优

## 测试二：V2 vs V3(online) — 30分钟

**目标：** 验证搜索机器人(V3)对比改进启发式(V2)的优势

```
配置: V2(P1) vs V3(P2)
V3_CONFIG: sampleCount=50, depth=4, timeLimitMs=500ms
预期局数: ~180局
```

**输出：**
- V2 胜率 / V3 胜率 / 平局率
- 均分 V2:V3

## 测试三：V3(online) vs V3(high) — 5小时

**目标：** 验证更高参数（更深搜索+更多采样）能否带来额外收益

```
配置: V3(online, P1) vs V3(high, P2)

V3(online): sampleCount=50, depth=4, timeLimitMs=500ms
V3(high):   sampleCount=100, depth=6, timeLimitMs=1000ms

预期局数: ~600局
```

**输出：**
- online 胜率 / high 胜率 / 平局率
- 均分
- 若 high 胜率 > 55% → 参数提升有价值

## 位置校准

所有测试结果附带**换位测试**（交换 P1/P2 策略），消除先手偏差。

最终报告格式：
```
V1 vs V3(online)  — 200局
  正常位: V1 42% | V3 56% | 平 2%
  换位位: V1 38% | V3 60% | 平 2%
  综评:   V3 胜率 ~58%  ✅ 搜索优于启发式
```

## 执行流程

```
1. 创建 test-all.sh 脚本
   ↓
2. 运行 test1（~30min）
   ↓
3. 运行 test2（~30min）
   ↓
4. 运行 test3（~5h，后台）
   ↓
5. 汇总报告
```

## 运行方式

```bash
cd 伊藤/poke
nohup node --input-type=module test-plan.mjs > results-$(date +%Y%m%d-%H%M).log 2>&1 &
```
