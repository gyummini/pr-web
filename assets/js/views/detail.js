import { getCard } from '../data.js';
import { state } from '../state.js';
import { openDoc } from '../ui.js';
import { fmtCase } from '../collect.js';
import { navigate } from '../router.js';
import { hasBrief, briefOpenKey } from './brief.js';
import { evidenceHeader } from '../motion/evidence-header.js';
import { T, TH } from '../text.js';

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
      <div class="stamp">${TH(collected ? 'detail.stamp_collected' : 'detail.stamp_unknown')}</div>
      <div class="ev-kicker">${TH('detail.kicker', { id: ev.id, chapter: firstChapter ? fmtCase(firstChapter) : T('detail.no_chapter') })}</div>
      <h2 class="ev-title"></h2>
      <p class="ev-sub"></p>
      <div class="detail-summary">
        <h3>${TH('detail.summary')}</h3>
        <p class="ev-summary"></p>
      </div>
      <div class="ev-attachments"></div>
      <div class="detail-actions">
        ${
          firstChapter
            ? `<a class="btn accent" href="/case/${firstChapter.slice(4)}">${TH('detail.to_statement', { case: fmtCase(firstChapter) })}</a>`
            : ''
        }
        ${
          // 이미 수집한 증거를 주소로 직접 열었을 때 — 조사로 바로 갈 수 있어야 한다.
          // 페이지가 곧 원문인 증거(E8)는 수집 여부와 상관없이 이 버튼 하나로 연다(아래 '문서 바로 열기 ↗'와 같은 곳이라 겹치지 않게)
          (collected || !ev.url) && hasBrief(ev)
            ? `<a class="btn accent" href="/evidence/${ev.id}/interactive">${TH(briefOpenKey(ev, 'detail'))}</a>`
            : ''
        }
        ${hasBrief(ev) && !ev.url ? '' : `<button type="button" class="btn ghost open-doc">${TH('detail.open_doc')}</button>`}
        <a class="btn ghost" href="/evidence">${TH('common.back_to_evidence')}</a>
      </div>
    </div>`;

  view.querySelector('.ev-title').textContent = ev.title;
  view.querySelector('.ev-sub').textContent = ev.subtitle || '';
  view.querySelector('.ev-summary').textContent = ev.summary || '';
  const stopCover = evidenceHeader(view.querySelector('.detail'), ev);

  const attWrap = view.querySelector('.ev-attachments');
  (ev.attachments || []).forEach((att) => {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'att-chip';
    a.textContent = `📎 ${att.label}`;
    a.addEventListener('click', () => openDoc(att.url));
    attWrap.appendChild(a);
  });

  // 브리프가 곧 원문인 증거(E8)는 위의 '회고 읽기' 버튼 하나만 둔다 — 원본 문서 버튼이 없다
  view.querySelector('.open-doc')?.addEventListener('click', () => (ev.url || !hasBrief(ev) ? openDoc(ev.url) : navigate(`/evidence/${ev.id}/interactive`)));
  return { destroy: stopCover };
}
