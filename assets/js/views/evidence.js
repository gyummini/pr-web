import { DB, groupCards } from '../data.js';
import { BASE_EVIDENCE_IDS, state, baseUnlocked } from '../state.js';
import { addPending, landOne, flyFromRect, openDoc, unlanded, dismissUnlockToast } from '../ui.js';
import { checkChapterToasts, fmtCase } from '../collect.js';
import { hasBrief, briefOpenKey } from './brief.js';
import { landAt } from '../landing.js';
import { openEvidencePopup, CLOSE_ICON, keepFocusInside } from '../popup.js';
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
               <a class="btn ghost" href="${DB.resume.fullPdf}" download>${TH('common.full_pdf')}</a>
             </div>`
          : ''
      }
    </div>`;

  wireCards(view);
  renderHiddenSlot(view.querySelector('.hidden-slot-wrap'), view, hidden);

  // 장을 떠나며 모은 증거의 쪽지가 아직 날아가는 중이면, 내려앉은 뒤에 그 카드와 보너스 칸을 다시 그린다 —
  // 신호 순서는 '내려앉기, 펼침, 알림'(DESIGN.md 5절). 10/11에 CASE04 예외(이 화면에서 모으던 것)를 없애며 옮겼다
  const onLanded = (e) => {
    const ev = DB.cards.find((c) => c.id === e.detail.id);
    if (ev && !ev.hidden) refreshCard(view, ev);
    if (unlanded.size) return;
    const wrap = view.querySelector('.hidden-slot-wrap');
    if (wrap) renderHiddenSlot(wrap, view, hidden);
    checkChapterToasts();
  };
  document.addEventListener('pr:landed', onLanded);

  return {
    onLeave() {
      document.removeEventListener('pr:landed', onLanded);
    },
  };
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

