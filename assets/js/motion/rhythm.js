import { animate, reducedMotion } from './animate.js';

// Finite presentation of an already committed sample. It owns no chapter/game state.
export function createRhythm(host, cfg) {
  const ns = 'http://www.w3.org/2000/svg';
  host.innerHTML = `<div class="rd-rhythm"><div class="rd-rhythm-head"><strong></strong><span></span></div>
    <svg class="rd-track" viewBox="0 0 1000 70" preserveAspectRatio="none" role="img"></svg>
    <div class="rd-rhythm-status"><span class="rd-rhythm-current"></span><span class="rd-rhythm-legend"></span></div>
    <p class="rd-rhythm-note"></p></div>`;
  host.querySelector('strong').textContent = cfg.title;
  host.querySelector('.rd-rhythm-head > span').textContent = cfg.label;
  host.querySelector('.rd-rhythm-legend').textContent = cfg.legend;
  const svg = host.querySelector('svg');
  const status = host.querySelector('.rd-rhythm-current');
  let timer = null;
  let finishRun = null;
  let cursorMotion = null;
  let beatMotions = [];
  let markers = [];
  let cursor;
  let visible = true;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) stop();
  });
  observer.observe(host);
  document.addEventListener('visibilitychange', onVisibility);
  preference.addEventListener('change', onPreference);

  function draw(mode) {
    stop();
    svg.replaceChildren(); markers = [];
    svg.setAttribute('aria-label', `${mode.name}. ${mode.note}`);
    const baseline = document.createElementNS(ns, 'line');
    for (const [key, value] of Object.entries({ x1: 16, y1: 35, x2: 984, y2: 35 })) baseline.setAttribute(key, value);
    svg.append(baseline);
    mode.points.forEach(point => {
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', 16 + point * 9.68); circle.setAttribute('cy', 35); circle.setAttribute('r', 7);
      circle.classList.add('rd-beat'); circle.dataset.point = point;
      svg.append(circle); markers.push(circle);
    });
    cursor = document.createElementNS(ns, 'circle');
    cursor.setAttribute('cx', 16); cursor.setAttribute('cy', 35); cursor.setAttribute('r', 5);
    cursor.classList.add('rd-track-cursor'); svg.append(cursor);
    status.textContent = cfg.idle;
    host.querySelector('.rd-rhythm-note').textContent = mode.note;
    host.dataset.mode = cfg.modes.indexOf(mode);
  }

  function play(mode, { onBeat, onPhase, onDone }) {
    draw(mode);
    const finish = () => {
      clearInterval(timer); timer = null;
      cursorMotion?.cancel(); beatMotions.forEach(h => h.cancel()); beatMotions = [];
      finishRun = null;
      onBeat(mode.points.length - 1, false);
      markers.forEach(marker => marker.classList.add('rd-beat-past'));
      status.textContent = cfg.end;
      onDone();
    };
    finishRun = finish;
    if (reducedMotion() || document.hidden || !visible) { finish(); return; }
    const duration = cfg.duration;
    const events = [];
    mode.points.forEach((point, i) => {
      events.push({ time: point / 100 * duration, beat: i });
      if (i === mode.points.length - 1) return;
      const gap = (mode.points[i + 1] - point) / 100 * duration;
      mode.phases.forEach((label, j) => {
        events.push({ time: point / 100 * duration + 100 + j * Math.max(0, gap - 130) / mode.phases.length, label, system: mode.systems[j] });
      });
    });
    events.sort((a, b) => a.time - b.time);
    let index = 0;
    const start = performance.now();
    function tick() {
      const elapsed = performance.now() - start;
      while (index < events.length && events[index].time <= elapsed) {
        const event = events[index++];
        if (event.beat !== undefined) {
          markers[event.beat].classList.add('rd-beat-past');
          beatMotions.push(animate(markers[event.beat], [{ strokeWidth: '0px', strokeOpacity: 0 }, { strokeWidth: '20px', strokeOpacity: .16, offset: .3 }, { strokeWidth: '0px', strokeOpacity: 0 }], { duration: 160 }));
          status.textContent = cfg.label;
          onBeat(event.beat, true);
        } else {
          status.textContent = event.label;
          onPhase(event.system);
        }
      }
      if (elapsed >= duration) finish();
    }
    cursorMotion = animate(cursor, [{ transform: 'translateX(0)', opacity: .7 }, { transform: 'translateX(968px)', opacity: .7 }], { duration, easing: 'linear' });
    tick();
    timer = setInterval(tick, 24);
  }
  function stop() { finishRun?.(); }
  function onVisibility() { if (document.hidden) stop(); }
  function onPreference() { if (preference.matches) stop(); }
  return {
    draw, play, stop,
    destroy() {
      // Teardown cancels presentation without callbacks into a departed view.
      finishRun = null; clearInterval(timer); cursorMotion?.cancel(); beatMotions.forEach(h => h.cancel());
      observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); preference.removeEventListener('change', onPreference);
    },
  };
}
