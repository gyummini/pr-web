import { animate, sequence, effects, reducedMotion } from '../motion/animate.js';
import { fromRect, moveFrom } from '../motion/flip.js';
import { revealOnce } from '../motion/reveal.js';
// E1 · 캐릭터 호출 — 각인된 한 줄이 어떻게 입체감이 되는가.
//
// 다섯 장을 위에서 아래로 지난다. 첫 화면에 01 · 02장이 함께 있다(10/07 사용자 결정 — 맞히기는 첫 화면에서 바로 하되,
// 맞힌 뒤에 표지가 끼어들면 어색하다. 예전 기획처럼 맞히기 위에 표지와 37명을 조금 할당한다).
//   01 역설   — 37명을 한 줄로 짧게(표지는 뺐다). '100명이 모두 메인 히로인'을 먼저 묻는다. 맞힐 셋은 37명 안에서 짚어 둔다.
//   02 첫인상 — 한 줄짜리 카드를 초상에 끌어다 맞춘다. 설명 없이 맞혀진다는 것이 논증이다.
//   03 호출   — 내려갈수록 회차가 펼쳐진다. 회차 화면(컷)이 먼저 들어오고, 그 장면에 필요한 캐릭터가 위에 붙은 시트에서
//               내려와 시그니처 대사를 뱉는다. 끝에서 "소모되는 것 아닐까" 하고 되감아 다시 내려가면, 이번엔 캐릭터가 내려온 뒤
//               새로 드러난 면모의 컷이 열리고, 그 면모가 위 시트로 올라가 붙는다 — 붙을 때마다 시트 뒤에 종이가 한 장씩 쌓인다.
//               (10/06 버튼으로 한 장씩 넘기는 안을 해 본 뒤 사용자가 스크롤로 정했다)
//   04 결과   — 한 줄은 그대로인데 축이 늘어 있다.
//   05 검증·적용 — 같은 패턴을 실제 서비스 게임과 본인 기획에서 확인한다. 한 줄만 보이다가 이벤트가 하나씩 붙으며 두꺼워진다.
//
// 화면에 나오는 글자는 전부 콘텐츠_증거카드.json에서 온다. 여기 있는 건 순서와 조건뿐이다.
//
// 연출은 전부 setTimeout이 몬다. requestAnimationFrame은 가려진 탭에서 멈추고,
// transitionend·onfinish도 오지 않는다 — 상태 변경을 거기 걸면 화면이 영영 잠긴다(함정 2·3).
// 회차 한 장의 걸음(화면 → 등장 → 컷 → 면모)도 타이머로 걸고, 되감기 · 탭 가려짐이 오면 남은 걸음을 움직임 없이 한 번에 마친다.

const OPEN_AT_START = 2; // 처음부터 열려 있는 장 수(역설 · 첫인상)
const TRIGGER = 0.78; // 캐릭터가 내려앉을 칸이 화면 이 높이까지 올라오면 그 회차가 펼쳐진다
// 걸음 간격은 배포본 스크롤 연출만큼 짧게 — 줄을 넘는 즉시 캐릭터가 내려오고, 컷 · 면모가 바로 뒤따른다(10/06 사용자 요청:
// 기다리게 하면 스크롤하는 손이 연출을 앞질러 버린다)
const STAGGER = 180; // 같은 화면에 여러 회차가 걸릴 때 서로 밀어 주는 간격
const CALL_AT = 0; // 줄을 넘으면 바로 — 컷(화면)은 스크롤로 이미 들어와 있다
const FLY_MS = 420; // 시트 → 회차 칸
const CUT_AT = 260; // (다시 보기) 새로 드러난 면모의 컷이 열리는 때
const RISE_AT = 620; // (다시 보기) 면모가 컷에서 시트로 올라가기 시작하는 때
const RISE_MS = 460; // 컷 → 시트
const LAYER_STEP = 6; // 시트 뒤 종이 한 장의 어긋남(px)

