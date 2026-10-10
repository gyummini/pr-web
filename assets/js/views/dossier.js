import { DB } from '../data.js';
import { state, counts } from '../state.js';
import { openEvidencePopup } from '../popup.js';
import { autoCollectChapter, chapterEvidence } from '../collect.js';
import { unlanded } from '../ui.js';
import { navigate } from '../router.js';
import { takeLanding } from '../landing.js';
import { T, TH } from '../text.js';

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
  // 장 머리(10/10 나3): 'CASE 01 · WHY?'는 종이 위에 걸친 파일철 탭 한 줄로 묶고, 그 장의 주장(부제)을 읽는 제목으로 올린다.
  // 문구는 그대로다 — 자리와 크기만 바꿨다. EPILOGUE처럼 라벨과 이름이 같으면 한 번만 쓴다(전에는 같은 낱말이 두 번 나왔다)
  const label = chapterLabel(ch);
  const tab = ch.concept && ch.concept !== label ? `${label} · ${ch.concept}` : label;
  view.innerHTML = `
    <div class="dossier">
      <article class="paper essay filed">
        <div class="file-tab">${tab}</div>
        <span class="clip" aria-hidden="true"></span>
        <div class="stamp">${TH('dossier.stamp')}</div>
        <h2 class="chapter-claim">${ch.subtitle || ch.concept}</h2>
        <div class="essay-body">${ch.html}</div>
        <div class="chapter-nav">
          ${prev ? `<a class="btn ghost" href="${chapterPath(prev)}">← ${prev.concept}</a>` : '<span></span>'}
          ${
            next
              ? `<a class="btn accent" href="${chapterPath(next)}">${next.concept} →</a>`
              : `<a class="btn accent" href="/evidence">${TH('dossier.to_evidence')}</a>`
          }
        </div>
      </article>
      <aside class="chapter-index">
        <div class="index-title">${TH('dossier.index_title')}</div>
        ${DB.chapters
          .map(
            (c) => `
          <a class="idx ${c.id === chId ? 'active' : ''}" href="${chapterPath(c)}">
            <span class="idx-case">${chapterLabel(c)}</span>
            <span class="idx-name">${c.concept}</span>
            ${marksHtml(c.id)}
          </a>`
          )
          .join('')}
      </aside>
    </div>`;

  // 모은 흔적(10/10 다1) — 이미 모은 증거의 문장 끝에는 선으로 그린 체크, 목차의 칸은 채운다.
  // 새로 모은 증거는 배지에 내려앉는 순간(pr:landed) 같은 표시가 붙는다. 움직임 줄이기면 바로 붙는다
  const mark = (id) => {
    view.querySelectorAll(`.anchor[data-eid="${id}"]`).forEach((a) => a.classList.add('got'));
    view.querySelectorAll(`.idx-mark[data-eid="${id}"]`).forEach((m) => m.classList.add('on', 'just'));
  };
  view.querySelectorAll('.anchor').forEach((a) => {
    if (state.collected.has(a.dataset.eid) && !unlanded.has(a.dataset.eid)) a.classList.add('got');
  });
  const onLanded = (e) => mark(e.detail.id);

  // 휴대폰에서 목차가 가로 띠일 때 — 지금 장을 띠 가운데로 민다(띠만 움직이고 페이지는 그대로).
  // 다섯째 장(EPILOGUE)이 띠 밖에 숨어 있던 것은 CSS의 끝 그늘이 알린다(10/10 재채점)
  const strip = view.querySelector('.chapter-index');
  const cur = strip && strip.querySelector('.idx.active');
  if (cur && strip.scrollWidth > strip.clientWidth) {
    const sr = strip.getBoundingClientRect();
    const cr = cur.getBoundingClientRect();
    strip.scrollLeft += cr.left - sr.left - (sr.width - cr.width) / 2;
  }
  document.addEventListener('pr:landed', onLanded);

  view.querySelectorAll('.anchor').forEach((btn) => {
    const open = () => {
      btn.classList.remove('found'); // 찾아온 표시는 할 일을 마쳤다
      openEvidencePopup(btn.dataset.eid);
    };
    btn.addEventListener('click', open);
    // span 기반이므로 키보드 활성화를 직접 처리
    btn.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        open();
      }
    });
  });

  // 보관함 요약 팝업의 '자기소개서에서 확인하기'로 왔으면 그 증거의 진술 문장으로 내려가 형광펜을 두어 번 깜빡인다.
  // 라우터가 그린 뒤 장 제목에 초점을 두므로 그다음 차례에 옮긴다. 수집은 여기서 하지 않는다 — 문장을 누르는 것이 수집이다
  const want = takeLanding('dossier');
  const spot = want && [...view.querySelectorAll('.anchor')].find((a) => a.dataset.eid === want);
  if (spot) {
    setTimeout(() => {
      if (!spot.isConnected) return;
      spot.scrollIntoView({ block: 'center', behavior: 'instant' });
      spot.focus({ preventScroll: true });
      spot.classList.add('found');
    }, 0);
  }

  return {
    // 챕터 이탈 시 미클릭 증거 자동 일괄 수집 — 모든 장이 같다.
    // (10/11 사용자 결정 다2: 전에는 CASE04만 보관함에 들어갈 때 모았다 — CASE04가 마지막 장이던 때의 규칙. 마지막 장이 EPILOGUE가 된 뒤에는
    //  CASE04를 떠나도 아무 반응이 없었다)
    onLeave() {
      document.removeEventListener('pr:landed', onLanded);
      autoCollectChapter(chId);
    },
  };
}

// 목차 칸의 수집 표시 — 그 장에서 세는 증거마다 네모 하나. 모은 것은 채운다(10/10 다1). 글자 없이 모양만이라 화면 낭독기에는 감춘다
function marksHtml(chId) {
  const ids = chapterEvidence(chId).filter((e) => counts(e.id)).map((e) => e.id);
  if (!ids.length) return '';
  return `<span class="idx-marks" aria-hidden="true">${ids
    .map((id) => `<i class="idx-mark${state.collected.has(id) && !unlanded.has(id) ? ' on' : ''}" data-eid="${id}"></i>`)
    .join('')}</span>`;
}

function chapterPath(ch) {
  return ch.id === 'EPILOGUE' ? '/case/epilogue' : `/case/${ch.id.slice(4)}`;
}

function chapterLabel(ch) {
  return ch.id === 'EPILOGUE' ? T('common.epilogue_label') : T('common.case_label', { n: ch.id.slice(4) });
}
