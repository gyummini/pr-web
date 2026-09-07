import { sequence } from './animate.js';

// One meaningful moment, only when the reader reaches it. Static DOM is always complete.
export function revealOnce(element, steps) {
  let handle;
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    handle = sequence(steps());
  }, { threshold: .25 });
  observer.observe(element);
  return () => { observer.disconnect(); handle?.cancel(); };
}
