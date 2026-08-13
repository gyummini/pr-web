import { DB } from '../data.js';
import { state } from '../state.js';
import { openEvidencePopup } from '../popup.js';
import { autoCollectChapter } from '../collect.js';
import { navigate } from '../router.js';

// 세부 사항 — 진술 기록 (CASE 01~04 + EPILOGUE)
export function renderDossier(view, routePart) {
  const normalized = String(routePart || '01').toLowerCase();
  const chId = normalized === 'epilogue' ? 'EPILOGUE' : `CASE${normalized.padStart(2, '0')}`;
  const ch = DB.chapters.find((c) => c.id === chId);
  if (!ch) {
    navigate('/case/01', { replace: true });
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
        <div class="case-no">${chapterLabel(ch)}</div>
        <h2>${ch.concept}</h2>
        <p class="chapter-sub">${ch.subtitle}</p>
        <div class="essay-body">${ch.html}</div>
        <div class="chapter-nav">
          ${prev ? `<a class="btn ghost" href="${chapterPath(prev)}">← ${prev.concept}</a>` : '<span></span>'}
          ${
            next
              ? `<a class="btn accent" href="${chapterPath(next)}">${next.concept} →</a>`
              : `<a class="btn accent" href="/evidence">수집된 증거 확인하기 →</a>`
          }
        </div>
      </article>
      <aside class="chapter-index">
        <div class="index-title">진술 기록 목차</div>
        ${DB.chapters
          .map(
            (c) => `
          <a class="idx ${c.id === chId ? 'active' : ''}" href="${chapterPath(c)}">
            <span class="idx-case">${chapterLabel(c)}</span>
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
    // 챕터 이탈 시 미클릭 증거 자동 일괄 수집.
    // 최종 증거가 등장하는 CASE04는 예외(증거 페이지 진입 시 수집).
    onLeave() {
      if (chId !== 'CASE04') autoCollectChapter(chId);
    },
  };
}

function chapterPath(ch) {
  return ch.id === 'EPILOGUE' ? '/case/epilogue' : `/case/${ch.id.slice(4)}`;
}

function chapterLabel(ch) {
  return ch.id === 'EPILOGUE' ? 'EPILOGUE' : `CASE ${ch.id.slice(4)}`;
}
