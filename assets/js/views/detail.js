import { getCard } from '../data.js';
import { state } from '../state.js';
import { openDoc } from '../ui.js';
import { fmtCase } from '../collect.js';
import { navigate } from '../router.js';

// 미수집 증거 상세 (명세서 2-4): 처음 등장하는 챕터 + 포폴 요약.
// 방문자가 요약만 볼지, 문서 세부를 열지 선택하게 한다.
export function renderDetail(view, eid) {
  const ev = getCard(eid);
  if (!ev || ev.hidden) {
    navigate('/evidence', { replace: true });
    return {};
  }
  const firstChapter = (ev.chapters || [])[0];
  const collected = state.collected.has(eid);

  view.className = 'view-detail';
  view.innerHTML = `
    <div class="paper detail">
      <div class="stamp">${collected ? '수집된 증거' : '미확인 증거'}</div>
      <div class="ev-kicker">증거 ${ev.id} · 첫 등장: ${firstChapter ? fmtCase(firstChapter) : '-'}</div>
      <h2 class="ev-title"></h2>
      <p class="ev-sub"></p>
      <div class="detail-summary">
        <h3>요약</h3>
        <p class="ev-summary"></p>
      </div>
      <div class="ev-attachments"></div>
      <div class="detail-actions">
        ${
          firstChapter
            ? `<a class="btn accent" href="/case/${firstChapter.slice(4)}">진술에서 확인하기 (${fmtCase(firstChapter)}) →</a>`
            : ''
        }
        <button type="button" class="btn ghost open-doc">문서 바로 열기 ↗</button>
        <a class="btn ghost" href="/evidence">← 증거 보관함으로</a>
      </div>
    </div>`;

  view.querySelector('.ev-title').textContent = ev.title;
  view.querySelector('.ev-sub').textContent = ev.subtitle || '';
  view.querySelector('.ev-summary').textContent = ev.summary || '';

  const attWrap = view.querySelector('.ev-attachments');
  (ev.attachments || []).forEach((att) => {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'att-chip';
    a.textContent = `📎 ${att.label}`;
    a.addEventListener('click', () => openDoc(att.url));
    attWrap.appendChild(a);
  });

  view.querySelector('.open-doc').addEventListener('click', () => openDoc(ev.url));
  return {};
}
