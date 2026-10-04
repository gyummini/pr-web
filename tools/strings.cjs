// 화면 문구를 GPT와 주고받는 도구 — Text/strings.csv(확정본이 아닌 문구의 목록)를 다룬다.
//
//   node tools/strings.cjs request [화면]   DRAFT 문구를 화면별로 묶은 GPT 요청문 → Text/GPT_요청문.md (화면 이름 일부로 좁힐 수 있다: request E8)
//   node tools/strings.cjs apply <답.txt>    GPT 답(키 = 문구)을 데이터에 그대로 넣고 FINAL로 바꾼다
//   node tools/strings.cjs flag <키> <맥락>   확정 문구를 다시 쓸 목록에 올린다(문구는 그대로 둔다)
//   node tools/strings.cjs check            목록·데이터·코드가 서로 맞는지 검사(npm test에 포함)
//
// 규칙(전역 문구 규칙): 화면 문구의 최종본은 GPT가 쓴다. Claude는 [임시] 문구만 넣고 목록에 DRAFT로 올린다.
// FINAL 문구는 고치지 않는다 — 다시 쓰려면 flag로 목록에 올리고, 받은 답은 한 글자도 바꾸지 않고 넣는다.
// 목록에 없는 문구는 FINAL로 본다. 문구는 원래 자리(데이터 파일)에 있고, 목록의 키는 그 자리를 가리킨다.
const fs = require('node:fs');
const path = require('node:path');
const L = require('./strings-lib.cjs');

const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
const rel = (p) => path.relative(L.ROOT, p).split(path.sep).join('/');

// ---------------------------------------------------------------- request
// 인터랙티브 페이지의 장(E#.brief.chapters.N) 안 문구 — 요청문에서 장마다 묶는다
const CHAPTER = /^(E\d+\.brief\.chapters\.[^.]+)\.(.+)$/;

