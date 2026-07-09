// 모든 콘텐츠는 데이터 파일에서 로드한다. 코드에 텍스트 하드코딩 금지 (명세서 8).
export const DB = {
  cards: null,     // 콘텐츠_증거카드.json → evidences 배열
  intro: null,     // 스크립트_인트로.json
  ending: null,    // 스크립트_엔딩.json
  chapters: null,  // 콘텐츠_자기소개서.md 파싱 결과
  resume: null,    // data/resume.json
  making: null,    // 콘텐츠_제작기.md 파싱 결과 (E7 히든 포트폴리오)
};

async function fetchJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`로드 실패: ${path} (${r.status})`);
  return r.json();
}

async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`로드 실패: ${path} (${r.status})`);
  return r.text();
}

export async function loadAll() {
  const [cardsJson, intro, ending, essayMd, resume, makingMd] = await Promise.all([
    fetchJSON('./콘텐츠_증거카드.json'),
    fetchJSON('./스크립트_인트로.json'),
    fetchJSON('./스크립트_엔딩.json'),
    fetchText('./콘텐츠_자기소개서.md'),
    fetchJSON('./data/resume.json'),
    fetchText('./콘텐츠_제작기.md'),
  ]);
  DB.cards = cardsJson.evidences;
  DB.intro = intro;
  DB.ending = ending;
  DB.chapters = parseEssay(essayMd);
  DB.resume = resume;
  DB.making = parseMaking(makingMd);
  return DB;
}

export function getCard(eid) {
  return DB.cards.find((c) => c.id === eid) || null;
}

export function getChapter(chId) {
  return DB.chapters.find((c) => c.id === chId) || null;
}

// ---- 자기소개서 MD 파서 ----
// 챕터 구분: ## [CASE##] 컨셉 타이틀 — 실명 부제
// 앵커 문법: {{E번호:문장}}
function parseEssay(md) {
  const chapters = [];
  const parts = md.split(/^## \[(CASE\d+)\]\s*/m);
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const content = parts[i + 1] || '';
    const nl = content.indexOf('\n');
    const titleLine = (nl === -1 ? content : content.slice(0, nl)).trim();
    const body = (nl === -1 ? '' : content.slice(nl + 1)).trim();
    const dash = titleLine.indexOf('—');
    const concept = (dash === -1 ? titleLine : titleLine.slice(0, dash)).trim();
    const subtitle = (dash === -1 ? '' : titleLine.slice(dash + 1)).trim();
    chapters.push({ id, concept, subtitle, html: renderBlocks(body) });
  }
  return chapters;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  let out = esc(s);
  out = out.replace(
    /\{\{(E\d+):([^}]+)\}\}/g,
    (m, id, txt) =>
      `<button type="button" class="anchor" data-eid="${id}">${txt}<span class="anchor-ic" aria-hidden="true">🔍</span></button>`
  );
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return out;
}

// ---- 제작기 MD 파서 ----
// 챕터: ## 제목 / 섹션 마커: [요약], [상세] / 블록 마커: [이미지 N-N], [증거링크 E#]
// 문서 끝: [클루 클로징] + "클루: ..." 한 줄
function parseMaking(md) {
  let closing = null;
  const closingMatch = md.match(/^\[클루 클로징\]\s*\n+(.+)$/m);
  if (closingMatch) {
    const line = closingMatch[1].trim();
    const m = line.match(/^(.+?):\s*["“]?(.*?)["”]?$/);
    closing = m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: '클루', text: line };
  }
  const body = closingMatch ? md.slice(0, closingMatch.index) : md;
  const titleMatch = body.match(/^# (.+)$/m);

  const chapters = [];
  const parts = body.split(/^## /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    const content = nl === -1 ? '' : part.slice(nl + 1);
    const secs = { 요약: '', 상세: '' };
    let cur = null;
    for (const line of content.split('\n')) {
      const sm = line.trim().match(/^\[(요약|상세)\]$/);
      if (sm) {
        cur = sm[1];
        continue;
      }
      if (cur) secs[cur] += line + '\n';
    }
    chapters.push({
      heading,
      summary: parseMakingBlocks(secs['요약']),
      detail: secs['상세'].trim() ? parseMakingBlocks(secs['상세']) : null,
    });
  }
  return { title: titleMatch ? titleMatch[1].trim() : '제작기', chapters, closing };
}

function parseMakingBlocks(text) {
  return text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b && b !== '---')
    .map((b) => {
      const img = b.match(/^\[이미지 ([\d-]+)\]$/);
      if (img) return { type: 'img', slot: img[1] };
      const ev = b.match(/^\[증거링크 (E\d+)\]$/);
      if (ev) return { type: 'evlink', eid: ev[1] };
      return { type: 'p', html: inline(b.replace(/\n/g, ' ')) };
    });
}

function renderBlocks(body) {
  return body
    .split(/\n{2,}/)
    .map((raw) => {
      const b = raw.trim();
      if (!b || b === '---') return '';
      if (b.startsWith('### ')) return `<h3>${inline(b.slice(4))}</h3>`;
      return `<p>${inline(b.replace(/\n/g, ' '))}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}
