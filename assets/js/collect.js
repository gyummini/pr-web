import { state, counts } from './state.js';
import { DB } from './data.js';
import { addPending, landOne, flyFromRect, toast } from './ui.js';
import { T } from './text.js';

// 장 이름(CASE 02 · EPILOGUE) — 에필로그에도 증거가 생겼다(E9 참고 줄, 10/09)
export function fmtCase(chId) {
  return chId === 'EPILOGUE' ? T('common.epilogue_label') : T('common.case_label', { n: chId.slice(4) });
}

// 장 id → 세부 사항 주소 (CASE02 → /case/02, EPILOGUE → /case/epilogue)
export function casePath(chId) {
  return chId === 'EPILOGUE' ? '/case/epilogue' : `/case/${chId.slice(4)}`;
}

export function chapterEvidence(chId) {
  return DB.cards.filter((c) => !c.hidden && (c.chapters || []).includes(chId));
}

// 한 챕터의 증거를 모두 수집하면 도전과제 스타일 토스트 (열람한 챕터만, 1회).
// 수집 개수에 들지 않는 증거(counts가 거짓 — 지금은 없음)만 있는 장은 알리지 않는다
export function checkChapterToasts() {
  for (const ch of DB.chapters) {
    const evs = chapterEvidence(ch.id).filter((e) => counts(e.id));
    if (!evs.length) continue;
    if (!state.viewedChapters.has(ch.id)) continue;
    if (state.toastedChapters.has(ch.id)) continue;
    if (evs.every((e) => state.collected.has(e.id))) {
      state.toastedChapters.add(ch.id);
      toast(T('toast.chapter_complete', { case: fmtCase(ch.id) }), T('toast.chapter_complete_sub'));
    }
  }
}

// 챕터 이탈 시 미클릭 증거 자동 일괄 수집
// 최종 증거가 등장하는 CASE04만 제외 — 증거 페이지 진입 시 수집한다.
// 세지 않는 증거는 조용히 잠금해제만 한다 — 배지로 날지 않는다(진술 팝업 · 보관함과 같은 규칙)
export function autoCollectChapter(chId, originRects = null) {
  const left = chapterEvidence(chId).filter((e) => !state.collected.has(e.id));
  left.filter((e) => !counts(e.id)).forEach((e) => state.collected.add(e.id));
  const rest = left.filter((e) => counts(e.id));
  if (!rest.length) return 0;
  rest.forEach((e, i) => {
    state.collected.add(e.id);
    addPending(1);
    const rect =
      (originRects && originRects[e.id]) || {
        left: window.innerWidth / 2 - 22,
        top: window.innerHeight - 180,
        width: 44,
        height: 44,
      };
    setTimeout(() => flyFromRect(rect, () => landOne()), i * 180);
  });
  setTimeout(checkChapterToasts, rest.length * 180 + 800);
  return rest.length;
}
