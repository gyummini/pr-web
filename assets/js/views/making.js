import { DB, getCard } from '../data.js';
import { state } from '../state.js';
import { openDoc } from '../ui.js';
import { sdSprite } from '../sprites.js';
import { figureHtml } from '../figures.js';

// E7 히든 포트폴리오 — 제작기 열람 페이지 (#/making).
// 외부 문서가 아니라 사이트 내 페이지. 원고는 콘텐츠_제작기.md에서 로드.
// 각 장: [요약] 상시 노출 + [상세] 아코디언(기본 접힘). 상세 없는 장은 전문 노출.
export function renderMaking(view) {
  if (!(state.resultOnlyMode || state.endingSeen)) {
    location.hash = '#/evidence';
    return {};
  }
  const doc = DB.making;
  const ev = DB.cards.find((c) => c.hidden);
  const r = DB.resume;

  view.className = 'view-making';
  view.innerHTML = `
    <div class="paper making-doc">
      <div class="stamp">최종 증거</div>
      <div class="ev-kicker">증거 ${ev.id} · 히든</div>
      <h2 class="mk-doc-title"></h2>
      <p class="ev-sub mk-doc-sub"></p>
      <div class="mk-chapters"></div>
      <div class="mk-closing-wrap"></div>
      <hr class="making-divider">
      <div class="making-contact">
        <h3>연락처</h3>
        <p>📞 <a href="tel:${r.phone.replace(/-/g, '')}">${r.phone}</a> &nbsp;·&nbsp; ✉ <a href="mailto:${r.email}">${r.email}</a></p>
        <div class="record-actions">
          <a class="btn accent" href="${r.fullPdf}" download>이력서, 자기소개서 PDF 다운로드 ⬇</a>
          <a class="btn ghost" href="#/evidence">← 증거 보관함으로</a>
        </div>
      </div>
    </div>`;

  view.querySelector('.mk-doc-title').textContent = doc.title;
  view.querySelector('.mk-doc-sub').textContent = ev.subtitle || '';

  const wrap = view.querySelector('.mk-chapters');
  doc.chapters.forEach((ch) => {
    const sec = document.createElement('section');
    sec.className = 'mk-chapter';
    sec.innerHTML = `
      <h3 class="mk-title"></h3>
      <div class="mk-summary">${blocksHtml(ch.summary)}</div>
      ${
        ch.detail
          ? `<details class="mk-detail">
               <summary>상세 보기</summary>
               <div class="mk-detail-body">${blocksHtml(ch.detail)}</div>
             </details>`
          : ''
      }`;
    sec.querySelector('.mk-title').textContent = ch.heading;
    wrap.appendChild(sec);
  });

  // 증거 교차 링크 칩 와이어링 (새 탭)
  view.querySelectorAll('.mk-evlink').forEach((btn) => {
    const card = getCard(btn.dataset.eid);
    if (!card) {
      btn.remove();
      return;
    }
    btn.querySelector('.mk-evlink-title').textContent = card.title;
    btn.addEventListener('click', () => openDoc(card.url));
  });

  // 클루 클로징 — 대화창 스타일 1줄
  if (doc.closing) {
    const c = document.createElement('div');
    c.className = 'mk-closing';
    c.innerHTML = `
      <img class="mk-sd" src="${sdSprite('happy')}" alt="클루 SD" loading="lazy">
      <div class="mk-line"><span class="mk-name"></span><span class="mk-text"></span></div>`;
    c.querySelector('.mk-name').textContent = doc.closing.speaker;
    c.querySelector('.mk-text').textContent = doc.closing.text;
    view.querySelector('.mk-closing-wrap').appendChild(c);
  }

  return {};
}

function blocksHtml(blocks) {
  return blocks
    .map((b) => {
      if (b.type === 'img') {
        // 제작 완료된 시각 자료(figures.js)가 있으면 렌더, 없으면 플레이스홀더
        return (
          figureHtml(b.slot) ||
          `<div class="img-slot" aria-hidden="true">🖼 이미지 준비 중 <span class="img-slot-id">[${b.slot}]</span></div>`
        );
      }
      if (b.type === 'evlink') {
        return `<button type="button" class="mk-evlink" data-eid="${b.eid}">
                  <span class="mk-evlink-kicker">증거 ${b.eid}</span>
                  <span class="mk-evlink-title"></span>
                  <span class="mk-evlink-open">문서 열기 ↗</span>
                </button>`;
      }
      return `<p>${b.html}</p>`;
    })
    .join('\n');
}
