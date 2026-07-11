import { DB } from '../data.js';
import { state } from '../state.js';
import { SPRITES } from '../sprites.js';

// E7 히든 — 클루의 수사 수첩 (#/notebook). 작업지시_수첩디자인이식.md 기준 구현.
// 페이지 구성: 표지 / 1부 / 2부(3항목) / 2부 계속(2항목) / 3부 / 접힌 페이지 = 6쪽.
// 데스크톱: scroll-snap 페이지 넘김 + 종이 넘김 연출. 모바일·reduced-motion: 폴백.
const PAGE_COUNT = 6;
const FONT_ID = 'nb-fonts';

function injectFonts() {
  // 수첩 전용 폰트(Gaegu, Gowun Dodum)는 이 페이지 첫 진입 시에만 로드 — 본편 성능 영향 없음
  if (document.getElementById(FONT_ID)) return;
  const pre1 = document.createElement('link');
  pre1.rel = 'preconnect';
  pre1.href = 'https://fonts.googleapis.com';
  const pre2 = document.createElement('link');
  pre2.rel = 'preconnect';
  pre2.href = 'https://fonts.gstatic.com';
  pre2.crossOrigin = '';
  const css = document.createElement('link');
  css.id = FONT_ID;
  css.rel = 'stylesheet';
  css.href = 'https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Gowun+Dodum&display=swap';
  document.head.append(pre1, pre2, css);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// **강조** → 형광펜, [[E번호:라벨]] → 증거 내부 링크(본편 연결 컬러)
function nbInline(s) {
  let out = esc(s);
  out = out.replace(
    /\[\[(E\d+):([^\]]+)\]\]/g,
    (m, id, label) => `<a class="nb-evlink" href="#/evidence/${id}">${label}</a>`
  );
  out = out.replace(/\*\*(.+?)\*\*/g, '<span class="nb-hl">$1</span>');
  return out;
}

export function renderNotebook(view) {
  if (!(state.resultOnlyMode || state.endingSeen)) {
    location.hash = '#/evidence';
    return {};
  }
  injectFonts();
  const nb = DB.notebook;

  view.className = 'view-notebook';
  view.innerHTML = `
    <div class="nb-scroller">
      ${pageCover(nb.cover)}
      ${pagePart1(nb.part1)}
      ${pagePart2(nb.part2, 0, 3, false)}
      ${pagePart2(nb.part2, 3, 5, true)}
      ${pagePart3(nb.part3)}
      ${pageFolded(nb.folded)}
    </div>
    <div class="nb-indicator" aria-live="polite"><span class="nb-cur">1</span> / ${PAGE_COUNT}</div>`;

  // 3부 사진: 파일이 없으면 빈 폴라로이드 프레임으로 폴백
  view.querySelectorAll('.nb-photo-img').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        img.closest('.nb-photo-area').classList.add('empty');
        img.remove();
      },
      { once: true }
    );
  });

  // 페이지 인디케이터 + 종이 넘김 연출 (사용자 스크롤 통제권은 유지 — 네이티브 스크롤/스냅만 사용)
  const scroller = view.querySelector('.nb-scroller');
  const pages = [...view.querySelectorAll('.nb-page')];
  const curEl = view.querySelector('.nb-cur');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 820px)').matches;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((ent) => {
        if (!ent.isIntersecting) return;
        const idx = pages.indexOf(ent.target);
        if (idx === -1) return;
        curEl.textContent = idx + 1;
        if (reduced || mobile) return; // 연출 생략
        const sheet = ent.target.querySelector('.nb-sheet, .nb-cover');
        if (sheet) {
          sheet.classList.remove('nb-turn');
          void sheet.offsetWidth;
          sheet.classList.add('nb-turn');
        }
      });
    },
    { root: scroller, threshold: 0.55 }
  );
  pages.forEach((p) => io.observe(p));

  return { destroy: () => io.disconnect() };
}

