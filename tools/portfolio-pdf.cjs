// 포트폴리오만 모은 PDF(포트폴리오.pdf) — build-pdf.cjs가 이력서 PDF와 함께 만든다(10/19 사용자 요청).
// A4 가로, 보관함과 같은 모양: 마닐라 파일철 카드, 짝 증거(E6 · E7)는 짙은 파일철 한 묶음과 철끈의 공유 엑셀,
// 넓은 화면처럼 기획 문서는 왼쪽 두 칸 · 게임은 오른쪽 한 칸(쑥색 파일철, 사이 점선), 추가 포트폴리오는 다음 쪽.
// 카드에는 제목과 부제만(사용자 결정). 썸네일을 누르면 원본 문서 — 원본이 따로 없는 증거(E3 회고)는 사이트의 그 페이지.
// '미확인 증거' 흐림 · 도장은 모으는 놀이라 PDF에는 없다. 글은 모두 데이터와 화면 문구(확정)에서 읽는다
const fs = require('node:fs');
const path = require('node:path');

function portfolioHtml({ root, data, ui, resume }) {
  const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (v[k] === undefined ? m : String(v[k])));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cards = data.evidences.filter((e) => !e.hidden);
  const byNo = (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1));
  const groups = data.groups.map((g) => ({ ...g, cards: cards.filter((c) => c.group === g.id).sort(byNo) }));
  const img = (p) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, p)).toString('base64');
  const site = resume.site;
  const target = (ev) => ev.url || `${site}/evidence/${ev.id}/interactive`;
  const main = groups.filter((g) => !g.minor).reduce((n, g) => n + g.cards.length, 0);
  const minor = groups.filter((g) => g.minor).reduce((n, g) => n + g.cards.length, 0);
  const count = minor ? fill(ui.common.portfolio_count_minor, { main, minor }) : fill(ui.common.portfolio_count, { main });

  // 짝 증거(E6 · E7)는 두 파일철에 같은 엑셀 쪽지를 각각 붙인다(사이트 보관함과 같다, 10/19)
  function xlsx(ev) {
    const m = ev.doc_map || (ev.pair && (data.evidences.find((e) => e.id === ev.pair) || {}).doc_map);
    if (!m || !m.hub) return '';
    const partner = (m.docs.find((d) => d.eid !== ev.id) || {}).eid || '';
    return `<a class="xlsx" href="${esc(m.hub.url)}"><span class="xi">xlsx</span><span class="xt"><b>${esc(m.hub.name)} ↗</b><span>${esc((m.labels || {}).partner || '')} ${esc(partner)}</span></span></a>`;
  }
  function card(ev) {
    return `<div class="card">
      <span class="tab">${esc(ev.doc_type || '')}</span>
      <a class="thumb" href="${esc(target(ev))}"><img src="${img(ev.thumb)}" alt=""><span class="chip">${esc(ui.evidence.direct)}</span></a>
      <div class="info"><h3>${esc(ev.title)}</h3><p>${esc(ev.subtitle || '')}</p></div>${xlsx(ev)}
      <span class="code">${esc(ev.id)}</span>
    </div>`;
  }
  // 대표작(SSR) — 1쪽 한 줄. 수사 파일 위 SSR 특별 도장, 와인색과 금빛 테두리. 썸네일을 누르면 원본(E3은 사이트 회고)
  function pick(ev) {
    const p = ev.pick || {};
    return `<div class="card pick">
      <span class="tab">${esc(ev.doc_type || '')}</span><span class="seal">SSR</span>
      <a class="thumb" href="${esc(target(ev))}"><img src="${img(ev.thumb)}" alt=""><span class="chip">${esc(ev.url ? ui.evidence.direct : ui.evidence.open_retro)}</span></a>
      <div class="info"><h3>${esc(ev.title)}</h3><p>${esc(p.question || ev.subtitle || '')}</p><p class="note">${esc(p.doc_note || '')}</p></div>${xlsx(ev)}
      <span class="code">${esc(ev.id)}</span>
    </div>`;
  }
  const picks = cards.filter((c) => c.rank === 'SSR').sort(byNo);
  const shelf = data.groups.map((g) => ({ ...g, cards: cards.filter((c) => c.group === g.id && c.rank !== 'SSR').sort(byNo) })).filter((g) => g.cards.length);
  const group = (g) => `<section class="group g-${g.id}${g.minor ? ' minor' : ''}"><h2>${esc(g.label)} <span>${g.cards.length}</span></h2><div class="cards">${g.cards.map(card).join('')}</div></section>`;
  const doc = shelf.find((g) => g.id === 'doc');
  const side = shelf.filter((g) => g !== doc);
  const NOTE = ui.pdf.portfolio_site_note || '';
  const head = `<header class="head"><div><h1>${esc(ui.evidence.title)}</h1><p class="lead">${esc(count)}</p></div>
    <div class="who"><b>${esc(resume.name)}</b><span class="site"><span class="note">${esc(NOTE)}</span><a href="${esc(site)}">${esc(site.replace(/^https?:\/\//, ''))}</a></span></div></header>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(resume.name)} ${esc(ui.evidence.title)}</title><style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #26241f; word-break: keep-all; }
  a { color: inherit; text-decoration: none; }
  .sheet { width: 297mm; height: 210mm; padding: 11mm 13mm; background: #eceae4; overflow: hidden; break-after: page; display: flex; flex-direction: column; gap: 6mm; }
  .sheet:last-child { break-after: auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 0.6pt solid #c9c5bc; padding-bottom: 3.5mm; }
  .head h1 { margin: 0; font-size: 17pt; }
  .head .lead { margin: 1.5mm 0 0; font-size: 9pt; color: #5d594f; }
  .who { text-align: right; font-size: 9pt; color: #5d594f; display: grid; gap: 1mm; }
  .who b { font-size: 11pt; color: #26241f; }
  .who .site { display: flex; gap: 2.5mm; align-items: baseline; justify-content: flex-end; }
  .who .note { color: #5d594f; }
  .who a { color: #1a56c4; text-decoration: underline; text-decoration-thickness: .6pt; }
  .cols { display: grid; grid-template-columns: 2fr 1fr; gap: 0 9mm; flex: 1; min-height: 0; }
  .side { display: flex; flex-direction: column; gap: 7mm; position: relative; }
  .cols .side::before { content: ''; position: absolute; left: -4.6mm; top: 0; bottom: 0; border-left: 1pt dashed #a59c8a; }
  .group h2 { margin: 0 0 4.5mm; font-size: 10.5pt; border-left: 3pt solid #b23a2f; padding-left: 2.5mm; }
  .group h2 span { font-weight: 400; color: #5d594f; font-size: 9pt; }
  .group.minor h2 { border-left-color: #c9c5bc; color: #5d594f; }
  .cards { display: grid; gap: 7mm 5mm; }
  .g-doc .cards { grid-template-columns: 1fr 1fr; }
  .side .cards { grid-template-columns: 1fr; }
  .card { position: relative; background: #f1e9d6; border: 0.8pt solid #d6c9ab; border-radius: 0 2mm 2mm 2mm; padding: 3mm 3mm 2.5mm; display: flex; flex-direction: column; gap: 2mm; }
  .g-game .card { background: #e3e7dc; border-color: #bfc7b3; }
  .g-game .tab { background: #e3e7dc; border-color: #bfc7b3; }
  .tab { position: absolute; left: -0.8pt; top: -4.2mm; height: 4.2mm; padding: 0 3mm; font-size: 6.5pt; line-height: 4.2mm; background: #f1e9d6; border: 0.8pt solid #d6c9ab; border-bottom: 0; border-radius: 1.5mm 1.5mm 0 0; color: #5d594f; }
  .thumb { position: relative; display: block; background: #fff; padding: 1.2mm; box-shadow: 0 0.5mm 1.5mm rgba(0,0,0,.12); }
  .thumb img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
  .g-game .thumb img { aspect-ratio: 16 / 7.4; }
  .chip { position: absolute; right: 2mm; bottom: 2mm; font-size: 6.5pt; padding: 0.5mm 2mm; border-radius: 9pt; background: rgba(255,255,255,.94); border: 0.6pt solid #b23a2f; color: #b23a2f; font-weight: 700; }
  .info h3 { margin: 0; font-size: 9pt; line-height: 1.35; }
  .info p { margin: 0.8mm 0 0; font-size: 7.5pt; color: #5d594f; line-height: 1.4; }
  .code { position: absolute; right: 3mm; top: -3.6mm; font-size: 6.5pt; color: #6d695e; }
  .picks h2 { border-left-color: #a97c1f; }
  .picks .cards { grid-template-columns: repeat(3, 1fr); gap: 9mm 7mm; }
  .card.pick { border: 1.6pt solid #8c1d16; box-shadow: 0 0 0 0.8pt #d9b45a inset, 0 1mm 3mm rgba(140,29,22,.18); padding: 4mm 4mm 3.5mm; gap: 2.5mm; }
  .card.pick .tab { border: 1.6pt solid #8c1d16; border-bottom: 0; left: -1.6pt; }
  .seal { position: absolute; top: -6mm; right: -4mm; z-index: 2; width: 17mm; height: 17mm; border-radius: 50%; display: grid; place-items: center;
          background: radial-gradient(circle at 35% 30%, #fbe9a9, #d9b45a 55%, #a97c1f); border: 0.9mm solid #8c1d16;
          box-shadow: inset 0 0 0 1.1mm rgba(255,246,214,.75), inset 0 0 0 1.5mm #8c1d16; transform: rotate(-12deg);
          font-size: 13pt; font-weight: 900; color: #8c1d16; }
  .card.pick h3 { font-size: 11pt; }
  .card.pick .info p { font-size: 8.5pt; }
  .card.pick .info .note { margin-top: 1.5mm; font-size: 7.5pt; color: #8c1d16; font-weight: 700; }
  .xlsx { display: flex; align-items: center; gap: 2mm; padding: 1.5mm 2.5mm; background: #fff; border: 0.6pt solid #b9cdb9; border-radius: 1mm; }
  .xi { padding: 0.4mm 1.2mm; border-radius: 0.6mm; background: #2f6b3a; color: #fff; font-size: 6pt; font-weight: 800; }
  .xt { display: grid; } .xt b { font-size: 7.5pt; } .xt span { font-size: 6.5pt; color: #5d594f; }
  .foot { font-size: 7pt; color: #6d695e; text-align: right; }
  </style></head><body>
  <div class="sheet">${head}<section class="group picks"><h2>${esc(ui.evidence.pick_title)} <span>${picks.length}</span></h2><div class="cards">${picks.map(pick).join('')}</div></section></div>
  <div class="sheet">${head}<div class="cols">${doc ? group(doc) : '<div></div>'}<div class="side">${side.map(group).join('')}</div></div></div>
  </body></html>`;
}

module.exports = { portfolioHtml };
