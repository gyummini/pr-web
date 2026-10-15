import { DB } from '../data.js';
import { SPRITES } from '../sprites.js';
import { preloadNotebookFonts } from '../preload.js';
import { dismissUnlockToast } from '../ui.js';
import { TH } from '../text.js';
import { CLOSE_ICON, keepFocusInside } from '../popup.js';

// 수첩 화면의 고정 문구(장 넘김·탭·메모 머리) — 콘텐츠_수사수첩.json의 labels
const NL = () => DB.notebook.labels;

// E9 히든 — 클루의 수사 수첩 (/notebook). 작업지시_수첩디자인이식.md 기준 구현,
// 10/11 사용자 결정(수첩 가 · 수첩 끝 · 수첩 나)으로 한 권으로 다듬었다.
// 쪽 구성(한 쪽씩): 표지 / 1부 / 2부(메모 둘) / 2부 계속(메모 둘) / 2부 계속(메모 하나 · 종합 소견 · 플레이 기록) / 3부 / 마지막 쪽
//   = 7쪽, 넘김 여섯 번(10/11(2) — 전에는 2부가 메모 셋 · 메모 둘+종합 소견이라 1366×768에서 종합 소견이 화면 밖이었다).
// 세로 종이(821px 이상 — 10/11 사용자 지적 '수첩이 가로로 너무 넓다'): 한 쪽씩 보는 넓은 화면도 펼침과 같은 세로 쪽(폭 560~640px)을 쓴다.
//   전에는 880px 폭의 가로로 누운 종이였다. 쪽 구성도 펼침과 같아 3부가 사진마다 한 쪽(번호는 하나)이라 넘김이 일곱 번이다.
// 펼친 수첩(넓고 높은 화면): 표지 | 1부 · 2부 | 2부 계속 · 2부 계속 | 3부(사진 ①) · 3부 계속(사진 ②) | 마지막 쪽 · 뒤표지
//   = 다섯 면, 넘김 네 번. 표지는 오른쪽 자리에 홀로 놓이고(덮인 수첩), 마지막 면의 오른쪽은 글자 없는 뒤표지라 첫 면과 짝을 이룬다(10/11(2)).
//   쪽 번호는 두 화면이 같은 일곱 쪽을 센다 — 펼침의 3부 두 쪽은 한 쪽(6), 뒤표지는 세지 않는다.
// 모든 쪽은 한 크기 · 같은 묶음 자리다(10/11 가 — 전에는 쪽마다 종이 크기가 달라 제목 줄이 최대 199px 위아래로 옮겨 다녔다).
// 크기는 화면 높이에 맞춘 하나이고, 짧은 쪽은 위에서부터 놓여 아래가 빈 공책 줄로 남는다. 긴 쪽은 종이 안에서 스크롤한다.
// 넘김: 버튼 · 키보드 · 색인 탭. 애니메이션은 순수 CSS로, reduced-motion 여부와 무관하게 모든 사용자가 경험한다(사용자 결정).

// ---- 넘김 튜닝 상수 ----
const TURN_MS = 600;       // 넘김 애니메이션 길이 (CSS의 --nb-turn-*와 동기)
const LOCK_EXTRA_MS = 100; // 애니메이션 종료 후 추가 입력 잠금

// 펼친 수첩(10/11 나) — 이 조건에 맞는 화면에서만 두 쪽씩 펼친다. 사용자가 실제 화면을 보고 확정한다.
// 끄려면 null로 둔다(모든 화면이 한 쪽씩). 기준은 펼친 쪽 일곱이 모두 스크롤 없이 들어오는 크기로 쟀다(10/11):
// 폭 1600px 이상(쪽 폭 640px)에서는 높이 888px부터 들어온다 — 1080p 모니터의 브라우저 높이(약 905~950px)가 여기 든다.
// 폭이 좁으면 쪽이 좁아져 더 높아야 한다(1536 폭은 940px, 1440 · 1366 폭은 1000px 넘게) — 1440×900 · 1536×864 · 1366×768 노트북은 한 쪽씩
const SPREAD_MEDIA = '(min-width: 1600px) and (min-height: 890px)';
// 세로 종이(10/11) — 이 폭부터는 한 쪽씩이어도 펼침과 같은 세로 쪽 · 같은 쪽 구성이다. 그보다 좁으면(휴대폰 · 태블릿 세로) 화면 폭을 다 쓴다.
// CSS의 .nb-portrait 규칙과 820/821px 경계가 같다
const PORTRAIT_MEDIA = '(min-width: 821px)';

// 2부 메모를 쪽으로 나누는 자리(메모 번호) — 두 화면 모두 2 · 4에서 나눈다(10/11(2) — 한 쪽씩은 전에 3에서 나눴다)
const P2_SPLIT = [2, 4];

