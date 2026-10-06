import { animate, reducedMotion } from '../motion/animate.js';

// E5 — the same Journey twice, one card apart. Both lanes walk the same fixed schedule; the only thing
// that changes is the empty event time in the swapped lane, which fills with what the set adds: its
// relation event, the skill it strengthens and its formation trait, gathered in that one cell.
//
// That cell is the page's one point (10/03). The page used to show the difference four times — the
// lanes, a "what changed" block, a rules summary, then the recap — because the lanes alone did not say
// which change was new: the additions sat in three places and the swapped card's own events change too
// (that is the existing rule). Now the additions live in one cell, nothing else in the lanes is
// emphasised, and one line under the lanes names what was seen. The rules stay in the original.
//
// The run button is the one thing to press: it carries the shared cue (style.css .cue) and, when the
// data says prompt_at: 'action', the lead's prompt sits beside it instead of in the header — both until
// the first press. The relations to swap in appear only after a run.
//
// Timing follows the site's traps: state first, motion on top; one timer checks elapsed Date.now()
// every tick; a hidden tab or reduced motion settles the run at its end.
export function playOneCard(host, cfg, onComplete) {
  const t = cfg.labels;
  const cards = cfg.cards;
  const beats = cfg.beats; // [{ id, at }] — ids name what lights: s0 i0 s1 i1 s2 i2 ready s3 event reward end
  const order = beats.map((b) => b.id);
  const state = { set: 0, step: 0, done: false, running: false, pressed: false };
  let timer = null;
  let started = 0;
  let recapShown = false;
  let dead = false;

  const root = el('div', 'oc');
  root.innerHTML = `
    <div class="oc-controls">
      <div class="oc-go"><button type="button" class="oc-run"></button></div>
      <p class="oc-legend"><span class="oc-key is-same"></span><span class="oc-key is-new"></span></p>
    </div>
    <div class="oc-lanes"></div>
    <p class="oc-caption" role="status" aria-live="polite"></p>
    <div class="oc-choose" hidden><span class="oc-choose-label"></span><div class="oc-choose-group" role="group"></div></div>
    <p class="oc-note"></p>`;
  host.append(root);

  const runBtn = root.querySelector('.oc-run');
  runBtn.addEventListener('click', () => (state.running ? null : run()));
  // The prompt moves next to the button only when the shell has dropped it from the header.
  const prompt = cfg.lead?.prompt_at === 'action' && cfg.lead.prompt ? el('p', 'cue-note', cfg.lead.prompt) : null;
  if (prompt) root.querySelector('.oc-go').append(prompt);

  const choose = root.querySelector('.oc-choose');
  root.querySelector('.oc-choose-label').textContent = t.choose;
  const group = root.querySelector('.oc-choose-group');
  group.setAttribute('aria-label', t.choose);
  const setButtons = cfg.sets.map((s, i) => {
    const b = button(s.name, () => chooseSet(i), 'oc-set');
    group.append(b);
    return b;
  });
  root.querySelector('.oc-key.is-same').textContent = t.same;
  root.querySelector('.oc-key.is-new').textContent = t.added;
  root.querySelector('.oc-note').textContent = t.note;
  const lanes = root.querySelector('.oc-lanes');
  const caption = root.querySelector('.oc-caption');
  let parkedRun = false; // 진행 중 꺼진 버튼의 초점을 레인 칸에 맡겨 두었는지

  function onVisibility() { if (document.hidden && state.running) settle(); }
  document.addEventListener('visibilitychange', onVisibility);

  // ---------- building ----------

  function currentSet() { return cfg.sets[state.set]; }
  function formationOf(set) { return set ? cfg.base.map((id) => (id === cfg.swap_out ? set.swap : id)) : [...cfg.base]; }
  const fmt = (tpl, map) => tpl.replace(/\{(\w+)\}/g, (_, k) => (map[k] ?? ''));
  const quote = (title) => fmt(t.event_format, { t: title });

  function build() {
    lanes.replaceChildren(lane(null), lane(currentSet()));
    paint();
  }

  function lane(set) {
    const after = !!set;
    const formation = formationOf(set);
    const box = el('section', `oc-lane ${after ? 'is-after' : 'is-before'}`);
    box.setAttribute('aria-label', after ? t.after : t.before);

    const head = el('header', 'oc-lane-head');
    head.append(el('span', 'oc-lane-tag', after ? t.after : t.before));
    const row = el('div', 'oc-cards');
    formation.forEach((id) => {
      const swapped = after && id === set.swap;
      const fig = el('figure', `oc-card${swapped ? ' is-swapped' : ''}`);
      // 이름은 그림 설명(figcaption)이 말한다 — 그림 대체 글에도 넣으면 같은 이름을 두 번 읽었다(10/06 점검)
      const img = el('img'); img.src = cards[id].image; img.alt = ''; img.loading = 'lazy';
      fig.append(img, el('figcaption', '', cards[id].name));
      if (swapped) fig.append(el('em', 'oc-one', t.one_card));
      row.append(fig);
    });
    head.append(row);
    const counts = el('p', 'oc-counts');
    cfg.sets.forEach((s) => {
      const have = s.members.filter((m) => formation.includes(m)).length;
      counts.append(el('span', have >= s.required ? 'is-on' : '', `${s.short} ${have} / ${s.required}`));
    });
    head.append(counts);
    box.append(head);

    const route = el('ol', 'oc-route');
    const fifth = formation[cfg.base.indexOf(cfg.swap_out)];
    cfg.stops.forEach((name, i) => {
      const last = i === cfg.stops.length - 1;
      const stop = el('li', `oc-stop${last ? ' is-next' : ''}`);
      if (!last) stop.dataset.beat = `s${i}`;
      stop.append(el('span', 'oc-dot'), el('strong', '', name), el('small', '', last ? t.next : t.fixed));
      route.append(stop);
      if (last) return;
      const gap = el('li', 'oc-gap');
      if (i < 3) {
        // The existing events look the same in both lanes. The swapped card's own events differ by the
        // existing rule, so they change without being marked — the eye should go to the empty time.
        gap.dataset.beat = `i${i}`;
        [cfg.protagonist, fifth, cfg.others[i]].forEach((id, k) => {
          const other = k === 2;
          const chip = el('span', 'oc-chip');
          const img = el('img'); img.src = cards[id].image; img.alt = ''; img.loading = 'lazy';
          const text = el('span');
          text.append(el('small', '', other ? t.arcana_event : cards[id].name), document.createTextNode(other ? cards[id].name : quote(cards[id].events[i])));
          chip.append(img, text);
          gap.append(chip);
        });
      } else {
        gap.classList.add('is-slot');
        gap.dataset.beat = 'event';
        gap.append(el('span', 'oc-slot-label', t.empty));
        if (after) {
          // Everything the set adds, in one cell.
          const pay = el('div', 'oc-pay');
          const insert = el('div', 'oc-insert');
          insert.append(el('small', '', t.set_event), el('strong', '', set.event ? quote(set.event) : t.tbd));
          const reward = el('p', 'oc-reward');
          reward.dataset.beat = 'reward';
          reward.append(el('strong', '', fmt(t.skill, { n: set.skill })), el('span', '', t.reward));
          const trait = el('p', 'oc-pay-trait');
          trait.dataset.beat = 'reward';
          trait.append(el('small', '', t.trait), el('strong', '', set.trait));
          pay.append(el('span', 'oc-pay-tag', set.name), insert, reward, trait);
          gap.append(pay);
        } else {
          gap.classList.add('is-empty');
          gap.append(el('small', 'oc-slot-same', t.stays_empty));
        }
      }
      route.append(gap);
    });
    box.append(route);
    return box;
  }

  // ---------- state → screen ----------

  function paint() {
    root.dataset.step = state.step;
    root.dataset.done = state.done;
    root.querySelectorAll('[data-beat]').forEach((node) => {
      node.classList.toggle('is-lit', state.step > order.indexOf(node.dataset.beat));
    });
    runBtn.textContent = state.running ? t.running : state.done ? t.rerun : t.run;
    // 진행 중에는 버튼을 끈다(테스트도 이 속성을 본다). 초점이 있는 버튼을 끄면 초점이 페이지 밖으로 빠졌다(10/06 점검) —
    // 끄기 전에 두 레인 칸으로 초점을 맡겨 두고, 끝나면 버튼으로 돌려준다
    if (state.running && !runBtn.disabled && document.activeElement === runBtn) {
      lanes.tabIndex = -1;
      lanes.focus({ preventScroll: true });
      parkedRun = true;
    }
    runBtn.disabled = state.running;
    if (!state.running && parkedRun) {
      parkedRun = false;
      if (document.activeElement === lanes) runBtn.focus({ preventScroll: true });
    }
    // The cue and the prompt belong to the first press only. After a run the button steps back —
    // it is no longer the next thing to do.
    runBtn.classList.toggle('cue', !state.pressed);
    runBtn.classList.toggle('is-done', state.done);
    if (prompt) prompt.hidden = state.pressed;
    choose.hidden = !state.done;
    const line = state.done ? t.caption : '';
    if (caption.textContent !== line) caption.textContent = line;
    setButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.set)));
  }

  // ---------- running ----------

  function run() {
    if (dead) return;
    stop();
    state.pressed = true;
    state.step = 0;
    state.done = false;
    paint();
    if (reducedMotion() || document.hidden) { settle(); return; }
    state.running = true;
    started = Date.now();
    paint();
    // One timer; every tick derives the step from elapsed time, so a skipped tick never stalls the run.
    timer = setInterval(tick, 80);
  }

  function tick() {
    if (dead) return;
    const elapsed = Date.now() - started;
    const step = beats.filter((b) => b.at <= elapsed).length;
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
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  function chooseSet(i) {
    if (dead || i === state.set) return;
    stop();
    state.running = false;
    state.set = i;
    // The chips only appear after a run, so the other relation is shown settled; its cell flashes once.
    state.step = beats.length;
    state.done = true;
    build();
    const slot = root.querySelector('.oc-lane.is-after .is-slot');
    animate(slot, [{ boxShadow: '0 0 0 10px rgba(213,233,168,.95)' }, { boxShadow: '0 0 0 4px rgba(213,233,168,.7)' }], { duration: 800 });
  }

  function restart(before) {
    if (dead) return;
    stop();
    before?.();
    onComplete({ hide: true });
    recapShown = false;
    state.set = 0; state.step = 0; state.done = false; state.running = false; state.pressed = false;
    parkedRun = false;
    build();
    // 다시 해보기 버튼(결론 칸)은 사라진다 — 초점을 실행 버튼으로 옮기고 화면도 그리로 데려간다.
    // 초점만 옮기면 버튼이 화면 밖(휴대폰에서 1,349px 위)에 있어 빈 점선 칸 앞에 남았다(10/06 점검)
    runBtn.focus({ preventScroll: true });
    runBtn.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'instant' : 'smooth' });
  }

  function button(label, action, cls = '') {
    const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', action); return b;
  }
  function el(tag, cls = '', text) {
    const node = document.createElement(tag); if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text; return node;
  }

  build();
  return {
    restart,
    destroy() { dead = true; stop(); document.removeEventListener('visibilitychange', onVisibility); },
  };
}
