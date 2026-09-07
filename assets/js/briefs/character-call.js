import { animate, sequence, effects, reducedMotion } from '../motion/animate.js';
import { fromRect, moveFrom } from '../motion/flip.js';
import { revealOnce } from '../motion/reveal.js';
// E1 · 캐릭터 호출 — 각인된 한 줄이 어떻게 입체감이 되는가.
//
// 다섯 장을 스크롤로 지난다. 버튼으로 넘기는 단계가 아니라, 내려가는 동안 벌어진다.
//   01 역설   — 37명을 한 화면에 늘어놓는다. 문제를 눈으로 먼저 본다.
//   02 첫인상 — 한 줄짜리 카드를 초상에 끌어다 맞춘다. 설명 없이 맞혀진다는 것이 논증이다.
//   03 호출   — 내려갈수록 회차가 흐르고, 맞힌 그 한 줄이 명찰이 되어 칸에 내려앉는다.
//               끝에서 "소모되는 것 아닐까" 하고 되감아 다시 내려가면, 이번엔 남은 것이 붙는다.
//   04 결과   — 한 줄은 그대로인데 축이 늘어 있다.
//   05 검증·적용 — 같은 패턴을 실제 서비스 게임과 본인 기획에서 확인한다.
//
// 화면에 나오는 글자는 전부 콘텐츠_증거카드.json에서 온다. 여기 있는 건 순서와 조건뿐이다.
//
// 연출은 전부 setTimeout이 몬다. requestAnimationFrame은 가려진 탭에서 멈추고,
// transitionend·onfinish도 오지 않는다 — 상태 변경을 거기 걸면 화면이 영영 잠긴다(함정 2·3).

const TRIGGER = 0.78; // 슬롯이 화면 이 높이까지 올라오면 그 회차가 발화한다
const STAGGER = 180; // 같은 화면에 여러 회차가 걸릴 때 서로 밀어 주는 간격