// 카드는 철해 둔 파일철이다(10/10 라5 시안 — 종류 태그는 파일철 탭 위, 표지는 클립으로 물린 종이 한 장).
// 표지는 4:3 칸 안에 통째로 놓는다(10/10 라2 가안 — 전에는 칸을 꽉 채우고 위를 기준으로 잘라 양옆 25~37%가 잘렸다).
// 아직 모으지 않은 카드는 표지 위에 '미확인 증거' 도장을 찍는다 — 모을 때마다 도장이 하나씩 사라진다(덧붙인 생각, 문구는 상세 화면 도장과 같은 확정 문구)
function cardHtml(ev) {
  const got = state.collected.has(ev.id) && !unlanded.has(ev.id); // 쪽지가 내려앉은 뒤에 '모음'으로 뒤집는다
  const thumb = ev.thumb
    ? `<span class="ev-sheet"><span class="ev-photo"><img class="ev-thumb-img" src="${ev.thumb}" alt="" loading="lazy"></span><span class="clip" aria-hidden="true"></span></span>`
    : '';
  // 자기소개서에 나오지 않는 추가 포트폴리오(E9)는 장 이름 없이 번호만. 모으지 않은 카드는 도장이 상태를 말하므로 번호만
  const chs = (ev.chapters || []).map(fmtCase).join(', ');
  const code = got ? (chs ? T('evidence.code', { id: ev.id, chapters: chs }) : ev.id) : ev.id;
  return `
    <div class="ev-card ${got ? 'collected' : 'unknown'}" data-eid="${ev.id}" tabindex="0" role="button">
      <span class="ev-tab"><span class="ev-type"></span></span>
      <div class="ev-thumb">${thumb}<span class="ev-thumb-fallback" aria-hidden="true"></span>${
        // 모은 카드에는 쪽지 · 메모와 같은 둥근 증거 번호 도장(10/11 재3) — 모으기 전에는 '미확인 증거' 도장
        got ? `<span class="ev-seal" aria-hidden="true">${esc(ev.id)}</span>` : `<span class="ev-stamp">${TH('detail.stamp_unknown')}</span>`
      }</div>
      <div class="ev-info">
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
          <span class="ev-acts"><span class="ev-open">${TH(!got ? 'evidence.open_summary' : hasBrief(ev) ? briefOpenKey(ev) : 'common.open_doc')}</span>${
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
  view.querySelectorAll('.ev-card[data-eid]').forEach((el) => wireCard(el, view));
}

// 아직 모으지 않은 증거 — 수집하지 않고 요약 팝업만 연다(10/07 사용자 결정: 블러는 그대로).
// 잠금해제하면 배지에 내려앉은 뒤 그 카드와 보너스 칸을 다시 그린다. 인터랙티브 페이지로 넘어갔으면 돌아올 때 새로 그려진다
function openShelf(view, id) {
  openEvidencePopup(id, {
    shelf: true,
    onCollected() {
      const ev = DB.cards.find((c) => c.id === id);
      if (ev) refreshCard(view, ev);
      const wrap = view.querySelector('.hidden-slot-wrap');
      if (wrap) renderHiddenSlot(wrap, view, DB.cards.find((c) => c.hidden));
    },
  });
}

// 카드 하나만 다시 그린다(수집 상태로 뒤집기). 초점이 그 카드에 있었으면 새 카드로 옮긴다
function refreshCard(view, ev) {
  const el = view.querySelector(`.ev-card[data-eid="${ev.id}"]`);
  if (!el) return;
  const focused = el.contains(document.activeElement);
  el.outerHTML = cardHtml(ev);
  const fresh = view.querySelector(`.ev-card[data-eid="${ev.id}"]`);
  if (!fresh) return;
  wireCard(fresh, view);
  if (focused) fresh.focus({ preventScroll: true });
}

function wireCard(el, view) {
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
  // 썸네일 파일이 없으면 아이콘 폴백 (파일이 추가되면 자동으로 표시됨).
  // 종이 한 장의 비율은 그림을 받은 뒤 그림 비율로 맞춘다(세로 그림 E3는 세로 종이, 넓은 E8은 가로로 긴 종이)
  const img = el.querySelector('.ev-thumb-img');
  if (img) {
    const sheet = img.closest('.ev-sheet');
    const fit = () => {
      if (img.naturalWidth && img.naturalHeight) sheet.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4));
    };
    if (img.complete) fit();
    else img.addEventListener('load', fit, { once: true });
    img.addEventListener('error', () => sheet.remove(), { once: true });
  }
  // 첨부 칩: 라벨은 데이터 그대로, 클릭은 카드 본체로 전파되지 않게 막는다
  el.querySelectorAll('.att-chip.card[data-att]').forEach((chip) => {
    const att = (ev.attachments || [])[Number(chip.dataset.att)];
    if (!att) {
      chip.remove();
      return;
    }
    chip.textContent = att.label; // 앞의 문서 표시는 CSS(10/09 — 전에는 📎)
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
      landAt('retro', 'play');
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
    // 아직 모으지 않은 증거는 요약 팝업 — 진술에서 찾아가거나 잠금해제하고 바로 연다.
    // 진술에서 못 만난 문서도 여기서 두 번 만에 열린다 (절대원칙 2: 게임적 경험은 선택)
    if (!state.collected.has(ev.id)) openShelf(view, ev.id);
    else if (hasBrief(ev)) navigate(`/evidence/${ev.id}/interactive`);
    else openDoc(ev.url);
  };
  el.addEventListener('click', act);
  el.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      act();
    }
  });
}

// 보너스 칸(히든 E7 — 클루의 수사 수첩). 위에 두는 것은 일부러다(10/10 사용자 — 해금하자마자 보이게).
// 대신 상태에 따라 크기를 바꾼다(10/10 라1 다안): 잠겨 있으면 한 줄 띠로 줄여 작업물 카드가 첫 화면에 들어오고,
// 해금되면 같은 자리에서 짙은 파일철로 펼친다(라4 시안 가 — 금빛 칸 · 자물쇠 대신 파일철과 붉은 도장).
function renderHiddenSlot(wrap, view, hidden) {
  // 날아가는 쪽지가 있으면 내려앉은 뒤에 펼친다(onLanded가 다시 그린다)
  const unlocked = baseUnlocked() && !unlanded.size;
  // 이미 펼쳐 둔 칸은 다시 그리지 않는다 — 내려앉기 알림(pr:landed)과 팝업의 수집 뒤 처리가 함께 부르면 펼침 연출이 끊겼다
  if (unlocked && wrap.querySelector('.hidden-slot.unlocked')) return;
  const n = BASE_EVIDENCE_IDS.filter((id) => state.collected.has(id) && !unlanded.has(id)).length;
  const total = BASE_EVIDENCE_IDS.length;
  const e7Target = hidden.url && hidden.url.startsWith('/') ? hidden.url : '/notebook';

  if (!unlocked) {
    wrap.innerHTML = `
      <div class="hidden-slot locked">
        <span class="hidden-seal" aria-hidden="true"></span>
        <span class="hidden-kicker">${TH('evidence.hidden_kicker')}</span>
        <h3 class="hidden-title"></h3>
        ${meterHtml(n, total, false)}
        <div class="hidden-slot-actions">
          <button type="button" class="btn hidden-find">${TH('evidence.hidden_find')}</button>
          <a class="btn ghost hidden-direct" href="${e7Target}">${TH('evidence.hidden_direct')}</a>
        </div>
      </div>`;
    wrap.querySelector('.hidden-title').textContent = hidden.title;
    wireMeter(wrap, view);
    // 아직 모으지 않은 첫 증거의 요약 팝업 — 그 카드를 누른 것과 같다(10/07: 전에는 증거 상세 화면으로 넘어갔다)
    wrap.querySelector('.hidden-find').addEventListener('click', () => {
      const missing = BASE_EVIDENCE_IDS.find((id) => !state.collected.has(id));
      if (missing) openShelf(view, missing);
    });
    // 잠긴 채 바로 열면 엔딩보다 수첩을 먼저 보게 된다 — 막지 않고 한 번 알린다(10/10 사용자 결정: 경고와 '그래도 보기')
    wrap.querySelector('.hidden-direct').addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // 새 탭 열기는 브라우저대로
      e.preventDefault();
      confirmDirect(view, e.currentTarget, e7Target);
    });
    return;
  }

  // 해금 상태. 펼치는 연출은 처음 한 번만(직접 수사 완주자 전용 보상 — 결과만 보기 경로에서는 생략).
  const flash = !state.hiddenFlashShown;
  if (flash) state.hiddenFlashShown = true;
  wrap.innerHTML = `
    <div class="hidden-slot unlocked ${flash ? 'flash' : ''}" tabindex="0" role="button">
      <span class="hidden-seal open" aria-hidden="true"></span>
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
  // 해금 고정 알림은 같은 곳으로 가는 길이다 — 펼친 칸이 화면에 보이면 알림을 거둔다(10/11 재채점: 다른 화면에서 해금된 뒤 보관함에 오면
  // 알림과 펼친 칸이 같은 단추를 함께 내밀었고, 휴대폰에서는 알림이 제목을 덮었다). 돌아온 자리로 스크롤한 뒤에 잰다
  setTimeout(() => {
    if (!slot.isConnected) return;
    const r = slot.getBoundingClientRect();
    const head = document.querySelector('body > header');
    const top = head ? head.getBoundingClientRect().bottom : 0; // 고정 머리말 밑에 숨은 것은 보이지 않는 것으로 친다
    if (r.bottom > top + 24 && r.top < innerHeight) dismissUnlockToast();
  }, 0);
}

