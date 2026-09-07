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
  observer.observe(frame);
  return () => { observer.disconnect(); motion?.cancel(); };
}
