import { getCard } from '../data.js';
import { openDoc } from '../ui.js';
import { navigate } from '../router.js';
import { playFlow } from '../briefs/flow.js';
import { playCharacterCall } from '../briefs/character-call.js';
import { playCutPlay } from '../briefs/cut-play.js';
import { playOneCard } from '../briefs/one-card.js';
import { playRetro } from '../briefs/retro.js';
import { evidenceHeader } from '../motion/evidence-header.js';
import { animate, effects, reducedMotion } from '../motion/animate.js';
import { T } from '../text.js';

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
  cut_play: playCutPlay, // E3 — 처음 게임을 해 보고, 채굴·경제를 덜어내고, 출시한 게임을 해 본다
  one_card: playOneCard, // E5 — 같은 여정 두 개, 카드 한 장 차이
  retro: playRetro, // E8 — 인터랙션 없이 읽는 개발 회고. 브리프가 곧 원문이다
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
  if (b.kind === 'cut_play') view.classList.add('view-cut-play');
  if (b.kind === 'one_card') view.classList.add('view-one-card');
  if (b.kind === 'retro') view.classList.add('view-retro');
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
      <p class="sr-only" role="status"></p>
    </div>`;

  view.querySelector('.ev-kicker').textContent = T('brief.kicker', { id: ev.id, type: ev.doc_type || '' });
  view.querySelector('.ev-title').textContent = ev.title;
  view.querySelector('.ev-sub').textContent = ev.subtitle || '';
  const stopCover = evidenceHeader(view.querySelector('.brief-head'), ev);
  view.querySelector('.brief-lead-title').textContent = lead.title || '';
  view.querySelector('.brief-lead-line').textContent = lead.line || '';
  // 안내를 머리말 구석의 회색 알약에 두면 공지처럼 읽히고 누를 것과 멀다(10/03 피드백).
  // prompt_at: 'action'인 요약 페이지는 본체가 첫 행동 옆에 직접 붙인다 — 문구는 같다.
  const prompt = view.querySelector('.brief-prompt');
  if (lead.prompt_at === 'action') prompt.remove();
  else prompt.textContent = lead.prompt || '';
  // 브리프는 도표와 테이블이 함께 놓여야 읽히는 화면이라 넓은 화면을 전제로 만든다
  const notice = view.querySelector('.brief-notice');
  if (lead.pc_notice) notice.textContent = lead.pc_notice;
  else notice.remove();

  // 원본은 머리말에 상시 둔다. 결론까지 내려가야만 닿으면, 브리프를 건너뛰고
  // 문서만 보려는 검토자에게 인터랙션이 통행료가 된다.
  // 브리프가 곧 원문인 증거(E8)는 따로 열 원본이 없다
  if (ev.url) view.querySelector('.brief-head-doc').appendChild(docLink(T('brief.original_doc'), 'ghost', ev.url));

  const recapEl = view.querySelector('.brief-recap');
  const status = view.querySelector('.brief > [role="status"]');
  // 마운트 도중에 결론을 여는 브리프가 있다(E2 — 처음부터 열어 둔다). 그때는 play가 아직 없어
  // 다시 해보기를 둘지 모르므로, 요청만 받아 두었다가 play가 생긴 직후에 연다.
  // play를 바로 보면 초기화 전 접근(TDZ)으로 렌더가 중간에 끊기고 라우터가 렌더 중 상태로 굳는다.
  let play = null;
  let pendingRecap = null;
  // 마운트가 끝난 뒤에 열리는 결론은 조작이 끝나서 열린 것이다 — 화면 낭독기에도 알린다(처음부터 열어 두는 E2는 알리지 않는다).
  // showRecap보다 먼저 선언해 둔다(아래 pendingRecap 처리에서 읽는다 — 늦게 선언하면 TDZ)
  let mounted = false;
  play = PLAYS[b.kind](view.querySelector('.brief-play'), b, (opts) => {
    if (play) showRecap(opts);
    else pendingRecap = opts || {};
  });
  if (pendingRecap) showRecap(pendingRecap);
  mounted = true;
  view.querySelector('.brief-foot').appendChild(link(T('brief.back'), '/evidence'));

  // opts.scroll === false — 브리프가 처음부터 결론을 열어 둘 때 쓴다.
  // 화면을 연 사람을 결론으로 끌어내리지 않는다.
  function showRecap(opts) {
    if (opts?.hide) { hideRecap(); return; }
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
    if (ev.url) docs.appendChild(docLink(T('brief.original_doc'), 'accent', ev.url));
    (ev.attachments || []).forEach((att) => {
      docs.appendChild(docLink(att.label, 'ghost', att.url));
    });
    if (play.restart) docs.appendChild(btn(T('brief.restart'), 'ghost', () => play.restart(hideRecap)));

    recapEl.hidden = false;
    recapEl.classList.add('on');
    animate(recapEl, effects.slide);
    if (mounted) {
      status.textContent = '';
      setTimeout(() => (status.textContent = [r.title, r.line].filter(Boolean).join(' — ')), 40);
    }
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

  // 원본 문서 · 첨부는 버튼이 아니라 링크다 — 가운데 클릭 · 주소 복사 · 새 탭이 브라우저대로 된다(10/06 점검).
  // 아직 주소가 없는 문서(PLACEHOLDER)만 예전처럼 안내 알림을 띄운다
  function docLink(label, kind, url) {
    const a = document.createElement('a');
    a.className = `btn ${kind}`;
    a.textContent = label;
    a.target = '_blank';
    a.rel = 'noopener';
    const pending = !url || String(url).startsWith('PLACEHOLDER');
    a.href = pending ? '#' : url;
    if (pending) a.addEventListener('click', (e) => { e.preventDefault(); openDoc(url); });
    return a;
  }

  return { destroy: () => { stopCover(); play.destroy(); } };
}
