import { DB } from '../data.js';
import { state } from '../state.js';
import { DialogueEngine } from '../engine.js';
import { standingSprite } from '../sprites.js';
import { navigate, currentRoute } from '../router.js';

// 시작 페이지 (명세서 2-1). SKIP은 첫 프레임부터 상시 노출.
// 선택지 없는 단일 동선 — 대사가 끝나거나 SKIP하면 기본 사항으로 이동한다.

// 첫 진입 오프닝 타이밍. CSS 애니메이션과 동기이며 총 0.8s (요구 상한 1.2s 이내).
const OPEN_HOLD_MS = 300;   // 표지를 읽을 정지 시간
const OPEN_TURN_MS = 500;   // 표지가 왼쪽 축으로 열리는 시간
const CLUE_AT_MS = 500;     // 배경 페이드인(300ms 시작)보다 반 박자 늦게 클루 등장
const DIALOGUE_AT_MS = 650; // 스탠딩이 떠오른 뒤 대사창 등장 → 대사 재생

export function renderIntro(view) {
  // 세션 내 재진입: 대사를 다시 재생하지 않고 곧바로 기본 사항으로
  if (state.introSeen) {
    // replace — 뒤로가기가 인트로에 다시 걸려 되돌아오지 못하는 상황을 막는다
    navigate('/basic', { replace: true });
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
    // 대사 재생 중 사용자가 이미 다른 곳으로 이동했다면 끌어오지 않는다
    const at = currentRoute();
    if (at === '/intro' || at === '/') {
      navigate('/basic');
    }
  };

  // 첫 대사의 표정을 미리 띄워 스탠딩만 먼저 페이드인시킨다.
  // setSprite는 같은 키면 무시되므로 이후 play()가 다시 트리거하지 않는다.
  const showClue = () => {
    const first = (DB.intro.lines || []).find((l) => l.sprite);
    if (first) engine.setSprite(first.sprite);
  };

  let started = false;
  const startDialogue = () => {
    if (started) return;
    started = true;
    showClue();
    // 스크립트에 choice 블록이 없으므로 재생 종료 → onComplete → 기본 사항.
    engine.play(DB.intro.lines, { onComplete: goNext });
  };

  // 첫 진입 오프닝. reduced-motion이면 통째로 생략하고 인트로를 즉시 표시한다.
  // 인트로 DOM은 위에서 이미 렌더됐고 표지가 그 위를 덮을 뿐이라, 콘텐츠 준비가 늦어지지 않는다.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const opening = reduced ? null : buildOpening();
  const timers = [];
  let openingDone = false;

  const onKey = () => {
    endOpening();
    startDialogue();
  };

  const endOpening = () => {
    if (openingDone) return;
    openingDone = true;
    timers.splice(0).forEach(clearTimeout);
    document.removeEventListener('keydown', onKey);
    view.classList.remove('opening-active');
    if (opening) opening.remove();
  };

  view.querySelector('.skip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    // 오프닝 중이라도 SKIP은 즉시 동작해야 한다. play() 이후여야 종료 콜백이 걸린다.
    endOpening();
    startDialogue();
    engine.skip();
  });

  if (reduced) {
    startDialogue();
    return { destroy: () => engine.destroy() };
  }

  view.appendChild(opening);
  view.classList.add('opening-active');

  // 화면 아무 곳이나 클릭·탭·키 입력 → 잔여 애니메이션 생략하고 인트로로
  opening.addEventListener('click', (e) => {
    e.stopPropagation();
    onKey();
  });
  document.addEventListener('keydown', onKey);

  timers.push(setTimeout(showClue, CLUE_AT_MS));
  timers.push(
    setTimeout(() => {
      startDialogue();
      // 대사가 시작된 뒤에는 남은 표지 회전이 입력을 가로채지 않게 한다
      document.removeEventListener('keydown', onKey);
      opening.classList.add('through');
    }, DIALOGUE_AT_MS)
  );
  timers.push(setTimeout(endOpening, OPEN_HOLD_MS + OPEN_TURN_MS));

  return {
    destroy: () => {
      timers.splice(0).forEach(clearTimeout);
      document.removeEventListener('keydown', onKey);
      engine.destroy();
    },
  };
}

// 사건 파일 표지 — 새 에셋 없이 기존 종이 톤·세리프 타이포·도장 컴포넌트만 사용
function buildOpening() {
  const el = document.createElement('div');
  el.className = 'opening';
  el.innerHTML = `
    <div class="opening-cover">
      <div class="opening-kicker">CASE FILE</div>
      <div class="opening-title">지원자 김경민</div>
      <div class="opening-foot">게임 기획 · 2026</div>
      <div class="stamp opening-stamp">CONFIDENTIAL</div>
    </div>`;
  return el;
}
