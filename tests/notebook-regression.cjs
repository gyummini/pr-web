// 클루의 수사 수첩(/notebook) — 10/11 사용자 결정(수첩 가 · 수첩 끝 · 수첩 나)과 10/11(2) 재점검 결정.
// 한 권: 모든 쪽이 한 크기 · 같은 묶음 자리 · 같은 제목 줄 자리. 넘길 때 두 쪽이 함께 비치지 않고(불투명), 움직임 줄이기에서도 넘김은 돈다.
// 색인 탭 넷(지금 장은 aria-current), 쪽 안부터 내리는 아래쪽 키, 그 쪽에 가까워질 때 받는 그림, 3부 사진 창(초점 가두기 · Esc · 바깥 · 닫기 · 초점 복귀),
// 결론의 무게(종합 소견 쪽지 · 플레이 기록 단추 · 편지 먹), 마지막 쪽(서명 · CASE CLOSED 도장 · 명함 · 돌아가기 — 휴대폰에서 전보다 길어지지 않음),
// 넓고 높은 화면의 펼친 수첩(펼친 쪽 스크롤 없음)과 화면이 바뀔 때 보던 장을 잇는 것.
// 10/11(2): 2부는 두 화면 모두 세 쪽(메모 2 · 2 · 1+종합 소견+플레이 기록) — 한 쪽 화면은 일곱 쪽이고 1366×768에서 종합 소견이 첫 화면 안.
// 펼침은 다섯 면(넘김 네 번) — 3부는 사진마다 한 쪽(380px 안팎), 마지막 면 오른쪽은 글자 없는 뒤표지, 알약은 두 화면이 같은 일곱 쪽을 센다.
// 넘어가는 쪽은 앞으로든 뒤로든 독자 쪽으로 들린다(10/11 사용자 지적 — 책 뒤로 젖혀지던 방향을 바로잡음).
// 키 큰 화면의 종이는 높이 ÷ 폭 1.45까지(2560×1300 펼침 · 900×1600 한 쪽) — 남는 높이의 가운데에 놓이고 단추 · 알약 · 탭은 종이 밖. 휴대폰은 묶지 않는다.
// 세로 종이(10/11 사용자 지적 '수첩이 가로로 너무 넓다'): 821px 이상은 한 쪽씩이어도 펼침과 같은 세로 쪽(폭 560~640px) · 같은 쪽 구성(3부 두 쪽, 번호 하나).
// 표지(10/11 사용자 결정)는 위쪽 가운데의 이름표(제목만)와 클루 얼굴 스티커뿐이다 — 끈 · 봉인 · 도장 없음.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
// 문구는 데이터에서 읽는다 — GPT가 문구를 바꿔도 테스트는 그대로 돈다
const NB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_수사수첩.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_화면문구.json'), 'utf8'));
const L = NB.labels;
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
const IMG = /memo_\d|notebook_photo_\d/;

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async (viewport, opts = {}) => {
    const page = await browser.newPage({ viewport, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
    await page.route('**/_vercel/**', (r) => r.abort());
    await page.route('**/api/**', (r) => r.abort());
    page.on('pageerror', (e) => errors.push(e.message));
    const imgs = [];
    page.on('request', (q) => { if (IMG.test(q.url())) imgs.push(q.url().split('/').pop()); });
    await page.goto(origin + '/notebook');
    await page.locator('.nb-page.active').first().waitFor();
    await page.waitForTimeout(1000); // 글꼴 대기(최대 0.9초)
    return { page, imgs };
  };
  const indicator = (page) => page.locator('.nb-indicator').innerText();
  const next = async (page) => { await page.locator('.nb-next').click(); await page.waitForTimeout(760); };
  const overX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // 지금 보이는 쪽들의 종이 · 구멍 줄 · 제목 줄 자리와 쪽 안 스크롤 양
  const geometry = (page) => page.evaluate(() => [...document.querySelectorAll('.nb-page.active')].map((p) => {
    const r = (s) => { const n = p.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    const s = p.querySelector('.nb-scroll');
    return { ch: p.dataset.ch, paper: r('.nb-paper'), holes: r('.nb-spiral'), title: r('.nb-h2'), room: s ? s.scrollHeight - s.clientHeight : 0 };
  }));
  // 넘김 도중(0.3초) 보이는 쪽은 모두 불투명이고, 도는 쪽이 있다. 도는 쪽은 묶음 반대편 끝이 독자 쪽으로 들린다(lift 1)
  // — 10/11 사용자 지적: 전에는 회전 부호가 반대라 쪽이 화면 안쪽(책 뒤)으로 젖혀졌다
  const midTurn = async (page, sel) => {
    await page.locator(sel).click();
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => [...document.querySelectorAll('.nb-page')].filter((p) => getComputedStyle(p).visibility !== 'hidden')
      .map((p) => {
        const cs = getComputedStyle(p);
        const m = cs.transform.startsWith('matrix3d(') ? cs.transform.slice(9, -1).split(',').map(Number) : null;
        // 돌림 축(묶음)에서 반대편 끝까지 x만큼 떨어진 점의 깊이는 m[2]·x — 양수면 화면 밖, 독자 쪽
        const ox = parseFloat(cs.transformOrigin), w = p.offsetWidth;
        const lift = m && Math.abs(m[2]) > 0.01 ? Math.sign(m[2] * (ox < w / 2 ? w - ox : -ox)) : 0;
        return { opacity: +cs.opacity, running: p.getAnimations().some((a) => a.playState === 'running'), lift };
      }));
    await page.waitForTimeout(500);
    return r;
  };
  // 지금 쪽이 2부의 몇째 쪽인지, 그 쪽의 종합 소견 쪽지 · 플레이 기록 단추가 스크롤 없이 종이의 보이는 부분('더 있음' 그늘 위) 안인지
  const closingView = (page) => page.evaluate(() => {
    const p = document.querySelector('.nb-page.active');
    const s = p.querySelector('.nb-scroll');
    const box = s.getBoundingClientRect();
    const more = p.querySelector('.nb-paper').classList.contains('has-more') ? p.querySelector('.nb-more').getBoundingClientRect().top : box.bottom;
    const limit = Math.min(more, innerHeight);
    const inView = (el) => !!el && el.getBoundingClientRect().top >= box.top && el.getBoundingClientRect().bottom <= limit;
    return { nth: [...document.querySelectorAll('.nb-page[data-ch="p2"]')].indexOf(p) + 1, top: s.scrollTop,
      closing: inView(p.querySelector('.nb-closing')), link: inView(p.querySelector('.nb-evidence-link')) };
  });
  // 마지막 쪽 도장이 덮는 링크(명함 · 돌아가기) — 도장 원의 안쪽 반지름으로 잰다
  const stampCovers = (page) => page.evaluate(() => {
    const box = document.querySelector('.nb-page.active .nb-closed');
    const r = box.querySelector('svg').getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = (box.offsetWidth / 2) * (77.6 / 80);
    return [...box.closest('.nb-page').querySelectorAll('.nb-contact, .nb-back')].filter((a) => {
      const b = a.getBoundingClientRect();
      return Math.hypot(Math.max(b.left, Math.min(cx, b.right)) - cx, Math.max(b.top, Math.min(cy, b.bottom)) - cy) < rad - 1;
    }).map((a) => a.textContent.trim().slice(0, 10));
  });
  // 지금 면의 종이 비율과 놓인 자리, 넘김 단추 · 알약 · 색인 탭 가운데 종이와 겹치는 것
  const paperFit = (page) => page.evaluate(() => {
    const box = (e) => e.getBoundingClientRect();
    const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const papers = [...document.querySelectorAll('.nb-page.active .nb-paper')].map(box);
    const others = [...document.querySelectorAll('.nb-nav-btn, .nb-indicator')].map((e) => [e.className, box(e)]);
    // 탭은 종이 가장자리에 8px 걸쳐 붙는다 — 그만큼은 겹침으로 세지 않는다
    document.querySelectorAll('.nb-tab').forEach((t) => { const b = box(t); others.push([t.className, { left: b.left + 9, right: b.right - 9, top: b.top + 9, bottom: b.bottom - 9 }]); });
    const view = document.querySelector('.view-notebook');
    const px = (n) => parseFloat(getComputedStyle(view).getPropertyValue(n));
    const stage = box(document.querySelector('.nb-stage'));
    const book = box(document.querySelector('.nb-book'));
    return {
      ratio: Math.max(...papers.map((p) => p.height / p.width)),
      size: papers.map((p) => `${Math.round(p.width)}x${Math.round(p.height)}`).join(' '),
      above: Math.round(book.top - stage.top - px('--nb-gap-t')),
      below: Math.round(stage.bottom - px('--nb-nav-h') - px('--nb-gap-b') - book.bottom),
      overlap: others.filter(([, b]) => papers.some((p) => hit(p, b))).map(([c]) => c),
    };
  });

  try {
    // ── 한 쪽씩(1440×900) — 움직임 줄이기 켬: 넘김만 예외로 돈다 ──
    {
      const { page, imgs } = await open({ width: 1440, height: 900 }, { reduce: true });
      assert.equal(await indicator(page), '1 / 7');
      assert.equal(imgs.length, 0, 'no hidden-page pictures at the cover');
      assert.deepEqual(await page.locator('.nb-tab').allInnerTexts(), [L.part1_tab, L.part2_tab, L.part3_tab, L.end_tab].map((s) => s.trim()));
      assert.equal(await page.locator('.nb-tab[aria-current="true"]').count(), 0, 'the cover is before the chapters');

      // 표지 — 이름표(제목 한 줄)와 클루 스티커만, 이름표는 위쪽 가운데(윗변이 표지 높이의 15%)
      const cover = await page.evaluate(() => {
        const c = document.querySelector('.nb-page[data-ch="cover"] .nb-cover').getBoundingClientRect();
        const l = document.querySelector('.nb-cover-label').getBoundingClientRect();
        return { kids: [...document.querySelector('.nb-page[data-ch="cover"] .nb-cover').children].map((k) => k.classList[0]),
          label: [...document.querySelector('.nb-cover-label').children].map((k) => k.classList[0]),
          top: Math.round(((l.top - c.top) / c.height) * 100), centre: Math.round(l.left + l.width / 2 - (c.left + c.width / 2)) };
      });
      assert.deepEqual(cover, { kids: ['nb-spiral', 'nb-cover-label'], label: ['nb-cover-title', 'nb-sticker'], top: 15, centre: 0 },
        `[new] the cover is the title label and the sticker, near the top in the middle ${JSON.stringify(cover)}`);
      // 세로 종이 — 1440×900에서 가로로 누운 880×734가 아니라 세로로 긴 쪽
      const shape = await paperFit(page);
      assert.ok(shape.ratio > 1.1, `[new] 1440×900: the paper stands upright (${shape.size})`);

      // 일곱 면(2부 세 쪽 · 3부 한 쪽 — 세부 사진은 전체 사진 안의 네모 칸) — 종이 크기 · 자리, 구멍 줄 자리, 제목 줄 자리가 모두 같다
      const seen = [];
      const pills = [];
      for (let i = 0; i < 7; i++) {
        seen.push(...(await geometry(page)));
        pills.push(await indicator(page));
        if (i === 4) {
          // 2부 셋째 쪽 — 종합 소견과 플레이 기록 단추가 스크롤 없이 첫 화면 안(10/11(2) — 전에는 2부 둘째 쪽 아래에 있어 단추가 화면 밖)
          const v = await closingView(page);
          assert.ok(v.nth === 3 && v.top === 0 && v.closing && v.link, `[new] 1440×900: the closing note and the play record are on screen on the third 2부 page ${JSON.stringify(v)}`);
        }
        if (i < 6) {
          if (i === 0) {
            const mid = await midTurn(page, '.nb-next');
            assert.ok(mid.length >= 2 && mid.every((m) => m.opacity === 1), `turning pages stay opaque ${JSON.stringify(mid)}`);
            assert.ok(mid.some((m) => m.running), 'the turn plays under reduced motion');
            assert.ok(mid.every((m) => m.lift >= 0) && mid.some((m) => m.lift > 0), `[new] the turning page lifts toward the reader ${JSON.stringify(mid)}`);
          } else await next(page);
        }
      }
      assert.equal(new Set(seen.map((s) => s.paper.join())).size, 1, `one paper size and place ${JSON.stringify(seen.map((s) => s.paper))}`);
      assert.equal(new Set(seen.map((s) => s.holes[0])).size, 1, 'the holes are at the same place on every page');
      assert.deepEqual(pills, ['1 / 7', '2 / 7', '3 / 7', '4 / 7', '5 / 7', '6 / 7', '7 / 7'], 'seven views, seven pages');
      const titles = seen.filter((s) => s.title).map((s) => s.title[1]);
      assert.equal(titles.length, 5, 'titles on 1부, the three 2부 pages and the 3부 page');
      assert.equal(new Set(titles).size, 1, `titles on the same line ${titles}`);
      assert.equal(await overX(page), 0);
      await page.close();
    }

    // ── 키보드 · 탭 · 그림 받기 · 사진 창(1366×768) ──
    {
      const { page, imgs } = await open({ width: 1366, height: 768 });
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(760);
      assert.equal(await indicator(page), '2 / 7');
      assert.deepEqual(await page.locator('.nb-tab[aria-current="true"]').allInnerTexts(), [L.part1_tab]);
      assert.deepEqual([...new Set(imgs)].sort(), ['memo_1.jpg', 'memo_2.jpg'], 'only the next page pictures');
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(760);
      // 아래쪽 키는 쪽 안부터 — 끝에 닿은 뒤에야 넘긴다
      const room = () => page.evaluate(() => { const s = document.querySelector('.nb-page.active .nb-scroll'); return [s.scrollTop, s.scrollHeight - s.clientHeight]; });
      const [, max] = await room();
      assert.ok(max > 0, 'page 3 is longer than the paper at 1366×768');
      let turnedAt = null;
      for (let i = 0; i < 20 && turnedAt === null; i++) {
        const before = await room();
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(450);
        if ((await indicator(page)) !== '3 / 7') turnedAt = before;
      }
      assert.ok(turnedAt && turnedAt[0] >= turnedAt[1] - 2, `turned only at the bottom ${turnedAt}`);
      assert.equal(await indicator(page), '4 / 7');
      await page.waitForTimeout(400); // 넘김이 끝날 때까지(0.6초 + 잠금 0.1초) 다른 넘김은 받지 않는다

      // 2부 셋째 쪽 — 1366×768에서 종합 소견 쪽지 전체가 스크롤 없이 첫 화면 안(10/11(2) 재점검 P1 — 전에는 2부 둘째 쪽 아래라 테이프만 보였다)
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(760);
      assert.equal(await indicator(page), '5 / 7');
      const closing = await closingView(page);
      assert.ok(closing.nth === 3 && closing.top === 0 && closing.closing, `[new] 1366×768: the whole closing note is on screen on the third 2부 page ${JSON.stringify(closing)}`);

      // 색인 탭 — 그 장의 첫 쪽으로. 탭에 초점이 있어도 방향키는 넘김
      await page.locator('.nb-tab[data-ch="p3"]').click();
      await page.waitForTimeout(760);
      assert.equal(await indicator(page), '6 / 7');
      assert.deepEqual(await page.locator('.nb-tab[aria-current="true"]').allInnerTexts(), [L.part3_tab]);
      assert.ok(imgs.includes('notebook_photo_1.jpg'));
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(760);
      assert.equal(await indicator(page), '5 / 7');
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(760);

      // 결론의 무게 — 종합 소견은 메모보다 한 단계 큰 글자, 플레이 기록은 본문 이상 크기의 단추, 편지는 메모와 같은 먹
      const weight = await page.evaluate(() => {
        const cs = (s) => getComputedStyle(document.querySelector(s));
        return { closing: parseFloat(cs('.nb-closing').fontSize), postit: parseFloat(cs('.nb-postit').fontSize),
          link: parseFloat(cs('.nb-evidence-link').fontSize), linkBorder: parseFloat(cs('.nb-evidence-link').borderTopWidth),
          letter: cs('.nb-folded-line').color, memo: cs('.nb-postit').color };
      });
      assert.ok(weight.closing > weight.postit, JSON.stringify(weight));
      assert.ok(weight.link >= 16 && weight.linkBorder > 0, JSON.stringify(weight));
      assert.equal(weight.letter, weight.memo);

      // 3부 사진 창 — 세로 종이는 사진마다 한 쪽
      assert.equal(await page.locator('.nb-page.active .nb-photo-btn').count(), 1, '[new] one photo on each 3부 page');
      const photo = page.locator('.nb-page.active .nb-photo-btn').first();
      const box = await photo.boundingBox();
      assert.ok(box.width >= 330, `3부 photo is larger than before (300px) ${box.width}`);
      await photo.click();
      const dialog = page.locator('.nb-zoom[role="dialog"][aria-modal="true"]');
      await dialog.waitFor();
      assert.equal(await dialog.getAttribute('aria-label'), NB.part3.photos[0].label);
      assert.equal(await page.locator('.nb-zoom-close').getAttribute('aria-label'), UI.popup.close);
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('.nb-zoom')), true, 'focus moves into the window');
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => !!document.activeElement.closest('.nb-zoom')), true, 'Tab stays inside');
      }
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);
      assert.equal(await indicator(page), '6 / 7', 'the notebook does not turn behind the window');
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement.classList.contains('nb-photo-btn')), true, 'focus returns to the photo');
      await photo.click();
      await dialog.waitFor();
      await page.mouse.click(4, 764);
      assert.equal(await dialog.count(), 0, 'outside click closes');
      await photo.click();
      await page.locator('.nb-zoom-close').click();
      assert.equal(await dialog.count(), 0, 'the close button closes');

      // 전체 사진 위의 네모 칸 — 누르면 그 자리의 세부 사진, '전체 사진으로'를 누르면 돌아오고 초점은 누른 칸으로
      const spots = NB.part3.photos[0].spots;
      await photo.click();
      await dialog.waitFor();
      assert.equal(await page.locator('.nb-zoom-spot').count(), spots.length, 'one box per detail photo');
      const fit = await page.evaluate(() => {
        const st = document.querySelector('.nb-zoom-stage').getBoundingClientRect();
        return [...document.querySelectorAll('.nb-zoom-spot')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= st.left - 1 && r.right <= st.right + 1 && r.top >= st.top - 1 && r.bottom <= st.bottom + 1; });
      });
      assert.ok(fit, 'boxes lie inside the photo');
      await page.locator('.nb-zoom-spot').nth(1).click();
      await page.waitForFunction((src) => { const i = document.querySelector('.nb-zoom-img'); return i.src.endsWith(src) && i.complete && i.naturalWidth > 0; }, spots[1].src);
      assert.equal(await dialog.getAttribute('aria-label'), spots[1].label);
      assert.equal((await page.locator('.nb-zoom-cap').innerText()).trim(), spots[1].caption || '', 'detail photos carry no caption');
      assert.equal(await page.locator('.nb-zoom-spot:visible').count(), 0, 'boxes hide on a detail photo');
      assert.equal(await page.evaluate(() => document.activeElement.classList.contains('nb-zoom-back')), true, 'focus moves to the back button');
      await page.keyboard.press('Enter');
      assert.ok((await page.locator('.nb-zoom-img').getAttribute('src')).endsWith(NB.part3.photos[0].src), 'back to the overview');
      assert.equal(await page.locator('.nb-zoom-spot:visible').count(), spots.length);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.k), '1', 'focus returns to the box');
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(), 0);

      // 마지막 쪽 — 서명, CASE CLOSED 도장(방문한 날짜), 명함(이메일 · 휴대폰 · PDF) 뒤에 돌아가기. 도장은 단추를 가리지 않는다
      await page.locator('.nb-tab[data-ch="end"]').click();
      await page.waitForTimeout(760);
      assert.equal(await indicator(page), '7 / 7');
      const end = page.locator('.nb-page.active[data-ch="end"]');
      assert.equal((await end.locator('.nb-sign-name').innerText()).trim(), L.sd_alt);
      const stamp = await end.locator('.nb-closed').getAttribute('aria-label');
      assert.ok(stamp.startsWith(NB.folded.closed) && /\d{4}\.\d{2}\.\d{2}$/.test(stamp), stamp);
      const links = await end.locator('.nb-card a, .nb-back').evaluateAll((as) => as.map((a) => {
        const h = a.getAttribute('href') || '';
        return h.startsWith('mailto:') ? 'mailto' : h.startsWith('tel:') ? 'tel' : a.hasAttribute('download') ? 'download' : a.target === '_blank' ? 'new-tab:' + h : h;
      }));
      // 10/19 포트폴리오 PDF 단추를 더했다 — 둘 다 바로 내려받기
      assert.deepEqual(links, ['mailto', 'tel', 'download', 'download', '/evidence'], 'card (email · phone · two PDFs) then back, in focus order');
      assert.equal(await end.locator('.nb-back').getAttribute('href'), '/evidence');
      assert.deepEqual(await stampCovers(page), [], 'the stamp covers no link');
      assert.equal(await page.locator('.nb-next').isDisabled(), true);
      await page.close();
    }

    // ── 휴대폰 · 태블릿 — 탭이 보이고(위 가장자리), 가로 넘침 없음, 마지막 쪽은 전보다 길지 않다(10/11 바2 지금 유지) ──
    for (const [w, h, endMax] of [[390, 844, 0], [320, 640, 317], [820, 1180, 0], [1180, 820, 0]]) {
      const { page } = await open({ width: w, height: h });
      const tabs = await page.locator('.nb-tab').evaluateAll((ts) => ts.map((t) => { const b = t.getBoundingClientRect(); return b.width > 0 && b.right <= innerWidth && b.top >= 0; }));
      assert.deepEqual(tabs, [true, true, true, true], `${w}: four tabs on screen`);
      await page.locator('.nb-tab[data-ch="end"]').click();
      await page.waitForTimeout(760);
      const [g] = await geometry(page);
      assert.ok(g.room <= endMax, `${w}×${h}: last page scrolls ${g.room} (before: ${endMax})`);
      assert.equal(await overX(page), 0, `${w}: no horizontal overflow`);
      // 휴대폰은 종이 비율로 묶지 않는다 — 긴 쪽이 종이 안에서 스크롤하는 화면이라, 묶으면 스크롤만 길어진다(10/11(2))
      if (w <= 600) {
        const fit = await paperFit(page);
        assert.ok(fit.ratio > 1.45, `${w}×${h}: the phone paper keeps the screen height (${fit.size})`);
      }
      await page.close();
    }

    // ── 펼친 수첩(1920×1080) — 다섯 면 · 넘김 네 번(10/11(2)), 펼친 쪽은 스크롤 없이 들어온다. 화면이 줄면 한 쪽씩으로 바뀌어도 보던 장이 이어진다 ──
    {
      const { page, imgs } = await open({ width: 1920, height: 1080 });
      assert.equal(await indicator(page), '1 / 7');
      assert.deepEqual([...new Set(imgs)].sort(), ['memo_1.jpg', 'memo_2.jpg'], 'the cover loads only the next spread');
      const mid = await midTurn(page, '.nb-next');
      assert.ok(mid.length >= 3 && mid.every((m) => m.opacity === 1), `spread turn stays opaque ${JSON.stringify(mid)}`);
      assert.ok(mid.every((m) => m.lift >= 0) && mid.some((m) => m.lift > 0), `[new] the turning right page lifts toward the reader ${JSON.stringify(mid)}`);
      // 끝 면까지 넘기며 면마다 적는다 — 알약, 보이는 쪽, 지금 장 탭, 3부 사진 폭(흰 테두리 안의 사진, 기울이기 전), 받은 그림
      const views = [{ indicator: '1 / 7' }];
      for (let i = 0; i < 7; i++) {
        const g = await geometry(page);
        const info = await page.evaluate(() => [...document.querySelectorAll('.nb-page.active')].map((p) => ({
          ch: p.dataset.ch, cont: !!p.querySelector('.nb-cont'), text: p.innerText.trim(),
          photos: [...p.querySelectorAll('.nb-photo-area')].map((a) => a.offsetWidth),
          kraft: getComputedStyle(p.querySelector('.nb-paper')).backgroundColor,
        })));
        views.push({ indicator: await indicator(page), g, info, chs: info.map((x) => x.ch).join('|'), tabs: await page.locator('.nb-tab[aria-current="true"]').allInnerTexts(), imgs: [...new Set(imgs)] });
        assert.equal(g.length, 2, 'two pages side by side');
        assert.deepEqual(g.map((x) => x.room), [0, 0], `${await indicator(page)}: both pages fit ${JSON.stringify(g.map((x) => x.ch))}`);
        assert.equal(g[0].paper[2], g[1].paper[2]);
        assert.deepEqual([g[0].paper[2], g[0].paper[3]], [640, 928], 'a 1920×1080 spread page stays 640×928 (height ÷ width 1.45)');
        if (await page.locator('.nb-next').isDisabled()) break;
        await next(page);
      }
      assert.deepEqual(views.map((v) => v.indicator), ['1 / 7', '2–3 / 7', '4–5 / 7', '6–7 / 7'], 'four views, three turns — both screens count the same seven pages');
      assert.deepEqual(views.slice(1).map((v) => v.tabs.map((s) => s.trim()).join()), [[L.part1_tab, L.part2_tab], [L.part2_tab], [L.part3_tab, L.end_tab]].map((t) => t.map((s) => s.trim()).join()), 'the current chapter tabs');
      // 3부는 전체 사진 한 장(세부 사진은 그 안의 네모 칸) — 혼자라 크게
      const p3photos = views.slice(1).flatMap((v) => v.info.filter((x) => x.ch === 'p3').flatMap((x) => x.photos));
      assert.ok(p3photos.length === 1 && p3photos[0] >= 480, `3부 overview photo is large at 1920×1080 ${p3photos}`);
      // 마지막 면 — 왼쪽은 3부, 오른쪽은 마지막 쪽(쪽 수가 짝이 맞아 뒤표지 없음)
      const last = views[views.length - 1];
      assert.equal(last.chs, 'p3|end', `the last view is 3부 and the last page (${last.chs})`);
      assert.equal(await page.locator('.nb-next').isDisabled(), true);
      // 3부 앞 면에서 3부 사진을 미리 받는다(지금 면과 다음 면)
      const before3 = views[views.indexOf(last) - 1];
      assert.ok(before3.imgs.includes('notebook_photo_1.jpg'), 'the 3부 picture loads one view ahead');
      assert.deepEqual(await stampCovers(page), [], 'the stamp covers no link on the last page');
      const book = await page.evaluate(() => document.querySelector('.nb-book').getBoundingClientRect().width / innerWidth);
      assert.ok(book > 0.6 && book < 0.72, `the spread is about 65% of the screen (${book.toFixed(2)})`);
      assert.equal(await overX(page), 0);
      // 뒤로 넘길 때도 왼쪽 쪽이 독자 쪽으로 들려 넘어온다
      const back = await midTurn(page, '.nb-prev');
      assert.ok(back.every((m) => m.lift >= 0) && back.some((m) => m.lift > 0), `[new] turning back, the left page lifts toward the reader ${JSON.stringify(back)}`);
      // 넘기는 동안 누른 넘김 하나를 기억한다 — 새 면에서도(4–5에서 두 번 누르면 3부를 지나 마지막 면)
      await page.locator('.nb-tab[data-ch="p1"]').click();
      await page.waitForTimeout(760);
      assert.equal(await indicator(page), '2–3 / 7');
      await page.locator('.nb-next').click();
      await page.waitForTimeout(120);
      await page.locator('.nb-next').click();
      await page.waitForTimeout(1600);
      assert.equal(await indicator(page), '6–7 / 7', 'one turn pressed during a turn is kept');
      // 화면이 낮아지면 한 쪽씩 — 보던 3부가 그대로 보이고(3부 두 쪽 = 한 쪽 화면의 3부 한 쪽), 다시 넓어지면 3부 면
      await page.locator('.nb-tab[data-ch="p3"]').click();
      await page.waitForTimeout(760);
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.waitForTimeout(300);
      assert.equal(await indicator(page), '6 / 7', 'same chapter after leaving the spread');
      assert.equal(await page.locator('.nb-page.active .nb-photo-btn').count(), 1, 'the single 3부 page holds the overview photo');
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(300);
      assert.equal(await indicator(page), '6–7 / 7', 'same chapter after coming back to the spread');
      await page.close();
    }

    // ── 키 큰 화면 — 종이 높이 ÷ 폭은 1.45까지(10/11(2) 작은 정리 5 — 2560×1300 펼침은 640×1148, 1.8이었다). 남는 높이의 가운데, 단추 · 알약 · 탭은 종이 밖 ──
    for (const [w, h] of [[2560, 1300], [900, 1600]]) {
      const { page } = await open({ width: w, height: h });
      for (let i = 0; i < 7; i++) {
        const fit = await paperFit(page);
        assert.ok(fit.ratio <= 1.455, `[new] ${w}×${h} ${await indicator(page)}: paper ${fit.size} keeps height ÷ width at 1.45 or less (${fit.ratio.toFixed(2)})`);
        assert.ok(Math.abs(fit.above - fit.below) <= 1, `${w}×${h}: the notebook sits in the middle of the room left (${fit.above} above, ${fit.below} below)`);
        assert.deepEqual(fit.overlap, [], `${w}×${h} ${await indicator(page)}: nothing sits on the paper`);
        if (await page.locator('.nb-next').isDisabled()) break;
        await next(page);
      }
      assert.equal(await overX(page), 0);
      await page.close();
    }

    // 엔딩 → 수첩: 기본 증거를 다 모은 뒤 엔딩 대사가 끝나면 히든 수첩이 열린다.
    // 10/11 번호를 다시 매길 때 엔딩의 변수 이름(e7.url)이 그림 경로처럼 바뀌어 대사 뒤에 멈춘 적이 있다 — 수첩으로 바로 들어가는 검사만으로는 못 잡았다.
    {
      const { page } = await open({ width: 1366, height: 768 });
      await page.evaluate(async () => {
        const { state, BASE_EVIDENCE_IDS } = await import('/assets/js/state.js');
        BASE_EVIDENCE_IDS.forEach((id) => state.collected.add(id));
        (await import('/assets/js/router.js')).navigate('/ending');
      });
      // 장면 위에서는 지금 탭 아래 종이 띠(::after)를 그리지 않는다 — 10/15 사용자 지적: 엔딩 그림 위로 6px 삐져나왔다
      const tabTail = () => page.evaluate(() => getComputedStyle(document.querySelector('#tabs a.active'), '::after').content);
      await page.locator('.view-ending').waitFor();
      assert.equal(await tabTail(), 'none', 'no paper strip under the active tab over the ending scene');
      await page.locator('.view-ending .skip-btn').click();
      await page.waitForURL('**/notebook');
      await page.locator('.nb-page.active').first().waitFor();
      assert.equal(await tabTail(), 'none', 'no paper strip under the active tab over the notebook desk');
      assert.match(await page.locator('#badge').innerText(), /9\/9/); // 10/15 E6(데이터 테이블 설계)을 더해 기본 여덟 + 히든
      await page.close();
    }

    assert.deepEqual(errors, []);
    console.log('PASS notebook: ending → notebook after the last line, one paper size · binding · title line on every page (seven pages, 2부 in three), upright pages from 821px (cover: title label and sticker only), opaque turns that lift toward the reader (also under reduced motion), four index tabs with the current chapter, keys scroll inside first, pictures only for the current and next page, the 2부 closing note on screen at 1366×768 (with the play record at 1440×900), 3부 photo window (focus kept, Esc · outside · close, focus back; boxes on the overview open each detail photo and come back), weight of the conclusion, last page (signature · CASE CLOSED stamp with the visit date · card · back, stamp covers nothing, phones not longer than before), spreads at 1920×1080 (four views, three turns, one large 3부 overview photo, kept turn) and back to single pages on a low screen, paper height ÷ width 1.45 or less on tall screens (phones not capped).');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
