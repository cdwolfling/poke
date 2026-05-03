// ═══════════════════════════════════════════════════════════════════
// adapter.js - UI Adapter: bridges game engine to DOM
// ═══════════════════════════════════════════════════════════════════

import {
  createState, cloneState, applyMove, resolveRound,
  advanceRound, isTerminal, getWinner,
} from './game/state.js';
import { getLegalMoves } from './game/rules.js';
import { getCardScore, isJoker, getEffectiveSuit, getCardPower, cardToLabel } from './game/card.js';
import { getBotMove } from './ai/bot.js';

// ── State ────────────────────────────────────────────────────────
let state = null;
let autoAdvanceTimer = null;

// ── Init ─────────────────────────────────────────────────────────
function initGame() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
  state = createState({ p1: 'V1', p2: 'V3' });
  document.getElementById('btn-play').disabled = true;
  renderAll();
}

// ── Rendering ────────────────────────────────────────────────────

/** Get the playable cards for the human player (P1) as a Set of "type-index" strings */
function getPlayableSet() {
  if (state.phase !== 'select') return new Set();
  const leadCard = (state.firstPlayer === 2) ? state.playedP2 : null;
  if (state.firstPlayer === 2 && !leadCard) return new Set();
  const moves = getLegalMoves(state.p1, leadCard, state.dragonSuit);
  return new Set(moves.map(m => `${m.type}-${m.index}`));
}

function renderAll() {
  renderDragonInfo();
  renderPlayerZone('p1');
  renderPlayerZone('p2');
  renderPlayArea();
  renderStatus();
  renderButtons();
  renderHistory();
  document.querySelector('h1 .ver').textContent = 'v2026.5.4.1';
}

function renderDragonInfo() {
  const el = document.getElementById('dragon-info');
  if (!state.dragonSuit) { el.textContent = ''; return; }
  const sn = { '♠':'黑桃','♥':'红心','♦':'方块','♣':'梅花' };
  el.textContent = `🐉 天龙人花色：${state.dragonSuit} ${sn[state.dragonSuit] || ''}（${state.dragonSuit} + 大小鬼 = 15 张特权阶级）`;
}

function renderPlayerZone(pid) {
  const p = state[pid];
  const playableSet = (pid === 'p1') ? getPlayableSet() : new Set();

  // ── Face table ──
  const faceEl = document.getElementById(`face-${pid}`);
  faceEl.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const slot = p.table[i];
    const canSel = pid === 'p1' && slot.face && playableSet.has(`face-${i}`);
    const ts = makeTableSlotEl(slot, canSel);
    if (canSel) {
      const isSel = state.selectedSource && state.selectedSource.type === 'face' && state.selectedSource.index === i;
      if (isSel) ts.faceEl.classList.add('selected');
      const fi = i;
      ts.faceEl.addEventListener('click', () => onCardClick({ type: 'face', index: fi }));
    }
    faceEl.appendChild(ts.el);
  }

  // ── Hand ──
  const handEl = document.getElementById(`hand-${pid}`);
  handEl.innerHTML = '';
  if (pid === 'p1') {
    p.hand.forEach((card, idx) => {
      const canSel = playableSet.has(`hand-${idx}`);
      const el = makeCardEl(card, canSel);
      if (canSel) {
        const isSel = state.selectedSource && state.selectedSource.type === 'hand' && state.selectedSource.index === idx;
        if (isSel) el.classList.add('selected');
        el.addEventListener('click', () => onCardClick({ type: 'hand', index: idx }));
      }
      handEl.appendChild(el);
    });
  } else {
    // P2 hand: face-down stack
    p.hand.forEach((_, idx) => {
      const el = makeCardEl(null, false, true);
      el.style.setProperty('--stack-i', idx);
      handEl.appendChild(el);
    });
    const countEl = document.getElementById('hand-count-p2');
    if (countEl) countEl.textContent = `${p.hand.length}张`;
  }

  // First-player badge
  const badge = document.getElementById(`badge-${pid}`);
  badge.style.display = (state.phase === 'select' && state.firstPlayer === (pid === 'p1' ? 1 : 2)) ? '' : 'none';

  // Info line
  const hc = p.hand.length, fc = p.table.filter(s => s.face).length, dc = p.table.filter(s => s.down).length;
  const sc = pid === 'p1' ? state.p1.score : state.p2.score;
  document.getElementById(`info-${pid}`).textContent = `手牌: ${hc}张 | 桌面牌: ${fc}张 | 底牌: ${dc}张 | 得分: ${sc}分`;

  renderScorePile(pid);
}

