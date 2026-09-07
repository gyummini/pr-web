import { getCard } from '../data.js';
import { openDoc } from '../ui.js';
import { navigate } from '../router.js';
import { playFlow } from '../briefs/flow.js';
import { playCharacterCall } from '../briefs/character-call.js';
import { evidenceHeader } from '../motion/evidence-header.js';
import { animate, effects, reducedMotion } from '../motion/animate.js';

// 증거 상세 · Interactive Brief (/evidence/:id/brief).
//
// 단계 버튼으로 넘기지 않는다. 인터랙션이 본문이고, 다 하면 결론이 저절로 열린다.
// 원본 문서는 그 끝에 있다 — 발견 → 이해 → 조사 → 원본 순서를 지킨다.
//
// 껍데기(머리말·도입·결론·하단 액션)만 공통이고, 가운데는 증거마다 완전히 다르다.
// 브리프 화면은 사이트의 종이 톤을 따르지 않는다 — 팔레트를 그 증거 문서에서 가져온다.
const PLAYS = {
  flow: playFlow, // E2 — 원칙 → 요소 → 플로우 차트 → 데이터
  character_call: playCharacterCall, // E1 — 각인 → 호출 → 되감기 → 입체감
};

export function hasBrief(ev) {
  return !!(ev && ev.brief && PLAYS[ev.brief.kind]);
}

export function renderBrief(view, eid) {
  const ev = getCard(eid);
  if (!ev || ev.hidden || !hasBrief(ev)) {
    navigate('/evidence', { replace: true });
    return {};
  }
  const b = ev.brief;
  const lead = b.lead || {};

  view.className = 'view-brief';
  view.innerHTML = `
    <div class="brief">
      <div class="brief-head">
        <div class="ev-kicker"></div>
        <h2 class="ev-title"></h2>
        <p class="ev-sub"></p>
        <div class="brief-head-doc"></div>
      </div>
      <div class="brief-lead">
        <h3 class="brief-lead-title"></h3>
        <p class="brief-lead-line"></p>
        <p class="brief-notice"></p>
        <p class="brief-prompt"></p>
      </div>
      <div class="brief-play"></div>
      <div class="brief-recap" hidden></div>
      <div class="brief-foot"></div>
    </div>`;

  view.querySelector('.ev-kicker').textContent = `증거 ${ev.id} · ${ev.doc_type || ''}`;
  view.querySelector('.ev-title').textContent = ev.title;
  view.querySelector('.ev-sub').textContent = ev.subtitle || '';
  const stopCover = evidenceHeader(view.querySelector('.brief-head'), ev);
  view.querySelector('.brief-lead-title').textContent = lead.title || '';
  view.querySelector('.brief-lead-line').textContent = lead.line || '';
  view.querySelector('.brief-prompt').textContent = lead.prompt || '';
  // 브리프는 도표와 테이블이 함께 놓여야 읽히는 화면이라 넓은 화면을 전제로 만든다
  const notice = view.querySelector('.brief-notice');
  if (lead.pc_notice) notice.textContent = lead.pc_notice;
  else notice.remove();

  // 원본은 머리말에 상시 둔다. 결론까지 내려가야만 닿으면, 브리프를 건너뛰고
  // 문서만 보려는 검토자에게 인터랙션이 통행료가 된다.
  view.querySelector('.brief-head-doc').appendChild(btn('원본 문서 ↗', 'ghost', () => openDoc(ev.url)));

  const recapEl = view.querySelector('.brief-recap');
  const play = PLAYS[b.kind](view.querySelector('.brief-play'), b, showRecap);
  view.querySelector('.brief-foot').appendChild(link('← 증거 보관함', '/evidence'));

  // opts.scroll === false — 브리프가 처음부터 결론을 열어 둘 때 쓴다.
  // 화면을 연 사람을 결론으로 끌어내리지 않는다.
  function showRecap(opts) {
    const r = b.recap || {};
    recapEl.innerHTML = `
      <h3 class="brief-recap-title"></h3>
      <p class="brief-recap-line"></p>
      <p class="brief-closing"></p>
      <div class="brief-docs"></div>`;
    recapEl.querySelector('.brief-recap-title').textContent = r.title || '';
    recapEl.querySelector('.brief-recap-line').textContent = r.line || '';
    recapEl.querySelector('.brief-closing').textContent = r.closing || '';

    // 원본 문서는 브리프의 끝에서만 연다
    const docs = recapEl.querySelector('.brief-docs');
    docs.appendChild(btn('원본 문서 ↗', 'accent', () => openDoc(ev.url)));
    (ev.attachments || []).forEach((att) => {
      docs.appendChild(btn(att.label, 'ghost', () => openDoc(att.url)));
    });
    docs.appendChild(btn('다시 해보기', 'ghost', () => play.restart(hideRecap)));

    recapEl.hidden = false;
    recapEl.classList.add('on');
    animate(recapEl, effects.slide);
    if (!opts || opts.scroll !== false) {
      recapEl.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'nearest' });
    }
  }

  function hideRecap() {
    recapEl.hidden = true;
    recapEl.classList.remove('on');
    recapEl.textContent = '';
  }

  function btn(label, kind, onClick) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `btn ${kind}`;
    el.textContent = label;
    el.addEventListener('click', onClick);
    return el;
  }

  function link(label, href) {
    const a = document.createElement('a');
    a.className = 'btn ghost';
    a.href = href;
    a.textContent = label;
    return a;
  }

  return { destroy: () => { stopCover(); play.destroy(); } };
}
