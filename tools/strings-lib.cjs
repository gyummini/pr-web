// 화면 문구의 위치(키) 규칙 — Text/strings.csv, GPT 요청문, 문구 검사, 출처 조사가 모두 이 규칙을 쓴다.
//
// 문구는 원래 자리(데이터 파일)에 그대로 있다. 키는 그 자리를 가리키는 주소일 뿐이다.
//   E5.brief.labels.caption   증거 카드 JSON — 증거 id로 시작
//   groups.doc.name            증거 카드 JSON의 묶음
//   intro.notice.title         스크립트_인트로.json      (별칭.경로)
//   ui.evidence.title          콘텐츠_화면문구.json — 화면 공통 문구(버튼·안내)
//   html.title                 index.html — 링크 미리보기·첫 화면이 스크립트 없이 떠야 해서 HTML에 남은 문구
//   essay.CASE01.label         콘텐츠_자기소개서.md의 장 제목 라벨('## [CASE01] 라벨 — 부제'의 라벨). 부제·본문은 사용자 원고라 키가 없다
// 배열은 원소에 id가 있으면 id로, 없으면 0부터 세는 번호로 가리킨다(E5.brief.sets.writer.name, intro.lines.3.text).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const EVIDENCE = '콘텐츠_증거카드.json';
const ALIASES = {
  intro: '스크립트_인트로.json',
  ending: '스크립트_엔딩.json',
  notebook: '콘텐츠_수사수첩.json',
  resume: 'data/resume.json',
  ui: '콘텐츠_화면문구.json',
};
// 스크립트 없이 읽혀야 하는 문구만 index.html에 둔다. 패턴의 첫 괄호가 문구다.
const HTML = {
  'html.title': /<title>([^<]*)<\/title>/,
  'html.og_title': /<meta property="og:title" content="([^"]*)"/,
  'html.og_description': /<meta property="og:description" content="([^"]*)"/,
  'html.brand': /<a class="brand" href="\/intro">([^<]*)</,
  'html.brand_sub': /<span class="brand-sub">([^<]*)<\/span>/,
  'html.nav.basic': /data-tab="basic">([^<]*)<\/a>/,
  'html.nav.dossier': /data-tab="dossier">([^<]*)<\/a>/,
  'html.nav.evidence': /data-tab="evidence">([^<]*?)\s*<span/,
};
const HANGUL = /[가-힣]/;
const ESSAY = '콘텐츠_자기소개서.md';
const essayHeading = (id) => new RegExp('^## \\[' + id + '\\][ \\t]*(.+?)[ \\t]+—[ \\t]+', 'm');
// 데이터에 있지만 화면에 나가지 않는 문구 — GPT 요청문과 문구 목록에서 뺀다.
const NOT_SHOWN = [
  /^intro\.skip_behavior\./, // 동작 설명(개발 메모)
  /^ending\.on_complete\./, // 동작 설명(개발 메모)
  /^intro\.notice\./, // 첫 진입 메모 — 10/04 사용자 요청으로 끔(notice.off). 다시 켜면 이 줄을 지운다
  /^E7\.unlock_condition$/, // 코드가 읽지 않는다(옛 해금 조건 설명)
  // 10/03 E5 개편으로 화면에서 빠진 것. 확정 문구라 지우지 않고 남겨 뒀다 — 지울지는 사용자 결정.
  /^E5\.brief\.labels\.(diff_title|diff_added|diff_moved|moved_from|moved_rule|diff_same|summary_title|limit|ready|finished|no_set)$/,
  /^E5\.brief\.(summary|same_items)\./,
  /^E5\.brief\.sets\.[^.]+\.effect$/,
  // 10/04 E3을 '직접 해 보는 판단'(cut_play)으로 다시 짜며 화면에서 빠진 것 — 다섯 단계 화면의 글. 확정 문구라 지우지 않았다.
  /^E3\.brief\.lead\.prompt$/,
  /^E3\.brief\.labels\.(nav|chapter|diagram|idle|retry|skip|back|restart|next|cut_economy|cut_mining|add_context|show_result|economy_weight|economy_verdict|discovery|compare|before|after|cut_record|none_cut|action|context|action_line|context_question|context_found|social_label|final_detail|rules|core_code)$/,
  /^E3\.brief\.labels\.social\./,
  /^E3\.brief\.chapters\.(0|1|3|4)\./,
  /^E3\.brief\.chapters\.2\.(name|verb|body|source)$/, // 남는 것은 질문(title)과 관찰(question) — 판단 칸
  /^E3\.brief\.systems\.(mining|economy)\.(tag|detail|status|cut)$/, // 남는 것은 칸 이름(title)과 설명(note)
  /^E3\.brief\.systems\.market\./,
  /^E3\.brief\.(economy_rules|comparison|targets|rhythm|lessons)\./,
  // 10/07 E8을 '결정 장부'로 다시 짜며 화면에서 빠진 것 — 좁은 화면의 장 목록 알약(첫 화면의 장부가 대신한다). 확정 문구라 지우지 않았다.
  /^E8\.brief\.labels\.toc$/,
  // 10/07 사용자 지시로 08장의 '시기 | 있었던 일' 표와 출처 목록을 뺐다 — 출처 목록의 머리 라벨만 남았다(확정 문구라 지우지 않음).
  /^E8\.brief\.labels\.sources$/,
  // 10/07 사용자 결정으로 문서만 모아보기(/docs)와 보관함의 그 버튼을 뺐다 — 문구는 확정본이라 남겨 둠(지울지는 사용자 결정).
  /^ui\.docs\./,
  /^ui\.evidence\.to_docs$/,
];
const shown = (key) => !NOT_SHOWN.some((re) => re.test(key));

