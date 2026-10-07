// E8 — 개발 회고(PokeCollect) · 결정 장부(10/07). 워드로 쓰던 회고를 웹에 옮긴 문서라 조작은 없고, 읽는 순서만 바꿨다.
//   첫 화면 — 여덟 장의 지도: 가운데 실제 게임 팩(그 아래 기준 '팩을 뜯고 카드를 모으는 재미' — 요약 메모의 나침반과 같은 말),
//             양쪽에서 네 장씩 괄호 선으로 모여 팩을 가리킨다(모든 결정이 이 재미를 향했다). 장을 누르면 그 장으로 간다.
//             오른쪽에는 타이틀 화면과 직접 플레이 버튼이 붙어 따라온다.
//   장     — 왼쪽 기둥에 결정 → 제가 한 일 → 본문, 오른쪽에 그 장의 증거 패널(작은 그림으로 고르는 참고 | 결과, 바닥에 AI가 한 일).
//             붉은 세로줄이 장마다 결정으로 가지를 내고 —
//   끝     — 직접 플레이 버튼으로 들어가며 닫힌다. 비공식 프로젝트 안내는 보이게 두고, 저작권 전문은 접어 둔다.
// 텍스트와 그림 경로는 전부 콘텐츠_증거카드.json에서 온다(brief, 기준은 E8 요약 메모의 compass — 하드코딩 금지).
//
// 블록 종류: verdict(결정) · roles(제가 한 일 → 장 머리, AI가 한 일 → 패널 바닥) · figure · pair(증거 패널).
// 나머지(p · h · list · table · sources)는 본문. 참고 그림 바로 뒤에 결과 그림이 오면(점수 막대처럼 납작한 결과) 한 칸에 위아래로 묶는다.
// 움짤은 소리 없는 짧은 반복 영상(webm)으로 튼다 — 화면에 보일 때만 돌고, 멈춤 단추가 늘 붙어 있고,
// 움직임 줄이기면 첫 장면에서 멈춰 있다. 참고 영상은 처음부터 멈춰 있다(한 번에 움직이는 것은 지원자의 결과 하나).
// 영상을 못 트는 브라우저는 원래 움짤(gif)을 쓴다.
// 넓은 화면(1181px~)에서 껍데기의 머리말(.brief-head · .brief-lead)과 지도 · 표지 패널이 한 격자에 놓이는 것은 retro.css가 정한다.
import { track } from '../analytics.js';
import { takeLanding } from '../landing.js';
import { packCrop } from '../memo.js';

// 화면에 붙는 고정 문구(옆 목차 · 역할 머리 · 출처 · 그림 꼬리표 · 영상 단추) — brief.labels. 한 번에 한 화면만 그리므로 모듈에 둔다.
let L = {};
let uid = 0; // 증거 패널의 탭 ↔ 그림 짝(aria-controls)

const media = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
const reduce = () => media('(prefers-reduced-motion: reduce)');
const wide = () => media('(min-width: 1181px)');