function pageCover(c) {
  const seal = c.seal.main.split('|').map(esc).join('<br>');
  return `
  <section class="nb-page">
    <div class="nb-cover">
      <div class="nb-spiral cover"></div>
      <div class="nb-tape top"></div>
      <div class="nb-cover-label">
        <div class="nb-cover-kicker">${esc(c.kicker)}</div>
        <h1 class="nb-cover-title">${esc(c.title)}</h1>
        <div class="nb-cover-sub">${esc(c.sub)}</div>
        <div class="nb-stamp">${esc(c.stamp)}</div>
      </div>
      <div class="nb-seal">
        <span class="nb-seal-top">${esc(c.seal.top)}</span>
        <span class="nb-seal-main">${seal}</span>
        <span class="nb-seal-bottom">${esc(c.seal.bottom)}</span>
      </div>
      <div class="nb-scrollhint">▼ 스크롤</div>
    </div>
  </section>`;
}

function sheetOpen(tab, tabClass) {
  return `
  <section class="nb-page">
    <div class="nb-sheet">
      <div class="nb-spiral"></div>
      <div class="nb-parttab ${tabClass}">${esc(tab)}</div>
      <div class="nb-content">`;
}

const sheetClose = `
      </div>
    </div>
  </section>`;

function pagePart1(p) {
  return `${sheetOpen('1부', 'tab1')}
    <h2 class="nb-h2"><span>${esc(p.title)}</span></h2>
    <div class="nb-lead">${esc(p.lead)}</div>
    <div class="nb-profile">
      <div class="nb-polaroid">
        <div class="nb-polaroid-inner">
          <img src="${SPRITES.sd.normal}" alt="클루 SD" loading="lazy" class="nb-sd">
          <div class="nb-polaroid-cap">${esc(p.photoCaption)}</div>
        </div>
        <div class="nb-tape small"></div>
      </div>
      <dl class="nb-dl">
        ${p.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${nbInline(v)}</dd>`).join('')}
      </dl>
    </div>
  ${sheetClose}`;
}

function pagePart2(p, from, to, isCont) {
  const items = p.items.slice(from, to);
  return `${sheetOpen('2부', 'tab2')}
    <h2 class="nb-h2"><span>${esc(p.title)}</span>${isCont ? '<span class="nb-cont">(계속)</span>' : ''}</h2>
    ${
      isCont
        ? ''
        : `<div class="nb-quote">
             <img src="${SPRITES.sd.normal}" alt="" loading="lazy" class="nb-quote-sd">
             <div class="nb-quote-bubble">${esc(p.quote)}</div>
           </div>`
    }
    <div class="nb-memos">
      ${items
        .map(
          (it) => `
        <div class="nb-memo-row">
          <div class="nb-memo-subject">
            <div class="nb-memo-cat">${esc(it.category)}</div>
            <div class="nb-memo-name">${esc(it.name)}</div>
          </div>
          <div class="nb-postit"><span class="nb-postit-by">클루 메모:</span> ${nbInline(it.memo)}</div>
        </div>`
        )
        .join('')}
    </div>
  ${sheetClose}`;
}

function pagePart3(p) {
  return `${sheetOpen('3부', 'tab3')}
    <h2 class="nb-h2"><span>${esc(p.title)}</span></h2>
    <div class="nb-quote">
      <img src="${SPRITES.sd.normal}" alt="" loading="lazy" class="nb-quote-sd">
      <div class="nb-quote-bubble">${esc(p.quote)}</div>
    </div>
    <div class="nb-photos">
      ${p.photos
        .map(
          (ph, i) => `
        <div class="nb-polaroid photo p${i + 1}">
          <div class="nb-polaroid-inner">
            <div class="nb-photo-area"><img class="nb-photo-img" src="${esc(ph.src)}" alt="${esc(ph.label)}" loading="lazy"><span class="nb-photo-label">${esc(ph.label)}</span></div>
            <div class="nb-polaroid-cap">${esc(ph.caption)}</div>
          </div>
          <div class="nb-tape small t${i + 1}"></div>
        </div>`
        )
        .join('')}
    </div>
  ${sheetClose}`;
}

function pageFolded(f) {
  return `
  <section class="nb-page">
    <div class="nb-sheet folded">
      <div class="nb-spiral"></div>
      <div class="nb-content">
        <div class="nb-folded-line">${esc(f.line)}</div>
        <div class="nb-folded-note">${esc(f.note)}</div>
        <a class="nb-back" href="#/evidence">${esc(f.backLabel)} <span>↗</span></a>
        <div class="nb-corner"></div>
      </div>
    </div>
  </section>`;
}
