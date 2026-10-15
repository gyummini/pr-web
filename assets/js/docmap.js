import { openDoc } from './ui.js';

// 문서 지도 — 문서 두 개가 엑셀 하나를 함께 쓰는 증거(E6: Cost 역기획서와 데이터 테이블 설계 PPT, 가운데 스킬 데이터 테이블)를
// 첨부 칩 대신 '두 문서 — 엑셀 — 두 문서'의 한 줄 그림으로 보인다(10/15 사용자 제안 "두 개의 ppt가 하나의 엑셀을 물고 있는 형식").
// 칸마다 그 문서를 새 탭으로 여는 진짜 링크다(10/06 원칙 — 가운데 클릭 · 주소 복사가 되게). 문구는 모두 증거 데이터(doc_map)에서 읽는다
export function hasDocMap(ev) {
  const m = ev && ev.doc_map;
  return !!(m && m.hub && Array.isArray(m.docs) && m.docs.length === 2);
}

export function renderDocMap(ev) {
  const m = ev.doc_map;
  const fig = document.createElement('figure');
  fig.className = 'docmap';
  const cap = document.createElement('figcaption');
  cap.className = 'docmap-title';
  cap.textContent = m.title || '';
  const row = document.createElement('div');
  row.className = 'docmap-row';
  const [left, right] = m.docs;
  row.append(doc(left, 'docmap-doc'), link(), hub(m.hub), link(), doc(right, 'docmap-doc'));
  fig.append(cap, row);
  return fig;
}

function doc(d, cls) {
  const a = docAnchor(d.url, cls);
  a.innerHTML = '<b class="docmap-name"></b><span class="docmap-note"></span><span class="docmap-go" aria-hidden="true">↗</span>';
  a.querySelector('.docmap-name').textContent = d.name || '';
  a.querySelector('.docmap-note').textContent = d.note || '';
  return a;
}

// 아직 링크가 없는 문서(PLACEHOLDER)는 누르면 안내 토스트 — 다른 원본 링크와 같다
function docAnchor(url, cls) {
  const a = document.createElement('a');
  a.className = cls;
  a.target = '_blank';
  a.rel = 'noopener';
  const pending = !url || String(url).startsWith('PLACEHOLDER');
  a.href = pending ? '#' : url;
  if (pending) a.addEventListener('click', (e) => { e.preventDefault(); openDoc(url); });
  return a;
}

function hub(h) {
  const wrap = document.createElement('div');
  wrap.className = 'docmap-hub';
  wrap.appendChild(doc(h, 'docmap-sheet'));
  return wrap;
}

// 두 문서와 엑셀을 잇는 선 — 그림일 뿐이라 낭독기는 건너뛴다
function link() {
  const s = document.createElement('span');
  s.className = 'docmap-link';
  s.setAttribute('aria-hidden', 'true');
  return s;
}
