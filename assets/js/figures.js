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

  // 2-1: 컨셉 매핑 + 실제 앵커 UI (사이트 CSS 컴포넌트 재현 — 스크린샷과 동일 실물)
  '2-1': () => `
    <div class="fig-map">
      ${[
        ['방문자', '탐정'],
        ['자기소개서', '진술'],
        ['포트폴리오', '증거'],
      ]
        .map(
          ([a, b]) => `
        <div class="fig-map-row">
          <span class="fig-map-a">${a}</span>
          <span class="fig-map-eq">=</span>
          <span class="fig-map-b">${b}</span>
        </div>`
        )
        .join('')}
    </div>
    <div class="fig-uidemo">
      <p>… <span class="anchor" aria-hidden="true">로블록스 게임을 제작하며 인기 장르인 브레인롯 콘텐츠를 분석했을 때<span class="anchor-ic">🔍</span></span>, 처음에는 수집과 강화라는 시스템 구조에 집중했습니다. …</p>
    </div>
    <div class="fig-note">세부 사항 페이지의 실제 앵커 UI — 형광펜 문장을 누르면 그 주장을 뒷받침하는 증거 팝업이 열린다</div>`,

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

  // 3-2: 대사 스크립트 JSON ↔ 렌더링 결과 (사이트 CSS 컴포넌트 재현)
  '3-2': () => `
    <div class="fig-pair">
      <div class="fig-code">
        <div class="fig-bar">스크립트_인트로.json</div>
        <pre>{
  "speaker": "클루",
  "sprite": "happy",
  "text": "저는 이 사이트의 안내를
  맡은 조수, 클루예요. …"
}</pre>
      </div>
      <div class="fig-pair-arrow">→</div>
      <div class="fig-dlgdemo">
        <img class="demo-standing" src="${SPRITES.standing.happy}" alt="클루 스탠딩 (happy)" loading="lazy">
        <div class="demo-box">
          <div class="demo-name">클루</div>
          <div class="demo-text">저는 이 사이트의 안내를 맡은 조수, 클루예요. …</div>
          <div class="demo-ctc">▼</div>
        </div>
      </div>
    </div>
    <div class="fig-note">JSON 한 줄이 그대로 화면 연출이 된다 — 대사 데이터와 렌더러의 완전 분리 (진행 표시 ▼는 지금도 깜빡이는 실제 컴포넌트)</div>`,

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

  // 4-3: 분석서의 공식(이론) ↔ 클루(실전 적용) 대응
  '4-3': () => {
    const rows = [
      ['① 한 단어로 압축', "'기록광 조수'"],
      ['② 속성과 관련된 부작용 짝짓기', "'요약에 과하게 진심' — 수집 리액션의 톤 근거"],
      ['③ 모든 정보를 속성으로 귀결 (정보 도배)', "이름·생일·소품·말버릇이 전부 '기록/단서'로"],
      ['④ 호출을 통한 입체화', '인트로 각인 → 팝업·수집 알림 호출 → 엔딩에서 코어 공개'],
    ];
    return `
      <table class="fig-table fig-dobae">
        <thead><tr><th>「캐릭터 매력 분석서」의 공식 — 이론</th><th>클루 — 실전 적용</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="fig-note">공식의 원본은 위의 증거 E1 「서브컬처 캐릭터 매력 분석서」에서 확인할 수 있다</div>`;
  },

  // 5-1: 개발 명세서 발췌 (원문 인용)
  '5-1': () => `
    <div class="fig-doc">
      <div class="fig-bar">PR웹사이트_개발명세서.md — 절대 원칙 · 임의 판단 금지</div>
      <div class="fig-doc-body">
        <p class="fig-doc-h">절대 원칙 (충돌 시 이 순서로 우선)</p>
        <ol>
          <li><strong>정보 접근은 항상 즉시</strong>: 어떤 화면에서든 2클릭 이내에 모든 포트폴리오 문서에 도달할 수 있어야 한다.</li>
          <li><strong>게임적 경험은 항상 선택</strong>: 연출·수집·히든은 여유 있는 방문자를 위한 것. 바쁜 방문자를 막는 벽이 되어서는 안 된다.</li>
          <li><strong>읽기를 방해하지 않는다</strong>: 본문 열람 중 페이지 강제 이동, 강제 대기, 스킵 불가 연출 금지.</li>
        </ol>
        <p class="fig-doc-h">구현 시 임의 판단 금지 항목</p>
        <ul>
          <li>대사·요약·본문 텍스트를 새로 창작하거나 수정하지 않는다. 제공된 데이터 파일이 유일한 소스.</li>
          <li>증거 수(7), 챕터 수(4), 수집 규칙을 변경하지 않는다.</li>
        </ul>
      </div>
    </div>`,

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
