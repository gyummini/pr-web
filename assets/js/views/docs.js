import { DB } from '../data.js';
import { openDoc } from '../ui.js';

// 포트폴리오 문서 목록 (/docs).
// 컨셉 없는 열람용 페이지 — 수사 어휘·캐릭터·수집 UI를 일절 쓰지 않는다.
// 문서 데이터는 콘텐츠_증거카드.json을 그대로 참조한다(복제 금지).

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderDocs(view) {
  // 히든(E7)은 목록에서 제외. chapters·클루 대사는 사용하지 않는다.
  const docs = (DB.cards || []).filter((c) => !c.hidden);
  const r = DB.resume || {};

  view.className = 'view-docs';
  view.innerHTML = `
    <div class="docs-page">
      <header class="docs-head">
        <h1>${esc(r.name || '')} — 게임 기획 포트폴리오</h1>
        <p class="docs-sub">포트폴리오 문서 ${docs.length}건</p>
      </header>

      <div class="docs-grid">
        ${docs.map((d, i) => docCard(d, i + 1)).join('')}
      </div>

      <footer class="docs-foot">
        <div class="docs-foot-block">
          <h2>문서 내려받기</h2>
          <div class="docs-actions">
            ${r.fullPdf ? `<a class="btn accent" href="${esc(r.fullPdf)}" download>이력서·자기소개서 PDF ⬇</a>` : ''}
          </div>
        </div>

        <div class="docs-foot-block">
          <h2>연락처</h2>
          <p class="docs-contact">
            ${r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ''}
            ${r.email && r.phone ? '<span class="docs-dot">·</span>' : ''}
            ${r.phone ? `<a href="tel:${esc(r.phone).replace(/-/g, '')}">${esc(r.phone)}</a>` : ''}
          </p>
        </div>

        <p class="docs-alt">
          <a href="/intro">자기소개서와 각 문서를 연결해 열람할 수 있는 버전도 있습니다 →</a>
        </p>
      </footer>
    </div>`;

  // 텍스트는 데이터 그대로 주입
  view.querySelectorAll('.docs-card').forEach((el) => {
    const d = docs.find((c) => c.id === el.dataset.id);
    if (!d) return;
    el.querySelector('.docs-type').textContent = d.doc_type || '';
    if (!d.doc_type) el.querySelector('.docs-type').remove();
    el.querySelector('.docs-title').textContent = d.title || '';
    const sub = el.querySelector('.docs-card-sub');
    if (d.subtitle) sub.textContent = d.subtitle;
    else sub.remove();
    const sum = el.querySelector('.docs-summary');
    if (d.summary) sum.textContent = d.summary;
    else sum.remove();

    const img = el.querySelector('.docs-thumb-img');
    if (img) img.addEventListener('error', () => img.remove(), { once: true });

    el.querySelector('.docs-open').addEventListener('click', () => openDoc(d.url));
    el.querySelectorAll('.docs-att').forEach((btn) => {
      const att = (d.attachments || [])[Number(btn.dataset.att)];
      if (!att) {
        btn.remove();
        return;
      }
      btn.textContent = `📎 ${att.label}`;
      btn.addEventListener('click', () => openDoc(att.url));
    });
  });

  return {};
}

function docCard(d, no) {
  const thumb = d.thumb
    ? `<img class="docs-thumb-img" src="${esc(d.thumb)}" alt="" loading="lazy">`
    : '';
  const atts = (d.attachments || []).length
    ? `<div class="docs-atts">${(d.attachments || [])
        .map((_, i) => `<button type="button" class="att-chip docs-att" data-att="${i}"></button>`)
        .join('')}</div>`
    : '';
  return `
    <article class="docs-card" data-id="${d.id}">
      <div class="docs-thumb">${thumb}<span class="docs-thumb-fallback" aria-hidden="true">📄</span></div>
      <div class="docs-body">
        <div class="docs-meta"><span class="docs-no">${no}</span><span class="docs-type"></span></div>
        <h3 class="docs-title"></h3>
        <p class="docs-card-sub"></p>
        <p class="docs-summary"></p>
        ${atts}
        <div class="docs-card-foot">
          <button type="button" class="btn accent docs-open">문서 열기 ↗</button>
        </div>
      </div>
    </article>`;
}
