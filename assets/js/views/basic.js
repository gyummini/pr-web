import { DB } from '../data.js';

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

      <section class="record-sec">
        <h3>경력사항 및 사회경험</h3>
        <table class="record-table rows">
          ${r.experience.map((e) => `<tr><th>${e.period}</th><td>${e.org} — ${e.role}</td></tr>`).join('')}
        </table>
      </section>

      <div class="record-actions">
        <a class="btn accent" href="#/case/01">세부 사항 보기 →</a>
        <a class="btn ghost" href="${r.pdf}" download>이력서 PDF 다운로드 ⬇</a>
      </div>
    </div>`;
  return {};
}
