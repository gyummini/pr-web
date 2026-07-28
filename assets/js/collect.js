import { state } from './state.js';
import { DB } from './data.js';
import { addPending, landOne, flyFromRect, toast } from './ui.js';

export function fmtCase(chId) {
  return `CASE ${chId.slice(4)}`;
}

export function chapterEvidence(chId) {
  return DB.cards.filter((c) => !c.hidden && (c.chapters || []).includes(chId));
}

// 한 챕터의 증거를 모두 수집하면 도전과제 스타일 토스트 (열람한 챕터만, 1회)
export function checkChapterToasts() {
  for (const ch of DB.chapters) {
    const evs = chapterEvidence(ch.id);
    if (!evs.length) continue;
    if (!state.viewedChapters.has(ch.id)) continue;
    if (state.toastedChapters.has(ch.id)) continue;
    if (evs.every((e) => state.collected.has(e.id))) {
      state.toastedChapters.add(ch.id);
      toast(`${fmtCase(ch.id)}. 완벽 수집!`, '이 진술의 증거를 모두 확보했습니다');
    }
  }
}

// 챕터 이탈 시 미클릭 증거 자동 일괄 수집 (CASE04 제외 — 증거 페이지 진입 시 수집)
export function autoCollectChapter(chId, originRects = null) {
  const rest = chapterEvidence(chId).filter((e) => !state.collected.has(e.id));
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