export function playRetro(host, b, _onComplete, ev = {}) {
  L = b.labels || {};
  const chapters = b.chapters || [];
  const clips = videos();
  const root = el('div', 'lg');
  const spine = el('div', 'lg-spine');
  spine.setAttribute('aria-hidden', 'true');

  const secs = chapters.map((ch) => chapter(ch, clips));
  const atlas = map(chapters, compassCore(ev), b.cover?.pack, (i) => goTo(secs[i]));
  const cover = el('section', 'lg-cover');
  const main = el('div', 'lg-cover-main');
  main.appendChild(atlas);
  if (b.cover?.glance) main.appendChild(glance(b.cover.glance));
  // 숫자 · 기간과 도구는 첫 화면 아래로(10/07) — 오른쪽 패널에는 타이틀 화면과 직접 플레이만 남긴다
  if (b.cover) main.appendChild(facts(b.cover));
  cover.appendChild(main);
  // 표지 패널은 칸(.lg-cover-side) 안에서만 따라 내려온다. 넓은 화면에서 .lg-cover가 display: contents로 풀리면
  // 패널의 부모 상자가 페이지 전체(.brief)가 되어 끝까지 따라왔다(10/07) — 머리말 세 줄 높이의 칸으로 묶어 둔다
  if (b.cover) {
    const side = el('div', 'lg-cover-side');
    side.appendChild(coverPanel(b.cover, b.play));
    cover.appendChild(side);
  }

  const end = closing(b);
  const body = el('div', 'lg-chapters');
  const side = chapters.length > 1 ? rail(b, { atlas, secs, credits: end.credits, play: end.play }) : null;
  // 옆 목차는 장보다 앞에 둔다 — Tab 순서가 지도 → 목차 → 장이 된다
  if (side) body.appendChild(side.nav);
  const list = el('div', 'lg-ch-list');
  secs.forEach((s) => list.appendChild(s));
  body.appendChild(list);

  root.append(spine, cover, body, end.el);
  host.appendChild(root);

  // 세로줄은 첫 장의 머리에서 끝의 직접 플레이 버튼 가운데까지(옆 목차가 매달리는 구간). 글 · 그림이 자리를 잡거나
  // 탭 · 접힌 글이 바뀌어 문서 높이가 달라질 때마다 다시 잰다(ResizeObserver — 그리기 주기마다 도는 루프가 아니다)
  const frame = host.closest('.brief') || host;
  const spineTop = () => (secs[0] || body).getBoundingClientRect().top;
  const place = () => placeSpine(spine, frame, spineTop, end.button);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
  ro?.observe(frame);
  window.addEventListener('resize', place);
  place();
  clips.start();
  // 보관함의 '직접 플레이' 칩으로 왔으면 첫 화면의 직접 플레이 버튼(안내문 옆)으로 — 키는 그 버튼을 눌러야 발급된다.
  // 라우터가 그린 뒤 머리말 제목에 초점을 두므로 그다음 차례에 옮기고, '지금 누를 것' 테두리를 세 번만 퍼지게 붙인다
  if (takeLanding('retro') === 'play') {
    const target = root.querySelector('.lg-cta a') || end.button;
    if (target) {
      setTimeout(() => {
        if (!target.isConnected) return;
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
        target.focus({ preventScroll: true });
        target.classList.add('cue', 'cue-step', 'cue-seen');
      }, 0);
    }
  }

  return {
    restart: null,
    destroy() {
      side?.stop();
      ro?.disconnect();
      window.removeEventListener('resize', place);
      clips.stop();
    },
  };
}

// ---------------------------------------------------------------- 첫 화면: 여덟 장의 지도와 표지 패널

// 지도 가운데의 기준 — 요약 메모(팝업)의 나침반과 같은 말이다. 결정할 때마다 이리로 돌아왔다
function compassCore(ev) {
  const row = (ev.memo?.rows || []).find((r) => r.block?.kind === 'compass');
  return row?.block.core || '';
}

// 여덟 장의 지도(10/07 사용자 결정 — 시안 셋 중 A '모이는 선'). 가운데에 실제 게임의 팩, 양쪽에 네 장씩.
// 장마다 괄호 선이 세로줄로 모이고 그 가운데에서 화살표가 팩을 가리킨다. 기준 문구는 팩 바로 아래.
// 장은 번호 · 한 단어 · 장 제목만 — 결정 문장은 그 장 머리에서 읽는다(첫 화면의 정보를 줄인다).
// 누르면 그 장으로 간다(앵커 대신 버튼 — 라우터가 해시를 경로로 바꾸지 않게). 좁은 칸에서는 팩이 위, 장은 아래 두 칸(retro.css)
function map(chapters, core, pack, go) {
  const nav = el('nav', 'lg-map');
  nav.setAttribute('aria-label', L.map);
  nav.tabIndex = -1; // 옆 목차 맨 위 줄이 초점을 이리로 옮긴다
  const half = Math.ceil(chapters.length / 2);
  nav.style.setProperty('--rows', String(half)); // 모으는 세로줄의 길이(첫 장 가운데 ~ 끝 장 가운데)
  // 기준 문구는 문서 순서로는 맨 앞(화면 낭독기가 기준부터 읽는다), 화면에서는 팩 아래(CSS 격자)
  if (core) nav.appendChild(el('p', 'lg-map-core', core));
  const side = (part, from, cls) => {
    const ol = el('ol', `lg-map-side ${cls}`);
    if (from > 1) ol.start = from;
    part.forEach((ch) => {
      const i = chapters.indexOf(ch);
      const li = el('li');
      const button = el('button', 'lg-node');
      button.type = 'button';
      const head = el('span', 'lg-node-head');
      head.append(el('span', 'lg-no', ch.no), el('span', 'lg-word', ch.word));
      button.append(head, el('span', 'lg-node-title', ch.title));
      button.addEventListener('click', () => go(i));
      li.appendChild(button);
      ol.appendChild(li);
    });
    return ol;
  };
  const join = (cls) => { const j = el('span', `lg-map-join ${cls}`); j.setAttribute('aria-hidden', 'true'); return j; };
  const hub = el('span', 'lg-map-pack');
  hub.setAttribute('aria-hidden', 'true');
  packCrop(hub, pack); // 팩 개봉 첫 장면에서 팩만 잘라 보인다 — 요약 메모의 나침반과 같은 팩
  nav.append(side(chapters.slice(0, half), 1, 'is-left'), join('is-left'), hub, join('is-right'), side(chapters.slice(half), half + 1, 'is-right'));
  return nav;
}

