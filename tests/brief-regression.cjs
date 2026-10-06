// Run against a local SPA server: NODE_PATH=<directory containing playwright> node tests/brief-regression.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
// 화면 문구는 GPT가 바꿀 수 있다 — 버튼 이름은 데이터에서 읽는다
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_화면문구.json'), 'utf8'));
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
      navigate('/evidence/E1/interactive'); navigate('/evidence');
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
    // 처음에는 조작 칸만 — 차트 · 표는 첫 스킬을 누를 때 펼쳐진다(10/06)
    assert.equal(await page.locator('.fx.fx-closed').count(), 1, 'E2 opens with the skill panel only');
    assert.equal(await page.locator('.fx-chartcol').isVisible(), false);
    assert.equal(await page.locator('.fx-card').first().isVisible(), true);
    // 원본 문서는 버튼이 아니라 새 탭으로 여는 링크다(10/06 — 가운데 클릭 · 주소 복사가 되게)
    assert.equal(await page.locator('.brief-head-doc a[target="_blank"]').count(), 1, 'Original is always reachable');
    assert.notEqual(await page.locator('.brief-head-doc a').getAttribute('href'), '#', 'Original link has a real address');

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
    assert.equal(await test.locator('.fx-closed').count(), 0, 'The first cast opens the board');
    await page.evaluate(() => window.testFlow.restart());
    assert.equal(await test.locator('.fx-closed').count(), 1, 'Restart returns to the skill panel only');
    await mountFlow({ start_cost: 1 });
    await test.locator('.fx-card').first().evaluate(el => el.click());
    // 판이 펼쳐진 뒤에 흐름이 걷는다 — 고정 시간 대신 흐름이 끝날 때까지 기다린다
    await page.waitForFunction(() => !document.querySelector('#regression-host .fx-tracing'));
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

    // 옛 주소(/brief)로 이미 보낸 링크도 인터랙티브 페이지에 닿아야 한다
    await page.goto(origin + '/evidence/E1/brief');
    await page.waitForURL('**/evidence/E1/interactive');
    await page.locator('.cc').waitFor();

    // E1: real pointer input, wrong answer return, cancellation, keyboard alternative, both passes.
    // 맞히기가 첫 장이다(10/06) — 첫 화면에서 바로 카드를 끈다
    await page.goto(origin + '/evidence/E1/interactive');
    await page.locator('.cc').waitFor();
    assert.deepEqual(await page.locator('.cc-ch:not([hidden])').evaluateAll(es => es.map(e => e.dataset.n)), ['0', '1'], 'The paradox band and the quiz are open at first');
    assert.ok(await page.evaluate(() => document.querySelector('.cc-cards .cc-plate').getBoundingClientRect().bottom <= innerHeight), 'The first action is on the first screen');
    // 다음 장으로 데려가는 스크롤(setInterval)이 멈출 때까지 기다린다 — 고정 시간은 화면이 바쁘면 모자라서
    // 카드 자리를 스크롤 도중에 읽고 엉뚱한 곳을 누르게 된다(지금 누를 것 표시가 퍼지는 동안 특히)
    const settle = () => page.waitForFunction(async () => { const y = window.scrollY; await new Promise((r) => setTimeout(r, 150)); return window.scrollY === y; });
    await settle();
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
      // 틀린 자리에 놓았던 카드가 제자리로 돌아오는 연출(0.28초)이 끝난 뒤에 자리를 읽는다
      await page.waitForFunction((sel) => !document.querySelector(sel).getAnimations().length, '.cc-cards [data-id="' + id + '"]');
      await src.scrollIntoViewIfNeeded();
      await settle();
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
    // 셋을 다 맞히면 소감과 '이후 이야기 살펴보기'가 열리고, 그 버튼이 호출 장을 연다
    await page.locator('.cc-match-done .cc-next').click();
    // 회차는 내려가며 펼쳐진다 — 끝까지 내리면 남은 회차가 모두 펼쳐지고, 마지막 캐릭터가 내려앉으면 걱정이 열린다
    // 그림이 늦게 실리면 문서가 길어진다 — 닿을 때까지 끝으로 다시 내린다
    const toEnd = (sel) => page.waitForFunction((q) => { window.scrollTo(0, document.documentElement.scrollHeight); return !!document.querySelector(q); }, sel, { polling: 300 });
    await settle();
    await toEnd('.cc-worry:not([hidden])');
    assert.equal(await page.locator('.cc-ep.cc-filled').count(), 6);
    assert.equal(await page.locator('.cc-rl-slot.is-called').count(), 6, 'Pass 1 records every call on the sheets');
    assert.equal(await page.locator('.cc-rl .cc-layers i').count(), 0, 'Pass 1 does not thicken the sheets');
    await page.locator('.cc-worry .cc-next').click();
    assert.equal(await page.locator('.cc-second-pass').count(), 1);
    await settle();
    await toEnd('.cc-ch[data-n="3"]:not([hidden])');
    assert.equal(await page.locator('.cc-rl-slot.is-on').count(), await page.locator('.cc-ep').count());
    assert.equal(await page.locator('.cc-rl .cc-layers i').count(), await page.locator('.cc-ep').count(), 'Every facet adds one sheet of paper');
    // 먼저 붙은 종이가 시트 바로 뒤(위)에 — 그리는 순서가 가장 나중(형제 중 마지막)이고 어긋남이 가장 작다
    assert.deepEqual(await page.locator('.cc-rl').first().locator('.cc-layers i').evaluateAll(es => es.map(e => e.style.getPropertyValue('--o'))), ['12px', '6px']);
    await page.locator('.cc-ch[data-n="3"] .cc-next').click();
    await page.getByRole('button', { name: UI.brief.restart, exact: true }).click();
    assert.equal(await page.locator('.cc-second-pass, .cc-done, .cc-drag, .cc-token, .cc-flyer').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('cc-plate')), true, 'Restart focuses the first card');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
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
