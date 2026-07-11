import { DB } from '../data.js';
import { state } from '../state.js';
import { SPRITES } from '../sprites.js';

// E7 히든 — 클루의 수사 수첩 (#/notebook). 작업지시_수첩디자인이식.md 기준 구현.
// 페이지 구성: 표지 / 1부 / 2부(3항목) / 2부 계속(2항목) / 3부 / 접힌 페이지 = 6쪽.
// 넘김 방식: 임계값 전환 (작업지시 — 임계값전환). 휠/스와이프 델타 누적 → 임계값 초과 시
// 잠금과 함께 1페이지 즉시 전환. 페이지 내부 스크롤이 끝에 닿기 전에는 넘김 미발동.
const PAGE_COUNT = 6;
const FONT_ID = 'nb-fonts';

// ---- 넘김 튜닝 상수 ----
const TURN_MS = 600;        // 넘김 애니메이션 길이 (CSS와 동기)
const LOCK_EXTRA_MS = 100;  // 애니메이션 종료 후 추가 입력 잠금
const REDUCED_LOCK_MS = 300; // reduced-motion: 교체는 즉시지만 관성 연속 넘김 방지용 최소 잠금
const WHEEL_RATIO = 0.25;   // 휠 임계값 = 스테이지 높이 × 비율
const TOUCH_THRESHOLD = 70; // 모바일 스와이프 임계값(px)
const ACC_RESET_MS = 200;   // 무입력 시 휠 누적 리셋
const BOUNCE_MS = 320;      // 경계 저항 모션 길이

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
    <div class="nb-stage">
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

  return setupPager(view);
}

// ---- 임계값 전환 페이저 ----
// 델타 누적 → 임계값 초과 시 1페이지 전환 + 입력 잠금.
// 내부 스크롤이 있는 페이지는 끝(상/하단)에 도달한 상태에서만 누적을 시작한다.
function setupPager(view) {
  const stage = view.querySelector('.nb-stage');
  const pages = [...stage.querySelectorAll('.nb-page')];
  const curEl = view.querySelector('.nb-cur');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = 0;
  let acc = 0;
  let lastWheel = 0; // 마지막 휠 이벤트 시각 (잠금 중 포함 — 관성 흐름 감지용)
  let locked = false;
  let armed = true;  // false면 같은 관성 흐름 무시. 입력이 끊겨야(200ms+) 재무장.
  pages[0].classList.add('active');

  const atEdge = (page, dir) => {
    if (page.scrollHeight - page.clientHeight <= 1) return true; // 내부 스크롤 없음
    return dir > 0
      ? page.scrollTop + page.clientHeight >= page.scrollHeight - 1
      : page.scrollTop <= 0;
  };

  // 첫/마지막 페이지 경계: 저항 모션 (reduced-motion 시 생략)
  const bounce = (dir) => {
    if (locked) return;
    if (reduced) return;
    locked = true;
    const page = pages[cur];
    const cls = dir > 0 ? 'nb-bounce-next' : 'nb-bounce-prev';
    page.classList.add(cls);
    setTimeout(() => {
      page.classList.remove(cls);
      locked = false;
    }, BOUNCE_MS);
  };

  const turn = (dir) => {
    if (locked) return;
    const nextIdx = cur + dir;
    if (nextIdx < 0 || nextIdx >= pages.length) {
      bounce(dir);
      return;
    }
    locked = true; // 전환 잠금 — 관성 스크롤 연속 넘김 방지
    armed = false; // 이 제스처(관성 포함)로는 더 넘기지 않음 — 입력 공백 후 재무장
    acc = 0;
    const out = pages[cur];
    const inn = pages[nextIdx];
    inn.scrollTop = 0;
    cur = nextIdx;
    curEl.textContent = cur + 1; // 인디케이터 동기화
    if (reduced) {
      // 애니메이션 생략, 즉시 교체 — 잠금은 관성 방지를 위해 유지
      out.classList.remove('active');
      inn.classList.add('active');
      setTimeout(() => {
        locked = false;
      }, REDUCED_LOCK_MS);
      return;
    }
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

  const onWheel = (e) => {
    const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
    if (!dir) return;
    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    if (locked) {
      e.preventDefault();
      return;
    }
    // 전환 직후의 관성 꼬리: 입력이 끊기기 전까지는 같은 제스처로 보고 무시
    if (!armed) {
      if (gap > ACC_RESET_MS) {
        armed = true;
      } else {
        e.preventDefault();
        return;
      }
    }
    // 내부 스크롤 우선: 끝에 닿기 전엔 네이티브 스크롤에 맡기고 누적하지 않는다
    if (!atEdge(pages[cur], dir)) {
      acc = 0;
      return;
    }
    e.preventDefault();
    if (gap > ACC_RESET_MS) acc = 0; // 무입력 리셋
    acc += e.deltaY;
    if (Math.abs(acc) >= stage.clientHeight * WHEEL_RATIO) {
      turn(acc > 0 ? 1 : -1);
    }
  };

  // 모바일: 시작 시점에 끝에 있었던 방향으로만, 스와이프 거리 임계값으로 전환
  let touchY = null;
  let touchEdge = { next: false, prev: false };
  const onTouchStart = (e) => {
    touchY = e.touches[0].clientY;
    touchEdge = { next: atEdge(pages[cur], 1), prev: atEdge(pages[cur], -1) };
  };
  const onTouchEnd = (e) => {
    if (touchY == null) return;
    const dy = touchY - e.changedTouches[0].clientY; // 양수 = 위로 스와이프 = 다음
    touchY = null;
    if (locked || Math.abs(dy) < TOUCH_THRESHOLD) return;
    if (dy > 0 && touchEdge.next) turn(1);
    else if (dy < 0 && touchEdge.prev) turn(-1);
  };

  const onKey = (e) => {
    if (e.target && /^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const nextKey = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.code === 'Space' && !e.shiftKey);
    const prevKey = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.code === 'Space' && e.shiftKey);
    if (nextKey) {
      e.preventDefault();
      turn(1);
    } else if (prevKey) {
      e.preventDefault();
      turn(-1);
    }
  };

  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('touchstart', onTouchStart, { passive: true });
  stage.addEventListener('touchend', onTouchEnd, { passive: true });
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
