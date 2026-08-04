import { loadAll } from './data.js';
import { syncBadge } from './ui.js';
import { startRouter, currentRoute } from './router.js';
import { startPreload } from './preload.js';
import { initAnalytics } from './analytics.js';

const view = document.getElementById('view');

loadAll()
  .then(() => {
    syncBadge();
    initAnalytics(); // 라우터 시작 전에 구독해야 첫 진입도 집계된다
    startRouter();
    // 문서 목록(/docs)은 컨셉 없는 열람용이므로 스탠딩·수첩 등 연출 자원을 받지 않는다
    if (!currentRoute().startsWith('/docs')) {
      startPreload(); // 첫 렌더 후 유휴 시간에 나머지 에셋 백그라운드 로딩
    }
  })
  .catch((err) => {
    console.error(err);
    view.innerHTML = `<div class="paper load-error">
      <h2>사건 파일을 여는 데 실패했습니다</h2>
      <p>${String(err.message || err)}</p>
      <p>로컬에서 열었다면 정적 서버(http)로 실행해야 데이터 파일을 불러올 수 있습니다.</p>
    </div>`;
  });
