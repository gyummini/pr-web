import { DB, getCard } from './data.js';
import { state } from './state.js';
import { DialogueEngine } from './engine.js';
import { sdSprite } from './sprites.js';
import { addPending, landOne, flyFromRect, openDoc } from './ui.js';
import { checkChapterToasts, fmtCase } from './collect.js';

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
        <p class="ev-summary"></p>
        <div class="ev-attachments"></div>
        <div class="popup-actions">
          <button type="button" class="btn accent open-doc">문서 열기 ↗</button>
          <button type="button" class="btn ghost close-doc">닫기</button>
        </div>
      </div>
    </div>`;
  overlay.querySelector('.ev-title').textContent = ev.title;
  overlay.querySelector('.ev-sub').textContent = ev.subtitle || '';
  overlay.querySelector('.ev-summary').textContent = ev.summary || '';

  const attWrap = overlay.querySelector('.ev-attachments');
  (ev.attachments || []).forEach((att) => {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'att-chip';
    a.textContent = `📎 ${att.label}`;
    a.addEventListener('click', (e) => {
      e.stopPropagation();
      openDoc(att.url);
    });
    attWrap.appendChild(a);
  });

  root.appendChild(overlay);

  let engine = null;
  if (dlgText) {
    engine = new DialogueEngine(overlay.querySelector('.sd-engine'), {
      resolveSprite: sdSprite,
      mode: 'sd',
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
  overlay.querySelector('.close-doc').addEventListener('click', close);
  overlay.querySelector('.open-doc').addEventListener('click', (e) => {
    e.stopPropagation();
    openDoc(ev.url); // 외부 링크 새 탭
  });
}