export function playCharacterCall(host, cfg, onComplete) {
  const cast = new Map((cfg.cast || []).map((c) => [c.id, c]));
  const order = (cfg.order || []).filter((id) => cast.has(id));
  const eps = (cfg.episodes || []).filter((e) => cast.has(e.c));
  const chs = cfg.chapters || [];
  const t = cfg.labels || {};

  // 결과 장의 축은 회차에서 뽑는다 — 한 곳에만 적어 두고 두 군데서 읽는다
  function facetsOf(id) {
    return eps.filter((e) => e.c === id).map((e) => e.gain_label);
  }

  let pass = 1; // 1 호출 → 되감기 → 2 다시 보기
  let called = new Set(); // 호출에서 펼친 회차
  let revealed = new Set(); // 다시 보기에서 펼친 회차
  let played = 0; // 이번 패스에서 연출까지 마친 회차 수
  let suspend = false; // 자동 스크롤이 도는 동안 sweep을 멈춘다
  let matched = 0;
  let worryShown = false;
  let drag = null;
  let selected = null;
  let stopScroll = null;
  let stopResult = null;
  let stopApply = null;
  let stopCue = null;
  let timers = [];
  let jobs = []; // 지금 회차의 남은 걸음
  let quiet = false; // 남은 걸음을 한 번에 마치는 동안은 움직임 없이
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
    chs.forEach((ch, i) => root.appendChild(chapter(i)));
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
    cueOn(root.querySelector('.cc-cards'));
  }

  // 장 하나 — 머리말·제목·리드·꼬리말은 다섯 장이 모두 같은 모양이다
  function chapter(di) {
    const ch = chs[di] || {};
    const s = el('section', 'cc-ch');
    s.dataset.n = String(di);
    if (di >= OPEN_AT_START) s.hidden = true;

    // 장 사이는 선 하나로만 가른다 — 'CHAPTER 01 · 역설 … 01 / 05' 머리줄은 10/07 사용자 의견으로 뺐다(데이터의 no · name · mark는 남겨 둠)
    s.appendChild(el('hr', 'cc-rule'));

    const bodyTop = el('div', 'cc-ch-top');
    // 장 머리 — 데이터의 제목과 리드. 역설 장(데이터 0번)은 표지와 나란히 놓으므로 buildGrid가 따로 채운다
    if (di > 0 && (ch.title || ch.lede)) {
      const copy = el('div', 'cc-ch-copy');
      if (ch.title) copy.appendChild(lines('h3', 'cc-title', ch.title));
      if (ch.lede) copy.appendChild(lines('p', 'cc-lede', ch.lede));
      bodyTop.appendChild(copy);
    }
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

  /* ---------- 역설 — 37명 ---------- */

  function buildGrid() {
    const g = cfg.grid || {};
    const ch = chs[0] || {};
    const hero = sectTop(0);

    // 첫 화면 위쪽을 조금만 쓴다 — 제목 · 리드와 37명 한 줄. 바로 아래가 맞히기다.
    // 글자만으로 시작하면 '100명'이 숫자로만 읽힌다. 단행본 표지(key_visual)는 같은 말('히로인이 많다')을 두 번 하고
    // 첫 화면을 붐비게 해서 뺐다(10/07 사용자 결정) — 데이터에는 남겨 둔다
    const wrap = el('div', 'cc-hero');
    const copy = el('div', 'cc-hero-copy');
    copy.appendChild(lines('h3', 'cc-title', ch.title));
    if (ch.lede) copy.appendChild(lines('p', 'cc-lede', ch.lede)); // 10/07 사용자 지시로 첫 장 리드를 뺐다 — 데이터가 비면 자리도 두지 않는다
    wrap.appendChild(copy);

    const names = g.names || [];
    if (names.length && g.sprite) {
      const strip = el('div', 'cc-strip');
      strip.setAttribute('aria-hidden', 'true'); // 얼굴 37개는 낭독하지 않는다 — 아래 그림 설명이 대신한다
      const cols = Number(g.sprite_cols) || 10;
      const rowCount = Number(g.sprite_rows) || 4;
      // 맞힐 셋은 37명 안에서 캐릭터 색 테두리로 짚어 둔다 — '이 셋은 100명 중 셋'
      const pick = new Map(order.map((id) => [cast.get(id).name, id]));
      names.forEach((name, i) => {
        // 스프라이트를 퍼센트로 자른다. 10×4 배열이 이름 순서와 그대로 대응한다.
        const c = el('div', 'cc-cell cc-face');
        c.title = name;
        c.style.backgroundImage = `url("${g.sprite}")`;
        c.style.backgroundSize = `${cols * 100}% ${rowCount * 100}%`;
        c.style.backgroundPositionX = `${((i % cols) / (cols - 1)) * 100}%`;
        c.style.backgroundPositionY = `${(Math.floor(i / cols) / (rowCount - 1)) * 100}%`;
        if (pick.has(name)) {
          c.classList.add('cc-pick');
          tint(c, pick.get(name));
        }
        strip.appendChild(c);
      });
      copy.appendChild(strip);
      if (g.note) copy.appendChild(txt('p', g.note, 'cc-mono cc-strip-note')); // 그림 설명 줄 — 10/07 사용자 지시로 뺐다
    }

    hero.appendChild(wrap);
  }

  /* ---------- 첫인상 — 맞히기 ---------- */

  function buildMatch() {
    const m = cfg.match || {};
    // 왼쪽 칸에 '무엇을 하는 칸인지'와 카드 묶음을 세우고, 오른쪽에 초상 셋을 둔다 —
    // 첫 화면에서 카드와 얼굴이 나란히 보여야 설명 없이 바로 맞힌다(10/06, 맞히기가 첫 장이 되면서)
    const quiz = el('div', 'cc-quiz');
    const side = el('div', 'cc-quiz-side');
    const s = m.side || {};
    side.appendChild(txt('div', s.label || '', 'cc-quiz-lab'));
    side.appendChild(lines('p', 'cc-quiz-t', s.title));
    if (s.note) side.appendChild(lines('p', 'cc-quiz-note', s.note)); // '셋 다 맞히면 …' — 10/07 사용자 지시로 뺐다
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
    side.appendChild(cards);
    side.appendChild(txt('p', t.match_help, 'cc-match-help'));
    const count = txt('div', `0 / ${order.length}`, 'cc-quiz-count');
    count.setAttribute('aria-live', 'polite');
    side.appendChild(count);
    const skip = next(t.skip_match, 2);
    skip.classList.add('cc-skip');
    side.appendChild(skip);

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
    // 한 장을 맞히면 방법은 안 것이다 — 카드 묶음의 표시를 거둔다
    if (matched === 1) cueOn(null);
    root.querySelector('.cc-quiz-count').textContent = matched + ' / ' + order.length;
    fromRect(p, from, { duration: 360 });
    if (matched === order.length) finishQuiz();
    slot.focus({ preventScroll: true });
  }

  // 셋을 다 맞히면 소감과 함께 '이후 이야기 살펴보기'가 열린다 — 누르면 호출 장으로(배포본 그대로)
  function finishQuiz() {
    const done = root.querySelector('.cc-match-done');
    root.querySelector('.cc-skip').hidden = true; // 다 맞힌 뒤에 '건너뛰기'는 할 말이 없다
    done.hidden = false;
    done.classList.add('cc-on');
    animate(done, effects.fade);
    cueOn(done.querySelector('.cc-next'));
  }

  /* ---------- 호출 — 위에 붙은 시트, 아래로 흐르는 연재 ---------- */

  // 시트 한 장 — 초상 · 이름 · 한 줄, 그리고 그 인물이 불린 회차 수만큼의 면모 칸.
  // 뒤에 깔린 종이(.cc-layers)가 붙은 면모 수만큼 늘어난다 — 그것이 두께다(10/06 사용자 결정으로 2단계 시안에서 가져옴)
  function buildRail() {
    const rail = el('div', 'cc-rail');
    const status = txt('div', t.pass_call, 'cc-pass');
    status.setAttribute('aria-live', 'polite');
    rail.appendChild(status);
    order.forEach((id) => {
      const c = cast.get(id);
      const w = el('div', 'cc-rl');
      w.dataset.id = id;
      tint(w, id);
      w.appendChild(layersBox());
      const paper = el('div', 'cc-rl-paper');
      paper.appendChild(faceOf(id, 'cc-rl-face'));
      const b = el('div', 'cc-rl-b');
      b.appendChild(txt('div', c.name, 'cc-rl-name'));
      b.appendChild(txt('div', c.core, 'cc-rl-plate'));
      paper.appendChild(b);
      const slots = el('ol', 'cc-rl-slots');
      eps.forEach((ep, n) => {
        if (ep.c !== id) return;
        const li = el('li', 'cc-rl-slot');
        li.dataset.n = String(n);
        li.append(txt('span', ep.no, 'cc-rl-where'), el('b'));
        slots.appendChild(li);
      });
      paper.appendChild(slots);
      w.appendChild(paper);
      rail.appendChild(w);
    });
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
      img.loading = 'lazy';
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
  function sheetOf(id) {
    return root.querySelector(`.cc-rl[data-id="${id}"]`);
  }

  /* 스크롤 위치를 직접 계산한다.
     IntersectionObserver는 빠른 스크롤·앵커 점프·탭 전환에서 행을 통째로 건너뛸 수 있고,
     그러면 끝까지 차지 않아 다음 단계가 영영 안 열린다(소프트 락). */
  function sweep() {
    if (dead || suspend) return;
    // 아직 열리지 않은 장은 건드리지 않는다. display:none인 요소는 getBoundingClientRect()가 top:0을 돌려주는데,
    // 그걸 '이미 지나갔다'로 읽으면 숨어 있는 동안 회차가 전부 소비된다.
    if (chapterEl(2).hidden) return;
    const line = window.innerHeight * TRIGGER;
    const doc = document.documentElement;
    // 문서 끝에 닿으면 남은 행은 전부 처리한다. 마지막 행은 아래에 스크롤할 것이 없어 트리거 줄까지 못 올라온다 — 그대로 두면 잠긴다.
    const atEnd = window.scrollY + window.innerHeight >= doc.scrollHeight - 6;
    const seen = pass === 1 ? called : revealed;
    let batch = 0;
    rows().forEach((row, n) => {
      if (!row.getBoundingClientRect().height || seen.has(n)) return;
      // 행 맨 위가 아니라 '캐릭터가 내려앉을 칸'을 본다 — 그 칸이 줄에 닿을 때 위의 컷은 이미 화면에 있다
      const mark = row.querySelector('.cc-ep-slot').getBoundingClientRect();
      if (!atEnd && mark.top > line) return;
      seen.add(n); // 논리 상태는 즉시 확정한다 — 연출이 늦어도 두 번 세지 않는다
      play(row, n, batch * STAGGER);
      batch += 1;
    });
  }

  // 회차 한 장의 걸음을 건다. 되감기 · 다시 해보기 · 탭 가려짐이 오면 settle()이 남은 걸음을 움직임 없이 한 번에 마친다
  function stepAt(ms, fn) {
    const job = { done: false };
    job.run = () => {
      if (job.done || dead) return;
      job.done = true;
      fn();
    };
    job.id = setTimeout(job.run, ms);
    jobs.push(job);
  }
  function settle() {
    const left = jobs;
    jobs = [];
    quiet = true;
    left.forEach((j) => { clearTimeout(j.id); j.run(); });
    quiet = false;
  }
  function moving() {
    return !quiet && !reducedMotion() && !document.hidden;
  }

  // 회차가 트리거 줄에 닿으면 펼친다. 화면(컷)은 스크롤로 먼저 들어와 있다 — 곧바로 그 장면에 필요한 캐릭터가
  // 위 시트에서 내려와 시그니처 대사를 뱉는다. 다시 보기에서는 그다음 새로 드러난 면모의 컷이 열리고,
  // 그 면모가 위 시트로 올라가 붙으며 시트 뒤에 종이가 한 장 쌓인다(10/06 사용자 결정)
  function play(row, n, delay) {
    const ep = eps[n];
    stepAt(delay, () => root.querySelectorAll('.cc-rl').forEach((rl) => rl.classList.toggle('is-now', rl.dataset.id === ep.c)));
    stepAt(delay + CALL_AT, () => callInto(row));
    if (pass === 1) {
      stepAt(delay + CALL_AT + FLY_MS, () => {
        sheetOf(ep.c).querySelector(`.cc-rl-slot[data-n="${n}"]`).classList.add('is-called');
        played += 1;
        if (played === eps.length) showWorry();
      });
    } else {
      stepAt(delay + CUT_AT, () => row.classList.add('cc-revealed'));
      stepAt(delay + RISE_AT, () => riseFacet(row, n));
      stepAt(delay + RISE_AT + RISE_MS, () => {
        addLayer(sheetOf(ep.c));
        played += 1;
        // 마지막 면모가 붙은 시트를 잠깐 보여 준 뒤 결과 장을 연다
        if (played === eps.length) after(400, showResult);
      });
    }
  }

  // 캐릭터가 위 시트에서 회차 칸으로 내려온다 — 얼굴과 한 줄이 각자 시트의 자리에서 출발한다.
  // 내려오는 끝에 시그니처 대사가 말풍선으로 뜬다
  function callInto(row) {
    const id = row.dataset.c, c = cast.get(id);
    const slot = row.querySelector('.cc-ep-slot');
    slot.textContent = '';
    row.classList.add('cc-filled');
    const face = faceOf(id, 'cc-slot-mini');
    const plate = txt('div', c.core, 'cc-plate');
    const bub = txt('span', c.line || '', 'cc-bubble');
    slot.append(face, plate, bub);
    const rl = sheetOf(id);
    if (moving() && onScreen(rl) && onScreen(slot)) {
      moveFrom(face, rl.querySelector('.cc-rl-face'), { duration: FLY_MS });
      moveFrom(plate, rl.querySelector('.cc-rl-plate'), { duration: FLY_MS });
      after(Math.round(FLY_MS * .75), () => bub.classList.add('cc-on'));
    } else {
      bub.classList.add('cc-on');
    }
    after(2600, () => bub.classList.remove('cc-on'));
  }

  // 새로 드러난 면모가 컷의 이름표에서 위 시트의 빈 칸으로 올라가 붙는다
  function riseFacet(row, n) {
    const ep = eps[n];
    const slot = sheetOf(ep.c).querySelector(`.cc-rl-slot[data-n="${n}"]`);
    slot.classList.add('is-on');
    const b = slot.querySelector('b');
    b.textContent = ep.gain_label;
    if (!moving()) return;
    const from = row.querySelector('.cc-gain .cc-cap b');
    if (onScreen(from) && onScreen(slot)) moveFrom(b, from, { duration: RISE_MS });
    else animate(b, effects.slide, { duration: 320 });
  }

  function layersBox() {
    const box = el('div', 'cc-layers');
    box.setAttribute('aria-hidden', 'true');
    return box;
  }

  // 시트 뒤에 종이 한 장을 더한다. 먼저 붙은 종이가 시트 바로 뒤(위)에 남도록 새 종이는 맨 아래에 깐다 —
  // 형제 중 맨 앞에 넣으면 그려지는 순서가 가장 먼저라 앞 종이들 밑에 깔린다(10/06: 나중 종이가 위에 덮여 뭉개져 보였다)
  function addLayer(sheetEl, { dashed = false, still = false } = {}) {
    const box = sheetEl.querySelector('.cc-layers');
    const i = el('i');
    if (dashed) i.classList.add('is-opt');
    const o = (box.children.length + 1) * LAYER_STEP;
    i.style.setProperty('--o', `${o}px`);
    box.prepend(i);
    if (!still && moving()) {
      animate(i, [{ transform: 'translate(0, 0)', opacity: 0 }, { transform: `translate(${o}px, ${o}px)`, opacity: 1 }], { duration: 420 });
    }
    return i;
  }

  function showWorry() {
    if (worryShown || pass !== 1) return;
    worryShown = true;
    const w = root.querySelector('.cc-worry');
    w.hidden = false;
    cueOn(w.querySelector('.cc-next'));
    if (moving()) animate(w, effects.slide, { duration: 420 });
  }

  /* ---------- 되감기 ---------- */

  function rewind() {
    if (pass !== 1) return;
    settle();
    timers.forEach(clearTimeout); timers = [];
    pass = 2; // 상태를 먼저 확정한다
    played = 0;
    root.classList.add('cc-second-pass');
    root.querySelector('.cc-pass').textContent = t.pass_reveal;
    // 누른 버튼이 든 칸을 숨기기 전에 초점을 회차 목록으로 옮긴다 — 두 번째 패스도 스크롤로 진행하므로
    // 키보드(Space · 아래 화살표)가 거기서 이어진다. 그대로 숨기면 초점이 페이지 밖으로 빠졌다(10/06 점검)
    const streamEl = root.querySelector('.cc-stream');
    streamEl.tabIndex = -1;
    streamEl.focus({ preventScroll: true });
    root.querySelector('.cc-worry').hidden = true;
    cueOn(null);
    // 무대를 비운다 — 두 번째로 내려갈 때 캐릭터가 '다시' 내려와야 한다(시트의 '불린 회차' 표시는 남긴다)
    rows().forEach((row) => {
      row.classList.remove('cc-filled', 'cc-revealed');
      row.querySelector('.cc-ep-slot').textContent = t.awaiting || '';
    });
    clearFlying();
    sequence(rows().reverse().map((el, i) => ({ el, frames: [{ backgroundColor: 'rgba(85,120,150,.13)', transform: 'translateY(6px)' }, { backgroundColor: 'transparent', transform: 'none' }], at: i * 45, duration: 260 })));
    veil.classList.add('cc-on');
    // 연재 첫 행이 아직 트리거 줄 아래에 있도록 넉넉히 올라간다 — 덜 올라가면 착지하자마자 첫 행들이 한꺼번에 걸린다
    const top = Math.max(0, streamEl.getBoundingClientRect().top + window.scrollY - window.innerHeight * TRIGGER);
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
    if (reducedMotion() || document.hidden) {
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

  /* ---------- 결과 ---------- */

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
    cueOn(nav.querySelector('.cc-next'));

    chapterEl(3).hidden = false;
    stopResult = revealOnce(res, () => [...res.querySelectorAll('.cc-rcol')].flatMap(col => [
      { el: col.querySelector('.cc-plate'), effect: 'scale', duration: 300 },
      ...[...col.querySelectorAll('.cc-facet')].map((el, i) => ({ el, effect: 'slide', at: 160 + i * 90, duration: 320 })),
    ]));
  }

  /* ---------- 검증과 적용 ---------- */

  // 같은 양식의 카드 두 장. 장이 화면에 들어오면 한 줄(이름표)만 보이다가 이벤트가 하나씩 붙고,
  // 붙을 때마다 카드 뒤에 종이가 한 장씩 쌓인다(10/06 사용자 요청). 종이는 처음부터 깔아 두고 움직임만 얹는다 —
  // 연출이 재생되지 않아도 화면은 다 보인다
  function buildVerify() {
    const two = el('div', 'cc-two');
    (cfg.verify || []).forEach((v) => {
      const col = el('div', 'cc-vcol');
      col.style.setProperty('--cc-ink', v.ink || 'var(--cc-fg)');
      col.style.setProperty('--cc-tint', v.tint || 'var(--cc-panel)');
      col.appendChild(txt('div', v.role || '', 'cc-vrole'));
      const sheet = el('div', 'cc-vsheet');
      sheet.appendChild(layersBox());
      const body = el('div', 'cc-vbody');
      if (v.img) {
        const img = el('img');
        img.src = v.img;
        img.alt = '';
        img.loading = 'lazy';
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
        addLayer(sheet, { dashed: !!c.optional, still: true });
      });
      info.appendChild(chips);
      if (v.stamp) info.appendChild(txt('div', v.stamp, 'cc-stamp'));
      body.appendChild(info);
      sheet.appendChild(body);
      col.appendChild(sheet);
      two.appendChild(col);
    });
    sect(4).appendChild(two);
    stopApply = revealOnce(two, () => applySteps(two));
  }

  // 일레그 다음 유리에 — 카드마다 이벤트 한 줄이 붙고, 그 뒤에 종이가 한 장 깔린다
  function applySteps(two) {
    const steps = [];
    let ms = 450;
    two.querySelectorAll('.cc-vcol').forEach((col) => {
      const layers = [...col.querySelectorAll('.cc-layers i')].reverse(); // 깔린 순서 = 이벤트 순서
      col.querySelectorAll('.cc-vchip').forEach((chip, i) => {
        steps.push({ el: chip, effect: 'slide', at: ms, duration: 360 });
        const layer = layers[i];
        if (layer) {
          const o = layer.style.getPropertyValue('--o');
          steps.push({ el: layer, frames: [{ transform: 'translate(0, 0)', opacity: 0 }, { transform: `translate(${o}, ${o})`, opacity: 1 }], at: ms + 260, duration: 420 });
        }
        ms += 650;
      });
      const stamp = col.querySelector('.cc-stamp');
      if (stamp) {
        steps.push({ el: stamp, effect: 'fade', at: ms - 150, duration: 360 });
        ms += 300;
      }
    });
    return steps;
  }

  /* ---------- 잡동사니 ---------- */

  // 지금 누를 것 — 한 번에 하나만 붙인다(style.css .cue). 할 일을 마치면 다음 할 일로 옮겨 간다.
  // 이 페이지는 표시가 여러 번 옮겨 가서, 화면에 들어온 뒤 세 번만 퍼지고 고정 테두리로 남는다(.cue-step).
  // 누를 것 바로 앞에 놓인 말풍선(.cue-note)은 표시와 함께 보이고 함께 사라진다.
  function cueOn(target) {
    stopCue?.();
    stopCue = null;
    root.querySelectorAll('.cue').forEach((n) => n.classList.remove('cue', 'cue-step', 'cue-seen'));
    root.querySelectorAll('.cue-note').forEach((n) => { n.hidden = true; });
    if (!target) return;
    target.classList.add('cue', 'cue-step');
    const hint = target.previousElementSibling;
    if (hint && hint.classList.contains('cue-note')) hint.hidden = false;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      target.classList.add('cue-seen');
    }, { threshold: 0.6 });
    io.observe(target);
    stopCue = () => io.disconnect();
  }

  function next(label, chapterIndex) {
    const b = button(label);
    b.addEventListener('click', () => {
      cueOn(null);
      const s = chapterEl(chapterIndex);
      if (!s) return;
      s.hidden = false;
      // 마지막 장이 열리는 순간이 이 브리프를 다 본 시점이다 — 그때 결론을 연다.
      // 스크롤은 넘기지 않는다. 아래 scrollToY가 이미 그 장으로 데려간다.
      if (chapterIndex === chs.length - 1) onComplete({ scroll: false });
      scrollToY(s.getBoundingClientRect().top + window.scrollY - 60, 700);
    });
    return b;
  }

  function button(label, cls = 'cc-next') {
    const b = el('button', cls);
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

  function onScreen(node) {
    if (!node) return false;
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
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
    if (!document.hidden) { sweep(); return; }
    cancelDrag();
    stopScroll?.();
    veil.classList.remove('cc-on');
    settle(); // 가려진 동안 남은 걸음은 움직임 없이 마친다
  }

  return {
    restart(before) {
      stopResult?.();
      stopApply?.();
      if (before) before();
      jobs.forEach((j) => clearTimeout(j.id)); // 처음부터 다시 그리므로 남은 걸음은 마치지 않고 버린다
      jobs = [];
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(scrollIv);
      clearFlying();
      stopScroll?.();
      root.classList.remove('cc-second-pass');
      veil.classList.remove('cc-on');
      selected = null;
      pass = 1;
      played = 0;
      suspend = false;
      called = new Set();
      revealed = new Set();
      matched = 0;
      worryShown = false;
      drag = null;
      build();
      window.scrollTo(0, root.getBoundingClientRect().top + window.scrollY - 60);
      // 결론 칸(다시 해보기 버튼)이 사라지므로 초점을 처음 누를 것으로 옮긴다(10/06 점검)
      root.querySelector('.cc-cards .cc-plate')?.focus({ preventScroll: true });
    },
    destroy() {
      stopResult?.();
      stopApply?.();
      stopCue?.();
      dead = true;
      stopScroll?.();
      cancelDrag();
      jobs.forEach((j) => clearTimeout(j.id));
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
