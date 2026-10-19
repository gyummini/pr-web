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

  function card(ev) {
    return `<div class="card">
      <span class="tab">${esc(ev.doc_type || '')}</span>
      <a class="thumb" href="${esc(target(ev))}"><img src="${img(ev.thumb)}" alt=""><span class="chip">${esc(ui.evidence.direct)}</span></a>
      <div class="info"><h3>${esc(ev.title)}</h3><p>${esc(ev.subtitle || '')}</p></div>
      <span class="code">${esc(ev.id)}</span>
    </div>`;
  }
  function cardsHtml(list) {
    let out = '';
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i]; const b = list[i + 1];
      if (b && a.pair === b.id && b.pair === a.id) {
        const m = a.doc_map || b.doc_map;
        out += `<div class="bundle"><p class="bundle-h">${esc(m.title)}</p><div class="bundle-row">${card(a)}
          <a class="spine" href="${esc(m.hub.url)}"><span class="ring"></span><span class="spine-n">${esc(m.hub.name)} ↗</span><span class="ring"></span></a>${card(b)}</div></div>`;
        i += 1;
      } else out += card(a);
    }
    return out;
  }
  const group = (g) => `<section class="group g-${g.id}${g.minor ? ' minor' : ''}"><h2>${esc(g.label)} <span>${g.cards.length}</span></h2><div class="cards">${cardsHtml(g.cards)}</div></section>`;
  const doc = groups.find((g) => g.id === 'doc');
  const game = groups.find((g) => g.id === 'game');
  const rest = groups.filter((g) => g !== doc && g !== game);
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
  .cols .g-game { position: relative; }
  .cols .g-game::before { content: ''; position: absolute; left: -4.6mm; top: 0; bottom: 0; border-left: 1pt dashed #a59c8a; }
  .group h2 { margin: 0 0 4.5mm; font-size: 10.5pt; border-left: 3pt solid #b23a2f; padding-left: 2.5mm; }
  .group h2 span { font-weight: 400; color: #5d594f; font-size: 9pt; }
  .group.minor h2 { border-left-color: #c9c5bc; color: #5d594f; }
  .cards { display: grid; gap: 7mm 5mm; }
  .g-doc .cards { grid-template-columns: 1fr 1fr; }
  .g-game .cards { grid-template-columns: 1fr; }
  .minor .cards { grid-template-columns: repeat(3, 1fr); }
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
  .bundle { grid-column: 1 / -1; }
  .bundle-h { margin: 0 0 1.5mm; font-size: 7pt; color: #5d594f; font-weight: 700; }
  .bundle-row { display: grid; grid-template-columns: 1fr 9mm 1fr; background: #3d372f; border-radius: 2mm; padding: 6.5mm 3mm 3mm; gap: 0; }
  .spine { display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 2mm 0; }
  .ring { width: 6mm; height: 2.4mm; border-radius: 2mm; background: linear-gradient(#e9e5dc, #9d968a); }
  .spine-n { writing-mode: vertical-rl; background: #fff; color: #26241f; font-size: 6.5pt; font-weight: 700; padding: 2mm 0.8mm; border-radius: 0.8mm; }
  .foot { font-size: 7pt; color: #6d695e; text-align: right; }
  </style></head><body>
  <div class="sheet">${head}<div class="cols">${group(doc)}${group(game)}</div></div>
  <div class="sheet">${head}${rest.map(group).join('')}<p class="foot"><a href="${esc(site)}">${esc(site.replace(/^https?:\/\//, ''))}</a></p></div>
  </body></html>`;
}

module.exports = { portfolioHtml };