function request(only) {
  const ledger = L.readLedger();
  const drafts = ledger.filter((r) => r.status === 'DRAFT' && (!only || L.screenOf(r.key).includes(only)));
  if (!drafts.length) {
    console.log(only ? `'${only}' 화면에 다시 쓸 문구가 없다` : '다시 쓸 문구가 없다 (Text/strings.csv에 DRAFT 행 없음)');
    return;
  }
  const draftKeys = new Set(drafts.map((r) => r.key));
  const all = L.allStrings();
  const used = usedLabelNames();
  const screens = new Map();
  for (const r of drafts) {
    const s = L.screenOf(r.key);
    if (!screens.has(s)) screens.set(s, []);
    screens.get(s).push(r);
  }

  const out = [];
  out.push(`# 화면 문구 요청 — ${today()}`, '');
  out.push('게임 기획 직무 지원자의 포트폴리오 웹사이트(사건 파일을 뒤지는 탐정 게임 컨셉)에 들어갈 문구입니다.');
  out.push('아래 [다시 쓸 문구]만 검수해 주세요. 고칠 필요가 없으면 지금 문구를 그대로 답해도 됩니다(그것도 확정입니다).', '');
  out.push('- 사실을 바꾸거나 더하지 마세요. \'전할 것\'에 적힌 내용만 씁니다.');
  out.push('- {이름} 꼴의 자리표시는 그대로 두세요. 화면에서 값으로 바뀝니다.');
  out.push('- \'길이\' 안내를 지켜 주세요.');
  const keep = drafts.some((r) => CHAPTER.test(r.key)) ? '\'(고치지 않음)\' 줄과 [같은 화면의 다른 문구]' : '[같은 화면의 다른 문구]';
  out.push(`- ${keep}는 고치지 않습니다. 톤을 맞추고 같은 말을 되풀이하지 않는 데만 참고하세요.`, '');
  out.push('답은 아래 형식으로만 주세요. 키는 그대로, 한 줄에 하나씩.', '', '```', '키 = 문구', '```', '');

  // 화면에 나오는 문구를 데이터 순서(= 화면 순서)대로. 한글이 없는 DRAFT도 빠지지 않게 DRAFT는 따로 넣는다.
  const shownKeys = new Set(all.map((s) => s.key));
  const ordered = L.allStrings({ hangulOnly: false }).filter((s) => draftKeys.has(s.key) || shownKeys.has(s.key));

  for (const [screen, rows] of screens) {
    out.push(`## ${screen}`, '', '### 다시 쓸 문구', '');
    // 모든 문구에 똑같이 붙은 맥락은 한 번만 적는다
    const parts = (r) => r.context.split(' | ');
    const common = rows.length > 1 ? parts(rows[0]).filter((p) => rows.every((r) => parts(r).includes(p))) : [];
    if (common.length) out.push('모든 문구에 공통:', '', ...common.map((p) => `- ${p}`), '');
    const printed = new Set();
    const item = (r, kind) => {
      out.push(`- \`${r.key}\`${kind ? ` · ${kind}` : ''}`, `  - 지금: ${r.text}`);
      // 장 안 문구는 장 제목과 블록 종류가 자리를 말해 준다 — 데이터 경로뿐인 '자리'는 뺀다
      for (const p of parts(r)) if (!common.includes(p) && !(kind && /^자리: .*데이터 위치 /.test(p))) out.push(`  - ${p}`);
      out.push('');
      printed.add(r.key);
    };

    // 인터랙티브 페이지의 장 안 문구는 고칠 문장만 떼어 놓으면 앞뒤 흐름이 안 보인다 —
    // 장마다 화면 순서대로 두고, 고치지 않는 문장도 '(고치지 않음)'으로 함께 둔다.
    const inChapter = new Map(rows.filter((r) => CHAPTER.test(r.key)).map((r) => [r.key, r]));
    if (inChapter.size) {
      out.push('장 안의 문구는 장마다 화면 순서대로 둡니다. 키가 붙은 줄만 답해 주세요. \'(고치지 않음)\' 줄은 앞뒤 흐름을 보라고 함께 둔 것입니다.', '');
      const wanted = new Set([...inChapter.keys()].map((k) => k.match(CHAPTER)[1]));
      const chapters = [...new Set(ordered.map((s) => (s.key.match(CHAPTER) || [])[1]))].filter((c) => wanted.has(c));
      for (const pre of chapters) {
        const ch = L.nodeAt(pre) || {};
        const labels = L.nodeAt(pre.replace(/\.chapters\.[^.]+$/, '.labels')) || {};
        out.push(`#### ${[ch.no, ch.word].filter(Boolean).join(' ')}${ch.title ? ` — ${ch.title}` : ''}`, '');
        for (const s of ordered.filter((x) => x.key.startsWith(`${pre}.`))) {
          const sub = s.key.slice(pre.length + 1);
          const kind = blockKind(pre, sub, labels);
          if (inChapter.has(s.key)) item(inChapter.get(s.key), kind);
          else if (!/^(no|word|title)$/.test(sub)) out.push(`- (고치지 않음) ${kind}: ${s.text}`, '');
        }
      }
    }
    const rest = rows.filter((r) => !inChapter.has(r.key));
    if (rest.length && inChapter.size) out.push('#### 장 밖의 문구', '');
    for (const r of rest) item(r, '');
    const missed = rows.filter((r) => !printed.has(r.key));
    if (missed.length) throw new Error(`요청문에서 빠진 DRAFT: ${missed.map((r) => r.key).join(', ')}`);

    // 인터랙티브 페이지 머리에는 증거 제목·부제도 함께 보인다
    const head = new Set(rows.flatMap((r) => (/^E\d+\.brief\./.test(r.key) ? [`${r.key.split('.')[0]}.title`, `${r.key.split('.')[0]}.subtitle`] : [])));
    const refs = all.filter((s) => !draftKeys.has(s.key) && (head.has(s.key) || (L.screenOf(s.key) === screen && isReference(s.key, rows, used))));
    if (refs.length) {
      out.push('### 같은 화면의 다른 문구 (고치지 않음)', '');
      for (const s of refs) out.push(`- \`${s.key}\`: ${s.text}`);
      out.push('');
    }
  }
  const file = path.join(L.ROOT, 'Text', 'GPT_요청문.md');
  fs.writeFileSync(file, out.join('\n'));
  console.log(out.join('\n'));
  console.error(`\n→ ${rel(file)} (DRAFT ${drafts.length}개, 화면 ${screens.size}곳)`);
}

