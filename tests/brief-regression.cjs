// Run against a local SPA server: NODE_PATH=<directory containing playwright> node tests/brief-regression.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(origin + '/evidence');
    await page.locator('.ev-grid').waitFor();
    await page.evaluate(async () => {
      const { navigate } = await import('/assets/js/router.js');
      navigate('/evidence/E1/brief'); navigate('/evidence');
    });
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.ev-grid').count(), 1, 'Cancel pending route back to source');
    await page.locator('.ev-card[data-eid="E2"]').click();
    await page.locator('.fx-card').first().waitFor();
    await page.waitForTimeout(500);
    await page.goBack(); await page.locator('.ev-grid').waitFor();
    await page.goForward(); await page.locator('.fx').waitFor();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.fx-node').count(), 13);
    assert.equal(await page.locator('.fx-master-table').count(), 4);
    assert.equal(await page.locator('.brief-head-doc button').count(), 1, 'Original is always reachable');

    // Use the real renderer/reducer with deterministic fixture timing; no production debug API.
    async function mountFlow(overrides = {}) {
      await page.evaluate(async overrides => {
        window.testFlow?.destroy();
        const { DB } = await import('/assets/js/data.js');
        const { playFlow } = await import('/assets/js/briefs/flow.js');
        const cfg = structuredClone(DB.cards.find(c => c.id === 'E2').brief);
        Object.assign(cfg.play, { start_cost: 10, rate: 0, step_ms_start: 30, step_ms_min: 30 }, overrides);
        let host = document.getElementById('regression-host');
        if (!host) { host = document.createElement('div'); host.id = 'regression-host'; document.body.append(host); }
        host.textContent = '';
        window.testFlow = playFlow(host, cfg, () => {});
      }, overrides);
    }
    const test = page.locator('#regression-host');
    await mountFlow();
    await page.evaluate(() => {
      const b = document.querySelector('#regression-host .fx-card');
      b.click(); b.click(); // Interrupt before the spend presentation step; the cast must still be committed exactly once.
    });
    assert.match(await test.locator('.fx-count').innerText(), /^1 \/ 4/);
    assert.match(await test.locator('.fx-cost').innerText(), /7\.00/);
    assert.equal(await test.locator('.fx-deck-item').last().getAttribute('data-sid'), 'himari');
    assert.equal(await test.locator('.fx-card').first().getAttribute('data-sid'), 'tomoe');
    await mountFlow({ start_cost: 1 });
    await test.locator('.fx-card').first().evaluate(el => el.click());
    await page.waitForTimeout(500);
    assert.match(await test.locator('.fx-count').innerText(), /^0 \/ 4/);
    assert.match(await test.locator('.fx-cost').innerText(), /1\.00/);
    assert.equal(await test.locator('.fx-paths path[data-to="deny"]').getAttribute('class'), 'on');
    assert.equal(await test.locator('.fx-paths path[data-to="spend"]').getAttribute('class'), null);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mountFlow({ hand: ['ui', 'hoshino', 'cherino'], deck: ['himari', 'tomoe', 'haruka'] });
    await test.locator('.fx-card[data-sid="ui"]').evaluate(el => el.click());
    assert.equal(await test.locator('[data-t="runtime"] tr[data-sid="hoshino"] [data-c="ex_skill_cost"]').getAttribute('data-v'), '3');
    await mountFlow({ hand: ['hoshino', 'ui', 'cherino'], deck: ['himari', 'tomoe', 'haruka'] });
    await test.locator('.fx-card[data-sid="hoshino"]').evaluate(el => el.click());
    assert.match(await test.locator('.fx-rate').innerText(), /0\.6660/);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await mountFlow();
    await test.locator('.fx-card').first().evaluate(el => el.click());
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    assert.equal(await test.locator('.fx-tracing').count(), 0);
    assert.match(await test.locator('.fx-cost').innerText(), /7\.00/);
    await page.evaluate(() => { window.testFlow.destroy(); document.getElementById('regression-host').remove(); });

    // E1: real pointer input, wrong answer return, cancellation, keyboard alternative, both passes.
    await page.goto(origin + '/evidence/E1/brief');
    await page.locator('.cc-ch[data-n="0"] .cc-next').click();
    await page.waitForTimeout(800);
    const ids = await page.locator('.cc-cards .cc-plate').evaluateAll(es => es.map(e => e.dataset.id));
    const cancelSource = page.locator('.cc-cards .cc-plate').first();
    await cancelSource.scrollIntoViewIfNeeded();
    const cancelRect = await cancelSource.boundingBox();
    await page.mouse.move(cancelRect.x + 10, cancelRect.y + 10); await page.mouse.down();
    await page.evaluate(() => window.dispatchEvent(new Event('pointercancel')));
    await page.mouse.up();
    assert.equal(await page.locator('.cc-drag').count(), 0, 'Cancelled pointer cleans up its drag');
    async function dragTo(id, target) {
      const src = page.locator('.cc-cards [data-id="' + id + '"]');
      await src.scrollIntoViewIfNeeded();
      const a = await src.boundingBox(), b = await page.locator('.cc-slot[data-id="' + target + '"]').boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up();
    }
    await dragTo(ids[0], ids[1]); assert.equal(await page.locator('.cc-done').count(), 0);
    await dragTo(ids[0], ids[0]); assert.equal(await page.locator('.cc-done').count(), 1);
    for (const id of ids.slice(1)) {
      await page.locator('.cc-cards [data-id="' + id + '"]').focus(); await page.keyboard.press('Enter');
      await page.locator('.cc-slot[data-id="' + id + '"]').focus(); await page.keyboard.press('Enter');
    }
    assert.equal(await page.locator('.cc-done').count(), 3);
    await page.locator('.cc-match-done .cc-next').click(); await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.locator('.cc-worry:not([hidden])').waitFor();
    await page.locator('.cc-worry button').click(); await page.waitForTimeout(900);
    assert.equal(await page.locator('.cc-second-pass').count(), 1);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.locator('.cc-ch[data-n="3"]:not([hidden])').waitFor();
    assert.equal(await page.locator('.cc-rl-facets .cc-on').count(), await page.locator('.cc-ep').count());
    await page.locator('.cc-ch[data-n="3"] .cc-next').click();
    await page.getByRole('button', { name: '다시 해보기', exact: true }).click();
    assert.equal(await page.locator('.cc-second-pass, .cc-done, .cc-drag, .cc-token, .cc-flyer').count(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.cc-ch[data-n="0"] .cc-next').click();
    await page.locator('.cc-skip').click();
    assert.equal(await page.locator('.cc-ch[data-n="2"]:not([hidden])').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => { document.startViewTransition = undefined; });
    await page.locator('.brief-foot a').click(); await page.locator('.ev-grid').waitFor();
    await page.locator('.ev-card[data-eid="E2"]').click(); await page.locator('.fx').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('.fx-concept b').allTextContents().then(x => x.join(' ')), 'READ WRITE');
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: navigation, interruption, cost/queue/reduction/boost, hidden-tab recovery, drag/keyboard, rewind/facets, restart, mobile, reduced motion, fallback.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
