// 클루의 수사 수첩(/notebook) — 10/11 사용자 결정(수첩 가 · 수첩 끝 · 수첩 나).
// 한 권: 모든 쪽이 한 크기 · 같은 묶음 자리 · 같은 제목 줄 자리. 넘길 때 두 쪽이 함께 비치지 않고(불투명), 움직임 줄이기에서도 넘김은 돈다.
// 색인 탭 넷(지금 장은 aria-current), 쪽 안부터 내리는 아래쪽 키, 그 쪽에 가까워질 때 받는 그림, 3부 사진 창(초점 가두기 · Esc · 바깥 · 닫기 · 초점 복귀),
// 결론의 무게(종합 소견 쪽지 · 플레이 기록 단추 · 편지 먹), 마지막 쪽(서명 · CASE CLOSED 도장 · 명함 · 돌아가기 — 휴대폰에서 전보다 길어지지 않음),
// 넓고 높은 화면의 펼친 수첩(넘김 세 번, 펼친 쪽 스크롤 없음)과 화면이 바뀔 때 보던 장을 잇는 것.
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
  // 넘김 도중(0.3초) 보이는 쪽은 모두 불투명이고, 도는 쪽이 있다
  const midTurn = async (page, sel) => {
    await page.locator(sel).click();
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => [...document.querySelectorAll('.nb-page')].filter((p) => getComputedStyle(p).visibility !== 'hidden')
      .map((p) => ({ opacity: +getComputedStyle(p).opacity, running: p.getAnimations().some((a) => a.playState === 'running') })));
    await page.waitForTimeout(500);
    return r;
  };

  try {
    // ── 한 쪽씩(1440×900) — 움직임 줄이기 켬: 넘김만 예외로 돈다 ──
    {
      const { page, imgs } = await open({ width: 1440, height: 900 }, { reduce: true });
      assert.equal(await indicator(page), '1 / 6');
      assert.equal(imgs.length, 0, 'no hidden-page pictures at the cover');
      assert.deepEqual(await page.locator('.nb-tab').allInnerTexts(), [L.part1_tab, L.part2_tab, L.part3_tab, L.end_tab].map((s) => s.trim()));
      assert.equal(await page.locator('.nb-tab[aria-current="true"]').count(), 0, 'the cover is before the chapters');

      // 여섯 쪽 — 종이 크기 · 자리, 구멍 줄 자리, 제목 줄 자리가 모두 같다
      const seen = [];
      for (let i = 0; i < 6; i++) {
        seen.push(...(await geometry(page)));
        if (i < 5) {
          if (i === 0) {
            const mid = await midTurn(page, '.nb-next');
            assert.ok(mid.length >= 2 && mid.every((m) => m.opacity === 1), `turning pages stay opaque ${JSON.stringify(mid)}`);
            assert.ok(mid.some((m) => m.running), 'the turn plays under reduced motion');
          } else await next(page);
        }
      }
      assert.equal(new Set(seen.map((s) => s.paper.join())).size, 1, `one paper size and place ${JSON.stringify(seen.map((s) => s.paper))}`);
      assert.equal(new Set(seen.map((s) => s.holes[0])).size, 1, 'the holes are at the same place on every page');
      const titles = seen.filter((s) => s.title).map((s) => s.title[1]);
      assert.equal(titles.length, 4);
      assert.equal(new Set(titles).size, 1, `titles on the same line ${titles}`);
      assert.equal(await overX(page), 0);
      await page.close();
    }

    // ── 키보드 · 탭 · 그림 받기 · 사진 창(1366×768) ──
    {
      const { page, imgs } = await open({ width: 1366, height: 768 });
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(760);
      assert.equal(await indicator(page), '2 / 6');
      assert.deepEqual(await page.locator('.nb-tab[aria-current="true"]').allInnerTexts(), [L.part1_tab]);
      assert.deepEqual([...new Set(imgs)].sort(), ['memo_1.jpg', 'memo_2.jpg', 'memo_3.jpg'], 'only the next page pictures');
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
        if ((await indicator(page)) !== '3 / 6') turnedAt = before;
      }
      assert.ok(turnedAt && turnedAt[0] >= turnedAt[1] - 2, `turned only at the bottom ${turnedAt}`);
      assert.equal(await indicator(page), '4 / 6');
      await page.waitForTimeout(400); // 넘김이 끝날 때까지(0.6초 + 잠금 0.1초) 다른 넘김은 받지 않는다

      // 색인 탭 — 그 장의 첫 쪽으로. 탭에 초점이 있어도 방향키는 넘김
      await page.locator('.nb-tab[data-ch="p3"]').click();
      await page.waitForTimeout(760);
      assert.equal(await indicator(page), '5 / 6');
      assert.deepEqual(await page.locator('.nb-tab[aria-current="true"]').allInnerTexts(), [L.part3_tab]);
      assert.ok(imgs.includes('notebook_photo_1.jpg') && imgs.includes('notebook_photo_2.jpg'));
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(760);
      assert.equal(await indicator(page), '4 / 6');
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

      // 3부 사진 창
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
      assert.equal(await indicator(page), '5 / 6', 'the notebook does not turn behind the window');
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

      // 마지막 쪽 — 서명, CASE CLOSED 도장(방문한 날짜), 명함(이메일 · 휴대폰 · PDF) 뒤에 돌아가기. 도장은 단추를 가리지 않는다
      await page.locator('.nb-tab[data-ch="end"]').click();
      await page.waitForTimeout(760);
      assert.equal(await indicator(page), '6 / 6');
      const end = page.locator('.nb-page.active[data-ch="end"]');
      assert.equal((await end.locator('.nb-sign-name').innerText()).trim(), L.sd_alt);
      const stamp = await end.locator('.nb-closed').getAttribute('aria-label');
      assert.ok(stamp.startsWith(NB.folded.closed) && /\d{4}\.\d{2}\.\d{2}$/.test(stamp), stamp);
      const links = await end.locator('.nb-card a, .nb-back').evaluateAll((as) => as.map((a) => {
        const h = a.getAttribute('href') || '';
        return h.startsWith('mailto:') ? 'mailto' : h.startsWith('tel:') ? 'tel' : a.hasAttribute('download') ? 'download' : h;
      }));
      assert.deepEqual(links, ['mailto', 'tel', 'download', '/evidence'], 'card (email · phone · PDF) then back, in focus order');
      assert.equal(await end.locator('.nb-back').getAttribute('href'), '/evidence');
      const covered = await page.evaluate(() => {
        const box = document.querySelector('.nb-page.active .nb-closed');
        const r = box.querySelector('svg').getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = (box.offsetWidth / 2) * (77.6 / 80);
        return [...document.querySelectorAll('.nb-page.active .nb-contact, .nb-page.active .nb-back')].filter((a) => {
          const b = a.getBoundingClientRect();
          return Math.hypot(Math.max(b.left, Math.min(cx, b.right)) - cx, Math.max(b.top, Math.min(cy, b.bottom)) - cy) < rad - 1;
        }).map((a) => a.textContent.trim().slice(0, 10));
      });
      assert.deepEqual(covered, [], 'the stamp covers no link');
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
      await page.close();
    }

    // ── 펼친 수첩(1920×1080) — 넘김 세 번, 펼친 쪽은 스크롤 없이 들어온다. 화면이 줄면 한 쪽씩으로 바뀌어도 보던 장이 이어진다 ──
    {
      const { page, imgs } = await open({ width: 1920, height: 1080 });
      assert.equal(await indicator(page), '1 / 7');
      assert.deepEqual([...new Set(imgs)].sort(), ['memo_1.jpg', 'memo_2.jpg'], 'the cover loads only the next spread');
      const shown = [await indicator(page)];
      const mid = await midTurn(page, '.nb-next');
      assert.ok(mid.length >= 3 && mid.every((m) => m.opacity === 1), `spread turn stays opaque ${JSON.stringify(mid)}`);
      for (let i = 0; i < 3; i++) {
        const g = await geometry(page);
        shown.push(await indicator(page));
        assert.equal(g.length, 2, 'two pages side by side');
        assert.deepEqual(g.map((x) => x.room), [0, 0], `${await indicator(page)}: both pages fit ${JSON.stringify(g.map((x) => x.ch))}`);
        assert.equal(g[0].paper[2], g[1].paper[2]);
        if (i < 2) await next(page);
      }
      assert.deepEqual(shown, ['1 / 7', '2–3 / 7', '4–5 / 7', '6–7 / 7'], 'three turns');
      assert.equal(await page.locator('.nb-next').isDisabled(), true);
      assert.deepEqual(await page.locator('.nb-tab[aria-current="true"]').allInnerTexts(), [L.part3_tab, L.end_tab].map((s) => s.trim()));
      const book = await page.evaluate(() => document.querySelector('.nb-book').getBoundingClientRect().width / innerWidth);
      assert.ok(book > 0.6 && book < 0.72, `the spread is about 65% of the screen (${book.toFixed(2)})`);
      assert.equal(await overX(page), 0);
      // 화면이 낮아지면 한 쪽씩 — 보던 3부가 그대로 보인다
      await page.locator('.nb-tab[data-ch="p1"]').click();
      await page.waitForTimeout(760);
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.waitForTimeout(300);
      assert.equal(await indicator(page), '2 / 6', 'same chapter after leaving the spread');
      await page.close();
    }

    assert.deepEqual(errors, []);
    console.log('PASS notebook: one paper size · binding · title line on every page, opaque turns (also under reduced motion), four index tabs with the current chapter, keys scroll inside first, pictures only for the current and next page, 3부 photo window (focus kept, Esc · outside · close, focus back), weight of the conclusion, last page (signature · CASE CLOSED stamp with the visit date · card · back, stamp covers nothing, phones not longer than before), spreads at 1920×1080 (three turns, both pages fit) and back to single pages on a low screen.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
