import { syncBadge } from './ui.js';
import { renderIntro } from './views/intro.js';
import { renderBasic } from './views/basic.js';
import { renderDossier } from './views/dossier.js';
import { renderEvidence } from './views/evidence.js';
import { renderDetail } from './views/detail.js';
import { renderEnding } from './views/ending.js';
import { renderMaking } from './views/making.js';
import { renderNotebook } from './views/notebook.js';

// URL 해시 라우팅 — 브라우저 뒤로가기가 탭/챕터 이동과 자연스럽게 동작 (명세서 6)
let current = null;

const TAB_OF = {
  basic: 'basic',
  case: 'dossier',
  evidence: 'evidence',
  ending: 'evidence',
  making: 'evidence',
  notebook: 'evidence',
};

export function startRouter() {
  window.addEventListener('hashchange', dispatch);
  dispatch();
}

function dispatch() {
  const hash = location.hash || '#/intro';
  const seg = hash.replace(/^#\/?/, '').split('/'); // ['case','01'] 등

  if (current) {
    if (current.onLeave) current.onLeave(hash);
    if (current.destroy) current.destroy();
    current = null;
  }

  const view = document.getElementById('view');
  view.className = '';
  view.innerHTML = '';
  window.scrollTo(0, 0);
  // 콘텐츠가 붙기 전 빈 화면이 스치지 않도록 짧은 페이드 인 (스피너는 쓰지 않는다)
  view.classList.add('view-enter');
  setTimeout(() => view.classList.remove('view-enter'), 20);

  switch (seg[0]) {
    case '':
    case 'intro':
      current = renderIntro(view);
      break;
    case 'basic':
      current = renderBasic(view);
      break;
    case 'case':
      current = renderDossier(view, (seg[1] || '01').padStart(2, '0'));
      break;
    case 'evidence':
      current = seg[1] ? renderDetail(view, seg[1]) : renderEvidence(view);
      break;
    case 'ending':
      current = renderEnding(view);
      break;
    case 'making':
      current = renderMaking(view);
      break;
    case 'notebook':
      current = renderNotebook(view);
      break;
    default:
      current = renderIntro(view);
  }

  updateTabs(seg[0]);
  syncBadge();
}

function updateTabs(routeKey) {
  const active = TAB_OF[routeKey] || null;
  document.querySelectorAll('#tabs a[data-tab]').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === active);
  });
}
