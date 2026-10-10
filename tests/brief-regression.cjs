// Run against a local SPA server: NODE_PATH=<directory containing playwright> node tests/brief-regression.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
// 화면 문구는 GPT가 바꿀 수 있다 — 버튼 이름은 데이터에서 읽는다
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_화면문구.json'), 'utf8'));
const E2card = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_증거카드.json'), 'utf8')).evidences.find((e) => e.id === 'E2');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
// 보관함의 아직 모으지 않은 카드는 요약 팝업을 연다 — '잠금해제하고 요약 인터랙티브 페이지 보기'로 넘어간다(10/07)
const UNLOCK = UI.popup.unlock.replace('{action}', UI.common.to_interactive);
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
    await page.getByRole('button', { name: UNLOCK, exact: true }).click();
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
    // 결론 칸(원본 문서 · 첨부)은 처음부터 열지 않는다 — 첫 시전의 흐름이 끝난 뒤에 연다(10/10 마4)
    assert.equal(await page.locator('.brief-recap').isHidden(), true, 'E2 conclusion box waits for the first cast');
    // 첫 시전(움직임 줄이기 — 흐름이 한 번에 끝난다): 결론 한 줄은 덱 아래(조작 칸 안)에서 첫 화면 안에, 켜진 칸은 자기 상자 안에 다 보이고
    // 페이지는 옆으로 움직이지 않는다(마1 · 마6)
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('.fx-card[data-sid="himari"]')?.classList.contains('ready'));
    await page.locator('.fx-card[data-sid="himari"]').click();
    assert.equal(await page.locator('.brief-recap').isVisible(), true, 'the first cast opens the conclusion box');
    assert.deepEqual(await page.locator('.brief-docs a, .brief-docs button').allInnerTexts(), [UI.brief.original_doc, E2card.attachments[0].label], 'original and attachment only — no restart (10/10)');
    assert.equal(await page.locator('.fx-side .fx-concl .fx-caption').innerText(), E2card.brief.captions.complete, 'the conclusion line sits under the deck');
    assert.equal(await page.locator('.fx-concl .brief-concl-key').innerText(), UI.brief.conclusion);
    assert.ok(await page.evaluate(() => { const r = document.querySelector('.fx-concl').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'the conclusion line is on screen when the flow ends');
    // 노트북 높이(1366×768 · 1280×720)에서도 — 첫 시전 때 화면을 맞추는 양을 결론 줄까지 넓힌다(10/11 사용자 결정 재5. 전에는 결론 줄의 아래 절반 · 전체가 화면 밖)
    for (const [w, h] of [[1366, 768], [1280, 720]]) {
      const lap = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
      await lap.route('**/_vercel/**', (r) => r.abort());
      await lap.goto(origin + '/evidence/E2/interactive', { waitUntil: 'networkidle' });
      await lap.waitForFunction(() => document.querySelector('.fx-card[data-sid="himari"]')?.classList.contains('ready'));
      await lap.locator('.fx-card[data-sid="himari"]').click();
      await lap.waitForTimeout(400);
      const onScreen = await lap.evaluate(() => { const r = document.querySelector('.fx-concl').getBoundingClientRect(); return r.height > 0 && r.top >= 60 && r.bottom <= innerHeight; });
      assert.ok(onScreen, `the conclusion line is on screen after the first cast at ${w}x${h}`);
      await lap.close();
    }
    const envVisible = await page.evaluate(() => {
      const sc = document.querySelector('.fx-table[data-t="env"] .fx-tscroll');
      const a = sc.getBoundingClientRect(), r = sc.querySelector('td[data-c="current_cost"]').getBoundingClientRect();
      return { overflow: sc.scrollWidth > sc.clientWidth, frac: (Math.min(r.right, a.right) - Math.max(r.left, a.left)) / r.width, pageX: scrollX };
    });
    assert.ok(envVisible.frac >= 0.999, `the used cell is shown inside its box (${envVisible.frac.toFixed(3)}, box overflows: ${envVisible.overflow})`);
    assert.equal(envVisible.pageX, 0, 'the page itself does not move sideways');
    // 범례(다섯 색의 뜻)는 '구조 ① 플로우 차트' 이름 바로 아래 — 판 맨 아래에 있을 때는 1366×768에서 화면 밖이었다(10/11 사용자 결정 재9)
    const legendAt = await page.evaluate(() => {
      const name = document.querySelector('#view .fx-sec-chart').getBoundingClientRect();
      const keys = document.querySelector('#view .fx-legend');
      const r = keys.getBoundingClientRect();
      return { inChart: !!keys.closest('.fx-chartcol'), gap: Math.round(r.top - name.bottom), five: keys.querySelectorAll('.fx-key').length };
    });
    assert.ok(legendAt.inChart && legendAt.gap >= 0 && legendAt.gap < 24 && legendAt.five === 5, `the legend sits right under the flow chart name ${JSON.stringify(legendAt)}`);
    // 지나온 노드의 체크는 선으로 그린다(10/11 가2 — ✓는 Pretendard에 없는 글자)
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#view .fx-node.past'), '::after').content), '""', 'past-node check is drawn, not a glyph');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

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
        window.testFlowDone = 0; // 결론 칸을 연 횟수 — 첫 흐름이 끝날 때 한 번
        window.testFlow = playFlow(host, cfg, () => { window.testFlowDone += 1; });
      }, overrides);
    }
    const test = page.locator('#regression-host');
    await mountFlow();
    assert.equal(await page.evaluate(() => window.testFlowDone), 0, 'nothing opens the conclusion at mount');
    await page.evaluate(() => {
      const b = document.querySelector('#regression-host .fx-card');
      b.click(); b.click(); // Interrupt before the spend presentation step; the cast must still be committed exactly once.
    });
    assert.equal(await test.locator('.fx').first().getAttribute('data-used'), '1', 'one press spends once'); // 진행 수는 화면에서 뺐다(10/07) — 숨은 값으로 본다
    assert.match(await test.locator('.fx-cost').innerText(), /7\.00/);
    assert.equal(await test.locator('.fx-deck-item').last().getAttribute('data-sid'), 'himari');
    assert.equal(await test.locator('.fx-card').first().getAttribute('data-sid'), 'tomoe');
    assert.equal(await test.locator('.fx-closed').count(), 0, 'The first cast opens the board');
    // 결론 칸은 첫 흐름이 끝날 때 한 번만 연다(10/10 마4). 처음 화면으로 되돌리던 '다시 해보기'는 뺐다(바3)
    assert.equal(await page.evaluate(() => window.testFlowDone), 1, 'the first finished flow opens the conclusion once');
    assert.equal(await page.evaluate(() => typeof window.testFlow.restart), 'undefined', 'no restart path is left');
    await mountFlow({ start_cost: 1 });
    await test.locator('.fx-card').first().evaluate(el => el.click());
    // 판이 펼쳐진 뒤에 흐름이 걷는다 — 고정 시간 대신 흐름이 끝날 때까지 기다린다
    await page.waitForFunction(() => !document.querySelector('#regression-host .fx-tracing'));
    assert.equal(await test.locator('.fx').first().getAttribute('data-used'), '0', 'a denied press spends nothing');
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
    // 첫 결과 뒤 '한 번 더'(10/11 사용자 결정 재9): 예외 경로가 있는 카드(우이 · 호시노)가 아직 덱에 있으면 손패 묶음에, 손패로 올라오면 그 카드에
    // 세 번만 퍼지는 표시 하나. 둘 다 지나가 보면 거둔다. 처음 표시(첫 클릭 전)와는 겹치지 않는다
    await mountFlow({ start_cost: 30, max_cost: 30 });
    const cues = () => test.locator('.cue').evaluateAll((es) => es.map((e) => e.dataset.sid || [...e.classList].filter((c) => /^fx-/.test(c)).join('.')));
    const castAndWait = async (sid) => {
      await test.locator(`.fx-card[data-sid="${sid}"]`).evaluate((el) => el.click());
      await page.waitForFunction(() => !document.querySelector('#regression-host .fx-tracing'));
    };
    assert.deepEqual(await cues(), ['fx-hand'], 'before the first press: the first cue only');
    await castAndWait('himari');
    assert.deepEqual(await cues(), ['fx-hand'], 'after the first result: once more, on the hand (Ui and Hoshino are still in the deck)');
    assert.equal(await test.locator('.fx-hand.cue-step').count(), 1, 'the once-more cue rings three times (cue-step)');
    await castAndWait('tomoe');
    assert.deepEqual(await cues(), ['ui'], 'Ui came up from the deck — the cue moves to Ui');
    await castAndWait('ui');
    assert.deepEqual(await cues(), ['hoshino'], 'then Hoshino');
    await castAndWait('hoshino');
    assert.deepEqual(await cues(), [], 'both exception paths walked — no cue is left');
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
    // 끝 단추는 둘 — 원본 문서(결론 칸)와 '포트폴리오 화면으로 돌아가기'(10/10 사용자 결정 바3). '다시 해보기'는 뺐다
    await page.locator('.brief-recap:not([hidden]) .brief-docs a').first().waitFor();
    assert.deepEqual(await page.locator('.brief-docs a, .brief-docs button, .brief-foot a').allInnerTexts(), [UI.brief.original_doc, UI.brief.back], 'E1 end buttons');
    assert.equal(await page.getByRole('button', { name: UI.brief.restart, exact: true }).count(), 0, 'no restart button');
    // 머리말의 안내 알약은 뺐다(마3) · 맞힌 직후의 결론 한 줄은 공통 부품(이름표 + 17px 굵게, 마6)
    assert.equal(await page.locator('.brief-prompt').count(), 0, 'E1 header pill removed');
    assert.equal(await page.locator('.cc-match-done .brief-concl-key').innerText(), UI.brief.conclusion);
    assert.equal(await page.locator('.cc-match-1').evaluate((n) => getComputedStyle(n).fontSize), '16.96px', 'the conclusion line is --text-lg');

    // 노트북 높이(1366×768) — 셋째를 맞힌 직후 결론 한 줄과 다음 단추가 화면 안(10/11 사용자 결정 재5 — 방문자가 누른 뒤에만 필요한 만큼 내린다).
    // 전에는 둘 다 화면 아래(y 826~899 · 955~1007)여서 '지금 누를 것'이 옮겨 가도 보이지 않았다. 누르기는 화면을 굴리지 않는 click()으로
    const laptop = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
    laptop.on('pageerror', e => errors.push(e.message));
    await laptop.goto(origin + '/evidence/E1/interactive');
    await laptop.locator('.cc').waitFor();
    await laptop.waitForTimeout(300);
    assert.equal(await laptop.evaluate(() => scrollY), 0, 'nothing moves before the visitor presses');
    for (const id of await laptop.locator('.cc-cards .cc-plate').evaluateAll(es => es.map(e => e.dataset.id))) {
      await laptop.evaluate((x) => { document.querySelector(`.cc-cards [data-id="${x}"]`).click(); document.querySelector(`.cc-slot[data-id="${x}"]`).click(); }, id);
    }
    const quizDone = await laptop.evaluate(() => {
      const head = document.getElementById('site-header').getBoundingClientRect().bottom;
      const on = (q) => { const r = document.querySelector(q).getBoundingClientRect(); return r.top >= head && r.bottom <= innerHeight; };
      return { concl: on('.cc-match-done .brief-concl'), next: on('.cc-match-done .cc-next'), cue: document.querySelector('.cc-match-done .cc-next').classList.contains('cue') };
    });
    assert.deepEqual(quizDone, { concl: true, next: true, cue: true }, 'after the third match at 1366x768 the conclusion line and the cued next button are on screen');
    // 건너뛰기는 E3와 같은 모양 — 사이트 보조 단추(10/11 재9). 전에는 다음 장 단추와 같은 검은 테두리 단추였다
    await laptop.goto(origin + '/evidence/E1/interactive');
    await laptop.locator('.cc').waitFor();
    assert.equal(await laptop.locator('.cc-skip').evaluate((b) => b.classList.contains('btn') && b.classList.contains('ghost') && !b.classList.contains('cc-next')), true, 'the skip is the site ghost button');
    await laptop.close();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + '/evidence/E1/interactive');
    await page.locator('.cc').waitFor();
    await page.locator('.cc-skip').click();
    assert.equal(await page.locator('.cc-ch[data-n="2"]:not([hidden])').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    // 휴대폰에서는 위에 붙는 시트가 얼굴과 한 줄만 — 회차 칸을 접는다. 320~360px에서도 한 줄이 낱말 중간에서 끊기지 않는다(마7)
    assert.equal(await page.locator('.cc-rl-slots').first().isVisible(), false, 'phone sheets fold the episode slots');
    const midWordBreaks = () => page.evaluate(() => [...document.querySelectorAll('.cc-rl-plate')].flatMap((n) => {
      const t = n.firstChild; const r = document.createRange(); const tops = [];
      for (let i = 0; i < t.length; i++) { r.setStart(t, i); r.setEnd(t, i + 1); const rc = r.getClientRects()[0]; tops.push(rc ? Math.round(rc.top) : null); }
      // 띄어쓰기가 아닌 자리에서 줄이 바뀌면 낱말이 끊긴 것이다
      return [...t.data].flatMap((ch, i) => (i && ch !== ' ' && t.data[i - 1] !== ' ' && tops[i] !== null && tops[i - 1] !== null && Math.abs(tops[i] - tops[i - 1]) > 3 ? [t.data] : []));
    }));
    for (const width of [390, 360, 320]) {
      await page.setViewportSize({ width, height: 700 });
      assert.deepEqual(await midWordBreaks(), [], `sheet lines keep their words at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.startViewTransition = undefined; });
    await page.locator('.brief-foot a').click(); await page.locator('.ev-grid').waitFor();
    await page.locator('.ev-card[data-eid="E2"]').click();
    await page.getByRole('button', { name: UNLOCK, exact: true }).click(); await page.locator('.fx').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('.fx-concept b').allTextContents().then(x => x.join(' ')), 'READ WRITE');
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: navigation, interruption, cost/queue/reduction/boost, hidden-tab recovery, E2 conclusion after the first cast (under the deck, used cell shown in its box), drag/keyboard, rewind/facets, end buttons without restart, phone sheets, reduced motion, fallback.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
