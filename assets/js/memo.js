// 증거 요약 메모 — 클루가 문서를 미리 읽고 남겨둔 쪽지.
//
// 방문자는 읽기만 한다. 클릭·대기·자동 연출 없음 (명세서 절대원칙 3: 읽기를 방해하지 않는다).
// 시각 언어는 수사 수첩(E7)에서 가져오되 손글씨 폰트는 수첩 전용으로 남겨둔다 —
// 팝업 시점에는 아직 폰트가 선로딩되지 않고(ui.js: 5수집), 히든의 특별함도 지켜야 한다.
//
// 모든 증거가 공유하는 뼈대 — 이 순서를 증거마다 바꾸지 않는다:
//
//     관찰   무엇을 발견했나
//     판단   그래서 무엇을 결정했나
//     [블록] 프로젝트별 시각화 ← 여기만 증거마다 완전히 다르게 만든다
//     결과   무엇이 달라졌나
//
// 뼈대를 고정하는 이유: 채용 담당자가 증거를 여러 개 눌러도 읽는 법을 다시 배우지 않아도 된다.
// 그러면서 가운데 블록은 획일화하지 않는다 — kind별 렌더러를 갈아끼우면 그림이 통째로 바뀐다.
//
// 공통(프레임워크): 종이·괘선·머리말·사진·행 렌더링, 형광펜, 블록 해석.
// 개별(증거별): 블록 하나. BLOCKS에 kind를 추가하고 데이터에 필드를 채우면 된다.
// 텍스트는 전부 콘텐츠_증거카드.json의 memo 필드에서 온다 (하드코딩 금지).

import { sdSprite } from './sprites.js';

// 증거마다 그림이 통째로 달라진다 — 형태를 돌려쓰지 않는다.
const BLOCKS = {
  cycle: blockCycle,     // E1: 각인 → 호출 → 입체감이 반복되는 운영 사이클
  mapping: blockMapping, // E2: 설계 요소 ↔ 요구되는 것, 그리고 한 줄로 수렴
  reduce: blockReduce,   // E3: 단계마다 덜어내며 좁혀지는 구성
  bridge: blockBridge,   // E4: 끊긴 두 콘텐츠와 그 사이 징검다리
  graft: blockGraft,     // E5: 손대지 않은 기존 구조 위에 얹히는 조각
  split: blockSplit,     // E6: 같은 일의 두 단계와 그 사이 무게 이동
};

export function hasMemo(ev) {
  return !!(ev && ev.memo && Array.isArray(ev.memo.rows) && ev.memo.rows.length);
}

export function renderMemo(host, ev) {
  const m = ev.memo;
  const memo = document.createElement('div');
  memo.className = 'memo';

  // 메모를 남긴 사람 — 수첩에 붙여둔 스크랩 사진처럼 살짝 기울여 둔다.
  const photo = document.createElement('span');
  photo.className = 'memo-photo';
  const shot = document.createElement('img');
  shot.src = sdSprite('normal');
  shot.alt = '';
  shot.loading = 'lazy';
  photo.appendChild(shot);

  const tab = document.createElement('span');
  tab.className = 'memo-tab';
  tab.textContent = ev.id;
  memo.appendChild(tab);

  // 머리말 줄: 왼쪽에 '클루의 요약', 오른쪽 빈자리에 클루 사진.
  // 사진은 절대 위치가 아니라 머리말 안에서 실제 자리를 차지한다 — 본문 글씨를 가릴 수 없다.
  const head = document.createElement('div');
  head.className = 'memo-head';
  const by = document.createElement('span');
  by.className = 'memo-by';
  by.textContent = m.by || '';
  head.append(by, photo);
  memo.appendChild(head);

  const lines = document.createElement('div');
  lines.className = 'memo-lines';
  m.rows.forEach((row) => {
    if (row.block) {
      const fn = BLOCKS[row.block.kind];
      if (fn) lines.appendChild(fn(row.block));
      return;
    }
    lines.appendChild(memoRow(row));
  });
  memo.appendChild(lines);

  if (m.note) {
    const note = document.createElement('div');
    note.className = 'memo-note';
    note.textContent = m.note;
    memo.appendChild(note);
  }

  host.appendChild(memo);
  return memo;
}

function memoRow(row) {
  const r = document.createElement('div');
  r.className = 'memo-row';
  const k = document.createElement('span');
  k.className = 'memo-k';
  k.textContent = row.k || '';
  const v = document.createElement('span');
  v.className = 'memo-v';
  writeWithHighlight(v, row.v || '', row.hl);
  r.append(k, v);
  return r;
}

