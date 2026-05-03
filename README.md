# 🃏 扑克牌对战 — 得分抢夺游戏

> 目标很简单：**不要赢每一轮，要赢每一分。**

基于 54 张扑克牌（含大小王）的双人对战游戏。只有 **5、10、K** 共 12 张牌计分（总计 100 分），其余牌均为 0 分。27 轮出完所有牌，总分高者获胜。

---

## 快速开始

### 非开发者

直接打开 `CouplesCardGame-v3.html` 即可游玩（浏览器打开，无需任何服务器）。

### 开发者

```bash
# 1. 构建可玩版本
node build.mjs

# 2. 浏览器打开
open CouplesCardGame-v3.html

# 3. 或运行批量评测
node run-tests.mjs
```

---

## 项目结构

```
poke/
├── CouplesCardGame-v3.html     ← 🎮 最终可玩版本（build 产出，已 checkin）
├── CouplesCardGame.html        ← 🕰️ v2026.5.2.1 旧版（历史存档）
│
├── build.mjs                   ← 🔧 打包脚本：src/ → 独立 HTML
├── .gitignore
├── README.md                    ← 本文件
│
├── src/                         ← 📦 模块化源码（ES Modules）
│   ├── game/                    │
│   │   ├── card.js              │  卡牌类型、分数、特权判定
│   │   ├── deck.js              │  牌组创建、洗牌、发牌
│   │   ├── rules.js             │  合法走法、比大小、天龙人
│   │   └── state.js             │  游戏状态管理
│   ├── ai/                      │
│   │   ├── easyBot.js           │  V1 策略：抢分优先
│   │   ├── normalBot.js         │  V2 策略：桌面优先+计牌
│   │   ├── V3-search.js         │  🧠 V3 策略：Determinized Alpha-Beta
│   │   ├── V3-high.js           │  V3 高配版（更深度搜索）
│   │   ├── bot.js               │  Bot 工厂：按名称分发
│   │   ├── V1.md / V2.md / V3.md│  策略文档
│   ├── eval/                    │
│   │   ├── match.js             │  单局模拟
│   │   ├── tournament.js        │  批量锦标赛
│   │   └── report.js            │  报告格式化
│   └── ui/                      │
│       ├── index.html           │  HTML 模板
│       └── adapter.js           │  UI 适配器：引擎 ↔ DOM
│
├── results/                     ← 测试日志（.gitignore）
├── run-tests.mjs                ← 批量测试运行器
├── test-plan.mjs                ← 测试计划定义
├── TEST-PLAN.md                 ← 测试设计文档
├── run-status.md                ← 测试进度跟踪
│
├── rule.md                      ← 游戏规则详细说明
└── target.md                    ← 胜利条件说明
```

---

## 工作流

### 修改 UI / 算法

```bash
# 1. 修改 src/ 下的源码
# 2. 构建可玩版本
node build.mjs

# 3. 验证（浏览器打开 CouplesCardGame-v3.html）
open CouplesCardGame-v3.html

# 4. 可选：运行批量评测
node run-tests.mjs

# 5. commit 源码 + 构建产物
git add src/ CouplesCardGame-v3.html build.mjs
git commit -m "feat: xxx"
git push
```

### 部署到线上

```bash
# 先 build
node build.mjs

# 上传到 FTP（需先在 .env 或 ftp 客户端配置好凭据）
curl -T CouplesCardGame-v3.html \
  "ftp://<host>/htdocs/html/Couple/CouplesCardGame-v3.html" \
  --user <username>:<password> --disable-epsv
```

线上地址：<http://applechen.cn/html/Couple/CouplesCardGame-v3.html>

### 关于冗余

`CouplesCardGame-v3.html` 是 `src/` 所有模块打包而成的独立 HTML 文件，JS 代码完全内联。它与 `src/` 存在代码冗余——这是因为单文件部署的原子性和兼容性需求。**修改请始终在 `src/` 中进行，然后运行 `node build.mjs` 更新构建产物。**

---

## AI 策略一览

| 策略 | 策略名 | 说明 |
|------|--------|------|
| V1 | easy | 抢分优先，简单启发式 |
| V2 | normal | 桌面优先 + 计牌 + 残局激进 |
| **V3** | **V3** | **🧠 Determinized Alpha-Beta 搜索**（当前默认 AI） |
| V3-high | V3-high | V3 高配版（更深搜索，评测用） |

---

## 游戏规则核心

- 共 **54 张牌**（含大小王），每人 27 张
- 每轮双方各出一张（可跟可压），**牌力大者赢得该轮所有桌面上的分数牌**
- 计分牌（100 分）：**5**（各 5 分）× 4、**10**（各 10 分）× 4、**K**（各 10 分）× 4
- 其余牌（3、4、6、7、8、9、J、Q、A、2、小王、大王）均为 **0 分**
- **天龙人花色**拥有特权：同花色天王牌可压制普通花色王
- 27 轮后总分高者获胜

详见 `rule.md` 和 `target.md`。
