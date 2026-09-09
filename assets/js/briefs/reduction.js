import { createRhythm } from '../motion/rhythm.js';
import { animate } from '../motion/animate.js';

// E3 — the systems change; the enhancement component keeps its DOM identity.
export function playReduction(host, cfg, onComplete) {
  const t = cfg.labels;
  const state = { chapter: 0, context: false, experienced: new Set(), attempt: 0 };
  let dead = false;
  let recapShown = false;
  const root = el('div', 'rd');
  root.innerHTML = `
    <nav class="rd-nav"></nav>
    <div class="rd-workspace">
      <section class="rd-editorial">
        <div class="rd-eyebrow"><span class="rd-chapter"></span><span class="rd-verb"></span></div>
        <h3 class="rd-title" tabindex="-1"></h3>
        <p class="rd-body"></p>
        <div class="rd-analysis"></div>
        <p class="rd-question"></p>
        <p class="rd-source"></p>
        <div class="rd-actions"></div>
      </section>
      <section class="rd-stage">
        <div class="rd-stage-head"><span class="rd-stage-label"></span><span class="rd-stage-state"></span></div>
        <div class="rd-rhythm-host"></div>
        <div class="rd-diagram"></div>
        <div class="rd-context"></div>
        <p class="rd-demo-note"></p>
        <div class="rd-cut-record"></div>
      </section>
    </div>
    <section class="rd-result" hidden></section>
    <div class="rd-bottom"></div>`;
  host.append(root);
  const nav = root.querySelector('.rd-nav');
  nav.setAttribute('aria-label', t.nav);
  cfg.chapters.forEach((ch, i) => {
    const b = button('', () => setChapter(i));
    b.append(el('span', '', String(i + 1).padStart(2, '0')), el('span', '', ch.name));
    nav.append(b);
  });
  const board = root.querySelector('.rd-diagram');
  board.setAttribute('aria-label', t.diagram);
  root.querySelector('.rd-stage-label').textContent = t.diagram;
  root.querySelector('.rd-demo-note').textContent = t.preview;
  const core = el('article', 'rd-core');
  core.dataset.system = 'enhance';
  core.innerHTML = `<div class="rd-core-head"><span class="rd-core-code">CORE / 01</span><span class="rd-core-keep"></span></div>
    <div class="rd-target-art" aria-hidden="true"></div>
    <div class="rd-target-name"></div><h4 class="rd-core-title"></h4><p class="rd-core-note"></p>
    <button type="button" class="rd-enhance"></button><p class="rd-outcome" role="status" aria-live="polite"></p>`;
  core.querySelector('.rd-core-keep').textContent = t.kept;
  core.querySelector('.rd-core-title').textContent = t.identity;
  core.querySelector('.rd-core-note').textContent = t.core_note;
  const enhance = core.querySelector('.rd-enhance');
  enhance.textContent = t.enhance;
  enhance.addEventListener('click', execute);
  const outcome = core.querySelector('.rd-outcome');
  board.append(core);
  const systems = new Map(cfg.systems.map(s => {
    const card = el('article', 'rd-system');
    card.dataset.system = s.id;
    card.append(el('span', 'rd-system-tag', s.tag), el('h4', '', s.title),
      el('p', '', s.note), el('div', 'rd-system-detail', s.detail), el('span', 'rd-system-status', s.status));
    return [s.id, card];
  }));
  const context = root.querySelector('.rd-context');
  const result = root.querySelector('.rd-result');
  const ns = 'http://www.w3.org/2000/svg';
  const network = document.createElementNS(ns, 'svg');
  network.classList.add('rd-network'); network.setAttribute('aria-hidden', 'true');
  board.prepend(network);
  const resize = new ResizeObserver(drawConnections);
  resize.observe(board);
  const rhythm = createRhythm(root.querySelector('.rd-rhythm-host'), cfg.rhythm);
  root.querySelector('.rd-bottom').append(button(t.restart, () => restart(), 'rd-restart'));

  function phase() { return state.chapter < 2 ? 0 : state.chapter === 2 ? 1 : 2; }
  function setChapter(chapter) {
    if (dead) return;
    rhythm.stop();
    state.chapter = chapter;
    state.context = chapter === 4;
    render();
    root.querySelector('.rd-title').focus({ preventScroll: true });
  }

  function render() {
    const ch = cfg.chapters[state.chapter];
    root.dataset.chapter = state.chapter;
    root.dataset.phase = phase();
    root.dataset.context = state.context;
    nav.querySelectorAll('button').forEach((b, i) => {
      if (i === state.chapter) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    root.querySelector('.rd-chapter').textContent = `${t.chapter} ${String(state.chapter + 1).padStart(2, '0')} / 05`;
    root.querySelector('.rd-verb').textContent = ch.verb;
    root.querySelector('.rd-title').textContent = ch.title;
    root.querySelector('.rd-body').textContent = ch.body;
    root.querySelector('.rd-question').textContent = ch.question;
    root.querySelector('.rd-source').textContent = ch.source;
    root.querySelector('.rd-stage-state').textContent = cfg.rhythm.modes[phase()].name;
    core.querySelector('.rd-core-keep').hidden = state.chapter < 3;
    cfg.systems.forEach(s => {
      const card = systems.get(s.id);
      const keep = s.cut === 'economy' ? phase() === 0 : phase() < 2;
      if (keep) board.append(card);
      else card.remove();
    });
    renderTarget();
    renderAnalysis();
    renderActions();
    renderContext();
    renderRecord();
    renderResult();
    outcome.textContent = t.idle;
    outcome.dataset.result = 'idle';
    rhythm.draw(cfg.rhythm.modes[phase()]);
    drawConnections();
  }

  function drawConnections() {
    if (dead) return;
    const nodes = [core, ...[...systems.values()].filter(node => node.isConnected)];
    network.replaceChildren();
    network.setAttribute('viewBox', `0 0 ${board.clientWidth} ${board.clientHeight}`);
    if (nodes.length === 1) return;
    for (let i = 0; i < nodes.length - 1; i += 1) {
      const a = nodes[i], b = nodes[i + 1];
      const horizontal = a.offsetLeft !== b.offsetLeft && b.offsetTop < a.offsetTop + a.offsetHeight;
      const x1 = a.offsetLeft + (horizontal ? a.offsetWidth : a.offsetWidth / 2);
      const y1 = a.offsetTop + (horizontal ? Math.min(a.offsetHeight / 2, b.offsetHeight / 2) : a.offsetHeight);
      const x2 = b.offsetLeft + (horizontal ? 0 : b.offsetWidth / 2);
      const y2 = b.offsetTop + (horizontal ? b.offsetHeight / 2 : 0);
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', horizontal ? `M${x1},${y1} H${(x1 + x2) / 2} V${y2} H${x2}` : `M${x1},${y1} V${(y1 + y2) / 2} H${x2} V${y2}`);
      network.append(path);
      const arrow = document.createElementNS(ns, 'path');
      arrow.setAttribute('d', horizontal ? `M${x2 - 5},${y2 - 3} L${x2},${y2} L${x2 - 5},${y2 + 3}` : `M${x2 - 3},${y2 - 5} L${x2},${y2} L${x2 + 3},${y2 - 5}`);
      network.append(arrow);
    }
  }

  function renderTarget() {
    const target = cfg.targets[state.context ? 2 : phase() === 0 ? 0 : 1];
    const art = core.querySelector('.rd-target-art');
    // Only the subject changes. The card, enhancement button and result node are never replaced.
    if (art.dataset.target !== target.name) {
      art.dataset.target = target.name;
      art.replaceChildren();
      if (target.image) {
        const image = el('img'); image.src = target.image; image.alt = '';
        art.append(image);
      } else {
        const ns = 'http://www.w3.org/2000/svg';
        const icon = document.createElementNS(ns, 'svg'); icon.setAttribute('viewBox', '0 0 160 120');
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', target.icon === 'sword'
          ? 'M82 13 L95 30 L88 78 L73 78 L66 30 Z M60 79 H101 M80 79 V104 M72 105 H88'
          : 'M37 33 Q84 5 129 43 L123 51 Q79 26 42 44 Z M86 36 L60 105 L49 101 L75 31');
        path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '6');
        path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
        icon.append(path); art.append(icon);
      }
    }
    core.querySelector('.rd-target-name').textContent = target.name;
    art.title = target.caption;
  }

  function renderAnalysis() {
    const analysis = root.querySelector('.rd-analysis');
    analysis.replaceChildren();
    if (state.chapter === 1) {
      analysis.append(el('h4', 'rd-analysis-label', t.economy_weight));
      const list = el('dl', 'rd-rules');
      cfg.economy_rules.forEach(rule => {
        const row = el('div'); row.append(el('dt', '', rule.label), el('dd', '', rule.line)); list.append(row);
      });
      analysis.append(list, el('p', 'rd-verdict', t.economy_verdict));
    }
    if (state.chapter === 2) {
      analysis.append(el('h4', 'rd-analysis-label', t.compare));
      const comparison = el('div', 'rd-comparison');
      cfg.comparison.forEach(c => {
        const col = el('div'); col.append(el('h4', '', c.title));
        const list = el('ul'); c.items.forEach(item => list.append(el('li', '', item))); col.append(list); comparison.append(col);
      });
      analysis.append(comparison);
      const discovery = el('p', 'rd-discovery', t.discovery);
      discovery.hidden = !state.experienced.has(2);
      analysis.append(discovery);
    }
    if (state.chapter === 3) {
      const pair = el('div', 'rd-action-context');
      [[t.action, t.action_line], [t.context, state.context ? t.context_found : t.context_question]].forEach(([label, line]) => {
        const section = el('div'); section.append(el('h4', '', label), el('p', '', line)); pair.append(section);
      });
      analysis.append(pair);
    }
  }

  function renderActions() {
    const actions = root.querySelector('.rd-actions'); actions.replaceChildren();
    if (state.chapter === 1) actions.append(button(t.cut_economy, () => setChapter(2), 'rd-cut'));
    if (state.chapter === 2) actions.append(button(t.cut_mining, () => setChapter(3), 'rd-cut'));
    if (state.chapter === 3) {
      if (!state.context) actions.append(button(t.add_context, () => { state.context = true; render(); }, 'rd-context-button'));
      else actions.append(button(t.show_result, () => setChapter(4), 'rd-context-button'));
    }
    if (state.chapter < 4) actions.append(button(state.chapter === 0 ? t.next : t.skip, () => setChapter(state.chapter + 1), 'rd-skip'));
    if (state.chapter > 0) actions.append(button(t.back, () => setChapter(state.chapter - 1), 'rd-back'));
  }

  function renderContext() {
    context.hidden = !state.context;
    if (context.childElementCount) return;
    context.append(el('span', 'rd-context-label', t.social_label));
    const relations = el('ul', 'rd-relations');
    t.social.forEach(label => relations.append(el('li', '', label)));
    context.append(relations, el('p', 'rd-context-line', t.context_found));
  }

  function renderRecord() {
    const record = root.querySelector('.rd-cut-record'); record.replaceChildren();
    record.append(el('span', '', t.cut_record));
    if (phase() === 0) record.append(el('p', '', t.none_cut));
    if (phase() >= 1) record.append(el('p', '', t.economy_cut));
    if (phase() >= 2) record.append(el('p', '', t.mining_cut));
  }

  function renderResult() {
    result.hidden = state.chapter !== 4;
    if (state.chapter !== 4) {
      if (recapShown) { onComplete({ hide: true }); recapShown = false; }
      return;
    }
    if (!result.childElementCount) {
      result.append(el('h3', '', t.final_statement), el('p', 'rd-final-detail', t.final_detail));
      const pair = el('div', 'rd-final-comparison');
      const before = el('div', 'rd-before'); before.append(el('h4', '', t.before));
      const cluster = el('div', 'rd-before-cluster');
      [t.identity, ...cfg.systems.map(s => s.title), ...cfg.economy_rules.map(r => r.label)].forEach(label => cluster.append(el('span', '', label)));
      before.append(cluster);
      const after = el('div', 'rd-after'); after.append(el('h4', '', t.after), el('strong', '', t.identity), el('p', '', `+ ${t.final_context}`));
      pair.append(before, after); result.append(pair);
      const lessons = el('ol', 'rd-lessons');
      cfg.lessons.forEach(l => { const item = el('li'); item.append(el('h4', '', l.title), el('p', '', l.line)); lessons.append(item); });
      result.append(lessons);
      const figure = el('figure', 'rd-evidence');
      const image = el('img'); image.src = cfg.image; image.alt = t.source_alt; image.loading = 'lazy';
      figure.append(image, el('figcaption', '', t.source_label)); result.append(figure);
    }
    if (!recapShown) { recapShown = true; onComplete({ scroll: false }); }
  }

  function execute() {
    if (dead) return;
    rhythm.stop();
    state.experienced.add(state.chapter);
    state.attempt += 1;
    const mode = cfg.rhythm.modes[phase()];
    // Results for the entire sample are determined now. Timers only present them.
    const results = mode.points.map((_, i) => (state.attempt + i) % 3 !== 0);
    renderAnalysis();
    const discovery = root.querySelector('.rd-discovery');
    if (discovery) discovery.hidden = true;
    const light = node => [core, ...systems.values()].forEach(el => el.classList.toggle('rd-running', el === node));
    rhythm.play(mode, {
      onBeat(i, motion) {
        outcome.textContent = results[i] ? t.success : t.failure;
        outcome.dataset.result = results[i] ? 'success' : 'failure';
        light(core);
        if (motion) animate(outcome, [{ opacity: .35, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 150 });
      },
      onPhase(id) { light(systems.get(id)); },
      onDone() { light(null); if (discovery) discovery.hidden = false; },
    });
  }

  function restart(before) {
    if (dead) return;
    rhythm.stop();
    before?.();
    onComplete({ hide: true });
    state.chapter = 0; state.context = false; state.attempt = 0; state.experienced.clear();
    recapShown = false;
    render();
    root.querySelector('.rd-title').focus({ preventScroll: true });
  }

  function button(label, action, cls = '') {
    const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', action); return b;
  }
  function el(tag, cls = '', text) {
    const node = document.createElement(tag); if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text; return node;
  }
  render();
  return { restart, destroy() { dead = true; resize.disconnect(); rhythm.destroy(); } };
}
