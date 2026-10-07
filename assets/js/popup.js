import { DB, getCard } from './data.js';
import { state } from './state.js';
import { DialogueEngine } from './engine.js';
import { standingSprite } from './sprites.js';
import { addPending, landOne, flyFromRect } from './ui.js';
import { checkChapterToasts, fmtCase } from './collect.js';
import { navigate } from './router.js';
import { hasMemo, renderMemo } from './memo.js';
import { hasBrief, briefOpenKey } from './views/brief.js';
import { T, TH } from './text.js';

// 닫기 단추의 ✕ — 글자 기호 대신 선 두께가 정해진 그림으로 그린다(글꼴마다 굵기 · 위치가 달랐다)
const CLOSE_ICON =
  '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">' +
  '<path d="M2 2l10 10M12 2L2 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// 한 번에 하나만 연다 — 앵커에서 Enter를 두 번 누르면 같은 팝업이 겹쳐 열리던 것(10/06 점검)
let openOverlay = null;

// 앵커(증거) 팝업 (명세서 2-3). 클릭한 앵커는 즉시 수집, 닫을 때 수집 애니메이션.
export function openEvidencePopup(eid) {
  if (openOverlay && openOverlay.isConnected) return;
  const ev = getCard(eid);
  if (!ev || ev.hidden) return;

  const wasNew = !state.collected.has(eid);
  if (wasNew) {
    state.collected.add(eid);
    addPending(1);
  }

  // 재클릭 시 sd_dialogue_revisit (null이면 sd_dialogue 재사용)
  const useRevisit = !wasNew && !!ev.sd_dialogue_revisit;
  const withMemo = hasMemo(ev);
  const dlgText = useRevisit ? ev.sd_dialogue_revisit : ev.sd_dialogue;
  const sprite = useRevisit ? 'surprised' : 'normal';

  // 닫으면 초점을 이 자리(누른 앵커)로 돌려준다 — 키보드로 읽던 곳에서 이어 가게
  const returnFocus = document.activeElement;

  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="popup" role="dialog" aria-modal="true" aria-labelledby="ev-pop-title" tabindex="-1">
      <button type="button" class="popup-close" aria-label="${TH('popup.close')}">${CLOSE_ICON}</button>
      <div class="popup-sd"><div class="sd-engine"></div></div>
      <div class="popup-body">
        <div class="ev-kicker">${TH('popup.kicker', { id: ev.id, chapters: (ev.chapters || []).map(fmtCase).join(', ') })}</div>
        <h3 class="ev-title" id="ev-pop-title"></h3>
        <p class="ev-sub"></p>
        <div class="ev-memo"></div>
        <p class="ev-summary"></p>
        <div class="popup-actions"></div>
      </div>
    </div>`;
  overlay.querySelector('.ev-title').textContent = ev.title;
  overlay.querySelector('.ev-sub').textContent = ev.subtitle || '';
  overlay.querySelector('.ev-summary').textContent = ev.summary || '';

  // 메모가 있으면 그것이 요약을 대신한다. 긴 요약문은 증거 상세 페이지에 그대로 남아 있다.
  if (withMemo) {
    overlay.querySelector('.popup').classList.add('has-memo');
    renderMemo(overlay.querySelector('.ev-memo'), ev);
  }

  root.appendChild(overlay);
  openOverlay = overlay;
  document.documentElement.classList.add('modal-open');
  const card = overlay.querySelector('.popup');
  // 초점을 팝업 자체로 — 제목(aria-labelledby)이 읽히고, 위아래 키 · Space로 바로 스크롤된다.
  // 맨 아래 버튼으로 옮기면 긴 메모가 끝까지 스크롤되어 처음이 가려진다.
  card.focus({ preventScroll: true });

  let engine = null;
  if (dlgText) {
    // 메모가 길어 왼쪽 칸이 높아졌다 — SD 대신 기본 스탠딩으로 채운다.
    // SD는 메모 위에 붙인 스크랩 사진으로 옮겼다 (memo.js).
    // 대사는 한 줄뿐이고 버튼이 따로 있다 — 키보드는 버튼과 스크롤에 맡긴다.
    // 휴대폰에서는 대사가 메모 위에 띠로 놓인다 — 높이를 먼저 잡아 메모가 밀리지 않게 한다.
    engine = new DialogueEngine(overlay.querySelector('.sd-engine'), {
      resolveSprite: standingSprite,
      mode: 'standing',
      keyboard: false,
      reserveText: true,
    });
    engine.play([{ speaker: T('popup.speaker'), sprite, text: dlgText }], { holdEnd: true });
  }

  let closed = false;
  // restoreFocus: 뒤로 가기로 닫힐 때는 곧 사라질 진술 문장으로 초점을 돌려주지 않는다
  const close = (restoreFocus = true) => {
    if (closed) return;
    closed = true;
    openOverlay = null;
    document.documentElement.classList.remove('modal-open');
    const rect = card.getBoundingClientRect();
    if (engine) engine.destroy();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('popstate', onBack);
    overlay.remove();
    if (restoreFocus && returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    // 팝업 닫기: 페이지 이동 없음, 읽던 위치 유지. 새 수집이면 탭으로 날아가는 애니메이션.
    if (wasNew) {
      const from = {
        left: rect.left + rect.width / 2 - 30,
        top: rect.top + rect.height / 2 - 30,
        width: 60,
        height: 60,
      };
      flyFromRect(from, () => {
        landOne();
        checkChapterToasts();
      });
    }
  };

  const onKey = (e) => {
    if (e.code === 'Escape') close();
    else if (e.key === 'Tab') keepFocusInside(e, card);
  };
  document.addEventListener('keydown', onKey);
  // 뒤로 가기(휴대폰 뒤로 제스처 포함)로 다른 페이지가 되면 팝업도 닫는다 — 열린 채 남아 다른 진술을 덮던 것(10/06 재점검)
  const onBack = () => close(false);
  window.addEventListener('popstate', onBack);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.popup-close').addEventListener('click', close);

  // 발견 → 이해 → 수집 → (원하면) 조사. 원본 문서와 첨부는 여기서 열지 않는다 —
  // 그 자리는 브리프의 끝이다. 팝업은 자소서를 읽는 중에 뜨므로 갈림길을 둘로만 둔다.
  const actions = overlay.querySelector('.popup-actions');
  const deeper = hasBrief(ev)
    ? action(T(briefOpenKey(ev, 'popup')), wasNew ? 'ghost' : 'accent', () => {
        close();
        navigate(`/evidence/${ev.id}/interactive`);
      })
    : null;

  if (wasNew) {
    actions.appendChild(action(T('popup.collect'), 'accent', close)); // 닫히며 수집 애니메이션
    if (deeper) actions.appendChild(deeper);
  } else if (deeper) {
    actions.appendChild(deeper);
    actions.appendChild(action(T('popup.close'), 'ghost', close));
  } else {
    actions.appendChild(action(T('popup.close'), 'accent', close));
  }
}

// Tab이 팝업 밖(뒤의 진술 · 머리말)으로 나가지 않게 처음과 끝을 잇는다.
// 팝업 자체에 초점이 있을 때 Tab은 브라우저에 맡긴다 — 다음 차례가 곧 팝업 안의 첫 단추다.
function keepFocusInside(e, card) {
  const items = [...card.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')].filter(
    (n) => n.getClientRects().length
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const at = document.activeElement;
  if (e.shiftKey ? at === first || at === card || !card.contains(at) : at === last || !card.contains(at)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
}

function action(label, kind, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn ${kind}`;
  b.textContent = label;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}
