import { DB } from '../data.js';
import { state } from '../state.js';
import { openDoc } from '../ui.js';

// 최종 포트폴리오(E7 제작기) 열람 + 연락처/이력서 재노출 (명세서 2-5)
export function renderMaking(view) {
  if (!(state.resultOnlyMode || state.endingSeen)) {
    location.hash = '#/evidence';
    return {};
  }
  const ev = DB.cards.find((c) => c.hidden);
  const r = DB.resume;

  view.className = 'view-making';
  view.innerHTML = `
    <div class="paper making">
      <div class="stamp">최종 증거</div>
      <div class="ev-kicker">증거 ${ev.id} · 히든</div>
      <h2 class="ev-title"></h2>
      <p class="ev-sub"></p>
      <div class="detail-summary">
        <h3>요약</h3>
        <p class="ev-summary"></p>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn accent open-doc">제작기 열기 ↗</button>
        <a class="btn ghost" href="#/evidence">← 증거 보관함으로</a>
      </div>
      <hr class="making-divider">
      <div class="making-contact">
        <h3>연락처</h3>
        <p>📞 <a href="tel:${r.phone.replace(/-/g, '')}">${r.phone}</a> &nbsp;·&nbsp; ✉ <a href="mailto:${r.email}">${r.email}</a></p>
        <div class="record-actions">
          <a class="btn accent" href="${r.pdf}" download>이력서 PDF 다운로드 ⬇</a>
          <a class="btn ghost" href="mailto:${r.email}">이메일 보내기 ✉</a>
        </div>
      </div>
    </div>`;

  view.querySelector('.ev-title').textContent = ev.title;
  view.querySelector('.ev-sub').textContent = ev.subtitle || '';
  view.querySelector('.ev-summary').textContent = ev.summary || '';
  view.querySelector('.open-doc').addEventListener('click', () => openDoc(ev.url));
  return {};
}
