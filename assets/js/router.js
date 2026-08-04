import { syncBadge } from './ui.js';
import { renderIntro } from './views/intro.js';
import { renderBasic } from './views/basic.js';
import { renderDossier } from './views/dossier.js';
import { renderEvidence } from './views/evidence.js';
import { renderDetail } from './views/detail.js';
import { renderEnding } from './views/ending.js';
import { renderMaking } from './views/making.js';
import { renderNotebook } from './views/notebook.js';
import { renderDocs } from './views/docs.js';
import { renderNotFound } from './views/notfound.js';

// History API 경로 라우팅 — 브라우저 뒤로가기가 탭/챕터 이동과 자연스럽게 동작 (명세서 6).
// 해시(#/basic)가 아니라 실경로(/basic)를 쓴다: Vercel Web Analytics 스크립트는
// pushState/popstate만 페이지뷰로 집계하고 해시 변경은 감지하지 않기 때문.
// 새로고침·직접 진입이 404가 되지 않게 하는 SPA fallback은 vercel.json rewrites가 담당한다.
let current = null;
let currentPath = '/';
let lastNotified = null;

// 렌더 도중 뷰가 호출한 리다이렉트를 모아뒀다가 렌더가 끝난 뒤 처리한다.
// (해시 시절에는 hashchange가 비동기라 자연히 분리됐지만, pushState는 동기라
//  중첩 dispatch가 발생해 바깥 렌더가 안쪽 결과를 덮어쓴다.)
let dispatching = false;
let pendingRedirect = null;

const subscribers = [];

const TAB_OF = {
  basic: 'basic',
  case: 'dossier',
  evidence: 'evidence',
  ending: 'evidence',
  making: 'evidence',
  notebook: 'evidence',
};

export function currentRoute() {
  return currentPath;
}

// 라우트 변경 구독. 계측 모듈이 라우팅 코드를 건드리지 않고 붙기 위한 지점이다.
export function onRouteChange(fn) {
  subscribers.push(fn);
  return () => {
    const i = subscribers.indexOf(fn);
    if (i >= 0) subscribers.splice(i, 1);
  };
}

export function navigate(to, { replace = false } = {}) {
  if (dispatching) {
    // 뷰 렌더 중의 가드 리다이렉트 — 중간 경로는 기록하지 않고 최종 경로만 반영한다
    pendingRedirect = { to, replace };
    return;
  }
  const path = normalize(to);
  if (path === currentPath && !replace) return;
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  dispatch();
}

function normalize(to) {
  let p = String(to == null ? '/' : to).trim();
  if (p.startsWith('#')) p = p.slice(1); // 데이터에 남아 있을 수 있는 '#/notebook' 형태 방어
  p = p.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1'); // 끝 슬래시 제거 (루트 '/'는 유지)
  return p || '/';
}

export function startRouter() {
  // 기존에 공유된 '/#/basic' 형태의 외부 링크 호환 — 진입 시 1회만 실경로로 치환한다
  const legacy = location.hash.match(/^#(\/.*)$/);
  if (legacy) {
    history.replaceState(null, '', normalize(legacy[1]) + location.search);
  }
  window.addEventListener('popstate', dispatch);
  document.addEventListener('click', onLinkClick);
  dispatch();
}

// 내부 링크(<a href="/...">)를 가로채 pushState로 처리한다.
// 앵커 태그를 그대로 쓰므로 새 탭 열기·링크 복사 등 브라우저 기본 동작은 유지된다.
function onLinkClick(e) {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const href = a.getAttribute('href');
  // 외부 링크·mailto:·tel:·상대 경로는 브라우저에 맡긴다
  if (!href || !href.startsWith('/')) return;
  // '/이력서.pdf' 같은 정적 파일은 라우트가 아니다
  if (/\.[a-z0-9]+$/i.test(href.split('?')[0])) return;
  e.preventDefault();
  navigate(href);
}

function dispatch() {
  const path = normalize(location.pathname);
  const seg = path.replace(/^\//, '').split('/'); // ['case','01'] 등

  dispatching = true;
  pendingRedirect = null;

  if (current) {
    if (current.onLeave) current.onLeave(path);
    if (current.destroy) current.destroy();
    current = null;
  }
  currentPath = path;

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
    case 'docs':
      current = renderDocs(view);
      break;
    default:
      current = renderNotFound(view, path);
  }

  dispatching = false;

  if (pendingRedirect) {
    const r = pendingRedirect;
    pendingRedirect = null;
    navigate(r.to, { replace: r.replace });
    return; // 최종 경로의 dispatch가 탭 갱신과 구독자 통지를 마저 수행한다
  }

  // 문서 목록은 컨셉 없는 열람용 — 상단 탭 바(사건 파일 UI)를 노출하지 않는다
  document.body.classList.toggle('plain-mode', seg[0] === 'docs');
  updateTabs(seg[0]);
  syncBadge();

  const previousPath = lastNotified;
  lastNotified = path;
  subscribers.slice().forEach((fn) => {
    try {
      fn({ path, previousPath });
    } catch (err) {
      console.error(err);
    }
  });
}

function updateTabs(routeKey) {
  const active = TAB_OF[routeKey] || null;
  document.querySelectorAll('#tabs a[data-tab]').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === active);
  });
}
