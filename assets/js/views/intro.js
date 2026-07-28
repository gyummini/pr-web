import { DB } from '../data.js';
import { state } from '../state.js';
import { DialogueEngine } from '../engine.js';
import { standingSprite } from '../sprites.js';

// 시작 페이지 (명세서 2-1). SKIP은 첫 프레임부터 상시 노출.
// 선택지 없는 단일 동선 — 대사가 끝나거나 SKIP하면 기본 사항으로 이동한다.
export function renderIntro(view) {
  // 세션 내 재진입: 대사를 다시 재생하지 않고 곧바로 기본 사항으로
  if (state.introSeen) {
    location.replace('#/basic');
    return {};
  }
  state.introSeen = true;

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

  const goNext = () => {
    if (location.hash === '#/intro' || location.hash === '' || location.hash === '#/') {
      location.hash = '#/basic';
    }
  };

  // 스크립트에 choice 블록이 없으므로 재생 종료 → onComplete → 기본 사항.
  // SKIP도 엔진 내부에서 동일한 종료 경로를 탄다.
  engine.play(DB.intro.lines, { onComplete: goNext });

  view.querySelector('.skip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    engine.skip();
  });

  return { destroy: () => engine.destroy() };
}
