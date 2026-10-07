// 다른 화면에서 넘어올 때 '어디에 내려앉을지'를 한 번만 넘긴다(10/07).
// 라우터가 주소의 해시를 지우므로 주소에 싣지 않고, 다음 화면이 그린 직후 한 번 꺼내 쓰고 버린다.
//   보관함 카드의 '직접 플레이' 칩 → E8 페이지의 직접 플레이 버튼(retro)
//   보관함 요약 팝업의 '자기소개서에서 확인하기' → 그 증거의 형광펜 문장(dossier)
const wants = new Map();

export function landAt(page, target) {
  wants.set(page, target);
}

export function takeLanding(page) {
  const target = wants.get(page);
  wants.delete(page);
  return target;
}
