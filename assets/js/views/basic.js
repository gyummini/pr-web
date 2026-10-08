import { DB } from '../data.js';
import { TH } from '../text.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 프로젝트 — 기간·내용 2열. 이름과 역할이 모두 비어 있으면 그 행은 렌더링하지 않는다.
function projectsSection(list) {
  const rows = (list || []).filter((p) => (p.name || '').trim() || (p.role || '').trim());
  if (!rows.length) return '';
  return `
      <section class="record-sec">
        <h3>${TH('basic.projects')}</h3>
        <table class="record-table rows">
          ${rows
            .map((p) => {
              const title = [p.name, p.role].filter((v) => (v || '').trim()).map(esc).join(' — ');
              const detail = (p.detail || '').trim()
                ? `<div class="record-detail">${esc(p.detail)}</div>`
                : '';
              return `<tr><th>${esc(p.period) || '&nbsp;'}</th><td>${title}${detail}</td></tr>`;
            })
            .join('')}
        </table>
      </section>`;
}

// 보유 기술 — 기술명 + 실제 가능한 수준 + 근거. 이름 없는 항목은 건너뛴다.
function skillsSection(list) {
  const rows = (list || []).filter((s) => (s.name || '').trim());
  if (!rows.length) return '';
  return `
      <section class="record-sec">
        <h3>${TH('basic.skills')}</h3>
        <table class="record-table rows skills">
          ${rows
            .map((s) => {
              const level = (s.level || '').trim()
                ? `<div class="skill-level">${esc(s.level)}</div>`
                : '';
              const notes = (s.notes || []).length
                ? `<ul class="skill-notes">${s.notes
                    .map((n) => `<li>${esc(n)}</li>`)
                    .join('')}</ul>`
                : '';
              return `<tr><th>${esc(s.name)}</th><td>${level || notes ? level + notes : '&nbsp;'}</td></tr>`;
            })
            .join('')}
        </table>
      </section>`;
}

// 플레이 기록 — 자소서·수첩의 진술을 뒷받침하는 외부 기록. 비면 렌더링하지 않는다.
// 강조할 게임(highlights)을 글로 적는다. minimap 링크는 link: true인 줄 안에 참고로 붙고,
// 그런 줄이 없으면 맨 아래 따로 '플레이 시간순' 줄로 나온다(10/09).
function playSection(p) {
  if (!p) return '';
  const rows = (p.highlights || []).filter((h) => (h.name || '').trim() && (h.items || []).length);
  const url = (p.url || '').trim();
  if (!rows.length && !url) return '';
  const linkHtml = `${p.note ? `<div class="play-note">${esc(p.note)}</div>` : ''}
              <a class="play-link" href="${esc(url)}" target="_blank" rel="noopener">${TH('basic.play_link')}</a>`;
  const inRow = url && rows.some((h) => h.link);
  // '게임 — 설명' 줄은 넓은 화면에서 '—' 앞에서만 줄을 바꾼다('대부분의 / 콘텐츠를'처럼 설명 중간에서 끊기지 않게)
  const line = (t) => {
    const i = t.indexOf(' — ');
    return i < 0 ? esc(t) : `${esc(t.slice(0, i))} <span class="play-tail">— ${esc(t.slice(i + 3))}</span>`;
  };
  return `
      <section class="record-sec">
        <h3>${esc(p.label)}</h3>
        <table class="record-table rows">
          ${rows
            .map(
              (h) =>
                `<tr><th>${esc(h.name)}</th><td>${h.items.map((t) => `<div class="play-item">${line(t)}</div>`).join('')}${
                  inRow && h.link ? linkHtml : ''
                }</td></tr>`
            )
            .join('')}
          ${url && !inRow ? `<tr><th>${esc(p.summary || '')}</th><td>${linkHtml}</td></tr>` : ''}
        </table>
      </section>`;
}

// 기본 사항 — 인물 신상 조서 (명세서 2-2). 정적 페이지.
export function renderBasic(view) {
  const r = DB.resume;
  view.className = 'view-basic';
  view.innerHTML = `
    <div class="paper record">
      <div class="stamp">${TH('basic.stamp')}</div>
      <h2 class="record-title">${TH('basic.title')}</h2>

      <section class="record-sec">
        <h3>${TH('basic.personal')}</h3>
        <table class="record-table">
          <tr><th>${TH('basic.name')}</th><td>${r.name}</td><th>${TH('basic.birth')}</th><td>${r.birth}</td></tr>
          <tr><th>${TH('basic.phone')}</th><td><a href="tel:${r.phone.replace(/-/g, '')}">${r.phone}</a></td>
              <th>${TH('basic.email')}</th><td><a href="mailto:${r.email}">${r.email}</a></td></tr>
          <tr><th>${TH('basic.address')}</th><td colspan="3">${r.address}</td></tr>
        </table>
      </section>

      <section class="record-sec">
        <h3>${TH('basic.military')}</h3>
        <table class="record-table">
          <tr><th>${TH('basic.service_period')}</th><td>${r.military.period}</td><th>${TH('basic.branch_rank')}</th><td>${r.military.branch} / ${r.military.rank}</td></tr>
          <tr><th>${TH('basic.specialty')}</th><td colspan="3">${r.military.specialty}</td></tr>
        </table>
      </section>

      <section class="record-sec">
        <h3>${TH('basic.education')}</h3>
        <table class="record-table rows">
          ${r.education.map((e) => `<tr><th>${e.period}</th><td>${e.school}</td></tr>`).join('')}
        </table>
      </section>

      ${projectsSection(r.projects)}

      ${skillsSection(r.skills)}

      ${
        (r.experience || []).length
          ? `<section class="record-sec">
        <h3>${TH('basic.experience')}</h3>
        <table class="record-table rows">
          ${r.experience.map((e) => `<tr><th>${esc(e.period)}</th><td>${esc(e.org)} — ${esc(e.role)}</td></tr>`).join('')}
        </table>
      </section>`
          : ''
      }

      ${playSection(r.playRecord)}

      <div class="record-actions">
        <a class="btn accent" href="/case/01">${TH('basic.to_dossier')}</a>
        <a class="btn ghost" href="${r.pdf}" download>${TH('basic.resume_pdf')}</a>
      </div>
    </div>`;
  return {};
}
