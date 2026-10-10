import { animate, effects, reducedMotion } from '../motion/animate.js';
import { T } from '../text.js';

// E5 — 편성 화면이 곧 조작판(10/07 사용자 승인 시안). 방문자가 직접 한 장을 바꾼다.
//
// 고정 네 장 옆 다섯째 자리가 '지금의 편성'이고, 그 옆에 후보 세 장(세 관계의 카드)을 펼쳐 둔다. 하나를 고르면
// 그 카드가 다섯째 자리로 올라가고(내려온 카드는 후보 자리로), 같은 세트 구성원끼리 실이 이어지며 실 위에 세트 이름이 뜬다.
// 두 번째 버튼 없이 바로 여정이 재생된다 — 고정 일정 · 기존 이벤트는 그대로 지나가고, 빈 이벤트 시간에만 관계가 더해진다.
// 원인(실)과 결과(채워지는 빈 시간)가 한 화면에 놓이도록, 다섯째 카드 아래에서 실이 곧장 빈 시간의 핀으로 떨어진다.
// 이전 여정(지금의 편성)은 위에 얇은 유령 줄로 남아, 같은 열의 '그대로 비어 있음'과 나란히 읽힌다.
//
// 더해지는 것(세트 이벤트 · 스킬 강화 · 편성 효과)은 빈 시간 한 칸에 모인다(10/03 결정 그대로). 실은 그 원인을 가리킬 뿐이다.
// 진행 박자는 데이터(beats)대로다. 상태가 먼저이고 움직임은 그 위에 얹는다 — 한 타이머가 Date.now()로 지난 시간을 보고,
// 가려진 탭 · 움직임 줄이기는 진행을 끝까지 한 번에 마친다.
// kit.reach — 누른 뒤 볼 것을 화면에 들이는 껍데기의 도구(views/brief.js, 10/11 재5). 본체만 띄우는 테스트에는 없다
export function playOneCard(host, cfg, onComplete, _ev, kit = {}) {
  const t = cfg.labels;
  const cards = cfg.cards;
  const beats = cfg.beats; // [{ id, at }] — 켜지는 것: s0 i0 s1 i1 s2 i2 ready s3 event reward end
  const order = beats.map((b) => b.id);
  const swapAt = cfg.base.indexOf(cfg.swap_out);
  const firstBench = cfg.sets.map((s) => s.swap);
  const state = { set: null, step: 0, running: false, done: false, picked: false };
  let timer = null;
  let started = 0;
  let recapShown = false;
  let dead = false;
  let picks = 0; // 방문자가 후보를 고른 횟수
  let stopAgain = null; // '한 번 더' 표시가 화면에 들어오기를 기다리는 관찰자

  const root = el('div', 'ocx');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'ocx-svg');
  svg.setAttribute('aria-hidden', 'true');
  const knot = el('span', 'ocx-knot');
  knot.setAttribute('aria-hidden', 'true');
  const board = el('section', 'ocx-board');
  const journey = el('section', 'ocx-journey');
  const caption = el('p', 'oc-caption brief-concl-line');
  caption.setAttribute('role', 'status');
  caption.setAttribute('aria-live', 'polite');
  // 여정이 끝난 뒤의 결론 한 줄 — 다섯 페이지 공통 부품(이름표 + 17px 굵은 한 줄, 10/10 사용자 동의 마6). 전에는 초록 네모가 붙은 14.7px
  const concl = el('div', 'brief-concl oc-concl');
  concl.append(el('span', 'brief-concl-key', T('brief.conclusion')), caption);
  root.append(svg, knot, board, journey, concl, el('p', 'oc-note', t.note));
  host.append(root);
  // 처음 누를 것 — 후보 패. 안내 말풍선은 첫 선택까지만(껍데기가 머리말에서 안내를 뺐을 때만 붙는다)
  const hint = cfg.lead?.prompt_at === 'action' && t.pick_hint ? el('p', 'cue-note', t.pick_hint) : null;

  function onVisibility() { if (document.hidden && state.running) settle(); }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', layout);

  // ---------- 편성 ----------
  const fmt = (tpl, map) => tpl.replace(/\{(\w+)\}/g, (_, k) => (map[k] ?? ''));
  const quote = (title) => fmt(t.event_format, { t: title });
  const setOf = () => cfg.sets.find((s) => s.id === state.set) || null;
  const formationOf = (set) => cfg.base.map((id, i) => (set && i === swapAt ? set.swap : id));

  function buildBoard() {
    const set = setOf();
    const formation = formationOf(set);
    const fifth = formation[swapAt];
    const members = set ? set.members : [];
    // 후보 패는 자리를 지킨다 — 고른 카드가 다섯째 자리로 올라가면, 내려온 카드가 그 빈자리에 들어간다(맞바꾸기)
    const bench = firstBench.map((id) => (id === fifth ? cfg.swap_out : id));
    const focusAt = board.contains(document.activeElement) ? [...board.querySelectorAll('.ocx-pick')].indexOf(document.activeElement) : -1;

    board.setAttribute('aria-label', set ? t.after : t.before);
    const row = el('div', 'ocx-row');
    const card = (id, { five = false } = {}) => {
      const fig = el('figure', 'ocx-card');
      fig.dataset.id = id;
      if (members.includes(id)) fig.classList.add('is-member');
      if (five) fig.classList.add('is-five');
      if (five && set) fig.classList.add('is-swapped');
      // 이름은 그림 설명(figcaption)이 말한다 — 그림 대체 글에도 넣으면 같은 이름을 두 번 읽었다(10/06 점검)
      const img = el('img'); img.src = cards[id].image; img.alt = ''; img.loading = 'lazy';
      fig.append(img, el('figcaption', '', cards[id].name));
      if (five && set) fig.append(el('em', 'oc-one', t.one_card));
      return fig;
    };
    formation.slice(0, swapAt).forEach((id) => row.append(card(id)));
    const five = el('div', 'ocx-five');
    const tray = el('div', 'ocx-tray');
    tray.append(card(fifth, { five: true }));
    const benchWrap = el('div', 'ocx-bench-wrap');
    benchWrap.append(el('p', 'ocx-bench-label', state.picked ? t.choose : ''));
    const benchEl = el('div', `ocx-bench${state.picked ? '' : ' cue'}`);
    benchEl.setAttribute('role', 'group');
    benchEl.setAttribute('aria-label', t.choose);
    bench.forEach((id) => {
      const pick = el('button', 'ocx-pick');
      pick.type = 'button';
      pick.dataset.id = id;
      const img = el('img'); img.src = cards[id].image; img.alt = ''; img.loading = 'lazy';
      pick.append(img, el('span', '', cards[id].name));
      pick.addEventListener('click', () => choose(id));
      benchEl.append(pick);
    });
    benchWrap.append(benchEl);
    tray.append(benchWrap);
    five.append(tray);
    if (hint) { hint.hidden = state.picked; five.append(hint); }
    row.append(five);
    const counts = el('p', 'ocx-counts');
    counts.append(el('b', '', set ? t.after : t.before));
    cfg.sets.forEach((s) => {
      const have = s.members.filter((m) => formation.includes(m)).length;
      counts.append(el('span', have >= s.required ? 'is-on' : '', `${s.short} ${have} / ${s.required}`));
    });
    row.append(counts);
    board.replaceChildren(row);
    // 누른 버튼이 다시 그려져도 초점은 같은 자리의 후보에 남는다
    if (focusAt >= 0) board.querySelectorAll('.ocx-pick')[Math.min(focusAt, bench.length - 1)]?.focus({ preventScroll: true });
  }

  // ---------- 여정 — 열 = 시간(일정과 그 뒤 이벤트), 행 = 일정 이름 · 유령 줄(지금의 편성) · 지금 줄 ----------
  function buildJourney() {
    const set = setOf();
    const place = (n, col, rowAt) => { n.style.setProperty('--t', col); n.style.setProperty('--l', rowAt); return n; };
    const stage = place(el('div', 'ocx-stage'), 6, '1 / 4');
    if (set) stage.dataset.beat = 'event'; // 빈 시간에 들어서는 박자에 무대의 불이 켜진다
    const parts = [stage];
    const lastStop = cfg.stops.length - 1;
    cfg.stops.forEach((name, i) => {
      const last = i === lastStop;
      const stop = place(el('div', 'ocx-stop'), last ? 7 : i + 2, 1);
      if (!last) stop.dataset.beat = `s${i}`;
      stop.append(el('strong', '', name), el('small', '', last ? t.next : t.fixed));
      parts.push(stop);
    });
    parts.push(place(el('div', 'ocx-stage-name', t.empty), 6, 1));
    const lanes = set ? [{ kind: 'ghost', f: formationOf(null), tag: t.before }, { kind: 'main', f: formationOf(set), tag: t.after }] : [{ kind: 'main', f: formationOf(null), tag: t.before }];
    lanes.forEach((lane) => {
      const r = lane.kind === 'ghost' ? 2 : 3;
      const tag = place(el('div', `ocx-lane is-${lane.kind}`, lane.tag), 1, r);
      if (lane.kind === 'main' && set) tag.append(el('small', 'ocx-running', t.running));
      parts.push(tag, place(el('i', `ocx-line is-${lane.kind}`), '2 / 6', r), place(el('i', `ocx-line is-${lane.kind} is-gap`), 6, r));
      const laneFifth = lane.f[swapAt];
      cfg.stops.forEach((_, i) => {
        const last = i === lastStop;
        const cell = place(el('div', `ocx-cell is-${lane.kind}`), last ? 7 : i + 2, r);
        cell.dataset.stop = String(i);
        if (lane.kind === 'main' && !last) cell.dataset.dot = `s${i}`;
        cell.append(el('span', `ocx-dot${last ? ' is-next' : ''}`));
        if (i < 3) {
          // 기존 이벤트 세 개 — 레일에는 얼굴만, 제목은 대체 글(마우스 · 초점 · 낭독)로 남긴다.
          // 바꾼 카드의 이벤트는 기존 규칙대로 달라지지만 표시하지 않는다 — 눈은 빈 시간으로 가야 한다
          if (lane.kind === 'main') cell.dataset.faces = `i${i}`;
          const faces = el('span', 'ocx-faces');
          [[cfg.protagonist, quote(cards[cfg.protagonist].events[i])], [laneFifth, quote(cards[laneFifth].events[i])], [cfg.others[i], null]].forEach(([id, title]) => {
            const img = el('img');
            img.src = cards[id].image;
            img.alt = title ? `${cards[id].name} ${title}` : `${t.arcana_event} ${cards[id].name}`;
            img.title = img.alt;
            img.loading = 'lazy';
            faces.append(img);
          });
          cell.append(faces);
        }
        parts.push(cell);
      });
    });
    if (set) {
      parts.push(place(el('i', 'ocx-line is-main is-progress'), '2 / 8', 3), place(el('i', 'ocx-head'), '2 / 8', 3));
      // 무대 — 위(지금의 편성)는 '그대로 비어 있음', 아래(한 장을 바꾼 편성)는 더해진 것들
      const ghostCell = place(el('div', 'ocx-stage-ghost'), 6, 2);
      ghostCell.append(el('span', 'ocx-empty', t.stays_empty));
      ghostCell.dataset.beat = 'event';
      parts.push(ghostCell);
    }
    const main = place(el('div', 'ocx-stage-main'), 6, 3);
    if (set) {
      const pin = el('span', 'ocx-stage-pin');
      pin.dataset.beat = 'event';
      main.append(pin);
      const pay = el('div', 'ocx-pay');
      const insert = el('div', 'oc-insert');
      insert.dataset.beat = 'event';
      insert.append(el('small', '', t.set_event), el('strong', '', set.event ? quote(set.event) : t.tbd));
      const reward = el('p', 'oc-reward');
      reward.dataset.beat = 'reward';
      reward.append(el('strong', '', fmt(t.skill, { n: set.skill })), el('span', '', t.reward));
      const trait = el('p', 'oc-pay-trait');
      trait.dataset.beat = 'reward';
      trait.append(el('small', '', t.trait), el('strong', '', set.trait));
      pay.append(insert, reward, trait);
      main.append(pay);
    }
    parts.push(main);
    journey.replaceChildren(...parts);
  }

  // ---------- 상태 → 화면 ----------
  const lit = (beat) => state.step > order.indexOf(beat);

  function paint() {
    // 첫 화면은 편성 줄과 후보 패만(10/07 사용자 결정 — 첫 화면의 정보를 줄인다). 처음 고르면 두 여정이 아래로 펼쳐진다
    const opening = root.classList.contains('ocx-closed') && state.picked;
    root.classList.toggle('ocx-closed', !state.picked);
    if (opening) animate(journey, effects.slide);
    root.dataset.state = !state.set ? 'a' : state.done ? 'c' : 'b';
    root.dataset.step = String(state.step);
    root.dataset.done = String(state.done);
    journey.querySelectorAll('[data-beat]').forEach((n) => n.classList.toggle('is-lit', lit(n.dataset.beat)));
    journey.querySelectorAll('[data-dot]').forEach((n) => n.classList.toggle('dot-lit', lit(n.dataset.dot)));
    journey.querySelectorAll('[data-faces]').forEach((n) => n.classList.toggle('faces-lit', lit(n.dataset.faces)));
    const run = journey.querySelector('.ocx-running');
    if (run) run.hidden = !state.running;
    const line = state.done ? t.caption : '';
    if (caption.textContent !== line) caption.textContent = line;
    layout();
  }

  // 관계의 실 · 재생 헤드 — 그림 자리는 화면을 그린 뒤에 잰다(창 크기가 바뀌면 다시)
  function layout() {
    if (dead) return;
    drawThread();
    placeHead();
  }

  // 구성원 카드 위쪽 가운데에 핀을 꽂고, 이웃한 구성원끼리 카드 위로 둥글게 넘어가는 실을 건다.
  // 다섯째 카드 아래에서 실이 곧장 내려가 빈 이벤트 시간의 핀에 닿는다(원인 → 결과를 한 줄로)
  function drawThread() {
    const R = root.getBoundingClientRect();
    svg.setAttribute('width', R.width);
    svg.setAttribute('height', R.height);
    svg.setAttribute('viewBox', `0 0 ${R.width} ${R.height}`);
    svg.replaceChildren();
    const set = setOf();
    knot.hidden = !set;
    if (!set) return;
    knot.textContent = set.name;
    const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); svg.append(n); return n; };
    const narrow = matchMedia('(max-width: 1180px)').matches;
    const pins = set.members
      .map((id) => board.querySelector(`.ocx-card[data-id="${id}"] img`))
      .filter(Boolean)
      .map((img) => { const r = img.getBoundingClientRect(); return { x: r.left + r.width / 2 - R.left, y: r.top + (narrow ? 8 : 12) - R.top }; })
      .sort((p, q) => p.x - q.x);
    let best = null;
    for (let i = 0; i < pins.length - 1; i += 1) {
      const a = pins[i];
      const c = pins[i + 1];
      const span = c.x - a.x;
      const lift = narrow ? Math.min(52, 18 + span * 0.14) : Math.min(92, 30 + span * 0.12);
      const d = `M${a.x} ${a.y} Q${(a.x + c.x) / 2} ${a.y - lift} ${c.x} ${c.y}`;
      mk('path', { class: 'halo', d });
      mk('path', { class: 'string', d });
      if (!best || span > best.span) best = { span, x: (a.x + c.x) / 2, y: a.y - lift / 2 };
    }
    if (!narrow) {
      const fiveImg = board.querySelector('.ocx-card.is-five img');
      const fiveCap = board.querySelector('.ocx-card.is-five figcaption');
      const stagePin = journey.querySelector('.ocx-stage-pin');
      if (fiveImg && fiveCap && stagePin) {
        const fr = fiveImg.getBoundingClientRect();
        const cr = fiveCap.getBoundingClientRect();
        const pr = stagePin.getBoundingClientRect();
        const x0 = fr.left + fr.width / 2 - R.left;
        const y0 = cr.bottom + 8 - R.top;
        const x1 = pr.left + pr.width / 2 - R.left;
        const y1 = pr.top + pr.height / 2 - R.top;
        const d = `M${x0} ${y0} C${x0} ${(y0 + y1) / 2} ${x1} ${(y0 + y1) / 2} ${x1} ${y1 - 8}`;
        if (state.done) mk('path', { class: 'halo', d });
        mk('path', { class: `drop${state.done ? '' : ' is-pending'}`, d });
        mk('circle', { class: 'pin', cx: x0, cy: y0, r: 4 });
      }
    }
    pins.forEach((p) => { mk('circle', { class: 'pin-halo', cx: p.x, cy: p.y, r: narrow ? 7 : 9 }); mk('circle', { class: 'pin', cx: p.x, cy: p.y, r: narrow ? 4.5 : 6 }); });
    if (best) {
      knot.style.left = `${best.x}px`;
      knot.style.top = `${best.y}px`;
    }
  }

  // 재생 헤드 — 지금 켜진 마지막 일정(빈 시간에 들어서면 그 핀) 위. 끝나면 줄 전체가 초록이 되고 헤드는 사라진다
  function placeHead() {
    const lineEl = journey.querySelector('.ocx-line.is-main:not(.is-progress):not(.is-gap)');
    if (!lineEl || !state.set) return;
    let target = null;
    if (lit('event')) target = journey.querySelector('.ocx-stage-pin');
    else {
      for (let i = 3; i >= 0; i -= 1) if (lit(`s${i}`)) { target = journey.querySelector(`.ocx-cell.is-main[data-stop="${i}"] .ocx-dot`); break; }
    }
    if (!target) target = journey.querySelector('.ocx-cell.is-main[data-stop="0"] .ocx-dot');
    const lr = lineEl.getBoundingClientRect();
    const dr = target.getBoundingClientRect();
    journey.style.setProperty('--head', `${Math.max(6, dr.left + dr.width / 2 - lr.left + 6)}px`);
  }

  // ---------- 고르기 → 재생 ----------
  // 처음 고르면 여정을 재생한다. 그다음부터는 바꾼 관계를 끝난 모습으로 바로 보여 주고 빈 시간에 한 번 불을 켠다.
  // 처음 카드(다섯째 자리의 원래 카드)로 돌리면 실이 사라지고 처음 화면으로 돌아간다
  function choose(id) {
    if (dead) return;
    const set = cfg.sets.find((s) => s.swap === id) || null;
    stop();
    state.running = false;
    const first = !state.picked;
    state.picked = true;
    picks += 1;
    stopAgain?.();
    state.set = set ? set.id : null;
    buildBoard();
    buildJourney();
    if (!set) { state.step = 0; state.done = false; paint(); return; }
    if (first && !reducedMotion() && !document.hidden) {
      state.step = 0;
      state.done = false;
      state.running = true;
      started = Date.now();
      paint();
      bringResult();
      // 한 타이머가 지난 시간에서 걸음을 다시 계산한다 — 한 번 건너뛴 틱이 진행을 멈추지 않는다
      timer = setInterval(tick, 80);
      return;
    }
    state.step = beats.length;
    finish();
    bringResult();
    if (!first) animate(journey.querySelector('.ocx-stage'), [{ boxShadow: '0 0 0 10px rgba(213,233,168,.95)' }, { boxShadow: '0 0 0 4px rgba(213,233,168,.7)' }], { duration: 800 });
  }

  // 고른 뒤 결과(빈 시간 칸에서 결론 한 줄까지)가 화면 밖이면 보일 만큼만 화면을 옮긴다 — 화면 폭과 상관없이(10/11 재5. 전에는 ≤1180px에서만
  // 여정의 머리를 머리띠 밑까지 올렸다 — 10/10 마7). 1366×768 · 1280×720 · 1536×864에서 결론 줄이 화면 아래였다. 결론 줄은 여정이 끝나야 나타나므로
  // 그 자리(위 여백 + 이름표 + 문장)를 같은 문장으로 미리 재어 넣는다. 다 들지 않으면 빈 시간 칸부터 보인다. 움직임 줄이기면 바로 옮긴다
  function bringResult() {
    const stage = journey.querySelector('.ocx-stage-main');
    if (!stage || !kit.reach) return;
    const j = journey.getBoundingClientRect();
    kit.reach([{ top: stage.getBoundingClientRect().top, bottom: j.bottom + conclHeight() }]);
  }
  // 결론 줄이 나타나면 차지할 높이(위 여백 포함) — 보이지 않는 사본에 같은 문장을 넣어 잰다(화면 낭독기 알림 칸은 건드리지 않는다)
  function conclHeight() {
    if (concl.getClientRects().length) return concl.getBoundingClientRect().height + parseFloat(getComputedStyle(concl).marginTop || 0);
    const ghost = concl.cloneNode(true);
    const line = ghost.querySelector('.oc-caption');
    line.removeAttribute('role');
    line.removeAttribute('aria-live');
    line.textContent = t.caption || '';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.cssText = 'position:absolute;left:0;right:0;top:0;visibility:hidden;pointer-events:none';
    root.append(ghost);
    const h = ghost.getBoundingClientRect().height + parseFloat(getComputedStyle(ghost).marginTop || 0);
    ghost.remove();
    return h;
  }

  function tick() {
    if (dead) return;
    const step = beats.filter((b) => b.at <= Date.now() - started).length;
    if (step !== state.step) { state.step = step; paint(); }
    if (step >= beats.length) finish();
  }

  function settle() {
    stop();
    state.step = beats.length;
    finish();
  }

  function finish() {
    stop();
    state.running = false;
    state.done = true;
    paint();
    if (!recapShown) { recapShown = true; onComplete({ scroll: false }); }
    callAgain();
  }

  // 첫 결과가 나온 뒤 '한 번 더'(10/11 사용자 결정 재9 — DESIGN.md 13절 원칙 7 '끝은 열어 둔다'): 후보 패에 세 번만 퍼지는 표시(.cue-step).
  // 처음 표시(.cue)는 첫 선택에 거뒀으니 한 화면에 누를 것은 이것 하나다. 다시 고르면 거둔다(buildBoard가 표시 없이 다시 그린다)
  function callAgain() {
    if (picks !== 1 || !state.set) return;
    const bench = board.querySelector('.ocx-bench');
    if (!bench || bench.classList.contains('cue')) return;
    bench.classList.add('cue', 'cue-step');
    if (typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      bench.classList.add('cue-seen');
    }, { threshold: 0.6 });
    io.observe(bench);
    stopAgain = () => { io.disconnect(); stopAgain = null; };
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  // 끝의 '다시 해보기'(처음 편성으로 되돌리고 첫 후보로 초점을 옮기던 길)는 10/10 사용자 결정(바3)으로 뺐다 —
  // 후보 패가 그대로 '다른 관계로 바꿔 보기'이고, 처음 카드를 고르면 처음 모습으로 돌아간다

  function el(tag, cls = '', text) {
    const node = document.createElement(tag); if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text; return node;
  }

  buildBoard();
  buildJourney();
  paint();
  // 그림이 늦게 실리면 자리가 바뀔 수 있다 — 다 실린 뒤에 실을 다시 잰다(그림 비율은 고정이라 대개 그대로다)
  root.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', layout, { once: true }); });
  return {
    destroy() { dead = true; stop(); stopAgain?.(); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('resize', layout); },
  };
}
