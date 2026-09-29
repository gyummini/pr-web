// E8 — 개발 회고(PokeCollect). 다른 브리프와 달리 인터랙션이 없다. 워드로 쓰던 회고를 그대로 웹에 옮긴
// 문서라서, 장마다 결정과 이유(굵은 한 단락) → 짧은 본문 → 그림·움짤 순서로 읽힌다.
// 텍스트와 그림 경로는 전부 콘텐츠_증거카드.json의 brief 필드에서 온다(하드코딩 금지).
//
// 블록 종류: verdict(결정과 이유), p(본문), h(소제목), list(글머리표), figure(그림 한 장), pair(참고 | 결과),
// roles(제가 한 일 | AI가 한 일), table(표), sources(출처 링크).
// 문서의 끝 줄은 '직접 플레이하기' 버튼이다(/api/play → 개인 키 발급). 새 탭으로 열어 라우터를 거치지 않는다.
// 넓은 화면(PC)에서는 본문 왼쪽 여백에 장 목록이 따라 내려오고, 지금 읽는 장을 표시한다(좁은 화면은 위의 장 목록).
import { track } from '../analytics.js';

export function playRetro(host, b) {
  const root = el('div', 'rt');
  if (b.cover) root.appendChild(cover(b.cover));
  if ((b.chapters || []).length > 1) root.appendChild(contents(b.chapters, root));
  (b.chapters || []).forEach((ch) => root.appendChild(chapter(ch)));
  if (b.credits) root.appendChild(credits(b.credits));
  if (b.play) root.appendChild(play(b.play));
  const side = (b.chapters || []).length > 1 ? rail(b, root) : null;
  if (side) root.appendChild(side.nav);
  host.appendChild(root);
  return { restart: null, destroy() { side?.stop(); } };
}

// ---------------------------------------------------------------- 표지

function cover(c) {
  const box = el('section', 'rt-cover');
  if (c.meta?.length) {
    const meta = el('dl', 'rt-meta');
    c.meta.forEach(([k, v]) => meta.append(el('dt', null, k), el('dd', null, v)));
    box.appendChild(meta);
  }
  if (c.figure) box.appendChild(figure(c.figure));
  if (c.glance) {
    const g = el('div', 'rt-glance');
    g.appendChild(el('h4', 'rt-glance-title', c.glance.title));
    g.appendChild(list(c.glance.items));
    box.appendChild(g);
  }
  if (c.stats?.length) {
    const s = el('div', 'rt-stats');
    c.stats.forEach(([value, label]) => {
      const cell = el('div', 'rt-stat');
      cell.append(el('strong', null, value), el('span', null, label));
      s.appendChild(cell);
    });
    box.appendChild(s);
  }
  return box;
}

