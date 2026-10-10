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

// 누른 뒤에 볼 것(결론 한 줄 · 다음에 누를 것)이 화면 밖이면 보일 만큼만 화면을 옮긴다(10/11 사용자 결정 재5 —
// E2가 첫 시전에 판을 화면에 맞추듯, 방문자가 직접 누른 뒤에만). 1366×768 노트북에서 셋을 맞힌 뒤의 결론 · 다음 단추(E1),
// 덜어내기 · 출시 게임의 강화 단추(E3), 결론 줄(E5)이 화면 아래로 떨어져 '눌러도 아무 일이 없는' 화면이 됐다.
// 본체는 누른 직후 화면을 그린 다음에 부른다. 다 보이면 움직이지 않고, 아래로 넘쳤으면 아래 끝이 보일 만큼 내리고,
// 머리띠 밑으로 사라졌으면 그만큼 올린다(휴대폰 E3 — 표시가 화면 위로 사라졌다). 한 화면에 다 들지 않으면 첫째 것부터 보인다.
// 움직임 줄이기면 바로 옮긴다. 볼 것은 요소이거나 { top, bottom }(화면 좌표 — 아직 나타나지 않은 결론 줄의 자리를 미리 셀 때)
const REACH_GAP = 16; // 화면 끝 · 머리띠와 볼 것 사이 — '지금 누를 것' 테두리(7px 바깥)까지 보이게
function reach(targets) {
  const boxes = (targets || []).map((t) => {
    if (!t) return null;
    if (t instanceof Element) {
      if (!t.getClientRects().length) return null; // 숨은 요소
      const r = t.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    }
    return Number.isFinite(t.top) && Number.isFinite(t.bottom) ? t : null;
  }).filter(Boolean);
  if (!boxes.length) return false;
  const header = document.getElementById('site-header');
  const top0 = (header ? Math.max(0, header.getBoundingClientRect().bottom) : 0) + REACH_GAP;
  const bottom0 = window.innerHeight - REACH_GAP;
  let top = Math.min(...boxes.map((b) => b.top));
  let bottom = Math.max(...boxes.map((b) => b.bottom));
  if (bottom - top > bottom0 - top0) ({ top, bottom } = boxes[0]);
  let dy = 0;
  if (top < top0) dy = top - top0;
  else if (bottom > bottom0) dy = Math.min(bottom - bottom0, top - top0); // 아래 끝을 들이되 위 끝이 머리띠 밑으로 들어가지 않게
  if (Math.abs(dy) < 2) return false;
  window.scrollTo({ top: Math.max(0, window.scrollY + dy), behavior: reducedMotion() ? 'instant' : 'smooth' });
  return true;
}