// 같은 화면에서 함께 보이는 글만 참고로 붙인다. 인터랙티브 페이지는 머리말·결론·라벨과 증거 제목만 —
// 카드 이름이나 이벤트 이름까지 붙이면 정작 볼 것이 묻힌다. 코드가 읽지 않는 라벨(화면에 안 나오는 것)은 뺀다.
function isReference(key, rows, used) {
  const m = key.match(/^(E\d+)\.(.+)$/);
  if (!m) return true;
  const [, id, rest] = m;
  if (!rows.some((r) => r.key.startsWith(`${id}.brief.`))) return true;
  if (rest === 'title' || rest === 'subtitle') return true;
  const lab = rest.match(/^brief\.labels\.([^.]+)$/);
  if (lab) return used.has(lab[1]);
  return /^brief\.(lead|recap)\./.test(rest);
}

// 장 안 문구가 화면 어디에 놓이는지 — 블록 이름은 assets/js/briefs/retro.js가 그리는 대로 쓴다.
function blockKind(pre, sub, labels) {
  if (sub === 'word') return '장 이름(장 목록과 옆 목차에 쓰이는 한 단어)';
  if (sub === 'title') return '장 제목';
  const m = sub.match(/^blocks\.(\d+)\.(.+)$/);
  if (!m) return sub;
  const bk = L.nodeAt(`${pre}.blocks.${m[1]}`) || {};
  const p = m[2];
  // 그림 설명 앞에는 '참고'·'결과' 같은 꼬리표가 붙기도 한다
  const tag = (f) => (f && f.tag && labels[`tag_${f.tag}`] ? `(앞에 '${labels[`tag_${f.tag}`]}' 꼬리표)` : '');
  let x;
  if (p === 'verdict') return '장 첫 문단(이 장의 결정과 이유)';
  if (p === 'h') return '소제목';
  if (p === 'p') return '본문 문단';
  if (/^list\.\d+$/.test(p)) return '글머리표 항목';
  if (p === 'figure.caption') return `그림 설명${tag(bk.figure)}`;
  if ((x = p.match(/^pair\.(\d+)\.caption$/))) return `나란히 놓인 두 그림 중 ${['앞', '뒤'][x[1]] || `${Number(x[1]) + 1}번째`} 그림 설명${tag(bk.pair[x[1]])}`;
  if ((x = p.match(/^roles\.(mine|ai)$/))) return `장 끝 '${bk.roles[`${x[1]}_label`] || labels[x[1]]}' 칸`;
  if (/^table\.head\.\d+$/.test(p)) return '표 머리';
  if ((x = p.match(/^table\.rows\.\d+\.(\d+)$/))) return `표 칸('${bk.table.head[x[1]]}' 열)`;
  if (/^sources\.\d+\.label$/.test(p)) return '출처 링크 이름';
  return p;
}

// 코드가 읽는 라벨 이름 — 인터랙티브 페이지 코드에 `.이름` 꼴로 나오는지 본다(어림). 화면에 안 나오는 라벨을 거르는 데만 쓴다.
function usedLabelNames() {
  const names = new Set();
  const dir = path.join(L.ROOT, 'assets', 'js', 'briefs');
  for (const f of fs.readdirSync(dir)) {
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/\.([a-z_][a-z0-9_]*)\b/g)) names.add(m[1]);
  }
  return names;
}

