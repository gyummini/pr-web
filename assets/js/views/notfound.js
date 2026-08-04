// 존재하지 않는 경로. SPA fallback(vercel.json rewrites) 때문에 서버는 항상 index.html을
// 돌려주므로, 알 수 없는 경로의 안내는 라우터가 이 화면으로 처리한다.
export function renderNotFound(view, path) {
  view.className = 'view-notfound';
  view.innerHTML = `
    <div class="paper detail">
      <div class="stamp">단서 없음</div>
      <div class="ev-kicker">조회한 경로</div>
      <h2 class="ev-title nf-path"></h2>
      <p class="ev-sub">사건 파일에 해당 문서가 존재하지 않습니다.</p>
      <div class="detail-actions">
        <a class="btn accent" href="/basic">기본 사항으로 →</a>
        <a class="btn ghost" href="/evidence">← 증거 보관함으로</a>
      </div>
    </div>`;
  // 경로는 데이터가 아니라 사용자 입력이므로 textContent로만 주입한다
  view.querySelector('.nf-path').textContent = path;
  return {};
}
