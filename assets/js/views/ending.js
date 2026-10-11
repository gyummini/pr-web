import { DB } from '../data.js';
import { state, baseUnlocked } from '../state.js';
import { DialogueEngine } from '../engine.js';
import { standingSprite } from '../sprites.js';
import { syncBadge, dismissUnlockToast } from '../ui.js';
import { navigate } from '../router.js';
import { TH } from '../text.js';

// 히든 해금 엔딩 대화 (명세서 2-5). 시작 페이지와 동일한 대사 엔진 재사용.
export function renderEnding(view) {
  if (!baseUnlocked()) {
    navigate('/evidence', { replace: true });
    return {};
  }
  dismissUnlockToast();

  view.className = 'view-ending';
  view.innerHTML = `
    <div class="scene">
      <button type="button" class="skip-btn">${TH('common.skip')}</button>
      <div class="engine-root"></div>
    </div>`;

  const engine = new DialogueEngine(view.querySelector('.engine-root'), {
    resolveSprite: standingSprite,
    mode: 'standing',
  });

  const finish = () => {
    state.endingSeen = true;
    state.collected.add('E8'); // 히든 증거 수집 완료 → 8/8
    syncBadge();
    // on_complete: open_evidence E8 — 목적지는 E8 카드의 내부 라우트
    const hidden = DB.cards.find((c) => c.hidden);
    // 내부 라우트는 '/'로 시작한다 (외부 문서는 https://...)
    navigate(hidden && hidden.url && hidden.url.startsWith('/') ? hidden.url : '/notebook');
  };

  engine.play(DB.ending.lines, { onComplete: finish });

  view.querySelector('.skip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    engine.skip(); // 엔딩에는 choice가 없으므로 즉시 종료 → 제작기
  });

  return { destroy: () => engine.destroy() };
}
