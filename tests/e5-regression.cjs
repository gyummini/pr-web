// E5 · one_card — 편성 화면이 곧 조작판(10/07): 다섯째 자리 옆 후보 카드를 고르면 같은 세트끼리 실이 이어지고
// 여정이 바로 재생된다. 더해지는 것(세트 이벤트 · 스킬 강화 · 편성 효과)은 빈 이벤트 시간 한 칸에 모인다.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
// 문구는 데이터에서 읽는다 — GPT가 문구를 바꿔도 테스트는 그대로 돈다
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_화면문구.json'), 'utf8'));
const E5 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_증거카드.json'), 'utf8')).evidences.find(e => e.id === 'E5').brief;
const t = E5.labels;
const skillText = (n) => t.skill.replace('{n}', n);
const quote = (s) => t.event_format.replace('{t}', s);
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
const ORIGINAL = 'https://arcana-test-nine.vercel.app/';
const pickName = (id) => E5.cards[id].name;
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    // 움직임 줄이기면 고르는 즉시 끝까지 간다 — 시간에 따라 걷는 진행은 아래 둘째 페이지에서 본다
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/evidence/E5/interactive');
    await page.locator('.ocx').waitFor();
    assert.equal(await page.locator('.ocx-card').count(), 5, 'four fixed cards and the fifth seat');
    assert.equal(await page.locator('.ocx-pick').count(), E5.sets.length, 'one candidate per relation');
    assert.deepEqual(await page.locator('.ocx-pick span').allInnerTexts(), E5.sets.map((s) => pickName(s.swap)));
    // 여정 칸은 처음 고르기 전에는 접혀 있어 그 안의 얼굴 그림은 아직 불러오지 않는다 — 편성 줄의 그림만 본다
    await page.waitForFunction(() => [...document.querySelectorAll('.ocx-board img')].every(i => i.complete));
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ocx-board img')].filter(i => !i.naturalWidth).length), 0, 'every card image loads');
    assert.equal(await page.locator('.ocx-card.is-five figcaption').innerText(), pickName(E5.swap_out));

    // 원본은 인터랙티브 기획서 — 조작 전에도 머리말에서 새 탭 링크로 열린다(10/06)
    const doc = page.locator('.brief-head-doc a');
    assert.equal(await doc.getAttribute('href'), ORIGINAL);
    assert.equal(await doc.getAttribute('target'), '_blank');

    // 처음 누를 것은 후보 패 하나 — 안내 말풍선이 그 옆에 붙고(머리말 알약은 빠진다), 진행 버튼은 없다
    assert.equal(await page.locator('.brief-prompt').count(), 0, 'the prompt left the header');
    assert.equal(await page.locator('.ocx-five .cue-note').innerText(), t.pick_hint);
    assert.equal(await page.locator('.cue').count(), 1, 'one cue per screen');
    assert.equal(await page.locator('.ocx-bench').evaluate(n => n.classList.contains('cue')), true);
    assert.equal(await page.locator('.oc-run').count(), 0, 'no separate run button');
    assert.equal(await page.locator('.ocx').getAttribute('data-state'), 'a');
    assert.equal(await page.locator('.ocx-knot').isHidden(), true, 'no thread before a pick');
    // 첫 화면은 편성 줄과 후보 패만 — 여정은 처음 고른 뒤에 펼쳐진다(10/07)
    assert.equal(await page.locator('.ocx-journey').isHidden(), true, 'the journeys wait for the first pick');
    assert.equal(await page.locator('.ocx-stage-main .oc-insert').count(), 0, 'the empty time is empty');
    assert.equal(await page.locator('.oc-caption').innerText(), '');

    // 고르면 그 카드가 다섯째 자리로, 같은 세트끼리 실이 이어지고 여정이 끝까지 간다
    await page.locator('.ocx-pick').first().click();
    assert.equal(await page.locator('.ocx').getAttribute('data-state'), 'c');
    assert.equal(await page.locator('.ocx-journey').isVisible(), true, 'the first pick opens the journeys');
    assert.equal(await page.locator('.ocx-card.is-five figcaption').innerText(), pickName(E5.sets[0].swap));
    assert.equal(await page.locator('.ocx-knot').innerText(), E5.sets[0].name);
    assert.equal(await page.locator('.ocx-svg path.string').count(), E5.sets[0].members.length - 1, 'one thread between neighbouring members');
    assert.equal(await page.locator('.ocx-card.is-member').count(), E5.sets[0].members.length);
    assert.equal(await page.locator('.ocx-svg path.drop').count(), 1, 'the thread drops into the empty time');
    assert.equal((await page.locator('.ocx-stage-main .oc-insert').innerText()).includes(quote(E5.sets[0].event)), true);
    assert.equal(await page.locator('.ocx-stage-main .oc-reward strong').innerText(), skillText(E5.sets[0].skill));
    assert.equal(await page.locator('.ocx-stage-main .oc-pay-trait strong').innerText(), E5.sets[0].trait);
    assert.equal(await page.locator('.ocx-stage-ghost .ocx-empty').innerText(), t.stays_empty, 'the old journey stays empty in the same column');
    assert.equal(await page.locator('.ocx-cell.is-main.dot-lit').count(), 4, 'the fixed stops pass');
    assert.equal(await page.locator('.oc-caption').innerText(), t.caption);
    assert.equal(await page.locator('.cue').count(), 0, 'the cue is spent after the first pick');
    assert.equal(await page.locator('.ocx-five .cue-note').isHidden(), true);
    assert.equal(await page.locator('.ocx-bench-label').innerText(), t.choose, 'the candidates become "try another relation"');
    assert.equal(await page.locator('.brief-recap').isVisible(), true);

    // 후보 패가 곧 '다른 관계로 바꿔 보기' — 내려온 카드는 후보 자리로, 처음 카드로 돌리면 실이 사라진다
    for (const s of [E5.sets[1], E5.sets[2], E5.sets[0]]) {
      await page.locator(`.ocx-pick[data-id="${s.swap}"]`).click();
      assert.equal(await page.locator('.ocx-card.is-five figcaption').innerText(), pickName(s.swap));
      assert.equal(await page.locator('.ocx-knot').innerText(), s.name);
      assert.equal((await page.locator('.ocx-stage-main .oc-insert').innerText()).includes(s.event ? quote(s.event) : t.tbd), true, s.name);
      assert.equal(await page.locator('.ocx-stage-main .oc-reward strong').innerText(), skillText(s.skill));
      assert.equal(await page.locator('.ocx-counts .is-on').count(), 1, 'one set stands per one-card swap');
      assert.equal(await page.locator('.ocx-pick[data-id="' + E5.swap_out + '"]').count(), 1, 'the swapped-out card waits in the bench');
    }
    await page.locator(`.ocx-pick[data-id="${E5.swap_out}"]`).click();
    assert.equal(await page.locator('.ocx').getAttribute('data-state'), 'a');
    assert.equal(await page.locator('.ocx-knot').isHidden(), true, 'back to the first card, the thread is gone');
    await page.locator('.ocx-pick').first().click();

    // 키보드 — 후보는 버튼이고, 누른 버튼이 다시 그려져도 초점은 같은 자리의 후보에 남는다
    await page.locator('.ocx-pick').nth(1).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('ocx-pick')), true, 'focus stays in the bench');

    for (const width of [320, 390, 768, 1180, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflows at ${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.getByRole('button', { name: UI.brief.restart, exact: true }).click();
    assert.equal(await page.locator('.ocx').getAttribute('data-state'), 'a');
    assert.equal(await page.locator('.brief-recap').isHidden(), true);
    assert.equal(await page.locator('.ocx-journey').isHidden(), true, 'restart closes the journeys again');
    assert.equal(await page.locator('.oc-caption').innerText(), '');
    assert.equal(await page.locator('.ocx-bench').evaluate(b => b.classList.contains('cue')), true, 'a fresh start cues the bench again');
    assert.equal(await page.locator('.ocx-five .cue-note').isVisible(), true);
    assert.equal(await page.locator('.ocx-card.is-five figcaption').innerText(), pickName(E5.swap_out));

    // 시간에 따라 걷는 진행 — 걸음은 지난 시간에서 나오고, 가려진 탭은 멈추지 않고 끝까지 마친다
    const timed = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    timed.on('pageerror', e => errors.push(e.message));
    await timed.goto(origin + '/evidence/E5/interactive');
    await timed.locator('.ocx').waitFor();
    await timed.locator('.ocx-pick').first().click();
    await timed.waitForTimeout(1200);
    const mid = Number(await timed.locator('.ocx').getAttribute('data-step'));
    assert.ok(mid > 0 && mid < E5.beats.length, `mid-run step ${mid}`);
    assert.equal(await timed.locator('.ocx').getAttribute('data-state'), 'b');
    assert.equal(await timed.locator('.ocx-running').isVisible(), true);
    await timed.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await timed.locator('.ocx').getAttribute('data-done'), 'true', 'a hidden tab settles the run');
    await timed.evaluate(() => { delete document.hidden; });

    assert.deepEqual(errors, []);
    console.log('PASS E5 one card: board as the control, candidates, thread and knot, drop into the empty time, additions in one cell, ghost lane, three relations and back, keyboard, restart, hidden-tab settle, 320–1440px.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