const cache = new Map();
function readText(file) {
  const abs = path.join(ROOT, file);
  if (!cache.has(abs)) cache.set(abs, fs.readFileSync(abs, 'utf8'));
  return cache.get(abs);
}
function readJSON(file) { return JSON.parse(readText(file)); }

// 키 → { file, segs } (segs는 파일 안의 경로)
function locate(key) {
  const segs = key.split('.');
  if (segs[0] === 'essay') {
    if (segs.length !== 3 || segs[2] !== 'label') throw new Error(`자기소개서는 장 제목 라벨만 키가 있다: ${key}`);
    return { file: ESSAY, segs: null, essay: segs[1] };
  }
  if (segs[0] === 'html') return { file: 'index.html', segs: null };
  if (ALIASES[segs[0]]) return { file: ALIASES[segs[0]], segs: segs.slice(1) };
  if (/^E\d+$/.test(segs[0])) return { file: EVIDENCE, segs: ['evidences', ...segs] };
  if (segs[0] === 'groups') return { file: EVIDENCE, segs };
  throw new Error(`알 수 없는 키: ${key}`);
}

function step(node, seg) {
  if (Array.isArray(node)) {
    const byId = node.find((x) => x && typeof x === 'object' && x.id === seg);
    if (byId) return byId;
    return /^\d+$/.test(seg) ? node[Number(seg)] : undefined;
  }
  return node && typeof node === 'object' ? node[seg] : undefined;
}

// 키가 가리키는 현재 문구. 없으면 undefined.
function resolve(key) {
  const { file, segs, essay } = locate(key);
  if (essay) {
    const m = readText(file).match(essayHeading(essay));
    return m ? m[1] : undefined;
  }
  if (!segs) {
    const m = readText(file).match(HTML[key] || /$^/);
    return m ? m[1] : undefined;
  }
  const node = nodeAt(key);
  return typeof node === 'string' ? node : undefined;
}

// 키가 가리키는 데이터 그대로(문자열·객체·배열) — JSON 데이터의 키만. 장 번호나 그림 꼬리표처럼 문구 둘레를 읽을 때 쓴다.
function nodeAt(key) {
  const { file, segs } = locate(key);
  if (!segs) return undefined;
  let node = readJSON(file);
  for (const seg of segs) node = step(node, seg);
  return node;
}