export function playCharacterCall(host, cfg, onComplete) {
  const cast = new Map((cfg.cast || []).map((c) => [c.id, c]));
  const order = (cfg.order || []).filter((id) => cast.has(id));
  const eps = (cfg.episodes || []).filter((e) => cast.has(e.c));
  const t = cfg.labels || {};

  // 레일에 붙을 축은 회차에서 뽑는다 — 한 곳에만 적어 두고 두 군데서 읽는다
  function facetsOf(id) {
    return eps.filter((e) => e.c === id).map((e) => e.gain_label);
  }

  let mode = 'call'; // 'call' → 되감기 → 'reveal'
  let filled = 0;
  let revealed = 0;
  let matched = 0;
  let suspend = false; // 자동 스크롤이 도는 동안 sweep을 멈춘다
  let worryShown = false;
  let drag = null;
  let selected = null;
  let stopScroll = null;
  let stopResult = null;
  let timers = [];
  let scrollIv = null;
  let dead = false;

  const root = document.createElement('div');
  root.className = 'cc';
  host.appendChild(root);

  const veil = document.createElement('div');
  veil.className = 'cc-rewinding';
  document.body.appendChild(veil);

  build();

  window.addEventListener('scroll', sweep, { passive: true });
  window.addEventListener('resize', sweep);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', cancelDrag);
  window.addEventListener('blur', cancelDrag);
  document.addEventListener('visibilitychange', onVisible);

  /* ---------- 뼈대 ---------- */

  function build() {
    root.textContent = '';
    const chs = cfg.chapters || [];
    chs.forEach((ch, i) => root.appendChild(chapter(ch, i, chs.length)));
    buildGrid();
    buildMatch();
    buildRail();
    buildStream();
    buildVerify();
    if (cfg.credit) {
      const p = el('p', 'cc-credit');
      p.textContent = cfg.credit;
      sect(4).appendChild(p);
    }
  }

  // 장 하나 — 머리말·제목·리드·꼬리말은 다섯 장이 모두 같은 모양이다
  function chapter(ch, i, total) {
    const s = el('section', 'cc-ch');
    s.dataset.n = String(i);
    if (i > 0) s.hidden = true;

    const head = el('div', 'cc-head');
    head.appendChild(txt('span', `${ch.no} · ${ch.name}`));
    const right = el('span');
    const b = el('b');
    b.textContent = ch.mark || '';
    right.append(b, document.createTextNode(` / ${String(total).padStart(2, '0')}`));
    head.appendChild(right);
    s.appendChild(head);
    s.appendChild(el('hr', 'cc-rule'));

    const bodyTop = el('div', 'cc-ch-top');
    s.appendChild(bodyTop);

    const body = el('div', 'cc-body');
    s.appendChild(body);

    return s;
  }

  // 화살표 const는 TDZ에 걸려 build()보다 먼저 선언돼야 한다.
  // 선언문으로 두면 호이스팅돼서 위아래 순서를 신경 쓸 일이 없다.
  function sect(i) {
    return root.querySelector(`.cc-ch[data-n="${i}"] .cc-body`);
  }
  function sectTop(i) {
    return root.querySelector(`.cc-ch[data-n="${i}"] .cc-ch-top`);
  }
  function chapterEl(i) {
    return root.querySelector(`.cc-ch[data-n="${i}"]`);
  }

  /* ---------- 01 · 역설 ---------- */

  function buildGrid() {
    const g = cfg.grid || {};
    const ch = (cfg.chapters || [])[0] || {};
    const hero = sectTop(0);

    // 제목·리드와 표지를 나란히 둔다. 글자만으로 시작하면 '100명'이 숫자로만 읽힌다.
    const wrap = el('div', 'cc-hero');
    const copy = el('div', 'cc-hero-copy');
    copy.appendChild(lines('h3', 'cc-title', ch.title));
    copy.appendChild(lines('p', 'cc-lede', ch.lede));
    wrap.appendChild(copy);

    const kv = cfg.key_visual;
    if (kv && kv.src) {
      const fig = el('figure', 'cc-hero-key');
      const img = el('img');
      img.src = kv.src;
      img.alt = '';
      fig.appendChild(img);
      const cap = el('figcaption');
      cap.appendChild(txt('i', kv.label || ''));
      cap.appendChild(lines('b', '', kv.name));
      fig.appendChild(cap);
      wrap.appendChild(fig);
    }
    hero.appendChild(wrap);

    const grid = el('div', 'cc-grid');
    const names = g.names || [];
    const cols = Number(g.sprite_cols) || 10;
    const rowCount = Number(g.sprite_rows) || 4;
    const cells = Number(g.cells) || names.length;
    for (let i = 0; i < cells; i += 1) {
      const c = el('div', 'cc-cell');
      if (i < names.length && g.sprite) {
        // 스프라이트를 퍼센트로 자른다. 10×4 배열이 이름 순서와 그대로 대응한다.
        c.className = 'cc-cell cc-face';
        c.title = names[i];
        c.style.backgroundImage = `url("${g.sprite}")`;
        c.style.backgroundSize = `${cols * 100}% ${rowCount * 100}%`;
        c.style.backgroundPositionX = `${((i % cols) / (cols - 1)) * 100}%`;
        c.style.backgroundPositionY = `${(Math.floor(i / cols) / (rowCount - 1)) * 100}%`;
      }
      grid.appendChild(c);
    }
    sect(0).appendChild(grid);

    const note = el('div', 'cc-grid-note');
    note.appendChild(txt('span', g.note || '', 'cc-mono'));
    note.appendChild(next(t.to_match, 1));
    sect(0).appendChild(note);
  }

  /* ---------- 02 · 첫인상 ---------- */

  function buildMatch() {
    const m = cfg.match || {};
    // 초상 셋은 지면의 왼쪽 절반만 쓴다 — 오른쪽이 비면 화면이 끝난 것처럼 보인다.
    // 왼쪽에 '무엇을 하는 칸인지'를 세워 두고, 퀴즈는 오른쪽에 몰아 붙인다.
    const quiz = el('div', 'cc-quiz');
    const side = el('div', 'cc-quiz-side');
    const s = m.side || {};
    side.appendChild(txt('div', s.label || '', 'cc-quiz-lab'));
    side.appendChild(lines('p', 'cc-quiz-t', s.title));
    side.appendChild(lines('p', 'cc-quiz-note', s.note));
    side.appendChild(txt('div', `0 / ${order.length}`, 'cc-quiz-count'));
    side.querySelector('.cc-quiz-count').setAttribute('aria-live', 'polite');
    const main = el('div', 'cc-quiz-main');
    quiz.append(side, main);
    sect(1).appendChild(quiz);

    const slots = el('div', 'cc-match');
    order.forEach((id) => {
      const s = el('button', 'cc-slot');
      s.type = 'button';
      s.setAttribute('aria-label', cast.get(id).name);
      s.addEventListener('click', () => { if (selected) matchPlate(selected, s, selected.getBoundingClientRect()); });
      s.dataset.id = id;
      tint(s, id);
      s.appendChild(faceOf(id, 'cc-slot-face'));
      const z = el('div', 'cc-zone');
      z.dataset.id = id;
      z.textContent = t.drop_here || '';
      s.appendChild(z);
      slots.appendChild(s);
    });
    main.appendChild(slots);

    const cards = el('div', 'cc-cards');
    (m.card_order || order).forEach((id) => {
      if (!cast.has(id)) return;
      const p = el('button', 'cc-plate');
      p.type = 'button';
      p.setAttribute('aria-pressed', 'false');
      p.addEventListener('click', () => {
        selected = p;
        cards.querySelectorAll('.cc-plate').forEach(card => card.setAttribute('aria-pressed', String(card === p)));
      });
      p.dataset.id = id;
      p.textContent = cast.get(id).core;
      cards.appendChild(p);
    });
    cards.addEventListener('pointerdown', onDown);
    main.appendChild(cards);
    main.appendChild(txt('p', t.match_help, 'cc-match-help'));
    const skip = next(t.skip_match, 2);
    skip.classList.add('cc-skip');
    main.appendChild(skip);

    const done = el('div', 'cc-match-done');
    done.hidden = true;
    done.appendChild(lines('p', 'cc-match-1', m.done_title));
    done.appendChild(lines('p', 'cc-match-2', m.done_line));
    done.appendChild(next(t.to_stream, 2));
    main.appendChild(done);
  }

  function onDown(e) {
    const p = e.target.closest('.cc-plate');
    if (!p || p.classList.contains('cc-used') || drag || e.button !== 0) return;
    e.preventDefault();
    const r = p.getBoundingClientRect();
    const ghost = p.cloneNode(true);
    ghost.classList.add('cc-drag');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.tabIndex = -1;
    ghost.style.left = `${r.left}px`;
    ghost.style.top = `${r.top}px`;
    ghost.style.width = `${r.width}px`;
    document.body.appendChild(ghost);
    p.style.opacity = '.25';
    drag = { src: p, ghost, pointer: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    p.setPointerCapture?.(e.pointerId);
  }

  // 사진·이름표·드롭박스 어디에 놓아도 받는다 — 카드 전체가 대상이다
  function slotAt(x, y) {
    const els = document.elementsFromPoint(x, y) || [];
    return els.find((n) => n.classList && n.classList.contains('cc-slot')) || null;
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    let x = e.clientX - drag.dx, y = e.clientY - drag.dy;
    const target = root.querySelector('.cc-slot[data-id="' + drag.src.dataset.id + '"]');
    const r = target.getBoundingClientRect();
    const distance = Math.hypot(Math.max(r.left - e.clientX, 0, e.clientX - r.right), Math.max(r.top - e.clientY, 0, e.clientY - r.bottom));
    const near = !target.querySelector('.cc-done') && distance < 44;
    if (near && !reducedMotion()) {
      const pull = .1 * (1 - distance / 44);
      x += Math.max(-70, Math.min(70, r.left + r.width / 2 - e.clientX)) * pull;
      y += Math.max(-70, Math.min(70, r.top + r.height / 2 - e.clientY)) * pull;
    }
    drag.ghost.style.left = x + 'px'; drag.ghost.style.top = y + 'px';
    const over = slotAt(e.clientX, e.clientY);
    root.querySelectorAll('.cc-slot').forEach(sl => {
      sl.classList.toggle('cc-near', sl === target && near);
      sl.classList.toggle('cc-over', sl === over && !sl.querySelector('.cc-done'));
    });
  }

  function cancelDrag() {
    if (!drag) return;
    drag.src.style.opacity = '';
    if (drag.src.hasPointerCapture?.(drag.pointer)) drag.src.releasePointerCapture(drag.pointer);
    drag.ghost.remove(); drag = null;
    root.querySelectorAll('.cc-slot').forEach(n => n.classList.remove('cc-near', 'cc-over'));
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const { src, ghost } = drag;
    const from = ghost.getBoundingClientRect();
    const slot = slotAt(e.clientX, e.clientY);
    cancelDrag();
    if (slot) matchPlate(src, slot, from);
    else fromRect(src, from, { duration: 260 });
  }

  function matchPlate(src, slot, from) {
    const zone = slot.querySelector('.cc-zone');
    if (src.classList.contains('cc-used') || zone.classList.contains('cc-done')) return;
    if (slot.dataset.id !== src.dataset.id) {
      animate(slot, [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(3px) rotate(.8deg)', offset: .4 }, { transform: 'none' }], { duration: 280 });
      fromRect(src, from, { duration: 280 });
      return;
    }
    zone.classList.add('cc-done'); zone.textContent = '';
    const p = txt('div', cast.get(src.dataset.id).core, 'cc-plate cc-bare');
    zone.appendChild(p);
    src.classList.add('cc-used'); src.disabled = true;
    if (selected === src) selected = null;
    src.setAttribute('aria-pressed', 'false');
    matched += 1;
    root.querySelector('.cc-quiz-count').textContent = matched + ' / ' + order.length;
    fromRect(p, from, { duration: 360 });
    if (matched === order.length) {
      const done = root.querySelector('.cc-match-done');
      done.hidden = false;
      done.classList.add('cc-on');
      animate(done, effects.fade);
    }
    slot.focus({ preventScroll: true });
  }

  /* ---------- 03 · 호출 ---------- */

  function buildRail() {
    const rail = el('div', 'cc-rail');
    order.forEach((id) => {
      const c = cast.get(id);
      const w = el('div', 'cc-rl');
      w.dataset.id = id;
      tint(w, id);
      w.appendChild(faceOf(id, 'cc-rl-face'));
      const b = el('div', 'cc-rl-b');
      b.appendChild(txt('div', c.core, 'cc-rl-plate'));
      const fs = el('div', 'cc-rl-facets');
      facetsOf(id).forEach((label) => fs.appendChild(txt('span', label, 'cc-facet')));
      b.appendChild(fs);
      w.appendChild(b);
      rail.appendChild(w);
    });
    const status = txt('div', t.pass_call, 'cc-pass');
    status.setAttribute('aria-live', 'polite');
    rail.prepend(status);
    sect(2).appendChild(rail);
    sect(2).appendChild(el('div', 'cc-stream'));

    const worry = el('div', 'cc-worry');
    worry.hidden = true;
    const w = cfg.worry || {};
    worry.appendChild(lines('p', 'cc-worry-1', w.title));
    worry.appendChild(lines('p', 'cc-worry-2', w.line));
    const btn = button(w.button);
    btn.addEventListener('click', rewind);
    worry.appendChild(btn);
    sect(2).appendChild(worry);
  }

  function buildStream() {
    const stream = root.querySelector('.cc-stream');
    eps.forEach((ep, n) => {
      const a = el('article', 'cc-ep');
      a.dataset.c = ep.c;
      a.dataset.n = String(n);
      tint(a, ep.c);

      const top = el('div', 'cc-ep-top');
      top.appendChild(txt('span', ep.no, 'cc-ep-no'));
      top.appendChild(txt('span', ep.need, 'cc-ep-need'));
      if (ep.src) top.appendChild(txt('span', ep.src, 'cc-ep-src'));
      a.appendChild(top);

      const cuts = el('div', 'cc-cuts');
      cuts.appendChild(cut('cc-call', t.call, ep.role, ep.scene));
      cuts.appendChild(cut('cc-gain', t.remained, ep.gain_label, ep.gain_img));
      a.appendChild(cuts);

      const lanes = el('div', 'cc-lanes');
      const slot = el('div', 'cc-ep-slot');
      slot.textContent = t.awaiting || '';
      lanes.appendChild(slot);
      a.appendChild(lanes);

      const out = el('div', 'cc-ep-out');
      out.appendChild(txt('span', `${t.done_mark || ''}${ep.role}`, 'cc-ep-role'));
      out.appendChild(txt('span', ep.gain, 'cc-ep-gain'));
      a.appendChild(out);
      stream.appendChild(a);
    });
  }

  // 만화 컷은 대사가 증거다 — 비율이 3:1부터 1:1까지 제각각이라 높이만 상한으로 둔다
  function cut(kind, label, caption, src) {
    const fig = el('figure', `cc-fig ${kind}`);
    const shot = el('div', 'cc-shot');
    if (src) {
      const img = el('img');
      img.src = src;
      img.alt = '';
      shot.appendChild(img);
    } else {
      shot.appendChild(txt('div', t.no_image || '', 'cc-ph'));
    }
    fig.appendChild(shot);
    const cap = el('figcaption', 'cc-cap');
    cap.appendChild(txt('i', label || ''));
    cap.appendChild(txt('b', caption || ''));
    fig.appendChild(cap);
    return fig;
  }

  function rows() {
    return [...root.querySelectorAll('.cc-ep')];
  }

  /* 스크롤 위치를 직접 계산한다.
     IntersectionObserver는 빠른 스크롤·앵커 점프·탭 전환에서 행을 통째로 건너뛸 수 있고,
     그러면 끝까지 차지 않아 다음 단계가 영영 안 열린다(소프트 락). */
  function sweep() {
    if (dead || suspend) return;
    // 아직 열리지 않은 장은 건드리지 않는다. display:none인 요소는
    // getBoundingClientRect()가 top:0/height:0을 돌려주는데, 그걸 '이미 지나갔다'로 읽으면
    // 숨어 있는 동안 회차가 전부 소비된다.
    if (chapterEl(2).hidden) return;
    const line = window.innerHeight * TRIGGER;
    const doc = document.documentElement;
    // 문서 끝에 닿으면 남은 행은 전부 처리한다. 마지막 행은 아래에 스크롤할 것이 없어
    // 슬롯이 트리거 라인까지 못 올라온다 — 그대로 두면 잠긴다.
    const atEnd = window.scrollY + window.innerHeight >= doc.scrollHeight - 6;
    const all = rows();
    let batch = 0;
    all.forEach((row) => {
      if (!row.getBoundingClientRect().height) return;
      // 행 맨 위가 아니라 '명찰이 붙을 슬롯'을 본다. 컷이 커지면 행이 600px를 넘는데,
      // 행 위쪽을 기준으로 하면 정작 붙는 자리는 아직 화면 밖인 채로 발화한다.
      const mark = row.querySelector('.cc-ep-slot').getBoundingClientRect();
      if (!atEnd && mark.top > line) return;
      const key = mode === 'call' ? 'p1' : 'p2';
      if (row.dataset[key]) return;
      row.dataset[key] = '1'; // 논리 상태는 즉시 확정한다 — 연출이 늦어도 두 번 세지 않는다
      const withGain = mode !== 'call';
      playRow(row, withGain, batch * STAGGER);
      batch += 1;
      if (withGain) {
        revealed += 1;
        if (revealed >= all.length) showResult();
      } else {
        filled += 1;
        if (filled >= all.length) showWorry();
      }
    });
  }

  // 두 패스 모두 같은 동작이다 — 명찰이 내려와 붙는다.
  // 다른 점은 2회차에만 '남은 것'과 레일의 입체화 재료가 뒤따른다는 것뿐.
  function playRow(row, withGain, delay = 0) {
    callInto(row, delay);
    if (!withGain) return;
    row.classList.add('cc-revealed');
    animate(row.querySelector('.cc-gain'), effects.slide, { delay: delay + 220, fill: 'backwards', duration: 380 });
    flyToRail(row, delay + 420);
  }

  function callInto(row, delay) {
    const id = row.dataset.c, c = cast.get(id);
    const slot = row.querySelector('.cc-ep-slot');
    slot.textContent = '';
    row.classList.add('cc-filled');
    slot.appendChild(faceOf(id, 'cc-slot-mini'));
    const plate = txt('div', c.core, 'cc-plate');
    slot.appendChild(plate);
    const source = root.querySelector('.cc-rl[data-id="' + id + '"] .cc-rl-plate');
    // Animate the actual destination label from its source, with no floating duplicate.
    moveFrom(plate, source, { duration: 420, delay, fill: 'backwards' });
    const bub = txt('span', c.line || '', 'cc-bubble cc-on');
    slot.appendChild(bub);
    after(delay + 2100, () => bub.classList.remove('cc-on'));
  }

  function flyToRail(row, delay) {
    const id = row.dataset.c;
    const chips = [...root.querySelectorAll('.cc-rl[data-id="' + id + '"] .cc-facet')];
    const chip = chips.find(x => !x.dataset.claimed);
    if (!chip) return;
    chip.dataset.claimed = '1';
    chip.classList.add('cc-on');
    const source = row.querySelector('.cc-gain .cc-cap b');
    // Offscreen sources do not fly across the whole document.
    const r = source.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) moveFrom(chip, source, { duration: 460, delay, fill: 'backwards' });
    else animate(chip, effects.scale, { duration: 280, delay });
    const rail = chip.closest('.cc-rl');
    rail.dataset.facets = String(chips.filter(x => x.dataset.claimed).length);
  }

  function showWorry() {
    if (worryShown || mode !== 'call') return;
    worryShown = true;
    root.querySelector('.cc-worry').hidden = false;
  }

  /* ---------- 되감기 ---------- */

  function rewind() {
    if (mode !== 'call') return;
    timers.forEach(clearTimeout); timers = [];
    mode = 'reveal'; // 상태를 먼저 확정한다
    root.classList.add('cc-second-pass');
    root.querySelector('.cc-pass').textContent = t.pass_reveal;
    root.querySelector('.cc-worry').hidden = true;
    revealed = 0;
    // 무대를 비운다 — 두 번째로 내려갈 때 캐릭터가 '다시' 붙어야 한다
    rows().forEach((row) => {
      row.classList.remove('cc-filled', 'cc-revealed');
      delete row.dataset.p2;
      row.querySelector('.cc-ep-slot').textContent = t.awaiting || '';
    });
    root.querySelectorAll('.cc-facet').forEach((f) => {
      f.classList.remove('cc-on');
      delete f.dataset.claimed;
    });
    clearFlying();
    sequence(rows().reverse().map((el, i) => ({ el, frames: [{ backgroundColor: 'rgba(85,120,150,.13)', transform: 'translateY(6px)' }, { backgroundColor: 'transparent', transform: 'none' }], at: i * 45, duration: 260 })));
    veil.classList.add('cc-on');
    // 스트림 첫 행이 아직 트리거 라인 아래에 있도록 넉넉히 올라간다.
    // 덜 올라가면 착지하자마자 첫 행들이 한꺼번에 걸려 버린다.
    const stream = root.querySelector('.cc-stream');
    const top = Math.max(0, stream.getBoundingClientRect().top + window.scrollY - window.innerHeight * TRIGGER);
    scrollToY(top, 650, () => after(200, () => veil.classList.remove('cc-on')));
  }

  // rAF는 가려진 탭에서 멈춘다 — setInterval로 민다
  function scrollToY(target, dur, done) {
    stopScroll?.();
    const start = window.scrollY;
    const delta = target - start;
    const t0 = Date.now();
    let cancelled = false;
    suspend = true;
    const finish = () => {
      clearInterval(scrollIv);
      ['wheel', 'touchstart', 'keydown'].forEach(ev => window.removeEventListener(ev, stop));
      stopScroll = null;
      if (dead) return;
      suspend = false;
      if (done) done();
      sweep();
    };
    const stop = () => {
      cancelled = true;
      finish();
    };
    ['wheel', 'touchstart', 'keydown'].forEach((ev) => {
      window.addEventListener(ev, stop, { once: true, passive: true });
    });
    stopScroll = stop;
    if (reducedMotion()) {
      window.scrollTo(0, target);
      finish();
      return;
    }
    clearInterval(scrollIv);
    scrollIv = setInterval(() => {
      if (dead || cancelled) {
        clearInterval(scrollIv);
        finish();
        return;
      }
      const p = Math.min(1, (Date.now() - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      window.scrollTo(0, start + delta * e);
      if (p >= 1) {
        clearInterval(scrollIv);
        finish();
      }
    }, 16);
  }

  /* ---------- 04 · 결과 ---------- */

  function showResult() {
    const wrap = sect(3);
    if (wrap.children.length) return;
    const res = el('div', 'cc-result');
    order.forEach((id) => {
      const c = cast.get(id);
      const col = el('div', 'cc-rcol');
      tint(col, id);
      col.appendChild(faceOf(id, 'cc-rface'));
      col.appendChild(txt('div', c.name, 'cc-rname'));
      col.appendChild(txt('div', c.core, 'cc-plate'));
      col.appendChild(txt('div', t.core_cap || '', 'cc-rcap'));
      const fw = el('div', 'cc-rfacets');
      facetsOf(id).forEach((label) => {
        const f = txt('span', label, 'cc-facet');
        f.classList.add('cc-on');
        fw.appendChild(f);
      });
      col.appendChild(fw);
      res.appendChild(col);
    });
    wrap.appendChild(res);

    const r = cfg.result || {};
    const band = el('div', 'cc-band');
    band.appendChild(txt('i', r.label || ''));
    band.appendChild(lines('b', '', r.text));
    wrap.appendChild(band);

    const nav = el('div', 'cc-next-wrap');
    nav.appendChild(next(t.to_apply, 4));
    wrap.appendChild(nav);

    // 답이 나온 자리에 질문을 남겨두지 않는다
    root.querySelector('.cc-worry').hidden = true;
    chapterEl(3).hidden = false;
    stopResult = revealOnce(res, () => [...res.querySelectorAll('.cc-rcol')].flatMap(col => [
      { el: col.querySelector('.cc-plate'), effect: 'scale', duration: 300 },
      ...[...col.querySelectorAll('.cc-facet')].map((el, i) => ({ el, effect: 'slide', at: 160 + i * 90, duration: 320 })),
    ]));
  }

  /* ---------- 05 · 검증과 적용 ---------- */

  function buildVerify() {
    const two = el('div', 'cc-two');
    (cfg.verify || []).forEach((v) => {
      const col = el('div');
      col.style.setProperty('--cc-ink', v.ink || 'var(--cc-fg)');
      col.style.setProperty('--cc-tint', v.tint || 'var(--cc-panel)');
      col.appendChild(txt('div', v.role || '', 'cc-vrole'));
      const body = el('div', 'cc-vbody');
      if (v.img) {
        const img = el('img');
        img.src = v.img;
        img.alt = '';
        body.appendChild(img);
      }
      const info = el('div');
      info.appendChild(txt('div', v.name || '', 'cc-vname'));
      info.appendChild(txt('div', v.meta || '', 'cc-vmeta'));
      const plate = txt('div', v.core || '', 'cc-plate cc-vplate');
      if (v.core_small) plate.classList.add('cc-small');
      info.appendChild(plate);
      const chips = el('div', 'cc-vchips');
      (v.chips || []).forEach((c) => {
        const chip = el('div', `cc-vchip${c.optional ? ' cc-opt' : ''}`);
        chip.appendChild(txt('span', c.label || '', 'cc-vlab'));
        chip.appendChild(document.createTextNode(c.text || ''));
        chips.appendChild(chip);
      });
      info.appendChild(chips);
      if (v.stamp) info.appendChild(txt('div', v.stamp, 'cc-stamp'));
      body.appendChild(info);
      col.appendChild(body);
      two.appendChild(col);
    });
    sect(4).appendChild(two);
  }

  /* ---------- 잡동사니 ---------- */

  function next(label, chapterIndex) {
    const b = button(label);
    b.addEventListener('click', () => {
      const s = chapterEl(chapterIndex);
      if (!s) return;
      s.hidden = false;
      // 마지막 장이 열리는 순간이 이 브리프를 다 본 시점이다 — 그때 결론을 연다.
      // 스크롤은 넘기지 않는다. 아래 scrollToY가 이미 그 장으로 데려간다.
      if (chapterIndex === (cfg.chapters || []).length - 1) onComplete({ scroll: false });
      scrollToY(s.getBoundingClientRect().top + window.scrollY - 60, 700);
    });
    return b;
  }

  function button(label) {
    const b = el('button', 'cc-next');
    b.type = 'button';
    b.textContent = label || '';
    return b;
  }

  function faceOf(id, cls) {
    const c = cast.get(id);
    if (c && c.img) {
      const i = el('img', cls);
      i.src = c.img;
      i.alt = c.name || '';
      return i;
    }
    return txt('div', t.no_image || '', `cc-ph ${cls}`);
  }

  // 캐릭터 색은 데이터에서 온다 — CSS가 이름을 알 필요는 없다
  function tint(node, id) {
    const c = cast.get(id) || {};
    if (c.ink) node.style.setProperty('--cc-ink', c.ink);
    if (c.tint) node.style.setProperty('--cc-tint', c.tint);
  }

  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function txt(tag, value, cls) {
    const n = el(tag, cls);
    n.textContent = value == null ? '' : value;
    return n;
  }

  // 줄바꿈은 데이터가 배열로 준다 — 콘텐츠에 마크업을 넣지 않는다
  function lines(tag, cls, value) {
    const n = el(tag, cls);
    const arr = Array.isArray(value) ? value : [value == null ? '' : value];
    arr.forEach((s, i) => {
      if (i) n.appendChild(el('br'));
      n.appendChild(document.createTextNode(s));
    });
    return n;
  }

  function after(ms, fn) {
    const id = setTimeout(() => {
      if (!dead) fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function clearFlying() {
    document.querySelectorAll('.cc-flyer, .cc-token, .cc-plate.cc-drag').forEach((n) => n.remove());
  }

  function onVisible() {
    if (document.hidden) { cancelDrag(); stopScroll?.(); veil.classList.remove('cc-on'); }
    else sweep();
  }

  return {
    restart(before) {
      stopResult?.();
      if (before) before();
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(scrollIv);
      clearFlying();
      stopScroll?.();
      root.classList.remove('cc-second-pass');
      veil.classList.remove('cc-on');
      selected = null;
      mode = 'call';
      filled = 0;
      revealed = 0;
      matched = 0;
      worryShown = false;
      suspend = false;
      drag = null;
      build();
      window.scrollTo(0, root.getBoundingClientRect().top + window.scrollY - 60);
    },
    destroy() {
      stopResult?.();
      dead = true;
      stopScroll?.();
      cancelDrag();
      timers.forEach(clearTimeout);
      clearInterval(scrollIv);
      clearFlying();
      veil.remove();
      window.removeEventListener('scroll', sweep);
      window.removeEventListener('resize', sweep);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cancelDrag);
      window.removeEventListener('blur', cancelDrag);
      document.removeEventListener('visibilitychange', onVisible);
    },
  };
}
