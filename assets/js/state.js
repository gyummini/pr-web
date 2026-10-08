// 세션 내 메모리 상태만 사용한다. localStorage / sessionStorage 금지 (명세서 5).
// E8(PokeCollect 개발 회고)은 E7(히든) 뒤에 추가된 기본 증거다. 번호는 순서가 아니라 추가된 차례.
export const BASE_EVIDENCE_IDS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E8'];
export const TOTAL_EVIDENCE = 8;
// 수집 개수(배지 n/8)에 드는 증거 — 기본 증거와 히든(E7).
// E9(전술대회 전투 개선 제안서, 10/08)처럼 자기소개서에 앵커가 없는 추가 포트폴리오는 보관함에서 잠금해제해도 세지 않는다 —
// 자기소개서를 다 읽으면 다 모이는 규칙과 8칸 배지를 그대로 두기 위해서다.
export const COUNTED_IDS = [...BASE_EVIDENCE_IDS, 'E7'];
export const counts = (id) => COUNTED_IDS.includes(id);

export const state = {
  introSeen: false,        // 세션 내 시작 페이지 재진입 시 대사 자동 스킵
  endingSeen: false,       // 엔딩 대화 완료 여부
  hiddenFlashShown: false, // 히든 해금 강조 연출 1회 재생 여부
  hiddenUnlockToastShown: false, // 기본 증거(E1~E6, E8) 수집 완료 고정 토스트 중복 방지
  viewedChapters: new Set(),   // 'CASE01' ~ 'CASE04', 'EPILOGUE'
  collected: new Set(),        // 'E1' ~ 'E8'
  toastedChapters: new Set(),  // 완벽 수집 토스트 중복 방지
};

export function collectedCount() {
  return COUNTED_IDS.filter((id) => state.collected.has(id)).length;
}

export function collectedBaseCount() {
  return BASE_EVIDENCE_IDS.filter((id) => state.collected.has(id)).length;
}

// 히든(E7) 해금 조건: 기본 증거(E1~E6, E8) 전부 수집
export function baseUnlocked() {
  return BASE_EVIDENCE_IDS.every((id) => state.collected.has(id));
}
