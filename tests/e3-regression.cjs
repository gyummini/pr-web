const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(origin + '/evidence/E3/brief');
    await page.locator('.rd').waitFor();
    await page.evaluate(() => { window.originalCore = document.querySelector('.rd-core'); window.originalButton = document.querySelector('.rd-enhance'); });
    assert.equal(await page.locator('.rd-system').count(), 3);
    assert.equal(await page.locator('.brief-head-doc button').count(), 1);
    await page.locator('.rd-nav button').nth(1).click();
    assert.equal(await page.locator('.rd-rules dt').count(), 5);
    await page.getByRole('button', { name: '경제 덜어내기', exact: true }).click();
    assert.equal(await page.locator('.rd-system').count(), 1);
    assert.equal(await page.locator('.rd').getAttribute('data-chapter'), '2');
    assert.equal(await page.locator('.rd-discovery').isHidden(), true);
    await page.locator('.rd-enhance').click();
    assert.equal(await page.locator('.rd-discovery').isVisible(), true);
    await page.getByRole('button', { name: '채굴 덜어내기', exact: true }).click();
    assert.equal(await page.locator('.rd-system').count(), 0);
    assert.equal(await page.locator('.rd-target-name').innerText(), '곡괭이');
    await page.getByRole('button', { name: '강화 대상을 브레인롯으로', exact: true }).click();
    assert.equal(await page.locator('.rd-target-name').innerText(), '브레인롯 캐릭터');
    assert.equal(await page.locator('.rd-relations li').count(), 4);
    assert.equal(await page.evaluate(() => originalCore === document.querySelector('.rd-core') && originalButton === document.querySelector('.rd-enhance')), true);
    await page.getByRole('button', { name: '무엇이 남았는지 보기 →', exact: true }).click();
    assert.equal(await page.locator('.rd-lessons li').count(), 3);
    assert.equal(await page.locator('.brief-recap').isVisible(), true);
    assert.equal(await page.getByRole('button', { name: '플레이 링크 (Roblox)', exact: true }).count(), 1);
    await page.getByRole('button', { name: '처음부터 다시', exact: true }).click();
    assert.equal(await page.locator('.rd-system').count(), 3);
    assert.equal(await page.locator('.brief-recap').isHidden(), true);
    assert.equal(await page.locator('.rd-result').isHidden(), true);
    assert.equal(await page.evaluate(() => originalCore === document.querySelector('.rd-core')), true);
    for (let i = 0; i < 5; i++) {
      await page.locator('.rd-nav button').nth(i).click();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Chapter ${i + 1} overflows at ${width}`);
      }
    }
    await page.locator('.rd-restart').click();
    for (let i = 0; i < 4; i++) await page.locator('.rd-skip').click();
    assert.equal(await page.locator('.rd-result').isVisible(), true, 'All decisions are skippable');
    await page.getByRole('button', { name: '다시 해보기', exact: true }).click();
    assert.equal(await page.locator('.rd').getAttribute('data-chapter'), '0');
    assert.deepEqual(errors, []);
    console.log('PASS E3 core: chapters, real removal, persistent core/button, context, skip, restart, recap, source links, 320–1440px.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