// ---------------------------------------------------------------- apply
function apply(file) {
  if (!file) throw new Error('GPT 답을 담은 파일을 주세요: node tools/strings.cjs apply 답.txt');
  const ledger = L.readLedger();
  const byKey = new Map(ledger.map((r) => [r.key, r]));
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const applied = [];
  for (const line of lines) {
    // GPT가 글머리표나 `키`처럼 감싸 보내는 경우만 벗긴다. 문구 쪽은 앞뒤 공백 말고는 손대지 않는다.
    const m = line.match(/^\s*(?:[-*]\s+)?`?([A-Za-z0-9_.]+)`?\s*=\s?(.*)$/);
    if (!m || !byKey.has(m[1])) continue;
    const [, key, raw] = m;
    const text = raw.trim();
    const row = byKey.get(key);
    if (row.status !== 'DRAFT') throw new Error(`${key}는 DRAFT가 아니다(${row.status}) — 확정 문구는 flag로 먼저 올린다`);
    if (!text) throw new Error(`${key}의 문구가 비어 있다`);
    if (text.startsWith('[임시]')) throw new Error(`${key}: 답에 [임시]가 붙어 있다`);
    // {이름} 자리는 화면에서 값으로 바뀐다 — 빠지거나 이름이 바뀌면 값이 안 들어간다
    const slots = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(',');
    if (slots(text) !== slots(row.text)) throw new Error(`${key}: 자리표시가 다르다 — 지금 {${slots(row.text)}}, 답 {${slots(text)}}`);
    applied.push([row, text]);
  }
  if (!applied.length) throw new Error('목록(DRAFT)에 있는 키를 하나도 찾지 못했다 — 답이 "키 = 문구" 형식인지 확인');
  // 넣기 전에 묶인 문구끼리 맞는지 본다 — 하나라도 어긋나면 아무것도 넣지 않는다
  const after = new Map(applied.map(([row, text]) => [row.key, text]));
  for (const problem of memoProblems((key) => (after.has(key) ? after.get(key) : L.resolve(key)))) throw new Error(problem);
  for (const [row, text] of applied) {
    L.writeValue(row.key, text);
    row.status = 'FINAL';
    row.text = text;
    row.context = `${row.context} | 확정: ${today()}`;
  }
  L.writeLedger(ledger);
  for (const [row, text] of applied) console.log(`FINAL ${row.key} = ${text}`);
  const left = ledger.filter((r) => r.status === 'DRAFT');
  const by = {};
  left.forEach((r) => (by[L.screenOf(r.key)] = (by[L.screenOf(r.key)] || 0) + 1));
  console.log(left.length ? `\n남은 DRAFT ${left.length}개 — ${Object.entries(by).map(([s, n]) => `${s} ${n}`).join(' · ')}` : '\n남은 DRAFT 없음');
}

