# 测试已启动 🚀

## 进度

| 时间 | 测试 | 状态 |
|------|------|------|
| 01:16 | Test 1: V1 vs V3(online) 200局×2组 | 🔄 运行中 |
| ~01:46 | Test 2: V2 vs V3(online) 180局×2组 | ⏳ 待开始 |
| ~02:16 | Test 3: V3(online) vs V3(high) ~300局×2组 | ⏳ |

## 查看进度

```bash
tail -f /Users/applechen/伊藤/poke/results/run.log
```

查看 CPU 状态：
```bash
ps aux | grep run-tests
```

## 预计完成

- Test 1+2: ~凌晨 2:16
- Test 3: ~早上 7:16

## 结果文件

```
results/
├── run.log              ← 实时日志
├── test-2026-05-02-*.log ← 详细日志
```
