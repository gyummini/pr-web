import { DB } from '../data.js';
import { state } from '../state.js';
import { DialogueEngine } from '../engine.js';
import { standingSprite } from '../sprites.js';
import { unlockAll } from '../collect.js';

// 시작 페이지 (명세서 2-1). SKIP은 첫 프레임부터 상시 노출.
export function renderIntro(view) {
  view.className = 'view-intro';
  view.innerHTML = `
    <div class="scene">
      <button type="button" class="skip-btn">SKIP ≫</button>
      <div class="engine-root"></div>
    </div>`;

  const engine = new DialogueEngine(view.querySelector('.engine-root'), {
    resolveSprite: standingSprite,
    mode: 'standing',
  });

  const onChoice = (opt) => {
    if (opt.goto === 'evidence_all_unlocked') {
      unlockAll();
      location.hash = '#/evidence';
    } else if (opt.goto === 'basic') {
      location.hash = '#/basic'; // 직접 수사: 기본 사항(신상 조서)부터
    } else {
      location.hash = '#/case/01';
    }
  };

  const revisit = state.introSeen;
  state.introSeen = true;
  if (revisit) {
    // 세션 내 재진입: 대사 자동 스킵, 선택지만 표시
    engine.playFromChoice(DB.intro.lines, { onChoice });
  } else {
    engine.play(DB.intro.lines, { onChoice });
  }

  view.querySelector('.skip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    engine.skip();
  });

  return { destroy: () => engine.destroy() };
}
