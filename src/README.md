# 扑克牌对战 — 模块化架构

```
src/
  game/
    card.js        Card 类型、颜色、分数、特权判定
    deck.js        牌组创建、洗牌、发牌
    rules.js       纯规则：合法走法、比大小、天龙人判定
    state.js       纯状态管理：创建、克隆、走法、结算、推进
  ai/
    easyBot.js     V1 策略：抢分优先
    normalBot.js   V2 策略：桌面优先+计牌+残局激进
    V1.md          V1 策略文档
    V2.md          V2 策略文档
    bot.js         Bot 工厂：按策略名分发
  eval/
    match.js       单局模拟
    tournament.js  多局锦标赛
    report.js      报告格式化
  ui/
    index.html     人机对战 HTML（ES Module）
    adapter.js     UI 适配器：桥接引擎↔DOM
```

## 使用方式

### 人机对战
```
open src/ui/index.html   (通过 HTTP 服务器，ES Module 需要)
```

### 批量评测
```js
import { runHeadToHead } from './src/eval/tournament.js';
import { formatReport } from './src/eval/report.js';

const stats = runHeadToHead('easy', 'normal', 100);
console.log(formatReport(stats, '简单', '普通'));
```

### 添加新策略
1. 在 `src/ai/` 下新建文件，实现 `chooseCard(state, playerId, leadCard)`
2. 在 `src/ai/bot.js` 的 `BOT_STRATEGIES` 注册
