import { animate, easing } from './animate.js';

// The destination is already in its final DOM position. No clones or completion gates.
export function fromRect(el, from, options = {}) {
  const to = el.getBoundingClientRect();
  if (!from?.width || !from.height || !to.width || !to.height) return animate(null, []);
  return animate(el, [
    { transformOrigin: '0 0', transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width},${from.height / to.height})` },
    { transformOrigin: '0 0', transform: 'translate(0,0) scale(1)' },
  ], { duration: 420, easing: easing.spring, ...options });
}
export function moveFrom(el, source, options) { return fromRect(el, source.getBoundingClientRect(), options); }
export function flip(elements, mutate, options) {
  const before = new Map([...elements].map(el => [el, el.getBoundingClientRect()]));
  mutate();
  const handles = [...before].map(([el, rect]) => fromRect(el, rect, options));
  return { finished: Promise.all(handles.map(h => h.finished)), cancel: () => handles.forEach(h => h.cancel()), reverse: () => handles.forEach(h => h.reverse()) };
}