// 요약 메모의 형광펜(hl)은 같은 행 본문(v) 안의 글자 그대로여야 칠해진다. 본문만 고치면 형광펜이 조용히 사라진다.
function memoProblems(get) {
  const out = [];
  const data = JSON.parse(fs.readFileSync(path.join(L.ROOT, '콘텐츠_증거카드.json'), 'utf8'));
  for (const ev of data.evidences) {
    (ev.memo?.rows || []).forEach((row, i) => {
      if (!row.hl) return;
      const v = get(`${ev.id}.memo.rows.${i}.v`);
      const hl = get(`${ev.id}.memo.rows.${i}.hl`);
      if (typeof v === 'string' && typeof hl === 'string' && !v.includes(hl)) {
        out.push(`${ev.id}.memo.rows.${i}: 형광펜(hl) "${hl}"이 본문(v) 안에 그대로 없다 — 본문을 고쳤으면 hl도 본문 속 글자로 맞춘다`);
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------- flag
function flag(key, context) {
  if (!key || !context) throw new Error('사용: node tools/strings.cjs flag <키> "<맥락: 자리 | 전할 것 | 길이 | 변경 사유>"');
  const text = L.resolve(key);
  if (text === undefined) throw new Error(`키가 가리키는 문구가 없다: ${key}`);
  const ledger = L.readLedger();
  const row = ledger.find((r) => r.key === key);
  if (row && row.status === 'DRAFT') throw new Error(`${key}는 이미 DRAFT로 올라 있다`);
  if (row) Object.assign(row, { status: 'DRAFT', context, text });
  else ledger.push({ key, status: 'DRAFT', context, text });
  L.writeLedger(ledger);
  console.log(`DRAFT ${key} = ${text}`);
}

// ---------------------------------------------------------------- check
// 코드에 남아도 되는 한글: 데이터를 못 읽었을 때의 안내, 데이터 파일 이름·원고 형식 표시, 연결이 끊긴 /making 화면.
const ALLOWED_FILES = {
  'assets/js/data.js': '데이터 파일 이름 · 원고 형식 표시([요약] 등) · 로드 실패 안내(데이터 없이 떠야 함)',
  'assets/js/views/making.js': '연결이 끊긴 /making 화면 — 지울지 사용자 결정 대기',
  'assets/js/figures.js': '연결이 끊긴 /making 화면 — 지울지 사용자 결정 대기',
};
const ALLOWED_FRAGMENTS = {
  'assets/js/main.js': ['사건 파일을 여는 데 실패했습니다', '로컬에서 열었다면 정적 서버(http)로 실행해야 데이터 파일을 불러올 수 있습니다.'],
  'assets/js/text.js': ['화면 문구 없음: ui.'], // 개발자 콘솔 경고 — 화면에 나가지 않는다
};
const UI_KEY = /^(common|opening|basic|dossier|evidence|detail|brief|popup|docs|toast|notfound|error|pdf)\.[a-z_]+$/;

function check() {
  const problems = [];
  const fail = (msg) => problems.push(msg);

  // 1) 목록
  let ledger = [];
  try {
    ledger = L.readLedger();
  } catch (e) {
    fail(e.message);
  }
  const seen = new Set();
  for (const r of ledger) {
    const at = `Text/strings.csv ${r.line}행 ${r.key}`;
    if (r.extra !== 0) fail(`${at}: 칸이 ${4 + r.extra}개다(4개여야 함 — 쉼표가 든 칸은 큰따옴표로 감싼다)`);
    if (seen.has(r.key)) fail(`${at}: 키가 두 번 나온다`);
    seen.add(r.key);
    if (!['DRAFT', 'FINAL'].includes(r.status)) fail(`${at}: status는 DRAFT 또는 FINAL이어야 한다(${r.status})`);
    const now = safeResolve(r.key);
    if (now === undefined) fail(`${at}: 키가 가리키는 문구가 없다`);
    else if (now !== r.text) fail(`${at}: 목록의 text와 데이터가 다르다\n    목록: ${r.text}\n    데이터: ${now}`);
    if (r.status === 'DRAFT' && !r.context.trim()) fail(`${at}: DRAFT에는 context(자리·전할 것·길이)가 있어야 한다`);
    if (r.status === 'FINAL' && /^\[임시\]/.test(r.text)) fail(`${at}: FINAL인데 [임시] 문구다`);
  }

  // 1-2) 요약 메모 형광펜이 본문 안에 있는지
  memoProblems((key) => safeResolve(key)).forEach(fail);

  // 2) [임시] 문구는 반드시 목록에 DRAFT로
  const all = L.allStrings({ includeHidden: true });
  const drafts = new Set(ledger.filter((r) => r.status === 'DRAFT').map((r) => r.key));
  for (const s of all) if (s.text.startsWith('[임시]') && !drafts.has(s.key)) fail(`${s.key}: [임시] 문구인데 Text/strings.csv에 DRAFT 행이 없다`);

  // 3) 데이터 파일은 JSON.stringify(…, null, 2) 꼴이어야 apply가 바뀐 값만 다시 쓸 수 있다
  for (const file of ['콘텐츠_증거카드.json', ...Object.values(L.ALIASES)]) {
    const abs = path.join(L.ROOT, file);
    if (!fs.existsSync(abs)) continue;
    const raw = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
    if (JSON.stringify(JSON.parse(raw), null, 2) + '\n' !== raw) fail(`${file}: 들여쓰기 2칸 JSON 형식이 아니다(형식만 바뀌어도 apply가 파일 전체를 다시 쓴다)`);
  }

  // 4) 코드에 박힌 한글 문구
  const ui = JSON.parse(fs.readFileSync(path.join(L.ROOT, L.ALIASES.ui), 'utf8'));
  for (const file of jsFiles(path.join(L.ROOT, 'assets', 'js'))) {
    const r = rel(file);
    if (ALLOWED_FILES[r]) continue;
    const code = stripComments(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
    code.split('\n').forEach((line, i) => {
      for (const frag of line.split(/\$\{[^}]*\}|<[^>]+>|['"`]/)) {
        const t = frag.replace(/\s+/g, ' ').trim();
        if (!L.HANGUL.test(t)) continue;
        if ((ALLOWED_FRAGMENTS[r] || []).includes(t)) continue;
        fail(`${r}:${i + 1}: 코드에 화면 문구가 있다 — "${t}" (콘텐츠_화면문구.json이나 그 화면의 데이터로 옮긴다)`);
      }
    });
    // 5) 코드가 부르는 ui 키는 데이터에 있어야 한다
    for (const m of code.matchAll(/'([a-z_]+\.[a-z_]+)'/g)) {
      if (UI_KEY.test(m[1]) && typeof get(ui, m[1]) !== 'string') fail(`${r}: 콘텐츠_화면문구.json에 없는 키 — ${m[1]}`);
    }
  }
  const pdf = fs.readFileSync(path.join(L.ROOT, 'tools', 'build-pdf.cjs'), 'utf8');
  for (const m of pdf.matchAll(/\bui\.([a-z_]+\.[a-z_]+)/g)) {
    if (typeof get(ui, m[1]) !== 'string') fail(`tools/build-pdf.cjs: 콘텐츠_화면문구.json에 없는 키 — ${m[1]}`);
  }

  const draftCount = ledger.filter((r) => r.status === 'DRAFT').length;
  if (problems.length) {
    console.error(problems.map((p) => `✖ ${p}`).join('\n'));
    console.error(`\nFAIL 화면 문구: 문제 ${problems.length}건`);
    process.exitCode = 1;
  } else {
    console.log(`PASS 화면 문구: 목록 ${ledger.length}행(DRAFT ${draftCount}) · 데이터 문구 ${all.length}개 · 코드 하드코딩 없음 · ui 키 전부 있음`);
  }
}

function safeResolve(key) {
  try {
    return L.resolve(key);
  } catch {
    return undefined;
  }
}
function get(obj, dotted) {
  return dotted.split('.').reduce((n, k) => (n == null ? undefined : n[k]), obj);
}
function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsFiles(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);
}
// 주석을 공백으로 지운다(줄 수는 그대로). 문자열 안의 //는 건드리지 않는다.
// 템플릿 문자열의 ${ } 안에 든 주석은 문자열로 보이므로, 줄 첫머리 주석은 한 번 더 거른다.
function stripComments(src) {
  let out = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += n ?? ''; i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const chunk = src.slice(i, end < 0 ? src.length : end + 2);
      out += chunk.replace(/[^\n]/g, ' ');
      i += chunk.length - 1;
      continue;
    }
    if (c === '/' && n === '/' && (i === 0 || /[\s;,(){}[\]]/.test(src[i - 1]))) {
      const end = src.indexOf('\n', i);
      i = (end < 0 ? src.length : end) - 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    out += c;
  }
  return out
    .split('\n')
    .map((line) => (/^\s*(\/\/|\*|\/\*)/.test(line) ? '' : line.replace(/(^|\s)\/\/\s.*$/, '')))
    .join('\n');
}

// ---------------------------------------------------------------- main
const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === 'request' || !cmd) request(args.join(' ').trim());
  else if (cmd === 'apply') apply(args[0]);
  else if (cmd === 'flag') flag(args[0], args.slice(1).join(' '));
  else if (cmd === 'check') check();
  else throw new Error(`모르는 명령: ${cmd} (request · apply · flag · check)`);
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exitCode = 1;
}
