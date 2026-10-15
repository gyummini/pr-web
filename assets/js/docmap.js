import { getCard } from './data.js';
import { openDoc } from './ui.js';

// 짝 증거 지도 — 엑셀 하나를 함께 쓰는 두 증거(E6 데이터 테이블 설계 · E7 Cost 역기획서)를 '증거 — 엑셀 — 증거'의 한 줄 그림으로 보인다.
// 10/15 사용자 제안 "두 개의 파일철이 하나를 묶는 느낌" — 데이터 테이블 설계를 따로 증거로 세우고, 두 증거가 같은 엑셀을 묶는다.
// 지도 데이터(doc_map)는 한쪽 증거(E7)에 두고, 다른 쪽은 pair로 그 증거를 가리킨다. 두 칸은 증거 번호 순으로 놓는다.
// 지금 보는 증거의 칸은 표시만 하고, 짝 증거의 칸은 그 증거의 상세 화면으로, 가운데 엑셀은 새 탭으로 연다(10/06 원칙 — 진짜 링크).
// 문구는 모두 증거 데이터에서 읽는다
export function pairMap(ev) {
  if (!ev) return null;
  const m = ev.doc_map || (ev.pair && (getCard(ev.pair) || {}).doc_map);
  return m && m.hub && Array.isArray(m.docs) && m.docs.length === 2 ? m : null;
}

export function hasDocMap(ev) {
  return !!pairMap(ev);
}

export function renderDocMap(ev) {
  const m = pairMap(ev);
  const fig = document.createElement('figure');
  fig.className = 'docmap';
  const cap = document.createElement('figcaption');
  cap.className = 'docmap-title';
  cap.textContent = m.title || '';
  const row = document.createElement('div');
  row.className = 'docmap-row';
  const no = (d) => Number(String(d.eid).slice(1));
  const [left, right] = [...m.docs].sort((a, b) => no(a) - no(b));
  row.append(side(left, ev, m), link(), sheet(m.hub), link(), side(right, ev, m));
  fig.append(cap, row);
  return fig;
}

// 증거 한 칸 — 지금 보는 증거는 링크가 아니라 표시(aria-current), 짝 증거는 사이트 안 링크(라우터가 받는다)
function side(d, ev, m) {
  const labels = m.labels || {};
  const current = d.eid === ev.id;
  const el = document.createElement(current ? 'div' : 'a');
  el.className = `docmap-doc${current ? ' is-current' : ''}`;
  if (current) el.setAttribute('aria-current', 'page');
  else el.href = `/evidence/${d.eid}`;
  el.innerHTML = '<span class="docmap-tag"><b class="docmap-eid"></b><span class="docmap-role"></span></span><b class="docmap-name"></b><span class="docmap-note"></span>';
  el.querySelector('.docmap-eid').textContent = d.eid;
  el.querySelector('.docmap-role').textContent = (current ? labels.current : labels.partner) || '';
  el.querySelector('.docmap-name').textContent = d.name || '';
  el.querySelector('.docmap-note').textContent = d.note || '';
  if (!current) {
    const go = document.createElement('span');
    go.className = 'docmap-go';
    go.setAttribute('aria-hidden', 'true');
    go.textContent = '→';
    el.appendChild(go);
  }
  return el;
}

// 가운데 엑셀 — 새 탭. 아직 링크가 없으면(PLACEHOLDER) 안내 토스트, 다른 원본 링크와 같다
function sheet(h) {
  const a = document.createElement('a');
  a.className = 'docmap-sheet';
  a.target = '_blank';
  a.rel = 'noopener';
  const pending = !h.url || String(h.url).startsWith('PLACEHOLDER');
  a.href = pending ? '#' : h.url;
  if (pending) a.addEventListener('click', (e) => { e.preventDefault(); openDoc(h.url); });
  a.innerHTML = '<b class="docmap-name"></b><span class="docmap-note"></span><span class="docmap-go" aria-hidden="true">↗</span>';
  a.querySelector('.docmap-name').textContent = h.name || '';
  a.querySelector('.docmap-note').textContent = h.note || '';
  return a;
}

// 두 증거와 엑셀을 잇는 선 — 그림일 뿐이라 낭독기는 건너뛴다
function link() {
  const s = document.createElement('span');
  s.className = 'docmap-link';
  s.setAttribute('aria-hidden', 'true');
  return s;
}