function glance(g) {
  const box = el('div', 'rt-glance lg-glance');
  box.appendChild(el('h4', 'rt-glance-title', g.title));
  box.appendChild(list(g.items, 'rt-list'));
  return box;
}

// 오른쪽에 붙어 따라오는 패널: 타이틀 화면 · 직접 플레이
function coverPanel(c, p) {
  const box = el('div', 'lg-panel lg-cover-panel');
  if (c.figure) {
    const fig = el('figure', 'lg-cover-fig');
    fig.appendChild(img(c.figure, { eager: true }));
    if (c.figure.caption) fig.appendChild(el('figcaption', 'lg-cap', c.figure.caption));
    box.appendChild(fig);
  }
  if (p) {
    const cta = el('div', 'lg-cta');
    cta.appendChild(playLink(p, 'cover'));
    if (p.note) cta.appendChild(el('p', 'lg-cta-note', p.note));
    box.appendChild(cta);
  }
  return box;
}

function facts(c) {
  const box = el('div', 'lg-facts');
  if (c.stats?.length) {
    const s = el('div', 'lg-stats');
    c.stats.forEach(([value, label]) => {
      const cell = el('div', 'lg-stat');
      cell.append(el('strong', null, value), el('span', null, label));
      s.appendChild(cell);
    });
    box.appendChild(s);
  }
  if (c.meta?.length) {
    const meta = el('dl', 'lg-meta');
    c.meta.forEach(([k, v]) => meta.append(el('dt', null, k), el('dd', null, v)));
    box.appendChild(meta);
  }
  return box;
}

// 직접 플레이 — /api/play가 개인 키를 발급한다. 라우터가 가로채지 않게, 키 카드는 새 탭에서
function playLink(p, at, cls) {
  const a = el('a', `btn accent${cls ? ` ${cls}` : ''}`, p.label);
  a.href = p.href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.addEventListener('click', () => track('play_click', { evidence: 'E8', at }));
  return a;
}

// ---------------------------------------------------------------- 장

// 장을 왼쪽 기둥(결정 · 제가 한 일 · 본문)과 오른쪽 패널(증거 · AI가 한 일)로 나눈다
function split(ch) {
  const out = { verdict: null, roles: null, body: [], items: [] };
  const blocks = ch.blocks || [];
  for (let i = 0; i < blocks.length; i += 1) {
    const bk = blocks[i];
    if (bk.verdict) out.verdict = bk.verdict;
    else if (bk.roles) out.roles = bk.roles;
    else if (bk.pair) {
      out.items.push({ kind: 'pair', ref: bk.pair.find((f) => f.tag === 'ref') || bk.pair[0], res: bk.pair.find((f) => f.tag === 'result') || bk.pair[1] });
    } else if (bk.figure) {
      const next = blocks[i + 1]?.figure;
      if (bk.figure.tag === 'ref' && next?.tag === 'result') {
        out.items.push({ kind: 'stack', ref: bk.figure, res: next });
        i += 1;
      } else out.items.push({ kind: 'single', fig: bk.figure });
    } else out.body.push(bk);
  }
  return out;
}