// 클루가 형광펜을 그은 자리. hl 문자열이 본문에 있을 때만 적용된다.
function writeWithHighlight(el, text, hl) {
  const at = hl ? text.indexOf(hl) : -1;
  if (at < 0) {
    el.textContent = text;
    return;
  }
  el.append(text.slice(0, at));
  const mark = document.createElement('span');
  mark.className = 'memo-hl';
  mark.textContent = hl;
  el.append(mark, text.slice(at + hl.length));
}

/* ---------- 블록: 운영 사이클 ---------- */

function blockCycle(cfg) {
  const box = el('div', 'memo-cyc');
  const row = el('div', 'memo-cyc-steps');
  (cfg.steps || []).forEach((st, i) => {
    if (i) row.appendChild(sep('→'));
    const s = el('span', `memo-cyc-step${st.mark ? ' mark' : ''}`);
    s.append(el('b', 'memo-cyc-n', st.n), el('span', 'memo-cyc-t', st.t));
    row.appendChild(s);
  });
  box.appendChild(row);
  if (cfg.foot) box.appendChild(el('div', 'memo-cyc-foot', `↻ ${cfg.foot}`));
  return box;
}

/* ---------- 블록: 단계마다 덜어내기 ---------- */

function blockReduce(cfg) {
  const box = el('div', 'memo-red');
  (cfg.stages || []).forEach((st) => {
    if (st.cut) {
      box.appendChild(el('div', 'memo-red-cut', `↓ ${st.cut}`));
      return;
    }
    const line = el('div', `memo-red-line${st.keep ? ' keep' : ''}`);
    line.appendChild(el('span', 'memo-red-label', st.label));
    const chips = el('span', 'memo-chips');
    (st.items || []).forEach((t) => chips.appendChild(el('span', 'memo-chip', t)));
    line.appendChild(chips);
    box.appendChild(line);
  });
  if (cfg.kept) box.appendChild(el('div', 'memo-red-kept', cfg.kept));
  return box;
}

/* ---------- 블록: 화면 ↔ 판단 대응 ---------- */

function blockMapping(cfg) {
  const box = el('div', 'memo-map');
  const head = el('div', 'memo-map-head');
  head.append(el('span', 'memo-map-h', cfg.left_label), el('span', 'memo-map-h', cfg.right_label));
  box.appendChild(head);
  (cfg.pairs || []).forEach((pr) => {
    const row = el('div', 'memo-map-row');
    row.append(el('span', 'memo-map-l', pr.l), el('span', 'memo-sep', '→'), el('span', 'memo-map-r', pr.r));
    box.appendChild(row);
  });
  if (cfg.converge) box.appendChild(el('div', 'memo-map-conv', cfg.converge));
  return box;
}

/* ---------- 블록: 끊긴 자리에 놓은 디딤돌 ---------- */

function blockBridge(cfg) {
  const box = el('div', 'memo-bri');
  if (cfg.gap) box.appendChild(el('div', 'memo-bri-gap', cfg.gap));
  const row = el('div', 'memo-bri-row');
  row.append(
    island(cfg.left, false),
    el('span', 'memo-bri-link', ''),
    island(cfg.span, true),
    el('span', 'memo-bri-link', ''),
    island(cfg.right, false)
  );
  box.appendChild(row);
  return box;

  function island(o, isSpan) {
    const n = el('span', `memo-bri-node${isSpan ? ' span' : ''}`);
    n.append(el('span', 'memo-bri-name', (o || {}).name), el('span', 'memo-bri-note', (o || {}).note));
    return n;
  }
}

/* ---------- 블록: 기존 구조 위에 얹히는 조각 ---------- */

function blockGraft(cfg) {
  const box = el('div', 'memo-gra');
  const add = el('div', 'memo-gra-add');
  add.append(
    el('span', 'memo-gra-name', (cfg.added || {}).name),
    el('span', 'memo-gra-cond', (cfg.added || {}).cond)
  );
  box.append(add, el('div', 'memo-gra-drop', '▼'));
  const base = el('div', 'memo-gra-base');
  (cfg.base || []).forEach((t) => base.appendChild(el('span', 'memo-gra-part', t)));
  box.append(base, el('div', 'memo-gra-label', cfg.base_label));
  return box;
}

/* ---------- 블록: 두 몫으로 가른 분담표 ---------- */

function blockSplit(cfg) {
  const box = el('div', 'memo-spl');
  if (cfg.title) box.appendChild(el('div', 'memo-spl-title', cfg.title));
  const cols = el('div', 'memo-spl-cols');
  (cfg.columns || []).forEach((c) => {
    const col = el('div', `memo-spl-col${c.keep ? ' keep' : ''}`);
    col.appendChild(el('span', 'memo-spl-name', c.name));
    (c.items || []).forEach((t) => col.appendChild(el('span', 'memo-spl-item', t)));
    cols.appendChild(col);
  });
  box.appendChild(cols);
  return box;
}

/* ---------- ---------- */

function sep(ch) {
  return el('span', 'memo-sep', ch);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
