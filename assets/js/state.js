// 세션 내 메모리 상태만 사용한다. localStorage / sessionStorage 금지 (명세서 5).
// E8(PokeCollect 개발 회고)은 E7(히든) 뒤에 추가된 기본 증거다. 번호는 순서가 아니라 추가된 차례.
// E9(전술대회 전투 개선 제안서)는 10/08 추가 때는 세지 않았지만, 10/09 에필로그 끝 '참고' 줄에 걸리면서 수집 개수와 히든 해금 조건에 든다.
// E4(에픽세븐 오토마톤 타워 개선 제안서)는 10/10 사용자 결정으로 뺐다 — 번호는 비워 둔다. 그래서 기본 증거는 일곱, 배지는 n/8이다.
export const BASE_EVIDENCE_IDS = ['E1', 'E2', 'E3', 'E5', 'E6', 'E8', 'E9'];
export const TOTAL_EVIDENCE = 8;
// 수집 개수(배지 n/8)에 드는 증거 — 기본 증거와 히든(E7).
// 세지 않는 증거를 다시 두게 되면 여기서 빼면 된다(수집 · 알림 코드는 counts()로 거른다).
export const COUNTED_IDS = [...BASE_EVIDENCE_IDS, 'E7'];
export const counts = (id) => COUNTED_IDS.includes(id);

export const state = {
  introSeen: false,        // 세션 내 시작 페이지 재진입 시 대사 자동 스킵
  endingSeen: false,       // 엔딩 대화 완료 여부
  hiddenFlashShown: false, // 히든 해금 강조 연출 1회 재생 여부
  hiddenUnlockToastShown: false, // 기본 증거(BASE_EVIDENCE_IDS) 수집 완료 고정 토스트 중복 방지
  viewedChapters: new Set(),   // 'CASE01' ~ 'CASE04', 'EPILOGUE'
  collected: new Set(),        // 'E1' ~ 'E9'
  toastedChapters: new Set(),  // 완벽 수집 토스트 중복 방지
};

export function collectedCount() {
  return COUNTED_IDS.filter((id) => state.collected.has(id)).length;
}

export function collectedBaseCount() {
  return BASE_EVIDENCE_IDS.filter((id) => state.collected.has(id)).length;
}

// 히든(E7) 해금 조건: 기본 증거(BASE_EVIDENCE_IDS) 전부 수집
export function baseUnlocked() {
  return BASE_EVIDENCE_IDS.every((id) => state.collected.has(id));
}
