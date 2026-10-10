import { state, counts, baseUnlocked } from './state.js';
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
  // 기본 증거를 다 모은 순간에는 해금 알림 하나만 띄운다(10/10 라4 — '내려앉기, 파일철 펼침, 안내 하나').
  // 전에는 해금 알림 위에 그 순간 끝난 장의 '완벽 수집' 알림이 한두 장 더 겹쳐 E5 카드의 행동 줄을 가렸다
  const quiet = baseUnlocked();
  for (const ch of DB.chapters) {
    const evs = chapterEvidence(ch.id).filter((e) => counts(e.id));
    if (!evs.length) continue;
    if (!state.viewedChapters.has(ch.id)) continue;
    if (state.toastedChapters.has(ch.id)) continue;
    if (evs.every((e) => state.collected.has(e.id))) {
      state.toastedChapters.add(ch.id);
      if (!quiet) toast(T('toast.chapter_complete', { case: fmtCase(ch.id) }), T('toast.chapter_complete_sub'));
    }
  }
}

// 챕터 이탈 시 미클릭 증거 자동 일괄 수집 — 모든 장이 같다(10/11 다2: CASE04의 예외를 없앴다)
// 세지 않는 증거는 조용히 잠금해제만 한다 — 배지로 날지 않는다(진술 팝업 · 보관함과 같은 규칙)
export function autoCollectChapter(chId, originRects = null) {
  const left = chapterEvidence(chId).filter((e) => !state.collected.has(e.id));
  left.filter((e) => !counts(e.id)).forEach((e) => state.collected.add(e.id));
  const rest = left.filter((e) => counts(e.id));
  if (!rest.length) return 0;
  rest.forEach((e, i) => {
    state.collected.add(e.id);
    addPending(1, e.id);
    // 장을 떠나는 순간에 불린다 — 다음 화면이 그려진 뒤 출발점을 찾는다(10/10 다1):
    // 다음 장의 목차에서 떠난 장의 칸, 목차가 없는 화면이면 머리말의 '자기소개서' 탭. 전에는 화면 아래 한가운데(다른 문장 위)에서 떴다
    setTimeout(() => flyFromRect((originRects && originRects[e.id]) || originOf(chId), () => landOne(e.id), { id: e.id }), 40 + i * 180);
  });
  setTimeout(checkChapterToasts, rest.length * 180 + 800);
  return rest.length;
}

function originOf(chId) {
  const idx = document.querySelector(`#view .chapter-index .idx[href="${casePath(chId)}"]`);
  const tab = document.querySelector('#tabs a[data-tab="dossier"]');
  // 화면 안에 보이는 것만 출발점이 된다(휴대폰의 가로 목차는 그 칸이 옆으로 밀려 있을 수 있다)
  const seen = (n) => {
    if (!n || !n.getClientRects().length) return null;
    const r = n.getBoundingClientRect();
    return r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight ? r : null;
  };
  const r = seen(idx) || seen(tab);
  if (r) return r;
  return { left: window.innerWidth / 2 - 22, top: window.innerHeight - 180, width: 44, height: 44 };
}