// 등폭 라벨(원본 지면을 흉내 내는 글꼴 목록)의 한글 글꼴 Noto Sans KR(10/10 사용자 결정 가3 — 전에는 Windows가 굴림체를 꺼냈다).
// 인터랙티브 페이지가 처음 열릴 때 글꼴 CSS를 한 번만 붙인다 — 다른 화면은 받지 않는다. 글자 조각(woff2)은 그 화면에 나온 글자의 것만 받는다
const MONO_KO = '/assets/fonts/noto-sans-kr/noto-sans-kr.css';
function loadMonoKo() {
  if (document.head.querySelector(`link[href="${MONO_KO}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = MONO_KO;
  document.head.appendChild(link);
}

// 브리프로 가는 이름표(10/07 사용자 결정): 해 보는 페이지(E1 · E2 · E3 · E5)와 읽는 회고(E8 — 페이지가 곧 원문)를 가른다.
// 보관함 카드는 evidence.open_*, 진술 팝업 · 증거 상세는 common.to_interactive(같은 문구)
export function briefOpenKey(ev, where = 'card') {
  if (ev?.brief?.kind === 'retro') return 'evidence.open_retro';
  return where === 'card' ? 'evidence.open_interactive' : 'common.to_interactive';
}

export function renderBrief(view, eid) {
  const ev = getCard(eid);
  if (!ev || ev.hidden || !hasBrief(ev)) {
    navigate('/evidence', { replace: true });
    return {};
  }
  const b = ev.brief;
  const lead = b.lead || {};
  loadMonoKo();

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
  // 리드 문장이 없는 페이지(E8 — 10/07 사용자 지시로 뺐다)는 자리도 두지 않는다
  if (lead.line) view.querySelector('.brief-lead-line').textContent = lead.line;
  else view.querySelector('.brief-lead-line').remove();
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
  // 결론은 조작을 마친 뒤에 열린다(10/10 — E2도 첫 시전 뒤로 옮겨 다섯 페이지가 같다).
  // 마운트 도중에 결론을 부르는 본체가 생겨도 렌더가 끊기지 않게, play가 생기기 전의 요청은 받아 두었다가 직후에 연다
  // (play를 바로 보면 초기화 전 접근(TDZ)으로 렌더가 중간에 끊기고 라우터가 렌더 중 상태로 굳는다).
  let play = null;
  let pendingRecap = null;
  // 마운트가 끝난 뒤에 열리는 결론은 조작이 끝나서 열린 것이다 — 화면 낭독기에도 알린다.
  // showRecap보다 먼저 선언해 둔다(아래 pendingRecap 처리에서 읽는다 — 늦게 선언하면 TDZ)
  let mounted = false;
  // 넷째 값은 증거 카드 전체 — 본체가 브리프 밖의 데이터(요약 메모의 단계 이름 등)를 그대로 쓸 때(E3).
  // 다섯째는 껍데기가 빌려주는 도구 — 누른 뒤 볼 것을 화면에 들이는 reach(재5). 테스트처럼 본체만 띄우면 없다
  play = PLAYS[b.kind](view.querySelector('.brief-play'), b, (opts) => {
    if (play) showRecap(opts);
    else pendingRecap = opts || {};
  }, ev, { reach });
  if (pendingRecap) showRecap(pendingRecap);
  mounted = true;
  // 페이지 끝 단추는 둘 — 원본 문서(결론 칸)와 '포트폴리오 화면으로 돌아가기'(10/10 사용자 결정 바3, 문구는 사용자 확정).
  // '다시 해보기'는 뺐다. 진술(자기소개서)로 가는 단추는 두지 않는다(같은 결정)
  view.querySelector('.brief-foot').appendChild(link(T('brief.back'), '/evidence'));

  // opts.scroll === false — 결론을 열어도 화면을 결론으로 끌어내리지 않는다(본체가 결론 한 줄을 조작 곁에 따로 보여 줄 때)
  function showRecap(opts) {
    const r = b.recap || {};
    // 결론 칸의 세 줄은 있는 것만 둔다 — 10/07 사용자 지시로 E2는 셋 다, E5는 마지막 줄을 뺐다(빈 줄의 여백이 남지 않게)
    recapEl.replaceChildren();
    for (const [tag, cls, text] of [['h3', 'brief-recap-title', r.title], ['p', 'brief-recap-line', r.line], ['p', 'brief-closing', r.closing]]) {
      if (!text) continue;
      const node = document.createElement(tag);
      node.className = cls;
      node.textContent = text;
      recapEl.appendChild(node);
    }
    // 원본 문서는 브리프의 끝에서만 연다 — 첨부(E2 스킬 데이터 테이블 · E3 플레이 링크)는 그 옆에 그대로
    const docs = document.createElement('div');
    docs.className = 'brief-docs';
    if (ev.url) docs.appendChild(docLink(T('brief.original_doc'), 'accent', ev.url));
    (ev.attachments || []).forEach((att) => {
      docs.appendChild(docLink(att.label, 'ghost', att.url));
    });
    if (docs.childElementCount) recapEl.appendChild(docs);

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
