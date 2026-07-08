import { DB } from '../data.js';
import { state, baseUnlocked, TOTAL_EVIDENCE } from '../state.js';
import { addPending, landOne, flyFromRect, openDoc } from '../ui.js';
import { checkChapterToasts, fmtCase } from '../collect.js';

// 수집된 증거 — 증거 보관함 (명세서 2-4)
export function renderEvidence(view) {
  view.className = 'view-evidence';

  const cards = DB.cards.filter((c) => !c.hidden);
  const hidden = DB.cards.find((c) => c.hidden);

  view.innerHTML = `
    <div class="evidence-page">
      <div class="page-head">
        <div class="stamp">증거 보관함</div>
        <h2>수집된 증거</h2>
      </div>
      <div class="ev-grid">
        ${cards.map((ev) => cardHtml(ev)).join('')}
      </div>
      <div class="hidden-slot-wrap"></div>
    </div>`;

  wireCards(view);
  renderHiddenSlot(view.querySelector('.hidden-slot-wrap'), hidden);

  // 예외 규칙: CASE04의 증거는 '수집된 증거' 페이지 진입 시 자동 수집 (CASE04를 열람한 경우만)
  collectCase04(view);

  return {};
}

function cardHtml(ev) {
  const got = state.collected.has(ev.id);
  if (got) {
    return `
      <div class="ev-card collected" data-eid="${ev.id}" tabindex="0" role="button">
        <div class="ev-thumb">📄</div>
        <div class="ev-info">
          <div class="ev-kicker">${ev.id} · ${(ev.chapters || []).map(fmtCase).join(', ')}</div>
          <h3 class="ev-title"></h3>
          <p class="ev-sub"></p>
        </div>
        <div class="ev-open">문서 열기 ↗</div>
      </div>`;
  }
  return `
    <div class="ev-card unknown" data-eid="${ev.id}" tabindex="0" role="button">
      <div class="ev-thumb">❔</div>
      <div class="ev-info">
        <div class="ev-kicker">${ev.id} · 미확인 증거</div>
        <h3 class="ev-title"></h3>
        <p class="ev-sub">클릭하면 등장 챕터와 요약을 확인할 수 있습니다</p>
      </div>
      <div class="ev-open">요약 확인 →</div>
    </div>`;
}

function wireCards(view) {
  view.querySelectorAll('.ev-card[data-eid]').forEach(wireCard);
}

function wireCard(el) {
  const ev = DB.cards.find((c) => c.id === el.dataset.eid);
  // 텍스트는 textContent로 주입 (데이터 파일 내용 그대로)
  const titleEl = el.querySelector('.ev-title');
  if (titleEl) titleEl.textContent = ev.title;
  const subEl = el.querySelector('.ev-sub');
  if (subEl && el.classList.contains('collected')) subEl.textContent = ev.subtitle || '';

  const act = () => {
    if (el.classList.contains('collected')) {
      openDoc(ev.url); // 수집됨: 외부 링크 새 탭
    } else {
      location.hash = `#/evidence/${ev.id}`; // 미수집: 등장 챕터+요약 화면
    }
  };
  el.addEventListener('click', act);
  el.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      act();
    }
  });
}

function renderHiddenSlot(wrap, hidden) {
  const unlocked = baseUnlocked();
  const n = state.collected.size;

  if (!unlocked) {
    wrap.innerHTML = `
      <div class="hidden-slot locked">
        <div class="hidden-icon">🔒</div>
        <div class="hidden-info">
          <h3>히든 증거</h3>
          <p class="hidden-cond">조건: 모든 증거를 수집하세요! &nbsp;현재: ${n} / ${TOTAL_EVIDENCE}</p>
          <div class="hidden-bar"><div class="hidden-bar-fill" style="width:${(n / TOTAL_EVIDENCE) * 100}%"></div></div>
        </div>
      </div>`;
    return;
  }

  // 해금 상태. 강조 연출(플래시)은 직접 수사 완주자 전용 보상 — 결과만 보기 경로에서는 생략.
  const flash = !state.resultOnlyMode && !state.hiddenFlashShown;
  if (flash) state.hiddenFlashShown = true;
  wrap.innerHTML = `
    <div class="hidden-slot unlocked ${flash ? 'flash' : ''}" tabindex="0" role="button">
      <div class="hidden-icon">🗝️</div>
      <div class="hidden-info">
        <h3 class="hidden-title"></h3>
        <p class="hidden-cond hidden-sub"></p>
      </div>
      <div class="ev-open">${state.resultOnlyMode || state.endingSeen ? '확인하기 →' : '해금! 클릭하여 확인 →'}</div>
    </div>`;
  wrap.querySelector('.hidden-title').textContent = hidden.title;
  wrap.querySelector('.hidden-sub').textContent = hidden.subtitle || '';

  const slot = wrap.querySelector('.hidden-slot');
  const act = () => {
    // 직접 수사 완주자: 엔딩 대화 → 제작기. 결과만 보기/엔딩 완료자: 제작기 바로.
    if (state.resultOnlyMode || state.endingSeen) location.hash = '#/making';
    else location.hash = '#/ending';
  };
  slot.addEventListener('click', act);
  slot.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      act();
    }
  });
}

function collectCase04(view) {
  if (!state.viewedChapters.has('CASE04')) return;
  const rest = DB.cards.filter(
    (c) => !c.hidden && (c.chapters || []).includes('CASE04') && !state.collected.has(c.id)
  );
  if (!rest.length) return;

  rest.forEach((ev, i) => {
    state.collected.add(ev.id);
    addPending(1);
    const el = view.querySelector(`.ev-card[data-eid="${ev.id}"]`);
    const rect = el
      ? el.getBoundingClientRect()
      : { left: innerWidth / 2 - 22, top: innerHeight / 2, width: 44, height: 44 };
    setTimeout(() => {
      flyFromRect(rect, () => {
        landOne();
        // 카드가 수집 상태로 뒤집히도록 해당 카드만 갱신 (중복 바인딩 방지)
        if (el && view.isConnected) {
          el.outerHTML = cardHtml(ev);
          const fresh = view.querySelector(`.ev-card[data-eid="${ev.id}"]`);
          if (fresh) wireCard(fresh);
        }
      });
    }, i * 200);
  });

  setTimeout(() => {
    checkChapterToasts();
    // 히든 해금 여부가 바뀌었을 수 있으므로 슬롯 갱신 (페이지 이탈 시 생략)
    if (!view.isConnected) return;
    const hidden = DB.cards.find((c) => c.hidden);
    renderHiddenSlot(view.querySelector('.hidden-slot-wrap'), hidden);
  }, rest.length * 200 + 850);
}
