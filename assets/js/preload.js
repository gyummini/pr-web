// 자원 사전 로딩. 필요한 시점에 요청하면 그 시점에 지연이 드러나므로,
// 유휴 시간(인트로 대사 재생 중 등)에 백그라운드로 미리 받아둔다.
// 실패는 조용히 무시하고 정상 로딩으로 폴백한다 (콘솔 에러를 남기지 않는다).
import { SPRITES, SPRITE_KEYS } from './sprites.js';
import { DB } from './data.js';

// 수첩 전용 폰트: 손글씨는 자체 호스팅(교보 손글씨, style.css의 @font-face),
// 본문 고운돋움만 Google Fonts에서 받는다.
export const NB_FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap';
const NB_FONT_ID = 'nb-fonts';
// 글꼴을 미리 불러 둘 때 쓰는 글자 — 고운돋움은 글자 범위마다 조각이 나뉘어 있어, 한글을 주어야 한글 조각을 받는다.
// 수첩 표지의 글(데이터는 첫 화면 전에 다 받아 둔다)을 쓴다. 없으면 글꼴의 기본 견본으로 부른다
const nbFontSample = () => {
  const c = (DB.notebook && DB.notebook.cover) || {};
  return [c.kicker, c.title, c.sub, c.stamp].filter(Boolean).join(' ') || undefined;
};

const idle = (fn) =>
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback(fn, { timeout: 2500 })
    : setTimeout(fn, 300);

const done = new Set();

// 이미지 1장을 받아두고 디코딩까지 끝낸다 (디코딩 지연이 전환 순간의 빈 프레임 원인).
export function preloadImage(url) {
  if (!url || done.has(url)) return Promise.resolve();
  done.add(url);
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().then(resolve, resolve);
      else resolve();
    };
    img.onerror = () => resolve(); // 파일이 없어도 조용히 통과
    img.src = url;
  });
}

function imageList() {
  const urls = [];
  SPRITE_KEYS.forEach((k) => urls.push(SPRITES.standing[k]));
  urls.push(SPRITES.sd.normal);
  // 증거 카드 썸네일 — 데이터에 경로가 있는 것만 (없는 파일은 onerror로 조용히 폴백)
  (DB.cards || []).forEach((c) => {
    if (c.thumb) urls.push(c.thumb);
  });
  // 사무소 그림 — 한국 시간 밤이면 밤 그림(index.html이 html에 night를 붙인다, 10/11 나4)
  urls.push(document.documentElement.classList.contains('night') ? '/assets/img/bg_office_night.jpg' : '/assets/img/bg_office.jpg');
  return [...new Set(urls.filter(Boolean))];
}

// 수첩 폰트를 백그라운드로 불러 둔다. 한 번만 하고, 글꼴이 준비되면 풀리는 약속을 돌려준다(수첩 화면이 이것을 기다린다).
// 손글씨는 style.css의 @font-face를 document.fonts.load로 직접 불러 둔다 — 한 번 불린 글꼴은 문서가 끝날 때까지 다시 받지 않는다.
// 전에는 preload 링크를 달았는데, 링크와 @font-face가 같은 파일(175KB)을 따로 받거나 수첩을 열 때 다시 받았다(10/11 수첩 재점검).
let nbFontsReady = null;
export function preloadNotebookFonts() {
  if (nbFontsReady) return nbFontsReady;
  const pre1 = document.createElement('link');
  pre1.rel = 'preconnect';
  pre1.href = 'https://fonts.googleapis.com';
  const pre2 = document.createElement('link');
  pre2.rel = 'preconnect';
  pre2.href = 'https://fonts.gstatic.com';
  pre2.crossOrigin = '';
  const css = document.createElement('link');
  css.id = NB_FONT_ID;
  css.rel = 'stylesheet';
  css.href = NB_FONT_CSS;
  const cssLoaded = new Promise((done) => {
    css.addEventListener('load', done, { once: true });
    css.addEventListener('error', done, { once: true });
  });
  document.head.append(pre1, pre2, css);
  const load = (spec) =>
    document.fonts && document.fonts.load ? document.fonts.load(spec, nbFontSample()).catch(() => []) : Promise.resolve([]);
  nbFontsReady = Promise.all([
    load('400 1rem "Kyobo Handwriting 2025 lyb"'),
    // 고운돋움의 @font-face는 위 스타일시트가 와야 생긴다 — 오기 전에 부르면 빈손으로 끝난다
    cssLoaded.then(() => load('400 1rem "Gowun Dodum"')),
  ]);
  return nbFontsReady;
}

// 첫 화면 렌더를 막지 않도록, 최초 렌더에 필요한 normal 스탠딩만 먼저 받고
// 나머지는 유휴 시간에 순차 로딩한다.
export function startPreload() {
  preloadImage(SPRITES.standing.normal);
  idle(() => {
    const rest = imageList().filter((u) => u !== SPRITES.standing.normal);
    // 한 장씩 순차 로딩 — 동시 요청으로 초기 네트워크를 막지 않는다
    rest.reduce((p, url) => p.then(() => preloadImage(url)), Promise.resolve());
  });
}