function chapter(ch, clips) {
  const parts = split(ch);
  const sec = el('section', 'lg-ch');
  sec.dataset.chapter = ch.no;
  const head = el('div', 'lg-ch-head');
  const label = el('div', 'lg-ch-label');
  label.append(el('span', 'lg-no', ch.no), el('span', 'lg-word', ch.word));
  head.append(label, el('h3', 'lg-ch-title', ch.title));
  if (parts.verdict) head.appendChild(el('p', 'lg-decision', parts.verdict));
  if (parts.roles?.mine) head.appendChild(role('lg-mine', parts.roles.mine_label || L.mine, parts.roles.mine));
  sec.appendChild(head);
  // 문서 순서는 머리 → 증거 패널 → 본문. 넓은 화면에서는 패널만 오른쪽 칸으로 빼서 두 줄에 걸쳐 붙여 둔다(retro.css)
  if (parts.items.length || parts.roles?.ai) sec.appendChild(evidence(ch, parts, clips));
  const body = el('div', 'lg-ch-body');
  parts.body.forEach((bk) => body.appendChild(block(bk)));
  sec.appendChild(body);
  return sec;
}

function role(cls, head, text) {
  const box = el('div', cls);
  box.append(el('strong', null, head), el('p', null, text));
  return box;
}

function evidence(ch, parts, clips) {
  const box = el('div', 'lg-panel lg-ev');
  const nodes = parts.items.map((it) => item(it, clips));
  if (nodes.length > 1) box.appendChild(tabs(nodes, parts.items, ch, clips));
  nodes.forEach((n) => box.appendChild(n));
  // AI가 한 일은 패널 바닥의 한 줄 각주 — 지원자의 결정 · 결과보다 늘 작고 조용하다
  if (parts.roles?.ai) box.appendChild(role('lg-ai', parts.roles.ai_label || L.ai, parts.roles.ai));
  return box;
}

// 장 안의 증거가 여럿이면 패널 머리의 작은 그림(결과 쪽)으로 고른다. 화살표 · Home · End로도 옮긴다
function tabs(nodes, items, ch, clips) {
  const bar = el('div', 'lg-tabs');
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', [ch.no, ch.word].filter(Boolean).join(' '));
  const n = String(parseInt(ch.no, 10) || ch.no);
  const buttons = nodes.map((node, i) => {
    const id = `lg-ev-${(uid += 1)}`;
    node.id = `${id}-panel`;
    node.setAttribute('role', 'tabpanel');
    node.setAttribute('aria-labelledby', `${id}-tab`);
    const tab = el('button', 'lg-tab');
    tab.type = 'button';
    tab.id = `${id}-tab`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', node.id);
    const thumb = el('span', 'lg-tab-thumb');
    const f = items[i].kind === 'single' ? items[i].fig : items[i].res;
    thumb.appendChild(img({ src: f.poster || f.src, w: f.w, h: f.h }));
    tab.append(thumb, el('span', 'lg-tab-no', `${n}-${i + 1}`));
    return tab;
  });
  const select = (k, focus) => {
    buttons.forEach((tab, i) => {
      const on = i === k;
      tab.classList.toggle('on', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      nodes[i].hidden = !on;
    });
    clips.sync();
    if (focus) buttons[k].focus();
  };
  buttons.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (e) => {
      const last = buttons.length - 1;
      const k = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      select(k, true);
    });
    bar.appendChild(tab);
  });
  select(0);
  return bar;
}

function item(it, clips) {
  if (it.kind === 'pair') {
    const box = el('div', 'lg-item lg-pair');
    box.style.setProperty('--pocket', pocketAspect(it.ref, it.res).toFixed(3));
    box.append(side(it.ref, 'ref', clips), side(it.res, 'result', clips));
    return box;
  }
  if (it.kind === 'stack') {
    // 점수 막대처럼 아주 납작한 결과는 위에 전체 폭으로, 참고는 아래 작게
    const box = el('div', 'lg-item lg-stack');
    const res = el('figure', 'lg-side result');
    const bar = el('div', 'lg-frame-bar');
    bar.appendChild(img(it.res));
    res.append(bar, caption(it.res));
    const ref = el('figure', 'lg-side ref');
    ref.append(img(it.ref), caption(it.ref));
    box.append(res, ref);
    return box;
  }
  const f = it.fig;
  const fig = el('figure', 'lg-item lg-single');
  const frame = el('div', 'lg-frame');
  if (f.video) {
    frame.classList.add('lg-pocket');
    frame.style.aspectRatio = `${f.w} / ${f.h}`;
  }
  show(f, frame, true, clips);
  fig.append(frame, caption(f));
  return fig;
}

