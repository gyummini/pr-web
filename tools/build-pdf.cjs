// 다운로드용 PDF 두 개를 사이트 데이터에서 다시 만든다 — `cd tests && npm run pdf`.
//
//   이력서.pdf            ← data/resume.json
//   이력서_자기소개서.pdf  ← data/resume.json + 콘텐츠_자기소개서.md
//
// 사이트의 컨셉(사건 파일·클루)을 걷어낸 열람용이다. 기본 사항·세부 사항과 같은 데이터를 읽으므로
// 원고나 이력을 고친 뒤 이것만 돌리면 웹과 PDF가 어긋나지 않는다.
// 9/30 전까지는 생성기가 저장소에 없어서, 웹을 고쳐도 PDF가 7월 내용(옛 주소, 옛 자소서)에 머물러 있었다.
//
// 조판은 7/28판을 잰 치수를 따른다. 이력서는 여백 15mm, 자소서는 19mm로 서로 다르다.
// 글꼴은 맑은 고딕 — 이 머신(Windows)에서 만든 판과 같게 하려는 것이며, 없으면 대체 글꼴로 뽑힌다.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

// playwright는 tests/의 개발 의존성이다. 저장소 루트에 package.json을 두지 않는다(Vercel이 Node 빌드로 바꾼다).
const { chromium } = createRequire(path.join(__dirname, '..', 'tests', 'package.json'))('playwright');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const resume = JSON.parse(read('data/resume.json'));
const cards = JSON.parse(read('콘텐츠_증거카드.json')).evidences;
const essay = parseEssay(read('콘텐츠_자기소개서.md'));
// 표 머리·제목 같은 고정 문구 — 사이트 기본 사항과 같은 키(콘텐츠_화면문구.json)
const ui = JSON.parse(read('콘텐츠_화면문구.json'));
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));

const esc = (s) =>
  String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const has = (s) => String(s || '').trim() !== '';

// 사이트(data.js)와 같은 규칙으로 나눈다: ## [CASE##|EPILOGUE] 라벨 — 부제
function parseEssay(md) {
  const parts = md.split(/^## \[(CASE\d+|EPILOGUE)\]\s*/m);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) {
    const content = parts[i + 1] || '';
    const nl = content.indexOf('\n');
    const title = (nl === -1 ? content : content.slice(0, nl)).trim();
    const dash = title.indexOf('—');
    out.push({
      id: parts[i],
      concept: (dash === -1 ? title : title.slice(0, dash)).trim(),
      subtitle: dash === -1 ? '' : title.slice(dash + 1).trim(),
      blocks: (nl === -1 ? '' : content.slice(nl + 1))
        .split(/\n{2,}/)
        .map((b) => b.trim())
        .filter((b) => b && b !== '---'),
    });
  }
  return out;
}

// 앵커는 사이트에서만 의미가 있다 — 문장만 남긴다.
// 다만 문단 전체가 '참고 · …' 앵커면 PDF에서는 가리킬 곳이 없어지므로 원본 문서로 링크한다.
function essayBlock(b) {
  // '참고 · {{E4:문서 이름}}' 줄(10/04 원고 형식) — 앵커 대신 원본 문서로 링크한 작은 줄
  const ref = b.match(/^(참고 · )\{\{(E\d+):([^}]+)\}\}$/);
  if (ref) {
    const card = cards.find((c) => c.id === ref[2]);
    const text = esc(ref[3]);
    return `<p class="ref">${esc(ref[1])}${card && card.url ? `<a href="${esc(card.url)}">${text} ↗</a>` : text}</p>`;
  }
  const only = b.match(/^\{\{(E\d+):([^}]+)\}\}$/);
  if (only && only[2].startsWith('참고')) {
    const card = cards.find((c) => c.id === only[1]);
    const text = esc(only[2]);
    return `<p class="ref">${card && card.url ? `<a href="${esc(card.url)}">${text} ↗</a>` : text}</p>`;
  }
  const plain = b.replace(/\{\{E\d+:([^}]+)\}\}/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1');
  if (plain.startsWith('### ')) return `<h4>${esc(plain.slice(4))}</h4>`;
  return `<p>${esc(plain).replace(/\n/g, '<br>')}</p>`;
}

