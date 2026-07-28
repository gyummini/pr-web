import { DB } from '../data.js';
import { state } from '../state.js';
import { SPRITES } from '../sprites.js';
import { preloadNotebookFonts } from '../preload.js';

// E7 히든 — 클루의 수사 수첩 (#/notebook). 작업지시_수첩디자인이식.md 기준 구현.
// 페이지 구성: 표지 / 1부 / 2부(3항목) / 2부 계속(2항목) / 3부 / 접힌 페이지 = 6쪽.
// 넘김 방식: 버튼식 페이지네이션(이전/다음 버튼 + 키보드). 넘김 애니메이션은 순수 CSS로,
// reduced-motion 여부와 무관하게 모든 사용자가 경험한다. 긴 페이지는 내부 스크롤 유지.
const PAGE_COUNT = 6;

// ---- 넘김 튜닝 상수 ----
const TURN_MS = 600;       // 넘김 애니메이션 길이 (CSS와 동기)
const LOCK_EXTRA_MS = 100; // 애니메이션 종료 후 추가 입력 잠금

// 폰트가 준비되면 실제 서체로 그려진 상태로 노출한다 (교체 시 깜빡임·레이아웃 점프 방지).
// 이미 5/7 시점에 백그라운드 요청이 시작되므로 대개 즉시 준비 완료 상태다.
function revealWhenFontsReady(view) {
  view.classList.add('nb-fontwait');
  const reveal = () => view.classList.remove('nb-fontwait');
  if (!document.fonts || !document.fonts.load) {
    reveal();
    return;
  }
  Promise.race([
    Promise.all([
      document.fonts.load('700 2rem "Kyobo Handwriting 2025 lyb"'),
      document.fonts.load('400 1rem "Gowun Dodum"'),
    ]),
    new Promise((r) => setTimeout(r, 900)), // 폰트가 늦어도 본문을 계속 가리지 않는다
  ]).then(reveal, reveal);
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
  if (!state.endingSeen) {
    location.hash = '#/evidence';
    return {};
  }
  preloadNotebookFonts();
  const nb = DB.notebook;

  view.className = 'view-notebook';
  view.innerHTML = `
    <div class="nb-stage">
      ${pageCover(nb.cover)}
      ${pagePart1(nb.part1)}
      ${pagePart2(nb.part2, 0, 3, false)}
      ${pagePart2(nb.part2, 3, 5, true)}
      ${pagePart3(nb.part3)}
      ${pageFolded(nb.folded)}
    </div>
    <div class="nb-nav">
      <button type="button" class="nb-nav-btn nb-prev" aria-label="이전 장" disabled>◀</button>
      <div class="nb-indicator" aria-live="polite"><span class="nb-cur">1</span> / ${PAGE_COUNT}</div>
      <button type="button" class="nb-nav-btn nb-next" aria-label="다음 장">▶</button>
    </div>`;

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
  // 2부 스크랩 사진: 파일이 없으면 빈 프레임만 남긴다 (파일 추가 시 자동 표시)
  view.querySelectorAll('.nb-memo-img').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        img.closest('.nb-memo-shot').classList.add('empty');
        img.remove();
      },
      { once: true }
    );
  });

  revealWhenFontsReady(view);
  return setupPager(view);
}

// ---- 버튼식 페이저 ----
// 이전/다음 버튼(+ 키보드)으로만 넘긴다. 전환 중에는 잠금으로 중복 입력 무시.
// 애니메이션은 CSS 클래스로 항상 재생 — reduced-motion 예외 없음 (사용자 지시).
function setupPager(view) {
  const pages = [...view.querySelectorAll('.nb-page')];
  const curEl = view.querySelector('.nb-cur');
  const prevBtn = view.querySelector('.nb-prev');
  const nextBtn = view.querySelector('.nb-next');
  let cur = 0;
  let locked = false;
  pages[0].classList.add('active');

  const syncNav = () => {
    curEl.textContent = cur + 1;
    prevBtn.disabled = cur === 0;
    nextBtn.disabled = cur === pages.length - 1;
  };

  const turn = (dir) => {
    if (locked) return;
    const nextIdx = cur + dir;
    if (nextIdx < 0 || nextIdx >= pages.length) return;
    locked = true; // 전환 잠금 — 연타 시 중복 전환 방지
    const out = pages[cur];
    const inn = pages[nextIdx];
    inn.scrollTop = 0;
    cur = nextIdx;
    syncNav();
    const outCls = dir > 0 ? 'nb-leave-fwd' : 'nb-leave-back';
    const innCls = dir > 0 ? 'nb-enter-fwd' : 'nb-enter-back';
    out.classList.add(outCls);
    inn.classList.add('active', innCls);
    setTimeout(() => {
      out.classList.remove('active', outCls);
      inn.classList.remove(innCls);
      locked = false;
    }, TURN_MS + LOCK_EXTRA_MS);
  };

  prevBtn.addEventListener('click', () => turn(-1));
  nextBtn.addEventListener('click', () => turn(1));

  const onKey = (e) => {
    if (e.target && /^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const nextKey = e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || (e.code === 'Space' && !e.shiftKey);
    const prevKey = e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.code === 'Space' && e.shiftKey);
    if (nextKey) {
      e.preventDefault();
      turn(1);
    } else if (prevKey) {
      e.preventDefault();
      turn(-1);
    }
  };
  document.addEventListener('keydown', onKey);

  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
    },
  };
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
            ${
              // 스크랩 사진 슬롯 — 파일이 없으면 빈 프레임으로 자리만 남는다
              it.image
                ? `<div class="nb-memo-shot"><img class="nb-memo-img" src="${esc(it.image)}" alt="" loading="lazy"></div>`
                : ''
            }
          </div>
          <div class="nb-postit"><span class="nb-postit-by">클루 메모:</span> ${nbInline(it.memo)}</div>
        </div>`
        )
        .join('')}
    </div>
    ${
      // 종합 소견은 관찰 메모를 다 나열한 뒤(마지막 2부 페이지)에만 붙인다
      isCont && p.closing
        ? `<div class="nb-closing">${nbInline(p.closing)}</div>`
        : ''
    }
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
  // line은 여러 문단(\n 구분) — 문단마다 간격을 두어 쪽지처럼 읽히게 한다
  const paras = String(f.line)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<p>${esc(s)}</p>`)
    .join('');
  return `
  <section class="nb-page">
    <div class="nb-sheet folded">
      <div class="nb-spiral"></div>
      <div class="nb-content">
        <div class="nb-folded-line">${paras}</div>
        <div class="nb-folded-note">${esc(f.note)}</div>
        <a class="nb-back" href="#/evidence">${esc(f.backLabel)} <span>↗</span></a>
        <div class="nb-corner"></div>
      </div>
    </div>
  </section>`;
}
