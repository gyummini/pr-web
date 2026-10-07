import { animate } from './animate.js';

export function evidenceHeader(scope, ev) {
  if (!ev.thumb) return () => {};
  const frame = document.createElement('div');
  frame.className = 'evidence-cover';
  frame.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.src = ev.thumb;
  img.alt = '';
  img.addEventListener('error', () => frame.remove(), { once: true });
  frame.appendChild(img);
  const scan = document.createElement('span');
  scan.className = 'evidence-scan';
  frame.appendChild(scan);
  scope.prepend(frame);
  let played = false;
  let motion;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) { motion?.cancel(); continue; }
      if (played) continue;
      played = true;
      motion = animate(scan, [
        { transform: 'translateY(0)', opacity: 0 },
        { opacity: .35, offset: .2 },
        { transform: `translateY(${frame.clientHeight}px)`, opacity: 0 },
      ], { duration: 560, easing: 'linear' });
    }
  });
  // 틀이 그림 크기에 맞춰 줄어드는 자리(인터랙티브 페이지 머리말)에서는 그림이 오기 전 높이가 0이다 — 그림이 온 뒤에 훑는다
  let stopped = false;
  if (img.complete) observer.observe(frame);
  else img.addEventListener('load', () => { if (!stopped) observer.observe(frame); }, { once: true });
  return () => { stopped = true; observer.disconnect(); motion?.cancel(); };
}