// 참고 | 결과 한 쌍: 두 칸은 같은 크기. 칸의 비율은 두 그림이 같은 넓이로 담기는 값(두 비율의 기하평균)에서
// 결과 쪽으로 15% 기울인다 — 결과 그림이 참고 그림보다 작게 보이는 일이 없다(다섯 쌍 모두 확인, 10/07)
function pocketAspect(ref, res) {
  const af = ref.w / ref.h;
  const ar = res.w / res.h;
  const p = Math.sqrt(af * ar);
  return ar > af ? Math.min(ar, p * 1.15) : Math.max(ar, p / 1.15);
}

function side(f, kind, clips) {
  const fig = el('figure', `lg-side ${kind}`);
  const pocket = el('div', 'lg-pocket');
  // 바깥이 검은 여백뿐인 녹화(팩 개봉)는 칸을 채운다 — 데이터의 fit
  if (f.fit === 'cover') pocket.classList.add('fill');
  show(f, pocket, kind === 'result', clips);
  fig.append(pocket, caption(f));
  return fig;
}

// 그림이면 그림, 움짤이면 영상. 영상을 못 트는 브라우저는 움짤(움직임 줄이기면 첫 장면 그림)
function show(f, holder, auto, clips) {
  if (f.video && clips.can) { clips.add(f, holder, auto); return; }
  holder.appendChild(img(f.video && f.poster && reduce() ? { ...f, src: f.poster } : f));
}

function caption(f) {
  const cap = el('figcaption');
  if (f.tag && L[`tag_${f.tag}`]) cap.appendChild(el('span', 'lg-tag', L[`tag_${f.tag}`]));
  cap.appendChild(document.createTextNode(f.caption || ''));
  return cap;
}

// 크기를 미리 알려 불러오는 동안 자리가 흔들리지 않게 한다. 캡션이 그림을 설명하므로 alt는 비운다
// (같은 문장이 두 번 읽히거나 복사되지 않게)
function img(f, { eager = false } = {}) {
  const im = document.createElement('img');
  im.src = f.src;
  im.alt = f.caption ? '' : (f.alt || '');
  if (!eager) im.loading = 'lazy';
  im.decoding = 'async';
  if (f.w && f.h) {
    im.width = f.w;
    im.height = f.h;
  }
  return im;
}

// ---------------------------------------------------------------- 움짤 → 짧은 영상

function videos() {
  const probe = document.createElement('video');
  const can = !!(probe.canPlayType && probe.canPlayType('video/webm; codecs="vp9"'));
  const all = [];
  let io = null;
  const shown = (c) => !c.holder.closest('[hidden]');
  const label = (c) => {
    c.icon.className = `lg-vico ${c.want ? 'pause' : 'play'}`;
    c.text.textContent = c.want ? L.video_pause : L.video_play;
  };
  const sync = (c) => {
    const go = c.want && c.seen && shown(c) && !document.hidden;
    if (go && c.video.paused) {
      const p = c.video.play();
      // 저전력 모드처럼 브라우저가 자동 재생을 막으면 '재생' 단추로 남는다(누르면 튼다)
      p?.catch?.((err) => { if (err?.name === 'NotAllowedError' && !c.user) { c.want = false; label(c); } });
    } else if (!go && !c.video.paused) c.video.pause();
  };
  const syncAll = () => all.forEach(sync);
  // 영상을 못 열면(코덱 · 파일 문제) 그 자리를 움짤로 바꾼다
  const fallback = (c) => {
    const i = all.indexOf(c);
    if (i < 0) return;
    all.splice(i, 1);
    io?.unobserve(c.holder);
    c.video.remove();
    c.button.remove();
    c.holder.prepend(img(reduce() && c.f.poster ? { ...c.f, src: c.f.poster } : c.f));
  };
  const onVisibility = () => syncAll();
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  // 움직임 줄이기를 켜면 스스로 돌던 영상은 멈춘다(직접 누른 것은 그대로)
  const onMotion = () => all.forEach((c) => {
    if (c.user) return;
    c.want = c.auto && !reduce();
    label(c);
    sync(c);
  });

  return {
    can,
    add(f, holder, auto) {
      const video = document.createElement('video');
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      video.disablePictureInPicture = true;
      if (f.poster) video.poster = f.poster;
      if (f.w && f.h) {
        video.width = f.w;
        video.height = f.h;
      }
      video.src = f.video;
      const button = el('button', 'lg-vctl');
      button.type = 'button';
      const icon = el('span');
      icon.setAttribute('aria-hidden', 'true');
      const text = el('span');
      button.append(icon, text);
      const c = { f, holder, video, button, icon, text, auto, want: auto && !reduce(), user: false, seen: false };
      button.addEventListener('click', () => {
        c.want = !c.want;
        c.user = true;
        label(c);
        sync(c);
      });
      video.addEventListener('error', () => fallback(c));
      label(c);
      holder.append(video, button);
      all.push(c);
    },
    sync: syncAll,
    start() {
      if (typeof IntersectionObserver === 'function') {
        io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            const c = all.find((x) => x.holder === e.target);
            if (!c) return;
            c.seen = e.isIntersecting && e.intersectionRatio >= 0.25;
            sync(c);
          });
        }, { threshold: [0, 0.25, 0.6] });
        all.forEach((c) => io.observe(c.holder));
      } else {
        all.forEach((c) => { c.seen = true; });
        syncAll();
      }
      document.addEventListener('visibilitychange', onVisibility);
      motion?.addEventListener?.('change', onMotion);
    },
    stop() {
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motion?.removeEventListener?.('change', onMotion);
      all.forEach((c) => c.video.pause());
    },
  };
}

