// 세션 내 메모리 상태만 사용한다. localStorage / sessionStorage 금지 (명세서 5).
export const BASE_EVIDENCE_IDS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
export const TOTAL_EVIDENCE = 7;

export const state = {
  introSeen: false,        // 세션 내 시작 페이지 재진입 시 대사 자동 스킵
  resultOnlyMode: false,   // '수사 결과만 본다' 경로
  endingSeen: false,       // 엔딩 대화 완료 여부
  hiddenFlashShown: false, // 히든 해금 강조 연출 1회 재생 여부
  viewedChapters: new Set(),   // 'CASE01' ~ 'CASE04'
  collected: new Set(),        // 'E1' ~ 'E7'
  toastedChapters: new Set(),  // 완벽 수집 토스트 중복 방지
};

export function collectedCount() {
  return state.collected.size;
}

// 히든(E7) 해금 조건: E1~E6 전부 수집
export function baseUnlocked() {
  return BASE_EVIDENCE_IDS.every((id) => state.collected.has(id));
}
