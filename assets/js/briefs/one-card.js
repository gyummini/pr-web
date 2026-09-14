import { animate, reducedMotion } from '../motion/animate.js';

// E5 — the same Journey twice, one card apart. The left lane keeps today's formation; the right lane
// swaps one card so a set stands. One run lights both lanes along the same fixed schedule, and only the
// right lane gains the set's trait, its relation event and the skill it strengthens. Everything the two
// lanes share is marked as unchanged. Text, cards and sets all come from data; nothing here computes a
// game rule — the interactive proposal (the original) is the source of truth.
//
// Timing follows the site's traps: state first, motion on top; one timer checks elapsed Date.now()
// every tick; a hidden tab or reduced motion settles the run at its end.
export function playOneCard(host, cfg, onComplete) {
  const t = cfg.labels;
  const cards = cfg.cards;
  const beats = cfg.beats; // [{ id, at }] — ids name what lights: s0 i0 s1 i1 s2 i2 ready s3 event reward
  const order = beats.map((b) => b.id);
  const state = { set: 0, step: 0, done: false, running: false };
  let timer = null;
  let started = 0;
  let recapShown = false;
  let dead = false;

  const root = el('div', 'oc');
  root.innerHTML = `
    <div class="oc-controls">
      <button type="button" class="oc-run"></button>
      <div class="oc-choose"><span class="oc-choose-label"></span><div class="oc-choose-group" role="group"></div></div>
    </div>
    <p class="oc-legend"><span class="oc-key is-same"></span><span class="oc-key is-new"></span></p>
    <div class="oc-lanes"></div>
    <p class="oc-status" role="status" aria-live="polite"></p>
    <section class="oc-diff" hidden></section>
    <section class="oc-summary" hidden></section>`;
  host.append(root);

  const runBtn = root.querySelector('.oc-run');
  runBtn.addEventListener('click', () => (state.running ? null : run()));
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
  const lanes = root.querySelector('.oc-lanes');
  const status = root.querySelector('.oc-status');
  const diff = root.querySelector('.oc-diff');
  const summary = root.querySelector('.oc-summary');

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
      const member = after && set.members.includes(id);
      const fig = el('figure', `oc-card${swapped ? ' is-swapped' : ''}${member ? ' is-member' : ''}`);
      const img = el('img'); img.src = cards[id].image; img.alt = cards[id].name; img.loading = 'lazy';
      fig.append(img, el('figcaption', '', cards[id].name));
      if (swapped) fig.append(el('em', 'oc-one', t.one_card));
      row.append(fig);
    });
    head.append(row);
    const counts = el('p', 'oc-counts');
    cfg.sets.forEach((s) => {
      const have = s.members.filter((m) => formation.includes(m)).length;
      const on = have >= s.required;
      counts.append(el('span', on ? 'is-on' : '', `${s.short} ${have} / ${s.required}`));
    });
    head.append(counts);
    if (after) {
      const trait = el('p', 'oc-trait is-new');
      trait.append(el('small', '', t.trait), el('strong', '', set.trait));
      head.append(trait);
    } else {
      head.append(el('p', 'oc-trait is-none', t.no_set));
    }
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
        gap.dataset.beat = `i${i}`;
        const chips = [cfg.protagonist, fifth, cfg.others[i]];
        chips.forEach((id, k) => {
          const member = after && set.members.includes(id);
          const other = k === 2;
          const chip = el('span', `oc-chip${other ? ' is-other' : ''}${member ? ' is-member' : ''}${k === 1 ? ' is-fifth' : ''}`);
          const img = el('img'); img.src = cards[id].image; img.alt = ''; img.loading = 'lazy';
          const text = el('span');
          text.append(el('small', '', other ? t.arcana_event : cards[id].name), document.createTextNode(other ? cards[id].name : quote(cards[id].events[i])));
          chip.append(img, text);
          gap.append(chip);
        });
        if (i === 2 && after) {
          const ready = el('p', 'oc-ready is-new', t.ready);
          ready.dataset.beat = 'ready';
          gap.append(ready);
        }
      } else if (after) {
        gap.classList.add('is-slot');
        const insert = el('div', 'oc-insert is-new');
        insert.dataset.beat = 'event';
        insert.append(el('small', '', t.set_event), el('strong', '', set.event ? quote(set.event) : t.tbd));
        const reward = el('p', 'oc-reward is-new');
        reward.dataset.beat = 'reward';
        reward.append(el('strong', '', fmt(t.skill, { n: set.skill })), el('span', '', t.reward), el('small', '', set.effect));
        gap.append(el('span', 'oc-slot-label', t.empty), insert, reward);
      } else {
        gap.classList.add('is-slot', 'is-empty');
        gap.dataset.beat = 'event';
        gap.append(el('span', 'oc-slot-label', t.empty), el('small', 'oc-slot-same', t.stays_empty));
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
    runBtn.disabled = state.running;
    setButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.set)));
    diff.hidden = !state.done;
    summary.hidden = !state.done;
    if (state.done) { renderDiff(); renderSummary(); }
  }

  function renderDiff() {
    const set = currentSet();
    diff.replaceChildren();
    const cols = el('div', 'oc-diff-cols');
    const added = column(t.diff_added, 'is-new', [
      [t.trait, set.trait],
      [t.set_event, set.event ? quote(set.event) : t.tbd],
      [fmt(t.skill, { n: set.skill }), t.reward],
    ]);
    const moved = column(t.diff_moved, 'is-moved', [
      [fmt(t.moved_from, { a: cards[cfg.swap_out].name, b: cards[set.swap].name }), t.moved_rule],
    ]);
    const same = column(t.diff_same, 'is-same', cfg.same_items.map((x) => [x, '']));
    cols.append(added, moved, same);
    diff.append(el('h4', 'oc-diff-title', t.diff_title), cols);
  }

  function column(title, cls, rows) {
    const col = el('div', `oc-diff-col ${cls}`);
    col.append(el('h5', '', title));
    const list = el('ul');
    rows.forEach(([a, b]) => {
      const li = el('li');
      li.append(el('strong', '', a));
      if (b) li.append(el('span', '', b));
      list.append(li);
    });
    col.append(list);
    return col;
  }

  function renderSummary() {
    if (summary.childElementCount) return;
    summary.append(el('h4', 'oc-summary-title', t.summary_title));
    const list = el('dl', 'oc-summary-list');
    cfg.summary.forEach((row) => {
      const item = el('div');
      item.append(el('dt', '', row.k), el('dd', '', row.v));
      list.append(item);
    });
    summary.append(list, el('p', 'oc-limit', t.limit), el('p', 'oc-note', t.note));
  }

  // ---------- running ----------

  function run() {
    if (dead) return;
    stop();
    state.step = 0;
    state.done = false;
    paint();
    if (reducedMotion() || document.hidden) { settle(); return; }
    state.running = true;
    started = Date.now();
    status.textContent = t.running;
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
    status.textContent = fmt(t.finished, { set: currentSet().name });
    paint();
    if (!recapShown) { recapShown = true; onComplete({ scroll: false }); }
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  function chooseSet(i) {
    if (dead || i === state.set) return;
    stop();
    state.running = false;
    state.set = i;
    build();
    if (state.done) {
      // A run already made the point; show the other relation settled, and mark what changed.
      state.step = beats.length;
      paint();
      root.querySelectorAll('.oc-lane.is-after .is-new, .oc-lane.is-after .is-swapped').forEach((node) => {
        animate(node, [{ boxShadow: '0 0 0 4px rgba(213,233,168,.9)' }, { boxShadow: '0 0 0 0 rgba(213,233,168,0)' }], { duration: 700 });
      });
      status.textContent = fmt(t.finished, { set: currentSet().name });
    } else {
      state.step = 0;
      paint();
    }
  }

  function restart(before) {
    if (dead) return;
    stop();
    before?.();
    onComplete({ hide: true });
    recapShown = false;
    state.set = 0; state.step = 0; state.done = false; state.running = false;
    status.textContent = '';
    summary.replaceChildren();
    build();
    runBtn.focus({ preventScroll: true });
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