// ---------------------------------------------------------------- 본문 블록

function block(bk) {
  if (bk.p) return el('p', 'lg-p', bk.p);
  if (bk.h) return el('h4', 'lg-h', bk.h);
  if (bk.list) return list(bk.list, 'lg-list');
  if (bk.table) return table(bk.table);
  if (bk.sources) return sources(bk.sources);
  return el('div');
}

function list(items, cls) {
  const ul = el('ul', cls);
  (items || []).forEach((t) => ul.appendChild(el('li', null, t)));
  return ul;
}

function table(t) {
  const wrap = el('div', 'rt-table-wrap');
  const tb = el('table', 'rt-table');
  if (t.caption) tb.appendChild(el('caption', null, t.caption));
  const thead = el('thead');
  const hr = el('tr');
  (t.head || []).forEach((h) => hr.appendChild(el('th', null, h)));
  thead.appendChild(hr);
  const tbody = el('tbody');
  (t.rows || []).forEach((r) => {
    const tr = el('tr');
    r.forEach((c) => tr.appendChild(el('td', null, c)));
    tbody.appendChild(tr);
  });
  tb.append(thead, tbody);
  wrap.appendChild(tb);
  return wrap;
}

function sources(items) {
  const box = el('div', 'rt-sources');
  box.appendChild(el('span', 'rt-sources-head', L.sources));
  const ol = el('ol');
  items.forEach((s) => {
    const li = el('li');
    const a = el('a', null, s.label);
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    li.appendChild(a);
    ol.appendChild(li);
  });
  box.appendChild(ol);
  return box;
}

// ---------------------------------------------------------------- 끝: 직접 플레이 · 안내 · 저작권

function closing(b) {
  const sec = el('section', 'lg-close');
  let button = null;
  let credits = null;
  if (b.play) {
    const main = el('div', 'lg-close-main');
    button = playLink(b.play, 'end', 'lg-end-play');
    main.appendChild(button);
    if (b.play.note) main.appendChild(el('p', 'lg-end-note', b.play.note));
    sec.appendChild(main);
  }
  const c = b.credits;
  if (c) {
    const box = el('div', 'lg-close-side');
    // 비공식 프로젝트 안내는 접지 않는다 — 권리 관계를 밝히는 글이라 늘 보여야 한다
    if (c.notice) box.appendChild(role('lg-notice', c.notice.title, c.notice.text));
    credits = el('details', 'lg-credits');
    const summary = el('summary');
    const peek = el('span', 'lg-credits-sum', (c.groups || []).map((g) => g.heading).join(' · '));
    peek.setAttribute('aria-hidden', 'true'); // 접힌 줄의 미리보기 — 화면 낭독기는 펼쳐서 읽는다
    summary.append(el('span', 'lg-credits-title', c.title), el('span', 'lg-credits-more', L.more), el('span', 'lg-credits-less', L.less), peek);
    const inner = el('div', 'lg-credits-body');
    (c.groups || []).forEach((g) => {
      inner.appendChild(el('h4', null, g.heading));
      (g.lines || []).forEach((line) => inner.appendChild(el('p', null, line)));
    });
    credits.append(summary, inner);
    box.appendChild(credits);
    sec.appendChild(box);
  }
  return { el: sec, button, credits, play: b.play ? sec : null };
}