const kicker = (id) => (id === 'EPILOGUE' ? ui.common.epilogue_label : fill(ui.common.case_label, { n: id.slice(4) }));

function periodTable(rows) {
  return `<table class="rows">${rows.map(([p, cell]) => `<tr><th class="period">${esc(p)}</th><td>${cell}</td></tr>`).join('')}</table>`;
}

function resumeHtml(r) {
  const m = r.military || {};
  const sec = (title, body) => `<section class="sec"><h2>${esc(title)}</h2>${body}</section>`;
  const out = [];

  out.push(`<header class="who"><h1>${esc(r.name)}</h1>
    <p>${esc(fill(ui.pdf.resume_head, { email: r.email, phone: r.phone }))}</p></header>`);

  out.push(
    sec(
      ui.basic.personal,
      `<table class="grid">
        <tr><th>${esc(ui.basic.name)}</th><td>${esc(r.name)}</td><th>${esc(ui.basic.birth)}</th><td>${esc(r.birth)}</td></tr>
        <tr><th>${esc(ui.basic.phone)}</th><td>${esc(r.phone)}</td><th>${esc(ui.basic.email)}</th><td>${esc(r.email)}</td></tr>
        <tr><th>${esc(ui.basic.address)}</th><td colspan="3">${esc(r.address)}</td></tr>
      </table>`
    )
  );

  if (has(m.period)) {
    out.push(
      sec(
        ui.basic.military,
        `<table class="grid">
          <tr><th>${esc(ui.basic.service_period)}</th><td>${esc(m.period)}</td><th>${esc(ui.basic.branch_rank)}</th><td>${esc(m.branch)} / ${esc(m.rank)}</td></tr>
          <tr><th>${esc(ui.basic.specialty)}</th><td colspan="3">${esc(m.specialty)}</td></tr>
        </table>`
      )
    );
  }

  if ((r.education || []).length) {
    out.push(sec(ui.basic.education, periodTable(r.education.map((e) => [e.period, esc(e.school)]))));
  }

  // 사이트(basic.js)와 같은 규칙 — 이름이 비면 역할만 제목으로 쓴다
  const projects = (r.projects || []).filter((p) => has(p.name) || has(p.role));
  if (projects.length) {
    out.push(
      sec(
        ui.basic.projects,
        periodTable(
          projects.map((p) => [
            p.period,
            `<div class="t">${[p.name, p.role].filter(has).map(esc).join(' — ')}</div>` +
              (has(p.detail) ? `<div class="d">${esc(p.detail)}</div>` : ''),
          ])
        )
      )
    );
  }

  const skills = (r.skills || []).filter((s) => has(s.name));
  if (skills.length) {
    out.push(
      sec(
        ui.basic.skills,
        `<table class="rows skills">${skills
          .map((s) => {
            const level = has(s.level) ? `<div class="t">${esc(s.level)}</div>` : '';
            const notes = (s.notes || []).length ? `<ul>${s.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
            return `<tr><th>${esc(s.name)}</th><td>${level + notes || '&nbsp;'}</td></tr>`;
          })
          .join('')}</table>`
      )
    );
  }

  const play = r.playRecord;
  if (play && has(play.url)) {
    out.push(
      sec(
        play.label,
        `<table class="rows"><tr><th class="period">${esc(play.summary || '')}</th><td>
          <div class="t"><a href="${esc(play.url)}">${esc(play.url.replace(/^https?:\/\//, '').split('?')[0])} ↗</a></div>
          ${has(play.note) ? `<div class="d">${esc(play.note)}</div>` : ''}</td></tr></table>`
      )
    );
  }

  if ((r.experience || []).length) {
    out.push(sec(ui.basic.experience, periodTable(r.experience.map((e) => [e.period, `${esc(e.org)} — ${esc(e.role)}`]))));
  }

  return `<div class="resume">${out.join('\n')}</div>`;
}

function essayHtml(chapters) {
  return chapters
    .map(
      (ch, i) => `<article class="chapter">
        ${i === 0 ? `<h1 class="doc">${esc(ui.pdf.essay_title)}</h1>` : ''}
        <div class="kicker">${esc(kicker(ch.id))}</div>
        <h2>${esc(ch.concept)}</h2>
        ${ch.subtitle ? `<p class="sub">${esc(ch.subtitle)}</p>` : ''}
        <div class="body">${ch.blocks.map(essayBlock).join('\n')}</div>
      </article>`
    )
    .join('\n');
}

const CSS = `
  @page resume { size: A4; margin: 15mm 15mm 15mm 15mm; }
  @page essay  { size: A4; margin: 19mm 19mm 19mm 19mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* 한국어는 어절 단위로 끊는다. 기본값(글자 단위)이면 '생각합니 / 다.', '결 / 정.'처럼 한 글자가 다음 줄로 떨어진다 —
     7월판에도 있던 문제다. 긴 URL만 예외로 어디서든 끊을 수 있게 둔다. */
  body { margin: 0; font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
         word-break: keep-all; overflow-wrap: anywhere; }
  a { color: inherit; text-decoration: none; }

  .resume { page: resume; color: #1c1b18; font-size: 10.5pt; }
  .who h1 { font-size: 20pt; margin: 0; font-weight: 700; }
  .who p { margin: 8pt 0 0; font-size: 10pt; color: #5d594f; }
  .sec { margin-top: 22pt; break-inside: avoid; }
  .sec h2 { font-size: 12pt; margin: 0; padding-bottom: 8pt; border-bottom: 1.2pt solid #1c1b18; }
  table { width: 100%; border-collapse: collapse; margin-top: 10pt; }
  th, td { border: 0.75pt solid #c9c5bc; padding: 6.5pt 7.5pt; text-align: left; vertical-align: top; font-weight: 400; line-height: 1.45; }
  th { background: #f2f0ec; color: #3d3a32; }
  .grid th { width: 74pt; white-space: nowrap; }
  .rows th.period { width: 1%; white-space: nowrap; }
  .skills th { width: 1%; white-space: nowrap; }  /* '데이터 테이블 작성 (Excel)'이 두 줄로 갈라지지 않게 */
  .t { color: #1c1b18; }
  .d { margin-top: 3pt; font-size: 9pt; color: #5d594f; }
  ul { margin: 3pt 0 0; padding-left: 13pt; font-size: 9pt; color: #5d594f; }
  li { margin: 1.5pt 0; }

  .chapter { page: essay; break-before: page; color: #252525; }
  .chapter .doc { font-size: 15pt; margin: 0 0 26pt; font-weight: 700; }
  .kicker { font-size: 9pt; font-weight: 700; color: #77716a; letter-spacing: .02em; }
  .chapter h2 { font-size: 14pt; margin: 6pt 0 0; font-weight: 700; }
  .sub { margin: 8pt 0 0; font-size: 10.5pt; color: #66615b; }
  .body { margin-top: 22pt; font-size: 9.5pt; line-height: 1.63; }
  .body p { margin: 0 0 14pt; }
  .body h4 { font-size: 10.5pt; margin: 18pt 0 8pt; }
  .body .ref { font-size: 9pt; color: #66615b; }
`;

const page = (title, inner) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
  <title>${esc(title)}</title><style>${CSS}</style></head><body>${inner}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const tab = await browser.newPage();
  const targets = [
    ['이력서.pdf', page(fill(ui.pdf.resume_doc_title, { name: resume.name }), resumeHtml(resume))],
    ['이력서_자기소개서.pdf', page(fill(ui.pdf.full_doc_title, { name: resume.name }), resumeHtml(resume) + essayHtml(essay))],
  ];
  for (const [file, html] of targets) {
    await tab.setContent(html, { waitUntil: 'load' });
    await tab.emulateMedia({ media: 'print' });
    // 여백은 CSS @page가 정한다 — 여기서 주면 이력서·자소서의 서로 다른 여백을 덮어쓴다
    await tab.pdf({ path: path.join(root, file), preferCSSPageSize: true, printBackground: true });
    console.log(`✓ ${file}`);
  }
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
