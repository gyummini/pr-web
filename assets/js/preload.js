// 자원 사전 로딩. 필요한 시점에 요청하면 그 시점에 지연이 드러나므로,
// 유휴 시간(인트로 대사 재생 중 등)에 백그라운드로 미리 받아둔다.
// 실패는 조용히 무시하고 정상 로딩으로 폴백한다 (콘솔 에러를 남기지 않는다).
import { SPRITES, SPRITE_KEYS } from './sprites.js';
import { DB } from './data.js';

// 수첩 전용 폰트 (Gaegu = 손글씨 제목, Gowun Dodum = 본문)
export const NB_FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Gowun+Dodum&display=swap';
const NB_FONT_ID = 'nb-fonts';

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
  urls.push('./assets/img/bg_office.jpg');
  return [...new Set(urls.filter(Boolean))];
}

// 수첩 폰트를 백그라운드로 요청. 스타일시트는 한 번만 삽입되고,
// 이후 수첩 페이지는 이미 받아진 폰트를 그대로 쓴다.
export function preloadNotebookFonts() {
  if (document.getElementById(NB_FONT_ID)) return;
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
  document.head.append(pre1, pre2, css);
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
