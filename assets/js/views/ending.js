import { DB } from '../data.js';
import { state, baseUnlocked } from '../state.js';
import { DialogueEngine } from '../engine.js';
import { standingSprite } from '../sprites.js';
import { syncBadge } from '../ui.js';

// 히든 해금 엔딩 대화 (명세서 2-5). 시작 페이지와 동일한 대사 엔진 재사용.
export function renderEnding(view) {
  if (!baseUnlocked()) {
    location.hash = '#/evidence';
    return {};
  }

  view.className = 'view-ending';
  view.innerHTML = `
    <div class="scene">
      <button type="button" class="skip-btn">SKIP ≫</button>
      <div class="engine-root"></div>
    </div>`;

  const engine = new DialogueEngine(view.querySelector('.engine-root'), {
    resolveSprite: standingSprite,
    mode: 'standing',
  });

  const finish = () => {
    state.endingSeen = true;
    state.collected.add('E7'); // 히든 증거 수집 완료 → 7/7
    syncBadge();
    // on_complete: open_evidence E7 — 목적지는 E7 카드의 내부 라우트
    const e7 = DB.cards.find((c) => c.hidden);
    location.hash = e7 && e7.url && e7.url.startsWith('#/') ? e7.url : '#/notebook';
  };

  engine.play(DB.ending.lines, { onComplete: finish });

  view.querySelector('.skip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    engine.skip(); // 엔딩에는 choice가 없으므로 즉시 종료 → 제작기
  });

  return { destroy: () => engine.destroy() };
}
