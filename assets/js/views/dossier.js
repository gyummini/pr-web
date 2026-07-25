import { DB } from '../data.js';
import { state } from '../state.js';
import { openEvidencePopup } from '../popup.js';
import { autoCollectChapter } from '../collect.js';

// 세부 사항 — 진술 기록 (명세서 2-3)
export function renderDossier(view, num) {
  const chId = `CASE${num}`;
  const ch = DB.chapters.find((c) => c.id === chId);
  if (!ch) {
    location.hash = '#/case/01';
    return {};
  }
  state.viewedChapters.add(chId);

  const idx = DB.chapters.indexOf(ch);
  const prev = DB.chapters[idx - 1];
  const next = DB.chapters[idx + 1];

  view.className = 'view-dossier';
  view.innerHTML = `
    <div class="dossier">
      <article class="paper essay">
        <div class="stamp">진술 기록</div>
        <div class="case-no">CASE ${num}</div>
        <h2>${ch.concept}</h2>
        <p class="chapter-sub">${ch.subtitle}</p>
        <div class="essay-body">${ch.html}</div>
        <div class="chapter-nav">
          ${prev ? `<a class="btn ghost" href="#/case/${prev.id.slice(4)}">← ${prev.concept}</a>` : '<span></span>'}
          ${
            next
              ? `<a class="btn accent" href="#/case/${next.id.slice(4)}">${next.concept} →</a>`
              : `<a class="btn accent" href="#/evidence">수집된 증거 확인하기 →</a>`
          }
        </div>
      </article>
      <aside class="chapter-index">
        <div class="index-title">진술 기록 목차</div>
        ${DB.chapters
          .map(
            (c) => `
          <a class="idx ${c.id === chId ? 'active' : ''}" href="#/case/${c.id.slice(4)}">
            <span class="idx-case">CASE ${c.id.slice(4)}</span>
            <span class="idx-name">${c.concept}</span>
          </a>`
          )
          .join('')}
      </aside>
    </div>`;

  view.querySelectorAll('.anchor').forEach((btn) => {
    btn.addEventListener('click', () => openEvidencePopup(btn.dataset.eid));
    // span 기반이므로 키보드 활성화를 직접 처리
    btn.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        openEvidencePopup(btn.dataset.eid);
      }
    });
  });

  return {
    // 챕터 이탈 시 미클릭 증거 자동 일괄 수집. CASE04는 예외(증거 페이지 진입 시 수집).
    onLeave() {
      if (chId !== 'CASE04') autoCollectChapter(chId);
    },
  };
}