// 진행 막대를 칸 여덟 개로(10/10 라3): 기본 증거 일곱 칸 + 잠긴 수첩 한 칸 — 머리 배지(n/8)와 같은 것을 센다.
// 전에는 배지 4/8 옆에 '증거 4 / 7 수집'이 따로 있어 숫자가 둘이었다. 모은 칸은 채우고, 빈 칸은 그 증거의 요약 팝업을 연다(카드를 누른 것과 같다).
// 칸의 글자는 증거 번호뿐이고, 몇 개를 모았는지는 화면 낭독기에 묶음 이름으로 읽힌다
// 칸에 마우스를 올리면 그 증거의 제목(카드 제목과 같은 데이터)이 뜬다 — 번호만 보고 어떤 문서인지 떠올리지 않게(10/11 재3)
const titleOf = (id) => esc((DB.cards.find((c) => c.id === id) || {}).title || id).replace(/"/g, '&quot;');
function meterHtml(n, total) {
  const cells = BASE_EVIDENCE_IDS.map((id) =>
    (state.collected.has(id) && !unlanded.has(id))
      ? `<span class="hm-cell on" data-eid="${id}" title="${titleOf(id)}">${id}</span>`
      : `<button type="button" class="hm-cell" data-eid="${id}" title="${titleOf(id)}" aria-label="${TH('evidence.code_unknown', { id })}">${id}</button>`
  ).join('');
  return `<div class="hidden-meter" role="group" aria-label="${TH('evidence.hidden_progress', { n, total })}">${cells}<span class="hm-cell lock" aria-hidden="true"></span></div>`;
}

function wireMeter(wrap, view) {
  wrap.querySelectorAll('button.hm-cell[data-eid]').forEach((b) => {
    b.addEventListener('click', () => openShelf(view, b.dataset.eid));
  });
}

// 잠긴 수첩을 바로 열 때의 작은 창(10/10 라1 — 사용자 결정 '경고랑 그래도 보기'). 막지는 않는다.
// 다른 팝업과 같은 종이 · 모서리 · 그림자 · 키보드 규칙(초점이 창 안에서 돌고, Esc · 바깥 누르기 · 뒤로 가기로 닫힘).
// '그래도 보기'는 지금처럼 수첩으로, '남은 증거 찾기'는 보너스 칸의 단추와 같은 일. 닫으면 '수첩 바로 열람'으로 초점이 돌아온다
function confirmDirect(view, trigger, target) {
  const root = document.getElementById('modal-root');
  if (!root || root.querySelector('.confirm-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-t" aria-describedby="confirm-d" tabindex="-1">
      <button type="button" class="popup-close" aria-label="${TH('popup.close')}">${CLOSE_ICON}</button>
      <span class="confirm-kicker">${TH('evidence.hidden_kicker')}</span>
      <h3 class="confirm-title" id="confirm-t">${TH('evidence.direct_warn_title')}</h3>
      <p class="confirm-body" id="confirm-d">${TH('evidence.direct_warn_body')}</p>
      <div class="confirm-actions">
        <a class="btn confirm-go" href="${target}">${TH('evidence.direct_warn_go')}</a>
        <button type="button" class="btn ghost confirm-find">${TH('evidence.hidden_find')}</button>
      </div>
    </div>`;
  root.appendChild(overlay);
  document.documentElement.classList.add('modal-open');
  const box = overlay.querySelector('.confirm');
  box.focus({ preventScroll: true });

  let closed = false;
  const close = (restore = true) => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('popstate', onBack);
    overlay.remove();
    document.documentElement.classList.remove('modal-open');
    if (restore && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  const onKey = (e) => {
    if (e.code === 'Escape') close();
    else if (e.key === 'Tab') keepFocusInside(e, box);
  };
  const onBack = () => close(false);
  document.addEventListener('keydown', onKey);
  window.addEventListener('popstate', onBack);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.popup-close').addEventListener('click', () => close());
  // 수첩으로 — 창을 먼저 닫고, 이동은 라우터가 이 링크를 그대로 받아 처리한다
  overlay.querySelector('.confirm-go').addEventListener('click', () => close(false));
  overlay.querySelector('.confirm-find').addEventListener('click', () => {
    close(false);
    const missing = BASE_EVIDENCE_IDS.find((id) => !state.collected.has(id));
    if (missing) openShelf(view, missing);
  });
}

