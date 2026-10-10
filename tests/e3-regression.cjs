// E3 · cut_play — 처음 게임을 해 보고, 판단해서 덜어내고, 출시한 게임을 해 본다.
// 문구는 데이터에서 읽는다 — GPT가 문구를 바꿔도 테스트는 그대로 돈다.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_화면문구.json'), 'utf8'));
const E3card = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_증거카드.json'), 'utf8')).evidences.find((e) => e.id === 'E3');
const E3 = E3card.brief;
const t = E3.labels;
const A = E3.demo.first;
const B = E3.demo.final;
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async (width, height, reduce) => {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin + '/evidence/E3/interactive');
    await page.locator('.cp').waitFor();
    return page;
  };
  // 지금 누를 것이 붙은 곳 — 버튼마다 제 이름표(cp-mine 등)로 가린다
  const cueClass = (page) => page.evaluate(() => [...document.querySelectorAll('.cue')].map((n) => [...n.classList].find((c) => /^cp-(enhance|mine|sell|buy|cut|lane)$/.test(c)) || n.className));
  const center = async (page, sel) => { const r = await page.locator(sel).first().boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const drag = async (page, from, to) => {
    await page.mouse.move(...from); await page.mouse.down();
    await page.mouse.move(from[0] + 12, from[1] + 12, { steps: 3 });
    await page.mouse.move(...to, { steps: 10 }); await page.mouse.up();
    await wait(150);
  };
  const slotNames = (page) => page.evaluate(() => [...document.querySelectorAll('.cp-slot')].map((s) => s.getAttribute('aria-label') || ''));
  try {
    const page = await open(1440, 1000, true);

    // ① 처음 게임 — 지금 누를 것은 강화 하나, 안내는 그 위 말풍선(머리말 알약은 빠진다)
    assert.equal(await page.locator('.brief-prompt').count(), 0, 'the header prompt moved to the action');
    assert.equal(await page.locator('.brief-notice').isVisible(), false, 'no PC notice on a wide screen');
    assert.deepEqual(await cueClass(page), ['cp-enhance']);
    assert.equal(await page.locator('.cp-go .cue-note').innerText(), t.run_hint);
    assert.equal(await page.locator('.cp-zone').count(), 3);
    await page.locator('.cp-enhance').click();
    assert.equal(await page.locator('.cp-msg').innerText(), t.short, 'no materials yet');
    assert.deepEqual(await cueClass(page), ['cp-mine'], 'the cue moves to mining');
    // 단계 안내 말풍선은 하나 — 지금 누를 것을 따라 옮겨 가며 문구가 바뀐다(10/07)
    assert.equal(await page.locator('.cp-guide:not([hidden])').count(), 1);
    assert.equal(await page.locator('.cp-guide').innerText(), t.guide_mine);
    assert.equal(await page.locator('.cp-guide').evaluate((g) => g.nextElementSibling?.classList.contains('cp-mine')), true, 'the bubble sits right above the cue');
    // 표시를 따라 누르면 강화까지 간다 — 바위가 다시 나오는 동안은 기다린다.
    // 재료가 모여 말풍선이 '다시 강화해 보세요'라고 할 때 그 아래에 '재료가 부족합니다'가 남지 않는다(10/10 마2)
    let gathered = false;
    for (let i = 0; i < 40 && (await page.locator('.cp-judge').isHidden()); i += 1) {
      const cue = page.locator('.cue').first();
      if (await cue.isDisabled()) { await wait(200); continue; }
      if (!gathered && (await page.locator('.cp-guide').innerText()) === t.guide_enhance) {
        gathered = true;
        assert.notEqual(await page.locator('.cp-msg').innerText(), t.short, 'the shortage notice is gone once the materials are in');
      }
      await cue.click();
      await wait(60);
    }
    assert.ok(gathered, 'the cue came back to enhance after gathering');
    const presses = 2 + Number(A.durability) * A.upgrade[0].iron;
    assert.equal(await page.locator('.cp-presses').innerText(), fill(t.presses, { n: presses }), 'presses until the first enhancement');
    assert.equal(await page.locator('.cp-level').innerText(), '+1');
    assert.equal(await page.locator('.cp-msg').innerText(), t.success);

    // ② 판단 — 근거·질문이 열리고, 지금 누를 것은 덜어내기
    assert.equal(await page.locator('.cp-question').innerText(), E3.chapters[2].title.replace(/\n/g, '\n'));
    assert.deepEqual(await cueClass(page), ['cp-cut']);
    assert.equal(await page.locator('.cp-guide').innerText(), t.guide_cut);
    await page.locator('.cp-cut').click();
    await wait(100);
    assert.equal(await page.locator('.cp').getAttribute('data-phase'), 'final', 'reduced motion lands the cut at once');
    assert.deepEqual(await page.locator('.cp-zone.is-gone .cp-gone').allInnerTexts(), [t.mining_cut, t.economy_cut]);
    assert.equal(await page.locator('.cp-cut').isDisabled(), true, 'the decision stays as a decision');
    // 내린 결정의 체크는 선으로 그린다(10/11 가2 — ✓는 Pretendard에 없는 글자)
    assert.equal(await page.locator('.cp-cut').evaluate((b) => getComputedStyle(b, '::before').content), '""', 'the decision check is drawn, not a glyph');
    // 처음 게임의 '강화 한 번까지 N번'은 덜어낸 칸에 남아 출시한 게임의 횟수와 나란히 선다 — 같은 확정 문구를 다시 쓴다(10/11 사용자 결정 재7)
    assert.deepEqual(await page.locator('.cp-zone.is-gone .cp-was > span').allInnerTexts(), [t.first_title, fill(t.presses, { n: presses })], 'the first game count stays in the cut zone');

    // ③ 출시한 게임 — 줄 · 방 · 강화대. 그림은 모두 읽히고 이모지는 없다
    await page.locator('.cp-walker').first().waitFor();
    assert.deepEqual(await cueClass(page), ['cp-lane']);
    assert.equal(await page.locator('.cp-lanebox .cue-note').innerText(), t.take_hint);
    await page.waitForFunction(() => [...document.querySelectorAll('.cp-walker img')].every((i) => i.complete));
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.cp-walker img')].filter((i) => !i.naturalWidth).length), 0, 'lane pictures load');
    const first = await page.locator('.cp-walker').first().getAttribute('aria-label');
    await drag(page, await center(page, '.cp-walker'), await center(page, '.cp-slot[data-i="2"]'));
    assert.equal((await slotNames(page))[2], first, 'drop on an empty slot sits there');
    await drag(page, await center(page, '.cp-walker'), await center(page, '.cp-slot[data-i="2"]'));
    assert.ok((await slotNames(page))[0], 'drop on a taken slot goes to the first empty one');
    await page.locator('.cp-walker').first().waitFor();
    const lane = await page.locator('.cp-walker').count();
    await drag(page, await center(page, '.cp-walker'), [200, 200]);
    assert.equal(await page.locator('.cp-walker').count(), lane, 'dropped outside the room, it goes back to the line');
    assert.equal(await page.locator('.cp-room-label').innerText(), fill(t.room, { n: 2, max: B.slots }));
    assert.deepEqual(await cueClass(page), ['cp-enhance'], 'two in the room — the cue moves to the stand');
    assert.match(await page.locator('.cp-rot-face img').getAttribute('title'), /·/, 'each picture names its uploader');

    for (let i = 0; i < Number(E3.demo.final_goal); i += 1) {
      await page.waitForFunction(() => !document.querySelector('.cp-enhance').disabled, null, { timeout: 15000 });
      await page.locator('.cp-enhance').click();
      await wait(80);
      if (i === 0) assert.equal(await page.locator('.cp-msg').innerText(), fill(t.evolve, { from: 'Tim Cheese', to: 'Pipi Corni' }), 'the first enhancement evolves');
      assert.equal(await page.locator('.cp-presses').innerText(), fill(t.presses, { n: 1 }));
    }
    // 두 수가 한 화면에 나란히 — 처음 게임 칸과 강화 칸의 아래 끝이 같은 높이(10/11 재7)
    const side = await page.evaluate(() => { const a = document.querySelector('.cp-was').getBoundingClientRect(); const b = document.querySelector('.cp-presses').getBoundingClientRect(); return { dy: Math.abs(a.bottom - b.bottom), left: a.right <= b.left }; });
    assert.ok(side.dy <= 2 && side.left, `the two counts sit side by side ${JSON.stringify(side)}`);
    // 빨강은 '지금 누를 것'에만(10/11 재7) — 지나가는 줄 · 덜어낸 칸 · 부족 · 오름 표시는 E3 팔레트
    const red = await page.evaluate(() => {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      const probe = document.createElement('i'); probe.style.color = accent; document.body.append(probe); const rgb = getComputedStyle(probe).color; probe.remove();
      const cs = (q, prop, pseudo) => { const n = document.querySelector(q); return n ? getComputedStyle(n, pseudo)[prop] : ''; };
      return { rgb, lane: cs('.cp-track', 'backgroundImage'), gone: cs('.cp-zone.is-gone .cp-gone', 'color'), dash: cs('.cp-zone.is-gone', 'borderTopColor'), cut: cs('.cp-cut', 'borderRightColor', '::before') };
    });
    assert.ok(![red.gone, red.dash, red.cut].includes(red.rgb) && !red.lane.includes(red.rgb) && !/rgb\(18[0-9], 5\d, 4\d\)|rgb\(19\d, 5\d, 5\d\)/.test(red.lane), `no red outside the cue ${JSON.stringify(red)}`);
    assert.equal(await page.locator('.cp-caption').innerText(), t.final_statement);
    // 결론 한 줄은 공통 부품 — 이름표 + 17px 굵은 한 줄(10/10 마6)
    assert.equal(await page.locator('.cp-concl .brief-concl-key').innerText(), UI.brief.conclusion);
    assert.equal(await page.locator('.cp-caption').evaluate((n) => getComputedStyle(n).fontSize), '16.96px');
    assert.equal(await page.locator('.cp-kept').isVisible(), true);
    assert.equal(await page.locator('.brief-recap').isVisible(), true, 'the conclusion opens');
    // 끝난 뒤에도 계속 강화할 수 있다 — 골드가 다시 모이면 버튼이 돌아온다
    await page.waitForFunction(() => !document.querySelector('.cp-enhance').disabled, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => (document.querySelector('.cp').innerText.match(/\p{Extended_Pictographic}/gu) || []).length), 0, 'no emoji stand-ins');
    assert.ok((await page.locator('.cp-credit').innerText()).includes('CC BY-SA'), 'the picture credit is on the page');

    // 끝 단추 — 원본 문서 · 플레이 링크(첨부)와 '포트폴리오 화면으로 돌아가기'. '다시 해보기'는 뺐다(10/10 사용자 결정 바3)
    assert.deepEqual(await page.locator('.brief-docs a, .brief-docs button, .brief-foot a').allInnerTexts(), [UI.brief.original_doc, ...E3card.attachments.map((a) => a.label), UI.brief.back], 'E3 end buttons');
    assert.equal(await page.getByRole('button', { name: UI.brief.restart, exact: true }).count(), 0, 'no restart button');
    await page.close();

    // 움직임이 있을 때 — 재료 부족 안내는 2초쯤 보였다가 서서히 사라지고(10/10 마2),
    // 강화 결과는 짧은 긴장 뒤에, 덜어낸 두 칸은 줄이 그어진 뒤에 빠진다
    const timed = await open(1440, 1000, false);
    await timed.locator('.cp-enhance').click();
    assert.equal(await timed.locator('.cp-msg').innerText(), t.short);
    await wait(1500);
    assert.equal(await timed.locator('.cp-msg').innerText(), t.short, 'the shortage notice stays for about two seconds');
    await timed.waitForFunction(() => !document.querySelector('.cp-msg').textContent, null, { timeout: 2000 });
    await timed.locator('.cp-skip').click();
    await timed.locator('.cp-cut').click();
    assert.equal(await timed.locator('.cp-zone.is-cut').count(), 2);
    await timed.waitForFunction(() => document.querySelector('.cp').dataset.phase === 'final');
    await timed.close();

    // 노트북 높이(1366×768) — 누른 직후 다음에 누를 것과 결론이 화면 안(10/11 사용자 결정 재5). 전에는 덜어내기 단추가 y 899~949로 화면 밖이었다.
    // 누르기는 화면을 굴리지 않는 click()으로 — 화면이 움직였다면 이 페이지가 옮긴 것이다. 저절로 그리는 때(시세 · 시계)에는 움직이지 않는다
    const laptop = await open(1366, 768, true);
    const inView = (q) => laptop.evaluate((sel) => {
      const n = document.querySelector(sel);
      const r = n.getBoundingClientRect();
      return r.top >= document.getElementById('site-header').getBoundingClientRect().bottom && r.bottom <= innerHeight;
    }, q);
    await laptop.evaluate(() => window.scrollTo(0, 120));
    await wait(2800); // 시세가 두 번 움직인다
    assert.equal(await laptop.evaluate(() => scrollY), 120, 'price ticks do not move the page');
    await laptop.evaluate(() => document.querySelector('.cp-enhance').click());
    for (let i = 0; i < 40 && (await laptop.locator('.cp-judge').isHidden()); i += 1) {
      const moved = await laptop.evaluate(() => { const n = document.querySelector('.cue'); if (!n || n.disabled) return false; n.click(); return true; });
      if (!moved) await wait(150);
    }
    assert.equal(await inView('.cp-cut'), true, 'after the first enhancement the cut button is on screen at 1366x768');
    await laptop.evaluate(() => document.querySelector('.cp-cut').click());
    await laptop.locator('.cp-walker').first().waitFor();
    assert.equal(await inView('.cp-lane'), true, 'after the cut the lane is on screen');
    for (let i = 0; i < 2; i += 1) {
      await laptop.locator('.cp-walker').first().waitFor();
      await laptop.evaluate(() => document.querySelector('.cp-walker').click());
    }
    assert.equal(await inView('.cp-enhance'), true, 'two in the room — the enhance button is on screen');
    const y = await laptop.evaluate(() => scrollY);
    await wait(1200); // 출시한 게임의 시계(0.25초)가 여러 번 그린다
    assert.equal(await laptop.evaluate(() => scrollY), y, 'clock repaints do not move the page');
    for (let i = 0; i < Number(E3.demo.final_goal); i += 1) {
      await laptop.waitForFunction(() => !document.querySelector('.cp-enhance').disabled, null, { timeout: 15000 });
      await laptop.evaluate(() => document.querySelector('.cp-enhance').click());
      await wait(60);
    }
    assert.equal(await inView('.cp-concl'), true, 'the conclusion line is on screen when it appears');
    // 머리의 원본 문서는 다른 페이지와 같은 크기, 건너뛰기는 E1과 같은 사이트 보조 단추(10/11 재9)
    assert.deepEqual(await laptop.evaluate(() => { const r = document.querySelector('.brief-head-doc .btn').getBoundingClientRect(); return [Math.round(r.height), getComputedStyle(document.querySelector('.brief-head-doc .btn')).fontSize]; }), [46, '14.72px'], 'the original document button is the common size');
    assert.equal(await laptop.locator('.cp-skip').evaluate((b) => b.classList.contains('btn') && b.classList.contains('ghost')), true, 'the skip is the site ghost button');
    await laptop.close();

    // 좁은 화면
    for (const width of [390, 320]) {
      const small = await open(width, 844, true);
      assert.equal(await small.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${width}px first game`);
      // 첫 조작이 첫 화면 아래라 다른 페이지와 같은 PC 안내를 둔다(10/10 마7 — 좁은 화면에서만 보인다)
      assert.equal(await small.locator('.brief-notice').innerText(), E3.lead.pc_notice, `${width}px PC notice`);
      await small.locator('.cp-skip').click(); await small.locator('.cp-cut').click();
      await small.locator('.cp-walker').first().waitFor();
      await small.evaluate(() => document.querySelector('.cp-walker').click());
      assert.equal(await small.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${width}px released game`);
      await small.close();
    }

    assert.deepEqual(errors, []);
    console.log('PASS E3 cut play: first game cue path and presses, judgment, cut, lane drag/click into 8 slots, pictures and credit, evolution, conclusion line, end buttons without restart, shortage notice fades, timed cut, PC notice and 320–1440px.');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
