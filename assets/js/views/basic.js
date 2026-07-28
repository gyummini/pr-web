import { DB } from '../data.js';

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
        <h3>프로젝트</h3>
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

// 보유 기술 — 분류별 칩 나열. 항목이 없는 분류는 건너뛴다.
function skillsSection(list) {
  const groups = (list || []).filter((g) => (g.items || []).length);
  if (!groups.length) return '';
  return `
      <section class="record-sec">
        <h3>보유 기술</h3>
        <table class="record-table rows">
          ${groups
            .map(
              (g) => `<tr><th>${esc(g.category)}</th><td><div class="skill-chips">${g.items
                .map((s) => `<span class="skill-chip">${esc(s)}</span>`)
                .join('')}</div></td></tr>`
            )
            .join('')}
        </table>
      </section>`;
}

// 기본 사항 — 인물 신상 조서 (명세서 2-2). 정적 페이지.
export function renderBasic(view) {
  const r = DB.resume;
  view.className = 'view-basic';
  view.innerHTML = `
    <div class="paper record">
      <div class="stamp">인물 신상 조서</div>
      <h2 class="record-title">기본 사항</h2>

      <section class="record-sec">
        <h3>인적사항</h3>
        <table class="record-table">
          <tr><th>이름</th><td>${r.name}</td><th>생년월일</th><td>${r.birth}</td></tr>
          <tr><th>휴대폰</th><td><a href="tel:${r.phone.replace(/-/g, '')}">${r.phone}</a></td>
              <th>E-mail</th><td><a href="mailto:${r.email}">${r.email}</a></td></tr>
          <tr><th>주소</th><td colspan="3">${r.address}</td></tr>
        </table>
      </section>

      <section class="record-sec">
        <h3>병역사항</h3>
        <table class="record-table">
          <tr><th>복무기간</th><td>${r.military.period}</td><th>군별 / 계급</th><td>${r.military.branch} / ${r.military.rank}</td></tr>
          <tr><th>병과</th><td colspan="3">${r.military.specialty}</td></tr>
        </table>
      </section>

      <section class="record-sec">
        <h3>학력사항</h3>
        <table class="record-table rows">
          ${r.education.map((e) => `<tr><th>${e.period}</th><td>${e.school}</td></tr>`).join('')}
        </table>
      </section>

      ${projectsSection(r.projects)}

      ${skillsSection(r.skills)}

      ${
        (r.experience || []).length
          ? `<section class="record-sec">
        <h3>경력사항 및 사회경험</h3>
        <table class="record-table rows">
          ${r.experience.map((e) => `<tr><th>${esc(e.period)}</th><td>${esc(e.org)} — ${esc(e.role)}</td></tr>`).join('')}
        </table>
      </section>`
          : ''
      }

      <div class="record-actions">
        <a class="btn accent" href="#/case/01">세부 사항 보기 →</a>
        <a class="btn ghost" href="${r.pdf}" download>이력서 PDF 다운로드 ⬇</a>
      </div>
    </div>`;
  return {};
}
