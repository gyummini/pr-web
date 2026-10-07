import { DB, groupCards } from '../data.js';
import { BASE_EVIDENCE_IDS, state, baseUnlocked, collectedBaseCount } from '../state.js';
import { addPending, landOne, flyFromRect, openDoc } from '../ui.js';
import { checkChapterToasts, fmtCase } from '../collect.js';
import { hasBrief, briefOpenKey } from './brief.js';
import { landOn } from '../briefs/retro.js';
import { navigate } from '../router.js';
import { T, TH } from '../text.js';

// 수집된 증거 — 증거 보관함 (명세서 2-4)
export function renderEvidence(view) {
  view.className = 'view-evidence';

  const cards = DB.cards.filter((c) => !c.hidden);
  const hidden = DB.cards.find((c) => c.hidden);
  const groups = groupCards(cards);

  view.innerHTML = `
    <div class="evidence-page">
      <div class="page-head">
        <div class="stamp">${TH('evidence.stamp')}</div>
        <h2>${TH('evidence.title')}</h2>
        <p class="page-lead">${TH('evidence.lead', { count: leadCount(groups) })}</p>
      </div>
      <div class="hidden-slot-wrap"></div>
      <div class="ev-grid">
        ${groups.map(groupHtml).join('')}
      </div>
      ${
        DB.resume && DB.resume.fullPdf
          ? `<div class="ev-doc-actions">
               <a class="btn ghost" href="/docs">${TH('evidence.to_docs')}</a>
               <a class="btn ghost" href="${DB.resume.fullPdf}" download>${TH('common.full_pdf')}</a>
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
// 문서 · 게임 · 추가 포트폴리오. .ev-grid는 바깥 틀 하나로 남긴다 — 회귀 테스트가
// '보관함 화면에 돌아왔다'를 .ev-grid 개수로 판정한다.
function groupHtml(g) {
  const head = g.label
    ? `<h3 class="ev-group-h">${esc(g.label)} <span class="ev-group-n">${g.cards.length}</span></h3>`
    : '';
  return `<section class="ev-group${g.minor ? ' minor' : ''}" data-group="${esc(g.id)}">${head}
    <div class="ev-cards">${g.cards.map((ev) => cardHtml(ev)).join('')}</div></section>`;
}

// '추가'로 내린 묶음은 따로 센다 — 수집·엔딩 조건과는 별개인 표시일 뿐이다
function leadCount(groups) {
  const main = groups.filter((g) => !g.minor).reduce((n, g) => n + g.cards.length, 0);
  const minor = groups.filter((g) => g.minor).reduce((n, g) => n + g.cards.length, 0);
  return minor ? T('common.portfolio_count_minor', { main, minor }) : T('common.portfolio_count', { main });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 페이지 안에서 직접 플레이할 수 있는 증거 — 브리프에 플레이 주소(play.href)가 있다(E8). E2의 brief.play는 체험 설정이라 주소가 없다
const canPlay = (ev) => hasBrief(ev) && !!ev.brief.play?.href;

function cardHtml(ev) {
  const got = state.collected.has(ev.id);
  const thumb = ev.thumb
    ? `<img class="ev-thumb-img" src="${ev.thumb}" alt="" loading="lazy">`
    : '';
  const code = got
    ? T('evidence.code', { id: ev.id, chapters: (ev.chapters || []).map(fmtCase).join(', ') })
    : T('evidence.code_unknown', { id: ev.id });
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
          // 페이지 안에서 직접 플레이할 수 있는 증거(E8)는 '직접 플레이' 칩 — E3의 플레이 링크 칩과 같은 자리(10/07)
          (ev.attachments || []).length || (canPlay(ev))
            ? `<div class="ev-card-atts">${(ev.attachments || [])
                .map((_, i) => `<button type="button" class="att-chip card" data-att="${i}"></button>`)
                .join('')}${canPlay(ev) ? `<button type="button" class="att-chip card play-chip">${TH('evidence.play')}</button>` : ''}</div>`
            : ''
        }
        <div class="ev-foot">
          <span class="ev-code">${esc(code)}</span>
          <span class="ev-acts"><span class="ev-open">${TH(hasBrief(ev) ? briefOpenKey(ev) : got ? 'common.open_doc' : 'evidence.open_summary')}</span>${
            // 절대원칙 1(2클릭 내 도달) 유지 — 본문이 브리프로 가더라도
            // 원본 문서로 바로 가는 길은 카드 안에 남겨둔다.
            // 행동 문구와 한 묶음(.ev-acts) — 자리가 모자라면 묶음째 다음 줄로 내려간다(10/07: 긴 문구에 밀려 카드 밖으로 잘렸다).
            // 수집 여부와 상관없이 원본이 있으면 붙인다(10/07 사용자 요청 — 전에는 수집한 카드에만)
            ev.url ? `<button type="button" class="ev-direct" title="${TH('evidence.direct_title')}">${TH('evidence.direct')}</button>` : ''
          }</span>
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
  el.querySelectorAll('.att-chip.card[data-att]').forEach((chip) => {
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

  // 직접 플레이 칩 — 개인 키를 여기서 발급하지 않는다. 그 증거 페이지를 열고 '직접 플레이하기' 버튼(안내문과 함께)으로 데려간다
  const play = el.querySelector('.play-chip');
  if (play) {
    const go = (e) => {
      e.preventDefault();
      e.stopPropagation();
      landOn('play');
      navigate(`/evidence/${ev.id}/interactive`);
    };
    play.addEventListener('click', go);
    play.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') go(e);
    });
  }

  // 수집된 증거의 원본 문서로 가는 지름길 (카드 본체 클릭과 분리)
  const direct = el.querySelector('.ev-direct');
  if (direct) {
    direct.addEventListener('click', (e) => {
      e.stopPropagation();
      openDoc(ev.url);
    });
  }

  const act = () => {
    // 브리프가 있으면 수집 여부와 무관하게 그리로 간다 — 진술에서 못 만난 문서도
    // 여기서 바로 조사할 수 있어야 한다 (절대원칙 2: 게임적 경험은 선택)
    if (hasBrief(ev)) {
      navigate(`/evidence/${ev.id}/interactive`);
    } else if (!el.classList.contains('collected')) {
      navigate(`/evidence/${ev.id}`); // 브리프가 아직 없는 미수집 증거: 등장 챕터 안내 + 요약
    } else {
      openDoc(ev.url);
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
  const n = collectedBaseCount();
  const total = BASE_EVIDENCE_IDS.length;
  const e7Target = hidden.url && hidden.url.startsWith('/') ? hidden.url : '/notebook';

  if (!unlocked) {
    wrap.innerHTML = `
      <div class="hidden-slot locked">
        <div class="hidden-icon" aria-hidden="true">🔒</div>
        <div class="hidden-info">
          <span class="hidden-kicker">${TH('evidence.hidden_kicker')}</span>
          <h3 class="hidden-title"></h3>
          <p class="hidden-cond hidden-sub"></p>
          <p class="hidden-progress">${TH('evidence.hidden_progress', { n, total })}</p>
          <div class="hidden-bar" aria-hidden="true"><div class="hidden-bar-fill" style="width:${(n / total) * 100}%"></div></div>
          <div class="hidden-slot-actions">
            <button type="button" class="btn hidden-find">${TH('evidence.hidden_find')}</button>
            <a class="btn ghost hidden-direct" href="${e7Target}">${TH('evidence.hidden_direct')}</a>
          </div>
        </div>
      </div>`;
    wrap.querySelector('.hidden-title').textContent = hidden.title;
    wrap.querySelector('.hidden-sub').textContent = hidden.subtitle || '';
    const missing = BASE_EVIDENCE_IDS.find((id) => !state.collected.has(id));
    wrap.querySelector('.hidden-find').addEventListener('click', () => {
      navigate(missing ? `/evidence/${missing}` : '/evidence');
    });
    return;
  }

  // 해금 상태. 강조 연출(플래시)은 직접 수사 완주자 전용 보상 — 결과만 보기 경로에서는 생략.
  const flash = !state.hiddenFlashShown;
  if (flash) state.hiddenFlashShown = true;
  wrap.innerHTML = `
    <div class="hidden-slot unlocked ${flash ? 'flash' : ''}" tabindex="0" role="button">
      <div class="hidden-icon">🗝️</div>
      <div class="hidden-info">
        <span class="hidden-kicker">${TH('evidence.hidden_done_kicker', { total })}</span>
        <h3 class="hidden-title"></h3>
        <p class="hidden-cond hidden-sub"></p>
      </div>
      <div class="ev-open">${TH(state.endingSeen ? 'evidence.hidden_open' : 'evidence.hidden_with_ending')}</div>
    </div>`;
  wrap.querySelector('.hidden-title').textContent = hidden.title;
  wrap.querySelector('.hidden-sub').textContent = hidden.subtitle || '';

  const slot = wrap.querySelector('.hidden-slot');
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