// ---------------------------------------------------------------- 옆 목차와 장 이동

// 장으로 옮긴다. 움직임 줄이기면 바로 옮기고(DESIGN.md 6절), 키보드로 이어 읽도록 초점을 그 자리로 옮긴다.
// 저작권으로 갈 때는 접힌 전문을 펼친다
function goTo(target, focus) {
  if (!target) return;
  if (target.tagName === 'DETAILS') target.open = true;
  target.scrollIntoView({ behavior: reduce() ? 'instant' : 'smooth', block: 'start' });
  const f = focus || (target.tagName === 'DETAILS' ? target.querySelector('summary') : target.querySelector('h3')) || target;
  if (!f.matches('a[href], button, summary, [tabindex]')) f.tabIndex = -1;
  f.focus({ preventScroll: true });
}

// PC의 옆 목차. 장부 여백에서 세로줄에 매달려 스크롤을 따라 내려오고(CSS sticky), 화면 위쪽 40% 선을 지난 마지막 장을 표시한다.
// 좁은 화면에서는 CSS가 숨기므로 그동안은 계산하지 않는다. 브리프를 떠나면 destroy가 리스너를 푼다
function rail(b, { atlas, secs, credits, play }) {
  const nav = el('nav', 'lg-rail');
  nav.setAttribute('aria-label', L.rail);
  const ol = el('ol');
  const marks = [];
  const add = ({ target, text, no, cls, spy = true, focus }) => {
    const li = el('li', cls);
    const button = el('button', 'lg-rail-item');
    button.type = 'button';
    if (no) button.appendChild(el('span', 'lg-rail-no', no));
    button.appendChild(el('span', null, text));
    button.addEventListener('click', () => goTo(target, focus?.()));
    li.appendChild(button);
    ol.appendChild(li);
    if (spy) marks.push({ button, target });
  };
  // 맨 위 줄은 첫 화면의 지도로 돌아가는 줄이다 — 지금 읽는 장 표시에서는 뺀다
  if (L.map) add({ target: atlas, text: L.map, cls: 'lg-rail-top', spy: false, focus: () => atlas });
  b.chapters.forEach((ch, i) => add({ target: secs[i], text: ch.word, no: ch.no }));
  if (credits) add({ target: credits, text: b.credits.title, cls: 'lg-rail-end' });
  if (play) add({ target: play, text: L.rail_play, cls: credits ? null : 'lg-rail-end', focus: () => play.querySelector('.lg-end-play') });
  nav.appendChild(ol);

  let timer = 0;
  const update = () => {
    timer = 0;
    if (!nav.isConnected || !nav.offsetParent) return;
    const line = window.innerHeight * 0.4;
    const page = document.scrollingElement || document.documentElement;
    const atEnd = page.scrollTop + window.innerHeight >= page.scrollHeight - 4;
    let on = -1;
    marks.forEach((m, i) => { if (m.target.getBoundingClientRect().top <= line) on = i; });
    if (atEnd && on >= 0) on = marks.length - 1;
    marks.forEach((m, i) => {
      m.button.classList.toggle('on', i === on);
      if (i === on) m.button.setAttribute('aria-current', 'true');
      else m.button.removeAttribute('aria-current');
    });
  };
  // requestAnimationFrame 대신 짧은 타이머로 모은다 — 사이트 규칙(DESIGN.md 6절: rAF 쓰지 않음, 가려진 탭에서 멈춘다)
  const soon = () => { if (!timer) timer = setTimeout(update, 60); };
  document.addEventListener('scroll', soon, { passive: true, capture: true });
  window.addEventListener('resize', soon, { passive: true });
  soon();
  return {
    nav,
    stop() {
      document.removeEventListener('scroll', soon, { capture: true });
      window.removeEventListener('resize', soon);
      if (timer) clearTimeout(timer);
    },
  };
}

// 붉은 세로줄: 넓은 화면에서만. 기준 알약 아래(from — 화면 기준 y) → 끝의 직접 플레이 버튼 가운데
function placeSpine(spine, frame, from, to) {
  if (!wide() || !to) { spine.hidden = true; return; }
  const base = frame.getBoundingClientRect().top;
  const top = from() - base;
  const r = to.getBoundingClientRect();
  const bottom = r.top + r.height / 2 - base;
  spine.hidden = false;
  spine.style.top = `${top}px`;
  spine.style.height = `${Math.max(0, bottom - top)}px`;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
