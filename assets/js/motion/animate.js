// Presentation only: callers commit DOM/state before asking for motion.
export const easing = { standard: 'cubic-bezier(.22,.61,.36,1)', spring: 'cubic-bezier(.2,.85,.3,1.12)' };
const preference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const active = new Set();
export const reducedMotion = () => !!preference?.matches;
const empty = () => ({ finished: Promise.resolve(), cancel() {}, reverse() {} });
export function animate(el, frames, options = {}) {
  if (!el?.animate || reducedMotion() || document.hidden) return empty();
  const animation = el.animate(frames, { duration: 320, easing: easing.standard, ...options });
  active.add(animation);
  // Cancellation is a successful presentation outcome, never an application error.
  const finished = animation.finished.catch(() => {}).finally(() => active.delete(animation));
  return { finished, cancel: () => animation.cancel(), reverse: () => {
    if (reducedMotion() || document.hidden) { animation.cancel(); return; }
    animation.reverse();
    active.add(animation);
    animation.finished.catch(() => {}).finally(() => active.delete(animation));
  } };
}
export const effects = {
  fade: [{ opacity: 0 }, { opacity: 1 }],
  slide: [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
  scale: [{ transform: 'scale(.96)' }, { transform: 'scale(1)' }],
  focus: [{ filter: 'blur(3px)', opacity: .4 }, { filter: 'blur(0)', opacity: 1 }],
  blur: [{ filter: 'blur(0)' }, { filter: 'blur(3px)' }],
  draw: [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
};
export function sequence(steps, options = {}) {
  const handles = steps.map(({ el, effect = 'fade', frames, at = 0, ...rest }) =>
    animate(el, frames || effects[effect], { fill: 'backwards', ...options, ...rest, delay: at }));
  return { finished: Promise.all(handles.map(h => h.finished)), cancel: () => handles.forEach(h => h.cancel()), reverse: () => handles.forEach(h => h.reverse()) };
}
export function stagger(elements, effect = 'slide', gap = 45, options = {}) {
  return sequence([...elements].map((el, i) => ({ el, effect, at: i * gap })), options);
}
export function cancelMotion() { active.forEach(a => a.cancel()); active.clear(); }
preference?.addEventListener('change', () => { if (reducedMotion()) cancelMotion(); });
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) cancelMotion(); });
