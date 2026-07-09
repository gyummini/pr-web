// E7 제작기의 시각 자료. 도식·표 계열은 이미지 대신 CSS로 직접 렌더링한다
// (디자인 톤 통일, 확대 선명, 텍스트 수정 용이). 슬롯 ID는 콘텐츠_제작기.md의 [이미지 N-N]과 대응.
import { SPRITES } from './sprites.js';

const FIGURES = {
  // 1-1: 세 가지 설계 목표와 그 사이의 충돌
  '1-1': () => `
    <div class="fig-goals">
      <div class="fig-goals-row">
        <div class="fig-goal">
          <span class="fig-goal-no">목표 ①</span>
          글과 연관된 포트폴리오를 함께 보여 <strong>설득력</strong>을 높인다
        </div>
        <div class="fig-goal">
          <span class="fig-goal-no">목표 ③</span>
          웹사이트 자체에서 <strong>캐릭터</strong>가 드러난다
        </div>
      </div>
      <div class="fig-goals-clash">⚡ 연출·인터랙션이 늘수록 읽기는 불편해진다 — 충돌</div>
      <div class="fig-goals-row">
        <div class="fig-goal wide">
          <span class="fig-goal-no">목표 ②</span>
          글만 읽는 것보다 <strong>불편하지 않다</strong>
        </div>
      </div>
      <div class="fig-note">조정 기준: <strong>"검토하시는 분의 5분"</strong> — 게임성과 검토 시간이 충돌하면 검토 시간이 이긴다</div>
    </div>`,

  // 3-1: 렌파이 채택안 vs 자체 구현안 비교표
  '3-1': () => {
    const rows = [
      ['첫 로딩 속도', false, true],
      ['URL 딥링크 · 뒤로가기', false, true],
      ['텍스트 스킴 (읽기 모드)', false, true],
      ['외부 문서 링크와의 공존', false, true],
      ['대사창 연출 (손맛)', true, true],
    ];
    const ox = (v) => (v ? '<span class="fig-o">○</span>' : '<span class="fig-x">✕</span>');
    return `
      <table class="fig-table">
        <thead><tr><th></th><th>렌파이 웹 빌드</th><th>자체 경량 대사 엔진 + 웹</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><th>${r[0]}</th><td>${ox(r[1])}</td><td>${ox(r[2])}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="fig-note">기각 근거: 심사는 '플레이 모드'가 아니라 '읽기 모드'로 이루어진다</div>`;
  },

  // 4-1: 클루 표정 시트 (스탠딩 4종)
  '4-1': () => {
    const keys = [
      ['normal', '기본'],
      ['happy', '기쁨'],
      ['surprised', '놀람'],
      ['serious', '진지'],
    ];
    return `
      <div class="fig-sheet">
        ${keys
          .map(
            ([k, ko]) => `
          <figure class="fig-sheet-item">
            <img src="${SPRITES.standing[k]}" alt="클루 스탠딩 — ${ko}" loading="lazy">
            <figcaption>${k}<span>${ko}</span></figcaption>
          </figure>`
          )
          .join('')}
      </div>`;
  },

  // 4-2: 정보 도배 — 모든 정보가 '기록/단서'로 귀결
  '4-2': () => {
    const rows = [
      ['이름', "클루 (Clue)", "이름이 곧 '단서(clue)'"],
      ['생일', '1월 12일', '112 — 수사 모티프'],
      ['외형', '돋보기 머리핀 · 머리에 꽂은 펜 · 항상 안고 있는 서류 파일', "어느 진입로로 봐도 '기록하는 사람'"],
      ['말버릇', '"기록해둘게요!", "요약하자면—"', '대사 단위 각인'],
      ['호칭', '방문자를 항상 "탐정님"', '방문자에게 역할 부여'],
    ];
    return `
      <table class="fig-table fig-dobae">
        <thead><tr><th>정보</th><th>설계</th><th>귀결</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><th>${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="fig-note">모든 정보가 <strong>'기록광 조수'</strong> 한 속성으로 귀결되도록 설계</div>`;
  },

  // 5-2: AI 협업 워크플로우 사이클
  '5-2': () => {
    const steps = ['명세 확정', '콘텐츠 / 코드 분리', 'AI 구현', '체크리스트 검수', '반영'];
    return `
      <div class="fig-cycle">
        ${steps
          .map(
            (s, i) => `
          <div class="fig-step"><span class="fig-step-no">${i + 1}</span>${s}</div>
          ${i < steps.length - 1 ? '<div class="fig-arrow">→</div>' : ''}`
          )
          .join('')}
      </div>
      <div class="fig-note">검수에서 발견된 문제는 명세·콘텐츠 수정으로 되돌아가는 사이클 ↺</div>`;
  },

  // 5-3: 캐릭터 이미지 생성 — 비포/애프터
  '5-3': () => `
    <div class="fig-ba">
      <figure class="fig-ba-item">
        <img src="./assets/img/making_before.jpg" alt="초기 시안 — 세부 프롬프트 없이 생성" loading="lazy">
        <figcaption><strong>Before — 초기 시안.</strong> 프롬프트를 세세하게 지정하지 않고 생성한 결과물. 배경·소품·복장이 통제되지 않아 디테일이 확정되지 못했고, 그대로 활용하기는 어려웠습니다.</figcaption>
      </figure>
      <div class="fig-ba-arrow">→</div>
      <figure class="fig-ba-item after">
        <img src="${SPRITES.standing.normal}" alt="확정 스탠딩" loading="lazy">
        <figcaption><strong>After — 확정 기본 스탠딩.</strong> 외형 설정을 상세 프롬프트로 고정해 확정한 이미지. 나머지 표정 3종은 이 이미지를 참조한 편집 파생으로 제작했습니다.</figcaption>
      </figure>
    </div>`,
};

// 슬롯에 해당하는 시각 자료 HTML을 반환. 없으면 null → 플레이스홀더 유지.
export function figureHtml(slot) {
  const builder = FIGURES[slot];
  return builder ? `<figure class="mk-fig" data-slot="${slot}">${builder()}</figure>` : null;
}
