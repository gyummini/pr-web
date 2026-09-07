import { animate, reducedMotion } from './animate.js';

const NS = 'http://www.w3.org/2000/svg';
// Explicit directed edges: a denied cast ends at deny; only accepted casts reach spend.
export function flowPaths(chart, yes, no, labels = {}) {
  const links = [
    ['env', 'runtime', labels.cost], ['runtime', 'q_cost'], ['q_cost', 'deny', no],
    ['q_cost', 'spend', yes], ['spend', 'q_draw'], ['q_draw', 'to_top', yes],
    ['q_draw', 'to_bottom', no], ['to_top', 'draw'], ['to_bottom', 'draw'],
    ['draw', 'queue'], ['queue', 'q_change', labels.exception], ['q_change', 'skilltable'], ['skilltable', 'reset', labels.recovery],
  ];
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('fx-paths');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>';
  chart.prepend(svg);
  const paths = new Map();
  links.forEach(([from, to, label]) => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('marker-end', 'url(#flow-arrow)');
    path.dataset.from = from; path.dataset.to = to;
    svg.append(path);
    let text;
    if (label) { text = document.createElementNS(NS, 'text'); text.textContent = label; svg.append(text); }
    paths.set(`${from}:${to}`, { path, text });
  });
  const packet = document.createElementNS(NS, 'circle');
  packet.setAttribute('r', '4'); packet.classList.add('fx-packet'); svg.append(packet);
  let pulse;
  function layout() {
    const box = chart.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    links.forEach(([from, to]) => {
      const a = chart.querySelector(`[data-n="${from}"]`), b = chart.querySelector(`[data-n="${to}"]`);
      const ar = { x: a.offsetLeft, y: a.offsetTop, w: a.offsetWidth, h: a.offsetHeight };
      const br = { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
      const horizontal = ar.y === br.y;
      const x1 = ar.x + (horizontal ? ar.w : ar.w / 2), y1 = ar.y + (horizontal ? ar.h / 2 : ar.h);
      const x2 = br.x + (horizontal ? 0 : br.w / 2), y2 = br.y + (horizontal ? br.h / 2 : 0);
      const mid = (y1 + y2) / 2;
      const d = horizontal ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} V${mid} H${x2} V${y2}`;
      const { path, text } = paths.get(`${from}:${to}`); path.setAttribute('d', d);
      if (text) {
        text.setAttribute('x', horizontal ? (x1 + x2) / 2 : x2 + 10);
        text.setAttribute('y', horizontal ? Math.min(ar.y, br.y) - 7 : mid - 5);
        text.setAttribute('text-anchor', horizontal ? 'middle' : 'start');
      }
    });
  }
  const observer = new ResizeObserver(layout); observer.observe(chart);
  return {
    trace(from, to, ms) {
      pulse?.cancel(); packet.style.opacity = '0';
      paths.forEach(({ path }) => { if (path.classList.contains('on')) path.classList.add('past'); path.classList.remove('on'); });
      const item = paths.get(`${from}:${to}`);
      if (!item) return;
      item.path.classList.add('on');
      if (reducedMotion() || document.hidden) return;
      packet.style.offsetPath = `path('${item.path.getAttribute('d')}')`;
      pulse = animate(packet, [{ offsetDistance: '0%', opacity: 1 }, { offsetDistance: '100%', opacity: 1 }], { duration: ms * .8, easing: 'linear' });
    },
    end() { pulse?.cancel(); packet.style.opacity = '0'; },
    reset() { pulse?.cancel(); packet.style.opacity = '0'; paths.forEach(({ path }) => path.classList.remove('on', 'past')); },
    destroy() { pulse?.cancel(); observer.disconnect(); },
  };
}
