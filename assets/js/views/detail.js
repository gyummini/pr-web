import { getCard } from '../data.js';
import { state, counts } from '../state.js';
import { openDoc, addPending, landOne, flyFromRect } from '../ui.js';
import { fmtCase, casePath, checkChapterToasts } from '../collect.js';
import { navigate } from '../router.js';
import { hasBrief, briefOpenKey } from './brief.js';
import { hasMemo, renderMemo } from '../memo.js';
import { T, TH, setLabel } from '../text.js';

// 증거 상세(명세서 2-4) — 수첩의 증거 링크로 오는 완주자와, 주소를 직접 연 방문자가 본다.
// 10/10 라6 정리: 빨간 주 단추는 하나. 모으기 전에도 보관함 요약 팝업과 같은 두 갈래('자기소개서에서 확인하기' · '잠금해제하고 ○○')를 보여 주고,
// 긴 요약 문단 대신 팝업과 같은 클루 메모를 쓴다(메모가 없는 증거만 요약 문단). 전에는 모은 뒤 빨간 단추가 둘이었고, 모으기 전에는 인터랙티브로 가는 길이 없었다
export function renderDetail(view, eid) {
  const ev = getCard(eid);
  if (!ev || ev.hidden) {
    navigate('/evidence', { replace: true });
    return {};
  }
  const firstChapter = (ev.chapters || [])[0];
  const collected = state.collected.has(eid);
  const brief = hasBrief(ev);
  const withMemo = hasMemo(ev);

  view.className = 'view-detail';
  view.innerHTML = `
    <div class="paper detail filed">
      <div class="file-tab detail-tab">${TH('detail.kicker', { id: ev.id, chapter: firstChapter ? fmtCase(firstChapter) : T('detail.no_chapter') })}</div>
      <div class="stamp">${TH(collected ? 'detail.stamp_collected' : 'detail.stamp_unknown')}</div>
      <h2 class="ev-title"></h2>
      <p class="ev-sub"></p>
      ${
        withMemo
          ? '<div class="ev-memo detail-memo"></div>'
          : `<div class="detail-summary"><h3>${TH('detail.summary')}</h3><p class="ev-summary"></p></div>`
      }
      <div class="ev-attachments"></div>
      <div class="detail-actions"></div>
    </div>`;

  view.querySelector('.ev-title').textContent = ev.title;
  view.querySelector('.ev-sub').textContent = ev.subtitle || '';
  if (withMemo) renderMemo(view.querySelector('.ev-memo'), ev);
  else view.querySelector('.ev-summary').textContent = ev.summary || '';
  // 표지 — 보관함 카드와 같은 '클립에 물린 종이 한 장'(10/11 재2). 전에는 스캐너 틀(회색 세로줄 · 모서리 눈금 · 청록 훑는 줄) 안에 작게 놓였다.
  // 종이 비율은 그림을 받은 뒤 그림 비율로(카드와 같다)
  if (ev.thumb) {
    const cover = document.createElement('div');
    cover.className = 'detail-cover';
    cover.setAttribute('aria-hidden', 'true');
    cover.innerHTML = '<span class="ev-sheet"><span class="ev-photo"><img class="ev-thumb-img" alt=""></span><span class="clip"></span></span>';
    const img = cover.querySelector('img');
    const sheet = cover.querySelector('.ev-sheet');
    img.addEventListener('load', () => {
      if (img.naturalWidth && img.naturalHeight) sheet.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4));
    }, { once: true });
    img.addEventListener('error', () => cover.remove(), { once: true });
    img.src = ev.thumb;
    view.querySelector('.detail .stamp').after(cover);
  }

  const attWrap = view.querySelector('.ev-attachments');
  (ev.attachments || []).forEach((att) => {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'att-chip';
    a.textContent = att.label; // 앞의 문서 표시는 CSS(10/09 — 전에는 📎)
    a.addEventListener('click', () => openDoc(att.url));
    attWrap.appendChild(a);
  });

  const actions = view.querySelector('.detail-actions');
  const toStatement = (kind) =>
    firstChapter ? link(T('detail.to_statement', { case: fmtCase(firstChapter) }), kind, casePath(firstChapter)) : null;
  // 그 증거를 여는 길 — 인터랙티브 페이지(회고)가 있으면 그 페이지, 없으면 원본 문서(새 탭)
  const openIt = (kind) =>
    brief
      ? link(T(briefOpenKey(ev, 'detail')), kind, `/evidence/${ev.id}/interactive`)
      : button(T('detail.open_doc'), kind, () => openDoc(ev.url));

  if (collected) {
    // 모은 증거: 여는 길이 주 단추, 진술로 가는 길은 보조. 인터랙티브가 있고 원본도 따로 있으면 '문서 바로 열기 ↗'도 보조로 남긴다
    actions.append(
      ...[
        openIt('accent'),
        toStatement('ghost'),
        brief && ev.url ? button(T('detail.open_doc'), 'ghost', () => openDoc(ev.url)) : null,
      ].filter(Boolean)
    );
  } else {
    // 아직 모으지 않은 증거: 보관함 요약 팝업과 같은 두 갈래(10/07 사용자 결정의 이름표)
    const opens = brief ? briefOpenKey(ev, 'popup') : 'common.open_doc';
    const unlock = button(T('popup.unlock', { action: T(opens) }), firstChapter ? 'ghost' : 'accent', (e) => {
      // 잠금해제 — 상태를 먼저 바꾸고, 누른 단추에서 배지로 쪽지를 날린 뒤 연다
      state.collected.add(ev.id);
      if (counts(ev.id)) {
        addPending(1, ev.id);
        flyFromRect(e.currentTarget.getBoundingClientRect(), () => {
          landOne(ev.id);
          checkChapterToasts();
        }, { id: ev.id });
      }
      if (brief) navigate(`/evidence/${ev.id}/interactive`);
      else {
        openDoc(ev.url); // 누른 그 차례에 열어야 새 탭이 막히지 않는다
        navigate(`/evidence/${ev.id}`, { replace: true });
      }
    });
    actions.append(...[toStatement('accent'), unlock].filter(Boolean));
  }
  actions.appendChild(link(T('common.back_to_evidence'), 'ghost', '/evidence'));

  return {};
}

function link(label, kind, href) {
  const a = document.createElement('a');
  a.className = `btn ${kind}`;
  a.href = href;
  setLabel(a, label);
  return a;
}

function button(label, kind, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn ${kind}`;
  setLabel(b, label);
  b.addEventListener('click', onClick);
  return b;
}
