# 玩家2（AI）出牌策略

> 文件位置：`feature/ImproveAI` 分支
> 策略实现位置：`CouplesCardGame.html` → `aiChooseCard(player, leadCard, opponent)`

## 基本信息

- AI 不窥探玩家1手牌（已修复）
- 可见信息：已出牌、天龙人花色、自己的手牌和桌面牌、分数牌归属
- 权值排序：`RANK_ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A','小王','大王']`
- 天龙人特权：天龙人花色 + 两张王 拥有更高优先级

---

## 跟牌策略（P1 先出，AI 回应）

当 `leadCard` 不为空时，AI 根据 P1 出的牌做决策：

### 1. P1 出了分牌（5/10/K）

```
if (getCardScore(leadCard) > 0 && winners.length > 0)
```

- 如果 AI 能赢下这一轮（自己有同花色或天龙人花色中更大的牌），**一定压上去抢分**
- 优先选择能赢的最小分数牌（省大牌）
- 若无可赢的分数牌，选能赢的最弱牌

### 2. AI 有机会出分牌且能赢

```
if (scoreWinners.length > 0)
```

- 自己的分数牌能赢时，出最小的那张
- 赢不了的分数牌留着不浪费

### 3. 默认行为

```
return chooseLowestPower(nonScoreCards.length > 0 ? nonScoreCards : playable)
```

- 出最小的**非分数牌**
- 如果只剩分数牌了，才出最小的分数牌

---

## 先手策略（AI 先出，P1 回应）

当 `leadCard` 为空时，AI 主导出牌。

### 1. 优先出天龙人花色里的分数牌

```
const privScore = privileged.filter(a => getCardScore(a.card) > 0);
if (privScore.length > 0) return chooseLowestScoreCard(privScore);
```

- 天龙人花色出分牌是安全的（对方必须跟同花色或特权牌，AI 的优势牌大概率能拿回主动权）
- 选最小的分数牌出

### 2. 仅剩分数牌时才出分

```
if (scoreCards.length > 0 && scoreCards.length === playable.length)
```

- 所有可出牌都是分数牌时，出最小的

### 3. 默认行为

```
return chooseLowestPower(nonScoreCards.length > 0 ? nonScoreCards : playable)
```

- 出最小的非分数牌

---

## 辅助函数

| 函数 | 作用 |
|------|------|
| `getCardScore(card)` | 5→5分, 10→10分, K→10分, 其他→0分 |
| `getPlayableCards(player, leadCard)` | 跟牌时只返回同花色/特权牌；无 leadCard 返回全部 |
| `isPrivileged(card)` | 天龙人花色 + 大小王 |
| `compareCards(a, b)` | 特权优先 → 同花色比大小 → 否则赢不了 |
| `chooseLowestPower(cards)` | 选权值最小的牌 |
| `chooseLowestScoreCard(cards)` | 先比分值，同分值比权值，选最小的 |

---

## 改进方向（待议）

- [ ] 记忆已出牌，推断对手剩余牌型
- [ ] 概率估算对手某花色是否已空
- [ ] 故意输小分以消耗对手大牌
- [ ] 优先消耗桌面明牌而非手牌
- [ ] 回合末期（快结束时）激进抢分 vs 保守防守的切换
