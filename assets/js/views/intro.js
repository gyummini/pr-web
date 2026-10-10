import { DB } from '../data.js';
import { state } from '../state.js';
import { DialogueEngine } from '../engine.js';
import { standingSprite } from '../sprites.js';
import { navigate, currentRoute } from '../router.js';
import { TH } from '../text.js';

// 시작 페이지 (명세서 2-1). SKIP은 첫 프레임부터 상시 노출.
// 선택지 없는 단일 동선 — 대사가 끝나거나 SKIP하면 기본 사항으로 이동한다.

// 첫 진입 오프닝 타이밍(10/10 나1). 표지는 index.html에 있어 첫 프레임부터 보인다 — 데이터를 받는 동안에도 표지다.
// 표지가 첫 화면부터 0.7초(데이터가 늦으면 받은 뒤 0.25초)는 보인 다음 0.5초에 걸쳐 열린다. 전에는 데이터를 받는 0.2초 남짓 빈 화면이 먼저 뜨고,
// 표지는 약 0.2초만 온전히 보였다. 열리는 길이 · 순서는 그대로(7/30 결정: 1.2초 이하, CSS만, 누르면 건너뜀)
const COVER_MIN_MS = 700;   // 페이지를 연 때부터 표지를 읽을 시간
const COVER_AFTER_MS = 250; // 데이터가 늦게 왔을 때 받은 뒤 더 보이는 시간
const OPEN_TURN_MS = 500;   // 표지가 왼쪽 축으로 열리는 시간(CSS coverOpen과 같다)
const CLUE_AFTER_MS = 200;  // 열리기 시작한 뒤 클루 등장
const DIALOGUE_AFTER_MS = 350; // 스탠딩이 떠오른 뒤 대사창 등장 → 대사 재생

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
      <button type="button" class="skip-btn">${TH('common.skip')}</button>
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
    // 한국 시간 밤(html.night — index.html 머리 스크립트가 붙인다)에는 대사의 밤 판(night_text)을 쓴다.
    // 지금은 첫 대사만 있다(10/11 사용자 요청 — 밤 사무소 그림과 짝)
    const night = document.documentElement.classList.contains('night');
    const lines = (DB.intro.lines || []).map((l) => (night && l.night_text ? { ...l, text: l.night_text } : l));
    engine.play(lines, { onComplete: goNext });
  };

  // 첫 진입 오프닝 — index.html의 표지(#boot-cover)를 받아 넘긴다. 첫 진입(/ · /intro)이 아니거나 움직임 줄이기면 표지가 없다.
  // 인트로 DOM은 위에서 이미 렌더됐고 표지가 그 위를 덮을 뿐이라, 콘텐츠 준비가 늦어지지 않는다.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const boot = document.getElementById('boot-cover');
  const opening = !reduced && boot && document.documentElement.classList.contains('boot-cover') ? boot : null;
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
    view.classList.remove('opening-active', 'opening-turn');
    removeCover();
  };

  // 표지 위의 SKIP(첫 프레임부터 누를 수 있다) — 스크립트가 늦으면 /basic 링크 그대로, 라우터가 뜬 뒤에는 라우터가 받는다. 표지는 떠날 때 지운다
  view.querySelector('.skip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    // 오프닝 중이라도 SKIP은 즉시 동작해야 한다. play() 이후여야 종료 콜백이 걸린다.
    endOpening();
    startDialogue();
    engine.skip();
  });

  // 작업 중이라는 양해를 먼저 전한다. 표지가 열리기 전에 세우는 이유 —
  // 오프닝이 돌기 시작하면 0.8초 뒤 대사가 이어져, 읽을 틈 없이 지나간다.
  // 데이터에서 notice를 지우거나 notice.off를 true로 두면 이 단계는 통째로 사라진다(문구는 데이터에 남는다).
  const notice = DB.intro.notice;
  if (notice && !notice.off && !state.noticeSeen) {
    const memo = buildNotice(notice);
    view.appendChild(memo);
    view.classList.add('notice-active');
    const go = () => {
      state.noticeSeen = true;
      document.removeEventListener('keydown', onNoticeKey);
      memo.remove();
      view.classList.remove('notice-active');
      begin();
    };
    const onNoticeKey = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') go();
    };
    memo.querySelector('.notice-ok').addEventListener('click', go);
    document.addEventListener('keydown', onNoticeKey);
    memo.querySelector('.notice-ok').focus();
    removeCover(); // 메모가 먼저 서는 길(지금은 꺼 둠)에서는 표지를 쓰지 않는다
    return {
      destroy: () => {
        document.removeEventListener('keydown', onNoticeKey);
        timers.splice(0).forEach(clearTimeout);
        document.removeEventListener('keydown', onKey);
        engine.destroy();
      },
    };
  }

  begin();

  function begin() {
  if (!opening) {
    removeCover();
    startDialogue();
    return;
  }

  view.classList.add('opening-active');

  // 표지의 아무 곳이나 클릭·탭·키 입력 → 잔여 애니메이션 생략하고 인트로로(SKIP 링크는 제 할 일을 한다)
  opening.addEventListener('click', (e) => {
    if (e.target.closest('.cover-skip')) return;
    e.stopPropagation();
    onKey();
  });
  document.addEventListener('keydown', onKey);

  const hold = Math.max(COVER_AFTER_MS, COVER_MIN_MS - performance.now());
  timers.push(
    setTimeout(() => {
      opening.classList.add('turn');
      view.classList.add('opening-turn');
    }, hold)
  );
  timers.push(setTimeout(showClue, hold + CLUE_AFTER_MS));
  timers.push(
    setTimeout(() => {
      startDialogue();
      // 대사가 시작된 뒤에는 남은 표지 회전이 입력을 가로채지 않게 한다
      document.removeEventListener('keydown', onKey);
      opening.classList.add('through');
    }, hold + DIALOGUE_AFTER_MS)
  );
  timers.push(setTimeout(endOpening, hold + OPEN_TURN_MS));
  }

  return {
    destroy: () => {
      timers.splice(0).forEach(clearTimeout);
      document.removeEventListener('keydown', onKey);
      removeCover();
      engine.destroy();
    },
  };
}

// 첫 진입 표지를 걷는다 — 다 넘어갔을 때, 건너뛰었을 때, 인트로를 떠날 때(표지의 SKIP 포함)
function removeCover() {
  document.getElementById('boot-cover')?.remove();
  document.documentElement.classList.remove('boot-cover');
}

// 표지에 붙은 클루의 메모 — 수첩(2부)의 포스트잇 톤을 그대로 빌린다.
// 새 에셋 없이 손글씨 폰트와 --nb-* 팔레트만 쓴다.
function buildNotice(n) {
  const el = document.createElement('div');
  el.className = 'notice';
  el.innerHTML = `
    <div class="notice-memo" role="dialog" aria-modal="true">
      <div class="notice-tape" aria-hidden="true"></div>
      <div class="notice-stamp"></div>
      <div class="notice-by"></div>
      <div class="notice-body"></div>
      <button type="button" class="notice-ok"></button>
    </div>`;
  el.querySelector('.notice-stamp').textContent = n.stamp || '';
  el.querySelector('.notice-by').textContent = n.by || '';
  const body = el.querySelector('.notice-body');
  (n.lines || []).forEach((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    body.appendChild(p);
  });
  el.querySelector('.notice-ok').textContent = n.button || '';
  return el;
}