// 색인 탭(10/11 가) — 장마다 하나, 지금 보이는 장은 더 튀어나온다. 누르면 그 장의 첫 쪽으로 간다
const TABS = [
  ['p1', 'part1_tab'],
  ['p2', 'part2_tab'],
  ['p3', 'part3_tab'],
  ['end', 'end_tab'],
];

// 폰트가 준비되면 실제 서체로 그려진 상태로 노출한다 (교체 시 깜빡임·레이아웃 점프 방지).
// 기본 증거를 거의 다 모은 시점(ui.js)에 이미 불러 두므로 대개 바로 준비되어 있다. 고운돋움은 한글 조각까지 기다린다(preload.js)
function revealWhenFontsReady(view) {
  view.classList.add('nb-fontwait');
  const reveal = () => view.classList.remove('nb-fontwait');
  Promise.race([
    preloadNotebookFonts(),
    new Promise((r) => setTimeout(r, 900)), // 폰트가 늦어도 본문을 계속 가리지 않는다
  ]).then(reveal, reveal);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// **강조** → 형광펜, [[E번호:라벨]] → 증거 내부 링크(본편 연결 컬러)
function nbInline(s) {
  let out = esc(s);
  out = out.replace(
    /\[\[(E\d+):([^\]]+)\]\]/g,
    (m, id, label) => `<a class="nb-evlink" href="/evidence/${id}">${label}</a>`
  );
  out = out.replace(/\*\*(.+?)\*\*/g, '<span class="nb-hl">$1</span>');
  return out;
}