function renderScorePile(pid) {
  const el = document.getElementById(`score-pile-${pid}`);
  const cards = pid === 'p1' ? state.p1.scoreCards : state.p2.scoreCards;
  const total = pid === 'p1' ? state.p1.score : state.p2.score;
  const visibleCards = cards.slice(-14);
  el.innerHTML = '';

  const title = document.createElement('div');
  title.classList.add('score-pile-title');
  title.textContent = pid === 'p1' ? '你得分牌' : 'AI得分牌';
  el.appendChild(title);

  const stack = document.createElement('div');
  stack.classList.add('score-stack');
  if (visibleCards.length === 0) {
    const empty = makeCardEl(null, false, false);
    empty.classList.add('card', 'empty');
    stack.appendChild(empty);
  } else {
    visibleCards.forEach((card, idx) => {
      const cardEl = makeCardEl(card);
      cardEl.style.setProperty('--stack-i', idx);
      cardEl.style.setProperty('--stack-col', idx % 2);
      cardEl.style.setProperty('--stack-row', Math.floor(idx / 2));
      stack.appendChild(cardEl);
    });
  }
  el.appendChild(stack);

  const count = document.createElement('div');
  count.classList.add('score-count');
  count.textContent = cards.length ? `${cards.length}张 / ${total}分` : '暂无';
  el.appendChild(count);
}

function renderPlayArea() {
  document.getElementById('played-p1').innerHTML = state.playedP1 ? makeCardEl(state.playedP1).outerHTML : makeEmptyEl().outerHTML;
  document.getElementById('played-p2').innerHTML = state.playedP2 ? makeCardEl(state.playedP2).outerHTML : makeEmptyEl().outerHTML;
  const re = document.getElementById('result-banner');

  if (state.phase === 'reveal' && state.roundResult) {
    const msgs = { p1: `🎉 你得${state.roundScore}分！`, p2: `🤖 AI得${state.roundScore}分！`, tie: `🤝 平！(无人得分)` };
    re.textContent = msgs[state.roundResult];
  } else if (state.phase === 'gameover') {
    if (state.p1.score > state.p2.score) re.textContent = `🏆 你赢了！ ${state.p1.score}:${state.p2.score}`;
    else if (state.p2.score > state.p1.score) re.textContent = `🤖 AI赢了！ ${state.p1.score}:${state.p2.score}`;
    else re.textContent = `🤝 平局！ ${state.p1.score}:${state.p2.score}`;
  } else re.textContent = '——';
}

function renderStatus() {
  const el = document.getElementById('status-bar');
  if (state.phase === 'gameover') {
    el.textContent = `游戏结束！ 你 ${state.p1.score} 分 vs AI ${state.p2.score} 分`;
    return;
  }
  const first = state.firstPlayer === 1 ? '你' : 'AI';
  if (state.phase === 'select') {
    const hint = state.firstPlayer === 2 ? '请跟牌（同花色）' : '请选一张牌出';
    el.textContent = `R${state.round}/27 | 先手：${first} | ${state.p1.score}:${state.p2.score} | ${hint}`;
  } else {
    el.textContent = `R${state.round}/27 结果 | 本轮${state.roundScore}分 | 即将自动进入下一回合……`;
  }
}

function renderButtons() {
  const bp = document.getElementById('btn-play');
  if (state.phase === 'select') {
    bp.style.display = '';
    bp.disabled = !state.selectedSource;
  } else bp.style.display = 'none';
}

