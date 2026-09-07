import { animate, effects, reducedMotion, cancelMotion } from './animate.js';

let pending = null;
let revision = 0;
function mark(view, id) {
  if (!id) return;
  const card = [...view.querySelectorAll('.ev-card')].find(el => el.dataset.eid === id);
  const scope = card || view.querySelector('.brief-head, .detail');
  const title = scope?.querySelector('.ev-title');
  if (title) title.style.viewTransitionName = 'evidence-title';
  const media = scope?.querySelector('.ev-thumb, .evidence-cover');
  if (media) media.style.viewTransitionName = 'evidence-media';
}
function unmark(view) {
  view.querySelectorAll('[style*="view-transition-name"]').forEach(el => el.style.viewTransitionName = '');
}
export function transitionRoute(view, from, to, render) {
  const token = ++revision;
  pending?.skipTransition();
  cancelMotion();
  unmark(view);
  const source = from.match(/^\/evidence(?:\/([^/]+))?/);
  const target = to.match(/^\/evidence(?:\/([^/]+))?/);
  const id = target?.[1] || source?.[1];
  const shared = source && target && id && (!source[1] || !target[1] || source[1] === target[1]);
  const update = () => {
    if (token !== revision) return;
    render();
    if (shared && token === revision) mark(view, id);
  };
  if (!shared || reducedMotion() || document.hidden || !document.startViewTransition) {
    update();
    unmark(view);
    animate(view, effects.fade, { duration: 180 });
    return;
  }
  mark(view, id);
  const transition = document.startViewTransition(update);
  pending = transition;
  transition.ready.catch(() => {});
  transition.finished.catch(() => {}).finally(() => {
    if (token !== revision) return;
    unmark(view);
    pending = null;
  });
}
