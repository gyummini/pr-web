import { DB, getCard } from './data.js';
import { state } from './state.js';
import { DialogueEngine } from './engine.js';
import { standingSprite } from './sprites.js';
import { addPending, landOne, flyFromRect } from './ui.js';
import { checkChapterToasts, fmtCase } from './collect.js';
import { navigate } from './router.js';
import { hasMemo, renderMemo } from './memo.js';
import { hasBrief } from './views/brief.js';

// 앵커(증거) 팝업 (명세서 2-3). 클릭한 앵커는 즉시 수집, 닫을 때 수집 애니메이션.
export function openEvidencePopup(eid) {
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

  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="popup" role="dialog" aria-modal="true">
      <button type="button" class="popup-close" aria-label="닫기">✕</button>
      <div class="popup-sd"><div class="sd-engine"></div></div>
      <div class="popup-body">
        <div class="ev-kicker">증거 ${ev.id} · ${(ev.chapters || []).map(fmtCase).join(', ')}</div>
        <h3 class="ev-title"></h3>
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

  let engine = null;
  if (dlgText) {
    // 메모가 길어 왼쪽 칸이 높아졌다 — SD 대신 기본 스탠딩으로 채운다.
    // SD는 메모 위에 붙인 스크랩 사진으로 옮겼다 (memo.js).
    engine = new DialogueEngine(overlay.querySelector('.sd-engine'), {
      resolveSprite: standingSprite,
      mode: 'standing',
    });
    engine.play([{ speaker: '클루', sprite, text: dlgText }], { holdEnd: true });
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    const card = overlay.querySelector('.popup');
    const rect = card.getBoundingClientRect();
    if (engine) engine.destroy();
    document.removeEventListener('keydown', onEsc);
    overlay.remove();
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

  const onEsc = (e) => {
    if (e.code === 'Escape') close();
  };
  document.addEventListener('keydown', onEsc);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.popup-close').addEventListener('click', close);

  // 발견 → 이해 → 수집 → (원하면) 조사. 원본 문서와 첨부는 여기서 열지 않는다 —
  // 그 자리는 브리프의 끝이다. 팝업은 자소서를 읽는 중에 뜨므로 갈림길을 둘로만 둔다.
  const actions = overlay.querySelector('.popup-actions');
  const deeper = hasBrief(ev)
    ? action('더 자세히 살펴보기 →', wasNew ? 'ghost' : 'accent', () => {
        close();
        navigate(`/evidence/${ev.id}/brief`);
      })
    : null;

  if (wasNew) {
    actions.appendChild(action('증거 수집', 'accent', close)); // 닫히며 수집 애니메이션
    if (deeper) actions.appendChild(deeper);
  } else if (deeper) {
    actions.appendChild(deeper);
    actions.appendChild(action('닫기', 'ghost', close));
  } else {
    actions.appendChild(action('닫기', 'accent', close));
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