function renderHistory() {
  const el = document.getElementById('history-panel');
  let html = '<h3>📜 最近回合</h3>';
  if (state.history.length === 0) {
    el.innerHTML = `${html}<div class="history-row"><span class="hr-round">暂无</span></div>`;
    return;
  }
  for (const h of state.history) {
    const wLabel = h.winner === 'p1' ? '<span class="hr-win">你胜</span>'
                  : h.winner === 'p2' ? '<span class="hr-lose">AI胜</span>'
                  : '<span class="hr-tie">平局</span>';
    const pts = h.points > 0 ? ` <span class="hr-pts">+${h.points}分</span>` : '';
    const p1c = cardToLabel(h.p1);
    const p2c = cardToLabel(h.p2);
    html += `<div class="history-row">
      <span class="hr-round">R${h.round}</span>
      <span class="hr-card ${h.p1.color || ''}">${p1c}</span>
      <span style="color:#888">vs</span>
      <span class="hr-card ${h.p2.color || ''}">${p2c}</span>
      ${wLabel}${pts}
    </div>`;
  }
  el.innerHTML = html;
}

// ── Card DOM Helpers ─────────────────────────────────────────────

function makeCardEl(card, selectable = false, faceDown = false) {
  const el = document.createElement('div');
  el.classList.add('card');
  if (faceDown) { el.classList.add('face-down'); return el; }
  if (!card) return el;
  el.classList.add(card.color || 'black');
  if (selectable) el.classList.add('selectable');
  if (isJoker(card)) {
    el.innerHTML = `<span class="top">🃏</span><span class="suit" style="font-size:0.65rem">${card.rank}</span><span class="bottom">🃏</span>`;
  } else {
    el.innerHTML = `<span class="top">${card.rank}</span><span class="suit">${card.suit}</span><span class="bottom">${card.rank}</span>`;
  }
  return el;
}

function makeTableSlotEl(slot, selectable = false) {
  const el = document.createElement('div');
  el.classList.add('table-slot');
  if (slot.down) {
    const under = makeCardEl(null, false, true);
    under.classList.add('under-card');
    el.appendChild(under);
  }
  const faceEl = slot.face ? makeCardEl(slot.face, selectable) : makeEmptyEl();
  faceEl.classList.add('face-card');
  el.appendChild(faceEl);
  return { el, faceEl };
}

function makeEmptyEl() {
  const el = document.createElement('div');
  el.classList.add('card', 'empty');
  return el;
}

function setStatus(msg) {
  document.getElementById('status-bar').textContent = msg;
}

// ── Game Logic ───────────────────────────────────────────────────

function onCardClick(move) {
  // P1 能选牌的条件：phase='select' 且（P1 先手 或 AI 已出牌等待回应）
  if (state.phase !== 'select') return;
  if (state.firstPlayer !== 1 && state.playedP2 === null) return;
  const isSel = state.selectedSource &&
    state.selectedSource.type === move.type &&
    state.selectedSource.index === move.index;
  state.selectedSource = isSel ? null : move;
  renderAll();
}

function playTurn() {
  if (state.phase !== 'select') return;
  if (!state.selectedSource) { setStatus('请先选择一张牌！'); return; }

  const isP1First = (state.firstPlayer === 1);

  // P1 plays
  state = applyMove(state, 'p1', state.selectedSource);
  state.selectedSource = null;

  // Track face-up index
  if (state.playedP1Source && state.playedP1Source.type === 'face') {
    // Face index tracking handled by resolveRound / advanceRound
  }

  // AI plays
  if (isP1First) {
    const aiMove = getBotMove(state.strategies.p2, state, 'p2', state.playedP1);
    if (aiMove) state = applyMove(state, 'p2', aiMove);
  }

  // Resolve round
  state = resolveRound(state);
  renderAll();

  if (!isTerminal(state)) {
    autoAdvanceTimer = setTimeout(() => {
      autoAdvanceTimer = null;
      nextRound();
    }, 1500);
  }
}

function nextRound() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
  if (state.phase !== 'reveal') return;
  state = advanceRound(state);
  renderAll();

  // AI goes first next round
  if (state.firstPlayer === 2 && state.phase === 'select') {
    const aiMove = getBotMove(state.strategies.p2, state, 'p2', null);
    if (aiMove) {
      state = applyMove(state, 'p2', aiMove);
      renderAll();  // 显示 AI 出的牌，玩家才能决策跟牌
    }
  }
}

// ── Keyboard shortcut ───────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') playTurn();
});

// ── Init ─────────────────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click', playTurn);
document.getElementById('btn-restart').addEventListener('click', initGame);
initGame();
