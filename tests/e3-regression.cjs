// E3 · cut_play — 처음 게임을 해 보고, 판단해서 덜어내고, 출시한 게임을 해 본다.
// 문구는 데이터에서 읽는다 — GPT가 문구를 바꿔도 테스트는 그대로 돈다.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_화면문구.json'), 'utf8'));
const E3 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_증거카드.json'), 'utf8')).evidences.find((e) => e.id === 'E3').brief;
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
    // 표시를 따라 누르면 강화까지 간다 — 바위가 다시 나오는 동안은 기다린다
    for (let i = 0; i < 40 && (await page.locator('.cp-judge').isHidden()); i += 1) {
      const cue = page.locator('.cue').first();
      if (await cue.isDisabled()) { await wait(200); continue; }
      await cue.click();
      await wait(60);
    }
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
    assert.equal(await page.locator('.cp-caption').innerText(), t.final_statement);
    assert.equal(await page.locator('.cp-kept').isVisible(), true);
    assert.equal(await page.locator('.brief-recap').isVisible(), true, 'the conclusion opens');
    // 끝난 뒤에도 계속 강화할 수 있다 — 골드가 다시 모이면 버튼이 돌아온다
    await page.waitForFunction(() => !document.querySelector('.cp-enhance').disabled, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => (document.querySelector('.cp').innerText.match(/\p{Extended_Pictographic}/gu) || []).length), 0, 'no emoji stand-ins');
    assert.ok((await page.locator('.cp-credit').innerText()).includes('CC BY-SA'), 'the picture credit is on the page');

    // 다시 해보기 — 처음 게임으로
    await page.getByRole('button', { name: UI.brief.restart, exact: true }).click();
    assert.equal(await page.locator('.cp').getAttribute('data-phase'), 'first');
    assert.equal(await page.locator('.cp-walker').count(), 0);
    assert.equal(await page.locator('.cp-slot.is-filled').count(), 0);
    assert.deepEqual(await cueClass(page), ['cp-enhance']);
    await page.close();

    // 움직임이 있을 때 — 강화 결과는 짧은 긴장 뒤에, 덜어낸 두 칸은 줄이 그어진 뒤에 빠진다
    const timed = await open(1440, 1000, false);
    await timed.locator('.cp-skip').click();
    await timed.locator('.cp-cut').click();
    assert.equal(await timed.locator('.cp-zone.is-cut').count(), 2);
    await timed.waitForFunction(() => document.querySelector('.cp').dataset.phase === 'final');
    await timed.close();

    // 좁은 화면
    for (const width of [390, 320]) {
      const small = await open(width, 844, true);
      assert.equal(await small.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${width}px first game`);
      await small.locator('.cp-skip').click(); await small.locator('.cp-cut').click();
      await small.locator('.cp-walker').first().waitFor();
      await small.evaluate(() => document.querySelector('.cp-walker').click());
      assert.equal(await small.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${width}px released game`);
      await small.close();
    }

    assert.deepEqual(errors, []);
    console.log('PASS E3 cut play: first game cue path and presses, judgment, cut, lane drag/click into 8 slots, pictures and credit, evolution, conclusion, restart, timed cut, 320–1440px.');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
