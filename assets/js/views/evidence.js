import { DB } from '../data.js';
import { state, baseUnlocked, TOTAL_EVIDENCE } from '../state.js';
import { addPending, landOne, flyFromRect, openDoc } from '../ui.js';
import { checkChapterToasts, fmtCase } from '../collect.js';
import { navigate } from '../router.js';

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
        <p class="page-lead">포트폴리오 ${TOTAL_EVIDENCE}건 — 자기소개서의 각 진술을 뒷받침하는 실제 작업 문서</p>
      </div>
      <div class="ev-grid">
        ${cards.map((ev) => cardHtml(ev)).join('')}
      </div>
      <div class="hidden-slot-wrap"></div>
      ${
        DB.resume && DB.resume.fullPdf
          ? `<div class="ev-doc-actions">
               <a class="btn ghost" href="${DB.resume.fullPdf}" download>이력서·자기소개서 PDF ⬇</a>
             </div>`
          : ''
      }
    </div>`;

  wireCards(view);
  renderHiddenSlot(view.querySelector('.hidden-slot-wrap'), hidden);

  // 예외 규칙: 최종 증거가 등장하는 CASE04의 증거는 이 페이지 진입 시 자동 수집
  // (CASE04를 열람한 경우만).
  collectFinalChapter(view);

  return {};
}

// 카드 정보 위계: 썸네일 → 문서 유형 → 제목 → 부제 → 증거코드·챕터 → 액션
function cardHtml(ev) {
  const got = state.collected.has(ev.id);
  const thumb = ev.thumb
    ? `<img class="ev-thumb-img" src="${ev.thumb}" alt="" loading="lazy">`
    : '';
  const code = got
    ? `${ev.id} · ${(ev.chapters || []).map(fmtCase).join(', ')}`
    : `${ev.id} · 미확인 증거`;
  return `
    <div class="ev-card ${got ? 'collected' : 'unknown'}" data-eid="${ev.id}" tabindex="0" role="button">
      <div class="ev-thumb">${thumb}<span class="ev-thumb-fallback" aria-hidden="true">${got ? '📄' : '❔'}</span></div>
      <div class="ev-info">
        <span class="ev-type"></span>
        <h3 class="ev-title"></h3>
        <p class="ev-sub"></p>
        ${
          // 첨부(실측 데이터·플레이 링크 등)는 목록에서 바로 열 수 있어야 한다.
          // 카드 본체 클릭은 본문 열기이므로 칩은 이벤트를 가로챈다.
          (ev.attachments || []).length
            ? `<div class="ev-card-atts">${(ev.attachments || [])
                .map((_, i) => `<button type="button" class="att-chip card" data-att="${i}"></button>`)
                .join('')}</div>`
            : ''
        }
        <div class="ev-foot">
          <span class="ev-code">${code}</span>
          <span class="ev-open">${got ? '문서 열기 ↗' : '요약 확인 →'}</span>
        </div>
      </div>
    </div>`;
}

function wireCards(view) {
  view.querySelectorAll('.ev-card[data-eid]').forEach(wireCard);
}

function wireCard(el) {
  const ev = DB.cards.find((c) => c.id === el.dataset.eid);
  // 텍스트는 textContent로 주입 (데이터 파일 내용 그대로)
  const typeEl = el.querySelector('.ev-type');
  if (typeEl) {
    if (ev.doc_type) typeEl.textContent = ev.doc_type;
    else typeEl.remove();
  }
  const titleEl = el.querySelector('.ev-title');
  if (titleEl) titleEl.textContent = ev.title;
  // 부제는 수집 여부와 무관하게 실제 한 줄 설명 (안내는 하단 '요약 확인 →' 액션이 담당)
  const subEl = el.querySelector('.ev-sub');
  if (subEl) subEl.textContent = ev.subtitle || '';
  // 썸네일 파일이 없으면 아이콘 폴백 (파일이 추가되면 자동으로 표시됨)
  const img = el.querySelector('.ev-thumb-img');
  if (img) {
    img.addEventListener('error', () => img.remove(), { once: true });
  }
  // 첨부 칩: 라벨은 데이터 그대로, 클릭은 카드 본체로 전파되지 않게 막는다
  el.querySelectorAll('.att-chip.card').forEach((chip) => {
    const att = (ev.attachments || [])[Number(chip.dataset.att)];
    if (!att) {
      chip.remove();
      return;
    }
    chip.textContent = `📎 ${att.label}`;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      openDoc(att.url);
    });
    chip.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        openDoc(att.url);
      }
    });
  });

  const act = () => {
    if (el.classList.contains('collected')) {
      openDoc(ev.url); // 수집됨: 외부 링크 새 탭
    } else {
      navigate(`/evidence/${ev.id}`); // 미수집: 등장 챕터+요약 화면
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
  const flash = !state.hiddenFlashShown;
  if (flash) state.hiddenFlashShown = true;
  wrap.innerHTML = `
    <div class="hidden-slot unlocked ${flash ? 'flash' : ''}" tabindex="0" role="button">
      <div class="hidden-icon">🗝️</div>
      <div class="hidden-info">
        <h3 class="hidden-title"></h3>
        <p class="hidden-cond hidden-sub"></p>
      </div>
      <div class="ev-open">${state.endingSeen ? '확인하기 →' : '해금! 클릭하여 확인 →'}</div>
    </div>`;
  wrap.querySelector('.hidden-title').textContent = hidden.title;
  wrap.querySelector('.hidden-sub').textContent = hidden.subtitle || '';

  const slot = wrap.querySelector('.hidden-slot');
  // E7의 목적지는 증거 카드 데이터가 결정 (내부 라우트, 예: /notebook)
  const e7Target = hidden.url && hidden.url.startsWith('/') ? hidden.url : '/notebook';
  const act = () => {
    // 처음 해금하면 엔딩 대화부터, 이미 본 뒤에는 E7로 바로
    if (state.endingSeen) navigate(e7Target);
    else navigate('/ending');
  };
  slot.addEventListener('click', act);
  slot.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      act();
    }
  });
}

function collectFinalChapter(view) {
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