export function renderNotebook(view) {
  preloadNotebookFonts();
  dismissUnlockToast();

  view.className = 'view-notebook';
  view.innerHTML = `
    <div class="nb-stage">
      <div class="nb-book">
        <div class="nb-leaves"></div>
        <div class="nb-tabs">
          ${TABS.map(([ch, key]) => `<button type="button" class="nb-tab" data-ch="${ch}">${esc(NL()[key])}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="nb-nav">
      <button type="button" class="nb-nav-btn nb-prev" aria-label="${esc(NL().prev)}" disabled>◀</button>
      <div class="nb-indicator" aria-live="polite"></div>
      <button type="button" class="nb-nav-btn nb-next" aria-label="${esc(NL().next)}">▶</button>
    </div>`;

  revealWhenFontsReady(view);
  return setupNotebook(view);
}

// ---- 쪽 · 면 구성 ----
// 쪽마다 no(알약에 적는 쪽 번호)를 붙인다 — 세로 종이에서만 나뉘는 3부 둘째 쪽은 첫 쪽과 같은 번호, 뒤표지는 번호 없음
function pagePlan(nb, spread, portrait) {
  const n = nb.part2.items.length;
  const cuts = [0, ...P2_SPLIT.filter((c) => c > 0 && c < n), n];
  const p2 = cuts.slice(0, -1).map((from, i) => ({ ch: 'p2', from, to: cuts[i + 1], first: i === 0, last: i === cuts.length - 2 }));
  // 3부: 휴대폰은 사진 둘이 한 쪽에, 세로 종이(펼침 · 넓은 화면의 한 쪽)는 두 쪽(제목 · 말풍선 · 사진 ① / 사진 ②)
  const shots = nb.part3.photos.length;
  const p3 = portrait && shots > 1
    ? [{ ch: 'p3', from: 0, to: 1, first: true }, { ch: 'p3', from: 1, to: shots, first: false }]
    : [{ ch: 'p3', from: 0, to: shots, first: true }];
  const plan = [{ ch: 'cover' }, { ch: 'p1' }, ...p2, ...p3, { ch: 'end' }];
  // 뒤표지는 마지막 쪽이 펼침의 왼쪽에 올 때만 그 오른쪽에 둔다(표지 뒤의 쪽 수가 홀수)
  if (spread && (plan.length - 1) % 2 === 1) plan.push({ ch: 'back' });
  let no = 0;
  plan.forEach((p) => {
    p.no = p.ch === 'back' ? null : p.ch === 'p3' && !p.first ? no : ++no;
  });
  return plan;
}

// 면 = 한 번에 보이는 쪽. 한 쪽씩이면 [쪽], 펼침이면 [왼쪽, 오른쪽](빈 자리는 null) — 표지는 오른쪽에 홀로
function viewPlan(count, spread) {
  if (!spread) return Array.from({ length: count }, (_, i) => [i]);
  const out = [[null, 0]];
  for (let i = 1; i < count; i += 2) out.push([i, i + 1 < count ? i + 1 : null]);
  return out;
}

function renderPage(nb, p) {
  if (p.ch === 'cover') return pageCover(nb.cover);
  if (p.ch === 'p1') return pagePart1(nb.part1);
  if (p.ch === 'p2') return pagePart2(nb.part2, p);
  if (p.ch === 'p3') return pagePart3(nb.part3, p);
  if (p.ch === 'back') return pageBackCover();
  return pageFolded(nb.folded);
}

// ---- 수첩 한 권 — 쪽 그리기 · 넘김 · 색인 탭 · 사진 창 ----
function setupNotebook(view) {
  const nb = DB.notebook;
  const leaves = view.querySelector('.nb-leaves');
  const tabs = [...view.querySelectorAll('.nb-tab')];
  const indicator = view.querySelector('.nb-indicator');
  const prevBtn = view.querySelector('.nb-prev');
  const nextBtn = view.querySelector('.nb-next');
  const mq = SPREAD_MEDIA && window.matchMedia ? window.matchMedia(SPREAD_MEDIA) : null;
  const pmq = window.matchMedia ? window.matchMedia(PORTRAIT_MEDIA) : null;

  let spread = false;
  let plan = [];
  let pages = [];
  let views = [];
  let cur = 0;
  let locked = false;
  let rebuildPending = false;
  // 넘기는 동안 누른 넘김 하나를 기억했다가 잠금이 풀리면 넘긴다(10/11 수첩 재점검 — 전에는 버려져서 빨리 누르면 단추가 먹통처럼 느껴졌다).
  // 하나만 기억한다 — 여러 번 이어 넘기면 화면이 어수선하다
  let queued = null;
  let photo = null; // 열린 사진 창
  const timers = new Set();
  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  const pagesOf = (v) => views[v].filter((i) => i !== null).map((i) => pages[i]);
  const scrollerOf = (page) => page.querySelector('.nb-scroll');

  // 지금 쪽과 다음 쪽의 그림만 받는다(10/11 가 — 전에는 수첩에 들어오는 순간 숨은 쪽 그림까지 일곱 장을 한꺼번에 받았다)
  const loadNear = (v) => {
    [v, v + 1].forEach((k) => {
      if (k < 0 || k >= views.length) return;
      pagesOf(k).forEach((p) =>
        p.querySelectorAll('img[data-src]').forEach((img) => {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        })
      );
    });
  };

  // 쪽이 종이보다 길면 종이 아래 끝에 종이색 그늘과 아래 화살표(10/10 수첩 점검). 끝까지 내리면 사라진다
  const syncMore = () => {
    views[cur] &&
      pagesOf(cur).forEach((p) => {
        const s = scrollerOf(p);
        if (s) p.firstElementChild.classList.toggle('has-more', s.scrollHeight - s.clientHeight - s.scrollTop > 8);
      });
  };

  const syncNav = () => {
    const shown = views[cur].filter((i) => i !== null);
    // 두 화면이 같은 일곱 쪽을 센다(쪽 번호는 pagePlan의 no — 뒤표지는 세지 않는다)
    const nos = shown.map((i) => plan[i].no).filter((x) => x !== null);
    const first = Math.min(...nos);
    const last = Math.max(...nos);
    const total = Math.max(...plan.map((p) => p.no || 0));
    indicator.textContent = `${first === last ? first : `${first}–${last}`} / ${total}`;
    prevBtn.disabled = cur === 0;
    nextBtn.disabled = cur === views.length - 1;
    const here = new Set(shown.map((i) => plan[i].ch));
    tabs.forEach((t) => {
      if (here.has(t.dataset.ch)) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
    });
  };

  const show = (v) => {
    cur = v;
    pages.forEach((p) => p.classList.remove('active', 'nb-fold', 'nb-unfold'));
    pagesOf(v).forEach((p) => {
      p.classList.add('active');
      const s = scrollerOf(p);
      if (s) s.scrollTop = 0;
    });
    loadNear(v);
    syncNav();
    syncMore();
  };

  // 쪽을 다시 그린다 — 처음, 그리고 화면이 펼침 조건을 넘나들 때. 보던 장면(장 · 메모 번호)은 이어서 보인다
  const build = (keep) => {
    queued = null;
    if (photo) photo.close(false); // 다시 그리면 누른 사진이 사라진다 — 창을 먼저 닫는다
    spread = !!(mq && mq.matches);
    const portrait = spread || !!(pmq && pmq.matches);
    view.classList.toggle('nb-spreads', spread);
    view.classList.toggle('nb-portrait', portrait);
    plan = pagePlan(nb, spread, portrait);
    leaves.innerHTML = plan.map((p) => renderPage(nb, p)).join('') + (spread ? '<div class="nb-coil" aria-hidden="true"></div>' : '');
    pages = [...leaves.querySelectorAll('.nb-page')];
    views = viewPlan(pages.length, spread);
    // 펼침에서는 면 안의 자리(왼쪽 · 오른쪽)를 쪽에 붙여 둔다 — 넘김은 그 자리의 묶음 쪽을 축으로 돈다
    if (spread) views.forEach(([l, r]) => {
      if (l !== null) pages[l].classList.add('at-l');
      if (r !== null) pages[r].classList.add('at-r');
    });
    wirePage(leaves, openPhoto);
    leaves.querySelectorAll('.nb-scroll').forEach((s) => s.addEventListener('scroll', syncMore, { passive: true }));
    let start = 0;
    if (keep) {
      const j = plan.findIndex((p) => p.ch === keep.ch && (p.ch !== 'p2' || (keep.from >= p.from && keep.from < p.to)));
      if (j >= 0) start = views.findIndex((v) => v.includes(j));
    }
    show(Math.max(0, start));
    fitStampWords(leaves);
  };

  const keyOfView = () => {
    const p = plan[views[cur].find((i) => i !== null)];
    return { ch: p.ch, from: p.from };
  };

  const onMode = () => {
    if (locked) rebuildPending = true;
    else build(keyOfView());
  };

  // 넘김(10/11 가) — 새 쪽을 처음부터 불투명하게 아래에 깔고 넘어가는 쪽만 돈다(전에는 두 쪽이 함께 반쯤 비쳤다).
  // 한 쪽씩: 앞으로 넘기면 지금 쪽이 묶음 쪽을 축으로 젖혀지고, 뒤로 넘기면 앞 쪽이 다시 덮인다.
  // 펼침: 오른쪽 쪽이 가운데 축을 돌아 넘어가고(앞 절반) 다음 왼쪽 쪽이 펼쳐진다(뒤 절반). 뒤로는 거꾸로.
  const turnTo = (to) => {
    if (to === cur || to < 0 || to >= views.length) return;
    if (locked) {
      queued = to;
      return;
    }
    locked = true; // 전환 잠금 — 연타 시 중복 전환 방지(누른 것은 하나 기억해 두었다가 넘긴다)
    const from = cur;
    const fwd = to > from;
    const out = pagesOf(from);
    const inn = pagesOf(to);
    inn.forEach((p) => {
      const s = scrollerOf(p);
      if (s) s.scrollTop = 0;
    });
    cur = to;
    loadNear(to);
    syncNav();
    pages.forEach((p) => p.firstElementChild.classList.remove('has-more'));

    const moving = [];
    if (!spread) {
      const [o] = out;
      const [n] = inn;
      n.classList.add('active');
      if (fwd) moving.push([o, 'nb-fold']);
      else moving.push([n, 'nb-unfold']);
    } else {
      const side = (v, k) => (views[v][k] === null ? null : pages[views[v][k]]);
      // 앞으로: 지금 오른쪽이 접혀 넘어가고, 다음 오른쪽은 처음부터 그 아래에, 다음 왼쪽은 지금 왼쪽 위로 펼쳐진다
      const [foldK, underK] = fwd ? [1, 0] : [0, 1];
      const folding = side(from, foldK);
      const under = side(to, foldK); // 접히는 쪽 아래에서 드러날 쪽
      const landing = side(to, underK); // 축을 넘어 반대편에 내려앉을 쪽
      if (under) under.classList.add('active');
      if (folding) moving.push([folding, 'nb-fold']);
      if (landing) {
        landing.classList.add('active');
        moving.push([landing, 'nb-unfold']);
      }
    }
    moving.forEach(([p, cls]) => p.classList.add(cls));

    later(() => {
      out.forEach((p) => {
        if (!inn.includes(p)) p.classList.remove('active');
      });
      moving.forEach(([p, cls]) => p.classList.remove(cls));
      locked = false;
      if (rebuildPending) {
        rebuildPending = false;
        build(keyOfView());
      } else {
        syncMore();
        if (queued !== null) {
          const q = queued;
          queued = null;
          turnTo(q);
        }
      }
    }, TURN_MS + LOCK_EXTRA_MS);
  };

  const viewOfChapter = (ch) => {
    const j = plan.findIndex((p) => p.ch === ch);
    return views.findIndex((v) => v.includes(j));
  };

  // ---- 사진 창(10/11 가) — 3부 사진을 누르면 크게 본다. 초점은 창 안에 머물고, Esc · 바깥 · 닫기로 닫히며, 닫으면 누른 사진으로 돌아간다 ----
  function openPhoto(btn) {
    if (photo) return;
    const img = btn.querySelector('img');
    const ph = nb.part3.photos[Number(btn.dataset.i)];
    if (!ph || !img || !img.complete || !img.naturalWidth) return; // 아직 받지 못했거나 파일이 없으면 열지 않는다
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay nb-zoom-overlay';
    overlay.innerHTML = `
      <div class="nb-zoom" role="dialog" aria-modal="true" aria-label="${esc(ph.label)}" tabindex="-1">
        <button type="button" class="popup-close nb-zoom-close" aria-label="${TH('popup.close')}">${CLOSE_ICON}</button>
        <p class="nb-zoom-cap">${esc(ph.caption)}</p>
        <img class="nb-zoom-img" src="${esc(img.currentSrc || img.src)}" alt="${esc(ph.label)}">
      </div>`;
    document.getElementById('modal-root').appendChild(overlay);
    document.documentElement.classList.add('modal-open');
    const card = overlay.querySelector('.nb-zoom');
    card.focus({ preventScroll: true });
    const onZoomKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Tab') keepFocusInside(e, card);
    };
    const onBack = () => close(false);
    // restoreFocus: 뒤로 가기로 닫힐 때는 곧 사라질 수첩으로 초점을 돌려주지 않는다
    const close = (restoreFocus = true) => {
      if (!photo) return;
      photo = null;
      document.removeEventListener('keydown', onZoomKey, true);
      window.removeEventListener('popstate', onBack);
      overlay.remove();
      document.documentElement.classList.remove('modal-open');
      if (restoreFocus && btn.isConnected) btn.focus({ preventScroll: true });
    };
    // 수첩의 방향키(넘김)보다 먼저 받는다 — 창이 떠 있는 동안 뒤의 쪽이 넘어가지 않게
    document.addEventListener('keydown', onZoomKey, true);
    window.addEventListener('popstate', onBack);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('.nb-zoom-close').addEventListener('click', () => close());
    photo = { close };
  }

  prevBtn.addEventListener('click', () => turnTo(cur - 1));
  nextBtn.addEventListener('click', () => turnTo(cur + 1));
  tabs.forEach((t) => t.addEventListener('click', () => turnTo(viewOfChapter(t.dataset.ch))));

  const onKey = (e) => {
    if (photo || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    // 수첩의 단추(넘김 · 색인 탭 · 사진)에 초점이 있어도 방향키는 넘김으로 받는다(10/10 수첩 점검: 단추를 마우스로 누른 뒤 방향키가 멈췄다).
    // 그 단추 위의 Space · Enter는 단추가 스스로 누른다
    const ownBtn = t instanceof HTMLElement && t.tagName === 'BUTTON' && view.contains(t);
    if (ownBtn && (e.code === 'Space' || e.key === 'Enter')) return;
    if (t && !ownBtn && /^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    // 아래 · 위쪽 키(↓ ↑ · Space · PageDown · PageUp)는 쪽 안을 먼저 움직이고, 끝에 닿았을 때만 넘긴다
    // (10/10 수첩 점검: 2부 결론이 화면 밖인 채로 다음 쪽으로 넘어갔다). ← → 와 단추는 바로 넘긴다.
    // 펼침에서는 읽는 차례대로 — 내릴 때는 왼쪽 쪽부터, 올릴 때는 오른쪽 쪽부터
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.code === 'Space' && !e.shiftKey);
    const up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.code === 'Space' && e.shiftKey);
    if (down || up) {
      // 넘기는 동안의 아래 · 위쪽 키는 새 쪽을 읽으려는 것일 수 있다 — 넘김으로 기억하지 않는다
      if (locked) {
        e.preventDefault();
        return;
      }
      const list = pagesOf(cur).map(scrollerOf).filter(Boolean);
      const room = (s) => (up ? s.scrollTop : s.scrollHeight - s.clientHeight - s.scrollTop);
      const s = (up ? list.reverse() : list).find((x) => room(x) > 2);
      if (s) {
        e.preventDefault();
        const step = e.key === 'ArrowDown' || e.key === 'ArrowUp' ? 80 : Math.round(s.clientHeight * 0.85);
        const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        s.scrollBy({ top: up ? -step : step, behavior: still ? 'auto' : 'smooth' });
        return;
      }
    }
    const nextKey = down || e.key === 'ArrowRight';
    const prevKey = up || e.key === 'ArrowLeft';
    if (nextKey) {
      e.preventDefault();
      turnTo(cur + 1);
    } else if (prevKey) {
      e.preventDefault();
      turnTo(cur - 1);
    }
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', syncMore);
  // 펼침 조건이나 세로 종이 조건을 넘나들면 쪽을 다시 그린다
  [mq, pmq].forEach((m) => {
    if (!m) return;
    if (m.addEventListener) m.addEventListener('change', onMode);
    else if (m.addListener) m.addListener(onMode);
  });

  build(null);
  // 글꼴을 기다리는 동안(최대 0.9초)은 쪽 높이와 도장 글 길이가 바뀐다
  later(() => {
    syncMore();
    fitStampWords(leaves);
  }, 950);

  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', syncMore);
      [mq, pmq].forEach((m) => {
        if (!m) return;
        if (m.removeEventListener) m.removeEventListener('change', onMode);
        else if (m.removeListener) m.removeListener(onMode);
      });
      timers.forEach(clearTimeout);
      timers.clear();
      if (photo) photo.close(false);
    },
  };
}

// 그린 쪽에 붙이는 것 — 그림이 없을 때의 빈 틀, 3부 사진 누르기
function wirePage(root, openPhoto) {
  // 3부 사진: 파일이 없으면 빈 폴라로이드 프레임으로 폴백
  root.querySelectorAll('.nb-photo-img').forEach((img) => {
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
  root.querySelectorAll('.nb-memo-img').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        img.closest('.nb-memo-shot').classList.add('empty');
        img.remove();
      },
      { once: true }
    );
  });
  root.querySelectorAll('.nb-photo-btn').forEach((b) => b.addEventListener('click', () => openPhoto(b)));
}

// 표지(10/11 표지 고도화 — 사용자 결정): 크라프트 표지 위쪽 가운데에 두 줄 테두리가 인쇄된 이름표 하나(제목만)와,
// 이름표 모서리에 붙인 클루 얼굴 스티커. 끈 · 밀랍 봉인 · '함부로 열람 금지!' 도장은 '수첩에 봉인은 이상하다'는 사용자 판단으로 뺐다.
// 소개 줄과 괄호 문장도 '글 상자가 너무 크다'며 뺐다
function pageCover(c) {
  return `
  <section class="nb-page" data-ch="cover">
    <div class="nb-paper nb-cover">
      <div class="nb-spiral"></div>
      <div class="nb-cover-label">
        <h1 class="nb-cover-title">${esc(c.title)}</h1>
        <span class="nb-sticker" aria-hidden="true"><img src="${SPRITES.sd.normal}" alt=""></span>
      </div>
    </div>
  </section>`;
}

function sheetOpen(ch, extra = '') {
  return `
  <section class="nb-page" data-ch="${ch}">
    <div class="nb-paper nb-sheet${extra}">
      <div class="nb-spiral"></div>
      <div class="nb-scroll">
        <div class="nb-content">`;
}

const sheetClose = (after = '') => `
        </div>
      </div>
      <div class="nb-more" aria-hidden="true"></div>${after}
    </div>
  </section>`;

function pagePart1(p) {
  return `${sheetOpen('p1')}
    <h2 class="nb-h2"><span>${esc(p.title)}</span></h2>
    <div class="nb-lead">${esc(p.lead)}</div>
    <div class="nb-profile">
      <div class="nb-polaroid">
        <div class="nb-polaroid-inner">
          <img src="${SPRITES.sd.normal}" alt="${esc(NL().sd_alt)}" class="nb-sd">
          <div class="nb-polaroid-cap">${esc(p.photoCaption)}</div>
        </div>
        <div class="nb-tape small"></div>
      </div>
      <dl class="nb-dl">
        ${p.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${nbInline(v)}</dd>`).join('')}
      </dl>
    </div>
  ${sheetClose()}`;
}

function pagePart2(p, slice) {
  const items = p.items.slice(slice.from, slice.to);
  const isCont = !slice.first;
  return `${sheetOpen('p2')}
    <h2 class="nb-h2"><span>${esc(p.title)}</span>${isCont ? `<span class="nb-cont">${esc(NL().continued)}</span>` : ''}</h2>
    ${
      isCont
        ? ''
        : `<div class="nb-quote">
             <img src="${SPRITES.sd.normal}" alt="" class="nb-quote-sd">
             <div class="nb-quote-bubble">${esc(p.quote)}</div>
           </div>`
    }
    <div class="nb-memos">
      ${items
        .map(
          // 사진이 있는 칸: 분류 · 작품명이 위 한 줄, 그 아래에 사진과 포스트잇이 같은 높이에서 나란히(10/10 사용자 결정 —
          // 포스트잇 윗변을 사진 윗변에). 사진이 없는 칸은 전처럼 제목 옆에 포스트잇.
          // 사진은 그 쪽에 가까워질 때 받는다(data-src → 넘김이 src로 옮긴다)
          (it) => `
        <div class="nb-memo-row${it.image ? ' has-shot' : ''}">
          <div class="nb-memo-subject">
            <div class="nb-memo-cat">${esc(it.category)}</div>
            <div class="nb-memo-name">${esc(it.name)}</div>
          </div>
          ${
            // 스크랩 사진 슬롯 — 파일이 없으면 빈 프레임으로 자리만 남는다
            it.image
              ? `<div class="nb-memo-shot"><img class="nb-memo-img" data-src="${esc(it.image)}" alt=""></div>`
              : ''
          }
          <div class="nb-postit"><span class="nb-postit-by">${esc(NL().memo_by)}</span> ${nbInline(it.memo)}</div>
        </div>`
        )
        .join('')}
    </div>
    ${
      // 종합 소견은 관찰 메모를 다 나열한 뒤(2부 마지막 쪽)에만 — 따로 붙인 쪽지로, 글자를 한 단계 크게(10/11 가 결론의 무게)
      slice.last && p.closing
        ? `<div class="nb-closing"><span class="nb-tape small" aria-hidden="true"></span>${nbInline(p.closing)}</div>`
        : ''
    }
    ${
      // 관찰 메모를 뒷받침하는 외부 기록. '물증을 붙이는 사람'이라는 소견 바로 뒤에 온다 — 링크는 본문 이상 크기의 단추(10/11 가)
      slice.last && p.evidence && p.evidence.url
        ? `<div class="nb-evidence">
             <p class="nb-evidence-line">${nbInline(p.evidence.line || '')}</p>
             <a class="nb-evidence-link" href="${esc(p.evidence.url)}" target="_blank" rel="noopener">${esc(
               p.evidence.label
             )}</a>
           </div>`
        : ''
    }
  ${sheetClose()}`;
}

function pagePart3(p, slice) {
  // 사진은 단추 — 누르면 크게 보는 창이 뜬다(10/11 가). 단추 이름은 사진 이름과 설명(이미 있는 문구)이 맡는다.
  // 펼침에서는 사진마다 한 쪽(10/11(2)) — 이어지는 쪽은 2부처럼 같은 제목 줄에 '(계속)'(확정 문구 labels.continued)
  const isCont = !slice.first;
  return `${sheetOpen('p3')}
    <h2 class="nb-h2"><span>${esc(p.title)}</span>${isCont ? `<span class="nb-cont">${esc(NL().continued)}</span>` : ''}</h2>
    ${
      isCont
        ? ''
        : `<div class="nb-quote">
      <img src="${SPRITES.sd.normal}" alt="" class="nb-quote-sd">
      <div class="nb-quote-bubble">${esc(p.quote)}</div>
    </div>`
    }
    <div class="nb-photos">
      ${p.photos
        .slice(slice.from, slice.to)
        .map((ph, k) => {
          const i = slice.from + k; // 사진 번호는 3부 전체에서 센다 — 사진 창 · 기울기 · 테이프 자리가 사진을 따라간다
          return `
        <div class="nb-polaroid photo p${i + 1}">
          <button type="button" class="nb-photo-btn" data-i="${i}" aria-haspopup="dialog">
            <span class="nb-polaroid-inner">
              <span class="nb-photo-area"><img class="nb-photo-img" data-src="${esc(ph.src)}" alt="${esc(ph.label)}"><span class="nb-photo-label">${esc(ph.label)}</span></span>
              <span class="nb-polaroid-cap">${esc(ph.caption)}</span>
            </span>
          </button>
          <span class="nb-tape small t${i + 1}" aria-hidden="true"></span>
        </div>`;
        })
        .join('')}
    </div>
  ${sheetClose()}`;
}

// 뒤표지 — 펼친 수첩 마지막 면의 오른쪽 쪽(10/11(2)). 표지와 같은 크라프트 · 같은 크기이고 글자가 없다.
// 움직이지 않는 그림이다(7/30 결정 — 닫히는 연출 없음). 첫 면(표지)과 짝을 이룬다
function pageBackCover() {
  return `
  <section class="nb-page" data-ch="back" aria-hidden="true">
    <div class="nb-paper nb-cover">
      <div class="nb-spiral"></div>
    </div>
  </section>`;
}

// 마지막 쪽 — 사건 종결(10/11 수첩 끝): 편지 끝의 서명과 작은 얼굴 도장, 클립에 물린 명함(연락처 · PDF), 돌아가기,
// 둥근 붉은 'CASE CLOSED' 도장과 방문한 날짜. 사건 파일이 여기서 닫힌다.
// 도장은 찍혀 있을 뿐 연출을 두지 않는다(7/30 'case close 연출'은 넣지 않기로 한 결정).
function pageFolded(f) {
  // line은 여러 문단(\n 구분) — 문단마다 간격을 두어 쪽지처럼 읽히게 한다
  const paras = String(f.line)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<p>${esc(s)}</p>`)
    .join('');
  return `${sheetOpen('end', ' folded')}
    <div class="nb-folded-line">${paras}</div>
    <p class="nb-sign"><span class="nb-sign-name">${esc(NL().sd_alt)}</span><span class="nb-sign-face" aria-hidden="true"><img src="${SPRITES.sd.normal}" alt=""></span></p>
    <div class="nb-closeout">
      <div class="nb-card">
        <span class="clip" aria-hidden="true"></span>
        ${contactLinks()}
      </div>
      <a class="nb-back" href="/evidence">${esc(f.backLabel)} <span aria-hidden="true">→</span></a>
      ${closedStamp(f.closed)}
    </div>
  ${sheetClose('\n      <div class="nb-corner" aria-hidden="true"></div>')}`;
}

// 'CASE CLOSED' 도장 — 둥근 띠의 글(위 · 아래)과 가운데 날짜. 날짜는 방문한 날을 숫자로 찍는다(글이 아니라 문구 키가 없다)
function closedStamp(label) {
  if (!label) return '';
  const d = new Date();
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const star = (x) =>
    `<path class="nb-closed-star" d="M${x} 74l1.8 3.9 4.2.5-3.1 2.9.8 4.2-3.7-2.1-3.7 2.1.8-4.2-3.1-2.9 4.2-.5z"/>`;
  return `
      <div class="nb-closed" role="img" aria-label="${esc(label)} ${date}">
        <svg viewBox="0 0 160 160" aria-hidden="true" focusable="false">
          <defs>
            <path id="nb-closed-top" d="M23 80a57 57 0 0 1 114 0"/>
            <path id="nb-closed-bottom" d="M15 80a65 65 0 0 0 130 0"/>
          </defs>
          <circle class="nb-closed-ring" cx="80" cy="80" r="76"/>
          <circle class="nb-closed-ring thin" cx="80" cy="80" r="71"/>
          <text class="nb-closed-word"><textPath href="#nb-closed-top" startOffset="50%" text-anchor="middle">${esc(label)}</textPath></text>
          <text class="nb-closed-word"><textPath href="#nb-closed-bottom" startOffset="50%" text-anchor="middle">${esc(label)}</textPath></text>
          <text class="nb-closed-date" x="80" y="86.5" text-anchor="middle">${date}</text>
          ${star(18)}${star(142)}
        </svg>
      </div>`;
}

// 도장 둘레 글이 반 바퀴보다 길면(임시 문구 등) 그 길이에 맞춰 글자 폭만 좁힌다 — 글자 높이(크기)는 그대로
function fitStampWords(root) {
  root.querySelectorAll('.nb-closed textPath').forEach((tp) => {
    const path = root.querySelector(tp.getAttribute('href'));
    if (!path || !path.getTotalLength) return;
    const room = path.getTotalLength() * 0.8; // 양 끝은 별 · 날짜 자리
    tp.removeAttribute('textLength'); // 글꼴이 바뀐 뒤 다시 잴 때 — 전에 맞춘 폭을 지우고 잰다
    tp.removeAttribute('lengthAdjust');
    let len = 0;
    try {
      len = tp.parentNode.getComputedTextLength();
    } catch {
      return;
    }
    if (len > room) {
      tp.setAttribute('textLength', String(Math.round(room)));
      tp.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
  });
}

// 마지막 쪽 명함 — 엔딩 끝에 연락처와 PDF를 다시 보인다(명세서 2-5, 10/10 사용자 결정).
// 이메일 · 휴대폰 글자는 이력서 데이터 값 그대로, PDF 단추 이름은 보관함 아래 단추와 같은 키(common.full_pdf).
// PDF는 내려받기(download)라 새 탭 표시 ↗를 달지 않는다. 사이트 안 이동(돌아가기)은 →.
function contactLinks() {
  const r = DB.resume || {};
  const lines = [];
  if (r.email) lines.push(`<a class="nb-contact" href="mailto:${esc(r.email)}">${esc(r.email)}</a>`);
  if (r.phone) lines.push(`<a class="nb-contact" href="tel:${esc(r.phone.replace(/-/g, ''))}">${esc(r.phone)}</a>`);
  const pdf = r.fullPdf ? `<a class="nb-contact nb-pdf" href="${esc(r.fullPdf)}" download>${TH('common.full_pdf')}</a>` : '';
  return `<div class="nb-card-lines">${lines.join('')}</div>${pdf}`;
}