// 파일 하나의 모든 문자열을 키와 함께 꺼낸다. _로 시작하는 키(설명)는 화면에 나가지 않으므로 뺀다.
function walkFile(alias) {
  const file = alias === null ? EVIDENCE : ALIASES[alias];
  if (!fs.existsSync(path.join(ROOT, file))) return [];
  const out = [];
  const visit = (node, key) => {
    if (typeof node === 'string') { out.push({ key, text: node, file }); return; }
    if (Array.isArray(node)) {
      node.forEach((x, i) => visit(x, `${key}.${x && typeof x === 'object' && typeof x.id === 'string' ? x.id : i}`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) if (!k.startsWith('_')) visit(v, key ? `${key}.${k}` : k);
    }
  };
  const data = readJSON(file);
  if (alias === null) {
    visit(data.groups, 'groups');
    for (const ev of data.evidences) visit(ev, ev.id);
  } else {
    visit(data, alias);
  }
  return out;
}

// 화면에 나가는 문구 전부(한글이 있는 것). 키 규칙과 resolve가 서로 맞는지는 검사가 확인한다.
// includeHidden: 화면에 안 나오는 데이터 문구(NOT_SHOWN)까지 — [임시] 검사처럼 빠짐없이 봐야 할 때.
function allStrings({ hangulOnly = true, includeHidden = false } = {}) {
  const rows = [null, ...Object.keys(ALIASES)].flatMap(walkFile);
  for (const key of Object.keys(HTML)) {
    const text = resolve(key);
    if (text !== undefined) rows.push({ key, text, file: 'index.html' });
  }
  for (const m of readText(ESSAY).matchAll(/^## \[(CASE\d+|EPILOGUE)\]/gm)) {
    const key = `essay.${m[1]}.label`;
    const text = resolve(key);
    if (text !== undefined) rows.push({ key, text, file: ESSAY });
  }
  return rows.filter((r) => (!hangulOnly || HANGUL.test(r.text)) && (includeHidden || shown(r.key)));
}

// 키를 받아 사람이 알아보는 화면 이름을 돌려준다 — GPT 요청문을 화면 단위로 묶을 때 쓴다.
const UI_SCREENS = {
  common: '여러 화면 공통', basic: '이력서', dossier: '자기소개서(진술 기록)', evidence: '포트폴리오(증거 보관함)',
  detail: '증거 상세', brief: '인터랙티브 페이지 공통', popup: '증거 팝업', docs: '문서만 모아보기(/docs)',
  notebook: '클루의 수사 수첩', notfound: '없는 주소', toast: '알림', opening: '오프닝 표지', error: '오류 화면',
  pdf: 'PDF(이력서·자기소개서)',
};
function screenOf(key) {
  const s = key.split('.');
  if (/^E\d+$/.test(s[0])) {
    if (s[1] === 'brief') return `${s[0]} 인터랙티브 페이지`;
    if (s[1] === 'memo') return `${s[0]} 요약 메모(팝업)`;
    return `${s[0]} 증거 카드`;
  }
  if (s[0] === 'groups') return '포트폴리오(증거 보관함)';
  if (s[0] === 'ui') return UI_SCREENS[s[1]] || `화면 문구 · ${s[1]}`;
  return { intro: '인트로 대화', ending: '엔딩 대화', notebook: '클루의 수사 수첩', resume: '이력서', html: '머리글 · 링크 미리보기', essay: '자기소개서(진술 기록)' }[s[0]] || s[0];
}

// --- Text/strings.csv ---------------------------------------------------------------
const CSV = path.join(ROOT, 'Text', 'strings.csv');
const HEADER = ['key', 'status', 'context', 'text'];

function parseCSV(raw) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const src = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const csvField = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function readLedger() {
  if (!fs.existsSync(CSV)) return [];
  const [head, ...rows] = parseCSV(fs.readFileSync(CSV, 'utf8')).filter((r) => r.some((f) => f !== ''));
  if (!head || head.join(',') !== HEADER.join(',')) throw new Error(`Text/strings.csv 머리 행은 ${HEADER.join(',')} 이어야 한다`);
  return rows.map((r, i) => ({ line: i + 2, key: r[0], status: r[1], context: r[2], text: r[3], extra: r.length - 4 }));
}
function writeLedger(rows) {
  const lines = [HEADER.join(','), ...rows.map((r) => HEADER.map((h) => csvField(r[h] ?? '')).join(','))];
  fs.writeFileSync(CSV, '﻿' + lines.join('\r\n') + '\r\n');
}

// --- 데이터 파일에 문구 쓰기 (GPT 확정 문구 반영) ------------------------------------
// 파일은 JSON.stringify(…, null, 2) 형식 그대로라 다시 써도 바뀐 값 말고는 한 바이트도 달라지지 않는다.
function writeValue(key, text) {
  const { file, segs, essay } = locate(key);
  const abs = path.join(ROOT, file);
  const raw = fs.readFileSync(abs, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  if (essay) {
    const re = essayHeading(essay);
    const m = raw.match(re);
    if (!m) throw new Error(`자기소개서에서 ${key} 자리를 찾지 못했다`);
    if (text.includes('—') || /\r|\n/.test(text)) throw new Error(`${key}: 장 제목 라벨에는 '—'나 줄바꿈을 넣을 수 없다(부제와 가르는 표시)`);
    fs.writeFileSync(abs, raw.replace(re, (all, label) => all.replace(label, text)));
  } else if (!segs) {
    const pattern = HTML[key];
    if (!pattern || !pattern.test(raw)) throw new Error(`index.html에서 ${key} 자리를 찾지 못했다`);
    fs.writeFileSync(abs, raw.replace(pattern, (m, old) => m.replace(old, text)));
  } else {
    const data = JSON.parse(raw);
    let parent = data;
    for (const seg of segs.slice(0, -1)) parent = step(parent, seg);
    const last = segs[segs.length - 1];
    const slot = Array.isArray(parent) ? (/^\d+$/.test(last) ? Number(last) : -1) : last;
    if (parent == null || typeof parent[slot] !== 'string') throw new Error(`${key}는 문구 자리가 아니다`);
    parent[slot] = text;
    fs.writeFileSync(abs, JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol);
  }
  cache.delete(abs);
}

module.exports = { ROOT, ALIASES, HTML, HANGUL, NOT_SHOWN, shown, resolve, nodeAt, allStrings, screenOf, readLedger, writeLedger, writeValue, CSV, HEADER };
