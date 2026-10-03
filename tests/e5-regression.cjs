const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
// Wording comes from the data, so the test survives the final copy replacing the draft.
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_화면문구.json'), 'utf8'));
const skillText = (n) => E5.labels.skill.replace('{n}', n);
const E5 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_증거카드.json'), 'utf8')).evidences.find(e => e.id === 'E5').brief;
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
const ORIGINAL = 'https://arcana-test-nine.vercel.app/';
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    // Reduced motion settles a run at once; the timed run is checked in a second page below.
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/evidence/E5/interactive');
    await page.locator('.oc').waitFor();
    assert.equal(await page.locator('.oc-lane').count(), 2);
    assert.equal(await page.locator('.oc-card img').count(), 10);
    await page.waitForFunction(() => [...document.querySelectorAll('.oc img')].every(i => i.complete));
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.oc img')].filter(i => !i.naturalWidth).length), 0, 'every card image loads');
    assert.equal(await page.locator('.oc-lane.is-after .is-swapped figcaption').innerText(), '로자리아');
    assert.equal(await page.locator('.oc-lane.is-before .oc-insert').count(), 0, 'the unchanged lane gains nothing');

    // The original is the interactive proposal, reachable from the header before any interaction.
    await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
    await page.locator('.brief-head-doc button').click();
    assert.deepEqual(await page.evaluate(() => window.__opened), [ORIGINAL]);

    // Before the first press there is one thing to press: the run button carries the cue, the prompt sits
    // beside it instead of in the header, and the relations to swap in are not offered yet.
    assert.equal(await page.locator('.brief-prompt').count(), 0, 'the prompt left the header');
    assert.equal(await page.locator('.oc-go .cue-note').innerText(), E5.lead.prompt);
    assert.equal(await page.locator('.oc-run').evaluate(b => b.classList.contains('cue')), true);
    assert.equal(await page.locator('.cue').count(), 1, 'one cue per screen');
    assert.equal(await page.locator('.oc-choose').isHidden(), true);
    assert.equal(await page.locator('.oc-caption').innerText(), '');
    await page.locator('.oc-run').click();
    assert.equal(await page.locator('.oc').getAttribute('data-done'), 'true');
    assert.equal(await page.locator('.oc-lane.is-after .oc-insert').innerText().then(t => t.includes('「즐거운 창작의 고통」')), true);
    assert.equal(await page.locator('.oc-lane.is-after .oc-reward strong').innerText(), skillText(1));
    assert.equal(await page.locator('.oc-lane.is-before .oc-stop.is-lit').count(), 4, 'both lanes walk the same fixed stops');
    assert.equal(await page.locator('.oc-lane.is-after .oc-stop.is-lit').count(), 4);
    // One point: everything the set adds sits in the one cell, and one line names it — no explanation blocks.
    assert.equal(await page.locator('.oc-lane.is-after .is-slot .oc-pay > *').count(), 4, 'set, event, skill and trait in one cell');
    assert.equal(await page.locator('.oc-lane.is-after .oc-pay-trait strong').innerText(), E5.sets[0].trait);
    assert.equal(await page.locator('.oc-trait, .oc-ready, .oc-diff, .oc-summary').count(), 0, 'nothing new outside the cell');
    assert.equal(await page.locator('.oc-caption').innerText(), E5.labels.caption);
    assert.equal(await page.locator('.cue').count(), 0, 'the cue is spent after the first press');
    assert.equal(await page.locator('.oc-go .cue-note').isHidden(), true);
    assert.equal(await page.locator('.oc-run').evaluate(b => b.classList.contains('is-done')), true);
    assert.equal(await page.locator('.oc-choose').isVisible(), true);
    assert.equal(await page.locator('.brief-recap').isVisible(), true);

    for (const [i, card, event, skill] of [[1, '바니걸 스칼렛', '「용족은 사실 친절해!」', skillText(2)], [2, '페이', E5.labels.tbd, skillText(3)], [0, '로자리아', '「즐거운 창작의 고통」', skillText(1)]]) {
      await page.locator('.oc-set').nth(i).click();
      assert.equal(await page.locator('.oc-set').nth(i).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.oc-lane.is-after .is-swapped figcaption').innerText(), card);
      assert.equal((await page.locator('.oc-lane.is-after .oc-insert').innerText()).includes(event), true, event);
      assert.equal(await page.locator('.oc-lane.is-after .oc-reward strong').innerText(), skill);
      assert.equal(await page.locator('.oc-lane.is-after .oc-counts .is-on').count(), 1, 'one set stands per one-card swap');
      assert.equal(await page.locator('.oc-lane.is-after .is-slot').evaluate(n => n.classList.contains('is-lit')), true, 'another relation is shown settled');
    }

    for (const width of [320, 390, 768, 1180, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflows at ${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.getByRole('button', { name: UI.brief.restart, exact: true }).click();
    assert.equal(await page.locator('.oc').getAttribute('data-step'), '0');
    assert.equal(await page.locator('.brief-recap').isHidden(), true);
    assert.equal(await page.locator('.oc-caption').innerText(), '');
    assert.equal(await page.locator('.oc-choose').isHidden(), true);
    assert.equal(await page.locator('.oc-run').evaluate(b => b.classList.contains('cue')), true, 'a fresh start cues the run again');
    assert.equal(await page.locator('.oc-go .cue-note').isVisible(), true);
    assert.equal(await page.locator('.oc-set').first().getAttribute('aria-pressed'), 'true');

    // Timed run: the step follows elapsed time; a hidden tab settles it instead of freezing it.
    const timed = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    timed.on('pageerror', e => errors.push(e.message));
    await timed.goto(origin + '/evidence/E5/interactive');
    await timed.locator('.oc').waitFor();
    await timed.locator('.oc-run').click();
    await timed.waitForTimeout(1200);
    const mid = Number(await timed.locator('.oc').getAttribute('data-step'));
    assert.ok(mid > 0 && mid < 11, `mid-run step ${mid}`);
    assert.equal(await timed.locator('.oc-run').isDisabled(), true);
    await timed.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await timed.locator('.oc').getAttribute('data-done'), 'true', 'a hidden tab settles the run');
    await timed.evaluate(() => { delete document.hidden; });
    assert.equal(await timed.locator('.oc-run').isDisabled(), false);

    assert.deepEqual(errors, []);
    console.log('PASS E5 one card: two lanes, card art, original link, cue and prompt on the run, additions in one cell, one caption, three relations, restart, hidden-tab settle, 320–1440px.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
