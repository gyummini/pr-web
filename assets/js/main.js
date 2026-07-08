import { loadAll } from './data.js';
import { syncBadge } from './ui.js';
import { startRouter } from './router.js';

const view = document.getElementById('view');

loadAll()
  .then(() => {
    syncBadge();
    startRouter();
  })
  .catch((err) => {
    console.error(err);
    view.innerHTML = `<div class="paper load-error">
      <h2>사건 파일을 여는 데 실패했습니다</h2>
      <p>${String(err.message || err)}</p>
      <p>로컬에서 열었다면 정적 서버(http)로 실행해야 데이터 파일을 불러올 수 있습니다.</p>
    </div>`;
  });