// 긴 문서라 장 목록을 둔다. 앵커 대신 버튼으로 옮긴다(라우터가 해시를 경로로 바꾸지 않게)
function contents(chapters, root) {
  const nav = el('nav', 'rt-toc');
  nav.setAttribute('aria-label', '장 목록');
  chapters.forEach((ch) => {
    const button = el('button', 'rt-toc-item');
    button.type = 'button';
    button.append(el('span', 'rt-toc-no', ch.no), el('span', null, ch.word));
    button.addEventListener('click', () => root.querySelector(`[data-chapter="${ch.no}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    nav.appendChild(button);
  });
  return nav;
}

// PC의 옆 목차. 본문 칸 왼쪽에 붙어 스크롤을 따라 내려오고(CSS sticky), 화면 위쪽 40% 선을 지난 마지막 장을 표시한다.
// 좁은 화면에서는 CSS가 숨기므로 그동안은 계산하지 않는다. 브리프를 떠나면 destroy가 리스너를 푼다
function rail(b, root) {
  const nav = el('nav', 'rt-rail');
  nav.setAttribute('aria-label', '장 바로가기');
  const list = el('ol', 'rt-rail-list');
  const marks = [];
  const add = (no, word, find, cls) => {
    const li = el('li', cls);
    const button = el('button', 'rt-rail-item');
    button.type = 'button';
    if (no) button.appendChild(el('span', 'rt-rail-no', no));
    button.appendChild(el('span', null, word));
    button.addEventListener('click', () => find()?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    li.appendChild(button);
    list.appendChild(li);
    marks.push({ button, find });
  };
  b.chapters.forEach((ch) => add(ch.no, ch.word, () => root.querySelector(`[data-chapter="${ch.no}"]`)));
  if (b.credits) add(null, '저작권과 출처', () => root.querySelector('.rt-credits'), 'rt-rail-end');
  if (b.play) add(null, '직접 플레이', () => root.querySelector('.rt-play'), b.credits ? null : 'rt-rail-end');
  nav.appendChild(list);

  let frame = 0;
  const update = () => {
    frame = 0;
    if (!nav.isConnected || !nav.offsetParent) return;
    const line = window.innerHeight * 0.4;
    const page = document.scrollingElement || document.documentElement;
    const atEnd = page.scrollTop + window.innerHeight >= page.scrollHeight - 4;
    let on = -1;
    marks.forEach((m, i) => {
      const target = m.find();
      if (target && target.getBoundingClientRect().top <= line) on = i;
    });
    if (atEnd && on >= 0) on = marks.length - 1;
    marks.forEach((m, i) => {
      m.button.classList.toggle('on', i === on);
      if (i === on) m.button.setAttribute('aria-current', 'true');
      else m.button.removeAttribute('aria-current');
    });
  };
  const soon = () => { if (!frame) frame = requestAnimationFrame(update); };
  document.addEventListener('scroll', soon, { passive: true, capture: true });
  window.addEventListener('resize', soon, { passive: true });
  soon();
  return {
    nav,
    stop() {
      document.removeEventListener('scroll', soon, { capture: true });
      window.removeEventListener('resize', soon);
      if (frame) cancelAnimationFrame(frame);
    },
  };
}

// ---------------------------------------------------------------- 장

function chapter(ch) {
  const sec = el('section', 'rt-chapter');
  sec.dataset.chapter = ch.no;
  const label = el('div', 'rt-label');
  label.append(el('span', 'rt-no', ch.no), el('span', 'rt-word', ch.word));
  sec.append(label, el('h3', 'rt-title', ch.title));
  (ch.blocks || []).forEach((bk) => sec.appendChild(block(bk)));
  return sec;
}

function block(bk) {
  if (bk.verdict) return el('p', 'rt-verdict', bk.verdict);
  if (bk.p) return el('p', 'rt-p', bk.p);
  if (bk.h) return el('h4', 'rt-h', bk.h);
  if (bk.list) return list(bk.list);
  if (bk.figure) return figure(bk.figure);
  if (bk.pair) return pair(bk.pair);
  if (bk.roles) return roles(bk.roles);
  if (bk.table) return table(bk.table);
  if (bk.sources) return sources(bk.sources);
  return el('div');
}

function list(items) {
  const ul = el('ul', 'rt-list');
  (items || []).forEach((t) => ul.appendChild(el('li', null, t)));
  return ul;
}

// 그림 한 장. 움짤(gif)도 같은 <img>로 둔다. 크기를 미리 알려 불러오는 동안 자리가 흔들리지 않게 한다.
// 캡션이 그림을 설명하므로 alt는 비운다(같은 문장이 두 번 읽히거나 복사되지 않게)
function figure(f) {
  const fig = el('figure', 'rt-fig');
  const img = document.createElement('img');
  img.src = f.src;
  img.alt = f.caption ? '' : (f.alt || '');
  img.loading = 'lazy';
  img.decoding = 'async';
  if (f.w && f.h) {
    img.width = f.w;
    img.height = f.h;
  }
  if (f.max) fig.style.setProperty('--rt-max', `${f.max}px`);
  fig.appendChild(img);
  if (f.caption) {
    const cap = el('figcaption');
    if (f.tag) cap.appendChild(el('span', `rt-tag${f.tag === '결과' ? ' result' : ''}`, f.tag));
    cap.appendChild(document.createTextNode(f.caption));
    fig.appendChild(cap);
  }
  return fig;
}

// 참고한 것 | 만든 것
function pair(items) {
  const row = el('div', 'rt-pair');
  items.forEach((f) => row.appendChild(figure(f)));
  return row;
}

function roles(r) {
  const box = el('div', 'rt-roles');
  [['mine', r.mine_label || '제가 한 일', r.mine], ['ai', r.ai_label || 'AI가 한 일', r.ai]].forEach(([cls, head, text]) => {
    const cell = el('div', `rt-role ${cls}`);
    cell.append(el('strong', null, head), el('p', null, text));
    box.appendChild(cell);
  });
  return box;
}

function table(t) {
  const wrap = el('div', 'rt-table-wrap');
  const tb = el('table', 'rt-table');
  if (t.caption) tb.appendChild(el('caption', null, t.caption));
  const thead = el('thead');
  const hr = el('tr');
  (t.head || []).forEach((h) => hr.appendChild(el('th', null, h)));
  thead.appendChild(hr);
  const tbody = el('tbody');
  (t.rows || []).forEach((r) => {
    const tr = el('tr');
    r.forEach((c) => tr.appendChild(el('td', null, c)));
    tbody.appendChild(tr);
  });
  tb.append(thead, tbody);
  wrap.appendChild(tb);
  return wrap;
}

function sources(items) {
  const box = el('div', 'rt-sources');
  box.appendChild(el('span', 'rt-sources-head', '출처'));
  const ol = el('ol');
  items.forEach((s) => {
    const li = el('li');
    const a = el('a', null, s.label);
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    li.appendChild(a);
    ol.appendChild(li);
  });
  box.appendChild(ol);
  return box;
}

// ---------------------------------------------------------------- 저작권 전문과 끝 줄

function credits(c) {
  const sec = el('section', 'rt-credits');
  sec.appendChild(el('h3', 'rt-credits-title', c.title));
  (c.groups || []).forEach((g) => {
    const group = el('div', 'rt-credit-group');
    group.appendChild(el('h4', null, g.heading));
    (g.lines || []).forEach((line) => group.appendChild(el('p', null, line)));
    sec.appendChild(group);
  });
  if (c.notice) {
    const n = el('div', 'rt-notice');
    n.append(el('strong', null, c.notice.title), el('p', null, c.notice.text));
    sec.appendChild(n);
  }
  return sec;
}

function play(p) {
  const box = el('div', 'rt-play');
  const a = el('a', 'btn accent rt-play-btn', p.label);
  a.href = p.href;
  a.target = '_blank';   // 라우터가 가로채지 않게, 키 카드는 새 탭에서
  a.rel = 'noopener';
  a.addEventListener('click', () => track('play_click', { evidence: 'E8' }));
  box.appendChild(a);
  if (p.note) box.appendChild(el('p', 'rt-play-note', p.note));
  return box;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
