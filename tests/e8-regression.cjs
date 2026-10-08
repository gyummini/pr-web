// E8 · retro — 결정 장부(10/07): 첫 화면은 여덟 장의 지도(가운데 게임 팩과 기준, 양쪽 네 장씩 선이 모여 팩을 가리킨다)와
// 따라오는 표지 패널, 장마다 왼쪽에 결정 → 제가 한 일 → 본문, 오른쪽에 증거 패널(작은 그림 탭 · 참고 | 결과 · AI가 한 일).
// 움짤은 소리 없는 반복 영상 — 보일 때만 돌고, 참고 영상과 '움직임 줄이기'는 멈춘 채 시작한다.
// 직접 플레이(/api/play)는 누르지 않는다 — 누르면 개인 키가 발급된다. 주소 · 새 탭만 보고, 요청 자체도 막아 둔다.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
// 문구는 데이터에서 읽는다 — GPT가 문구를 바꿔도 테스트는 그대로 돈다
const EVS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_증거카드.json'), 'utf8')).evidences;
const EV = EVS.find(e => e.id === 'E8');
const B = EV.brief;
const t = B.labels;
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
const core = EV.memo.rows.find(r => r.block?.kind === 'compass').block.core;
const ch = (no) => `.lg-ch[data-chapter="${no}"]`;

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async (opts) => {
    const page = await browser.newPage(opts);
    await page.route('**/_vercel/**', r => r.abort());
    await page.route('**/api/**', r => r.abort()); // 직접 플레이는 어떤 경우에도 부르지 않는다
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/evidence/E8/interactive');
    await page.locator('.lg-map').waitFor();
    return page;
  };
  // 영상 하나의 상태 — 돌고 있는지, 단추 문구
  const state = (video) => video.evaluate(v => ({ paused: v.paused, label: v.parentElement.querySelector('.lg-vctl').innerText.trim() }));
  try {
    // 움직임 줄이기 — 장 이동이 바로 끝나고, 모든 영상이 첫 장면에 멈춰 있다
    const page = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

    // 첫 화면: 여덟 장의 지도(가운데 팩 아래 기준, 장은 번호 · 한 단어 · 장 제목만 — 결정 문장은 그 장 머리에), 오른쪽 표지 패널(직접 플레이까지)
    assert.equal(await page.locator('.lg-map-core').innerText(), core);
    assert.deepEqual(await page.locator('.lg-node-title').allInnerTexts(), B.chapters.map(c => c.title));
    assert.deepEqual(await page.locator('.lg-node .lg-word').allInnerTexts(), B.chapters.map(c => c.word));
    assert.equal(await page.locator('.lg-map').getAttribute('aria-label'), t.map);
    assert.equal(await page.locator('.lg-cover-panel .lg-stat').count(), 0, 'numbers moved below the map');
    // 팩은 실제 게임의 팩 — 팩 개봉 첫 장면을 잘라 보인다(새 그림 없음). 양쪽 장의 가지가 모인 줄은 팩 가운데 높이로 들어간다
    const geo = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const pack = r('.lg-map-pack');
      const sides = [...document.querySelectorAll('.lg-map-side')].map((n) => n.getBoundingClientRect());
      const nodes = [...document.querySelectorAll('.lg-node')].map((n) => n.getBoundingClientRect());
      return {
        img: getComputedStyle(document.querySelector('.lg-map-pack')).backgroundImage,
        packMid: pack.top + pack.height / 2, sideMid: sides.map((s) => s.top + s.height / 2),
        leftOfPack: nodes.slice(0, 4).every((n) => n.right <= pack.left), rightOfPack: nodes.slice(4).every((n) => n.left >= pack.right),
        coreBelow: r('.lg-map-core').top >= pack.bottom,
      };
    });
    assert.match(geo.img, /clip_pack_open_poster\.webp/);
    assert.ok(geo.sideMid.every((m) => Math.abs(m - geo.packMid) < 2), `the joins meet the pack in the middle ${JSON.stringify(geo)}`);
    assert.equal(geo.leftOfPack && geo.rightOfPack && geo.coreBelow, true, 'four chapters on each side, the core under the pack');
    assert.equal(await page.locator('.lg-facts .lg-stat').count(), B.cover.stats.length);
    const cta = await page.locator('.lg-cta a').boundingBox();
    assert.ok(cta.y + cta.height <= 900, 'the cover play button is on the first screen');
    const plays = page.locator('a[href="/api/play"]');
    assert.equal(await plays.count(), 2, 'play in the cover panel and at the end');
    for (const a of await plays.all()) {
      assert.equal(await a.getAttribute('target'), '_blank');
      assert.equal(await a.getAttribute('rel'), 'noopener');
      assert.equal(await a.innerText(), B.play.label);
    }
    // 장의 글 첫 글자가 머리말 제목과 같은 세로선에 선다. 넓은 화면의 붉은 세로줄(직접 플레이 버튼 · 옆 목차 · 결정 문장에 잇던 선)은 10/07 사용자 의견으로 뺐다
    const line = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const red = (s, pseudo) => { const n = document.querySelector(s); return n ? getComputedStyle(n, pseudo).content : 'none'; };
      return { title: r('.brief-head .ev-title').left, decision: r('.lg-decision').left, spine: !!document.querySelector('.lg-spine'),
        ticks: [red('.lg-decision', '::before'), red('.lg-end-play', '::before'), red('.lg-rail-item', '::after')].every((c) => c === 'none' || c === 'normal') };
    });
    assert.equal(line.title, line.decision);
    assert.deepEqual({ spine: line.spine, ticks: line.ticks }, { spine: false, ticks: true }, 'no red spine or connectors on wide screens');
    // E8 머리말에는 리드 문장을 두지 않는다(10/07 사용자 지시)
    assert.equal(await page.locator('.brief-lead-line').count(), 0);

    // 지도의 장 → 그 장으로, 초점은 장 제목
    await page.locator('.lg-node').nth(2).click();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), B.chapters[2].title);
    const top = await page.locator(`${ch(B.chapters[2].no)} .lg-ch-title`).boundingBox();
    assert.ok(top.y > 60 && top.y < 160, `chapter title lands under the header (${top.y})`);
    // 표지 패널은 머리말 칸 안에서만 따라온다 — 장으로 내려오면 화면을 떠난다(10/07: 끝까지 따라와 장 패널을 덮었다)
    const coverBox = await page.locator('.lg-cover-panel').boundingBox();
    assert.ok(coverBox.y + coverBox.height < 60, `the cover panel stays with the cover (${coverBox.y})`);

    // 옆 목차: 지금 읽는 장 표시 · 누르면 이동
    await page.waitForFunction((no) => document.querySelector('.lg-rail-item[aria-current]')?.textContent.startsWith(no), B.chapters[2].no);
    await page.locator('.lg-rail-item', { hasText: B.chapters[4].word }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), B.chapters[4].title);
    await page.waitForFunction((no) => document.querySelector('.lg-rail-item[aria-current]')?.textContent.startsWith(no), B.chapters[4].no);
    await page.locator('.lg-rail-item', { hasText: t.map }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('lg-map')), true, 'back to the map');

    // 증거 패널: 결정 · 제가 한 일은 왼쪽 머리, AI가 한 일은 패널 바닥
    const c2 = ch(B.chapters[1].no);
    const roles = B.chapters[1].blocks.find(b => b.roles).roles;
    assert.equal(await page.locator(`${c2} .lg-ch-head .lg-mine p`).innerText(), roles.mine);
    assert.equal(await page.locator(`${c2} .lg-ev .lg-ai p`).innerText(), roles.ai);
    // 작은 그림 탭 — 하나만 보이고, 화살표 · Home으로 옮긴다
    const tabs = page.locator(`${c2} [role="tab"]`);
    assert.equal(await tabs.count(), 3);
    assert.equal(await page.locator(`${c2} [role="tabpanel"]:not([hidden])`).count(), 1);
    await tabs.nth(1).click();
    assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator(`${c2} [role="tabpanel"]`).nth(1).isVisible(), true);
    assert.equal(await page.locator(`${c2} [role="tabpanel"]`).nth(0).isHidden(), true);
    await page.keyboard.press('ArrowRight');
    assert.equal(await tabs.nth(2).evaluate(n => n === document.activeElement && n.getAttribute('aria-selected') === 'true'), true);
    await page.keyboard.press('Home');
    assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');
    // 참고 | 결과는 같은 크기 칸
    const pair = await page.locator(`${c2} .lg-pair:not([hidden]) .lg-pocket`).evaluateAll(ns => ns.map(n => [Math.round(n.getBoundingClientRect().width), Math.round(n.getBoundingClientRect().height)]));
    assert.deepEqual(pair[0], pair[1], 'reference and result pockets are the same size');

    // 움직임 줄이기: 모든 영상이 멈춘 채 '재생', 누르면 그 영상만 돈다
    const res = page.locator(`${c2} [role="tabpanel"]`).nth(0).locator('.lg-side.result');
    const resVideo = res.locator('video');
    await res.scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.lg video').count(), 5, 'five clips are videos');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.lg video')].every(v => v.paused)), true);
    assert.deepEqual(await state(resVideo), { paused: true, label: t.video_play });
    await res.locator('.lg-vctl').click();
    await page.waitForFunction((v) => !v.paused, await resVideo.elementHandle());
    assert.equal((await state(resVideo)).label, t.video_pause);
    await res.locator('.lg-vctl').click();
    assert.deepEqual(await state(resVideo), { paused: true, label: t.video_play });
    assert.equal(await page.evaluate(() => [...document.images].filter(i => /\.gif$/.test(i.src)).length), 0, 'no gif is fetched where video plays');

    // 끝: 비공식 안내는 펼쳐 두고, 저작권 전문은 접어 둔다 — 옆 목차로 가면 펼쳐진다
    assert.equal(await page.locator('.lg-notice strong').innerText(), B.credits.notice.title);
    const credits = page.locator('.lg-credits');
    assert.equal(await credits.evaluate(d => d.open), false);
    assert.equal(await page.locator('.lg-credits-more').innerText(), t.more);
    assert.equal(await page.locator('.lg-credits-less').isHidden(), true);
    await page.locator('.lg-credits > summary').click();
    assert.equal(await credits.evaluate(d => d.open), true);
    assert.equal(await page.locator('.lg-credits-less').innerText(), t.less);
    assert.equal(await page.locator('.lg-credits-body h4').count(), B.credits.groups.length);
    await page.locator('.lg-credits > summary').click();
    await page.locator('.lg-rail-item', { hasText: B.credits.title }).click();
    assert.equal(await credits.evaluate(d => d.open && document.activeElement === d.querySelector('summary')), true);
    assert.equal(await page.locator('.brief-foot a[href="/evidence"]').count(), 1);

    // 본문 블록: 표 · 출처 링크(새 탭)
    const c8 = ch(B.chapters[7].no);
    assert.equal(await page.locator(`${c8} .rt-table`).count(), B.chapters[7].blocks.filter(b => b.table).length);
    for (const a of await page.locator(`${c8} .rt-sources a`).all()) assert.equal(await a.getAttribute('target'), '_blank');

    // 폭: 넘치지 않고, 좁은 화면은 한 단(세로줄 · 옆 목차 없음, 장부 머리는 글과 같은 왼쪽)
    for (const width of [320, 390, 768, 1180, 1181, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflows at ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.lg-rail')).display === 'none');
    assert.equal(await page.locator('.lg-rail').isHidden(), true);
    // 휴대폰: 팩 → 기준 → 두 갈래로 갈라져 장 네 개씩(왼쪽 01~04, 오른쪽 05~08). 두 갈래의 첫 장은 같은 높이에서 시작한다 —
    // 장 제목 길이가 달라도(10/07: 짧은 쪽 칸이 늘어나 오른쪽 첫 장이 4~8px 내려가던 것을 CSS로 고침. 문구로 맞추지 않는다)
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const narrow = await page.evaluate(() => {
        const r = (n) => n.getBoundingClientRect();
        const pack = r(document.querySelector('.lg-map-pack'));
        const core = r(document.querySelector('.lg-map-core'));
        const nodes = [...document.querySelectorAll('.lg-node')].map(r);
        return { stacked: pack.bottom <= core.top && core.bottom <= Math.min(...nodes.map((n) => n.top)),
          columns: nodes[0].left < nodes[4].left && Math.abs(nodes[0].top - nodes[4].top) < 0.5,
          joins: [...document.querySelectorAll('.lg-map-join')].every((j) => getComputedStyle(j).display === 'none') };
      });
      assert.deepEqual(narrow, { stacked: true, columns: true, joins: true }, `the map stacks on phones (${width}px)`);
    }

    // 보관함 · 진술 팝업의 이름표 — 해 보는 페이지(E1 · E2 · E3 · E5)와 읽는 회고(E8)를 가른다(10/07 사용자 확정 문구).
    // E8 카드의 '직접 플레이' 칩은 키를 발급하지 않고 E8 페이지의 직접 플레이 버튼으로 데려가 초점과 표시를 둔다(버튼은 누르지 않는다)
    const UI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '콘텐츠_화면문구.json'), 'utf8'));
    const shelf = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await shelf.route('**/_vercel/**', r => r.abort());
    await shelf.route('**/api/**', r => r.abort());
    shelf.on('pageerror', e => errors.push(e.message));
    await shelf.goto(origin + '/evidence');
    await shelf.locator('.ev-grid').waitFor();
    // 아직 모으지 않은 카드는 블러 그대로 '요약 확인' — 누르면 수집하지 않고 요약 팝업이 뜬다(10/07 사용자 결정)
    for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E8', 'E9']) assert.equal(await shelf.locator(`.ev-card[data-eid="${id}"] .ev-open`).innerText(), UI.evidence.open_summary, id);
    assert.equal(await shelf.locator('.play-chip').count(), 1, 'only E8 plays inside its page');
    const unlock = (action) => UI.popup.unlock.replace('{action}', action);
    const badge = () => shelf.locator('#badge').innerText();
    const before = await badge();
    for (const [id, action] of [['E5', UI.common.to_interactive], ['E8', UI.evidence.open_retro], ['E4', UI.common.open_doc]]) {
      await shelf.locator(`.ev-card[data-eid="${id}"]`).click();
      assert.deepEqual(await shelf.locator('.popup-actions .btn').allInnerTexts(), [UI.popup.to_statement, unlock(action)], `${id} shelf popup buttons`);
      assert.equal(await shelf.locator('.popup .ev-memo .memo').count(), 1, `${id} shows the summary memo`);
      if (id === 'E8') {
        // 요약 메모의 나침반 = E8 페이지 지도와 같은 그림: 가운데 팩(자른 그림), 양쪽 둘씩 모여 팩을 가리킨다, 기준은 팩 아래
        const cmp = await shelf.locator('.memo-cmp').evaluate((box) => {
          const r = (n) => n.getBoundingClientRect();
          const pack = r(box.querySelector('.memo-cmp-pack'));
          const core = r(box.querySelector('.memo-cmp-core'));
          const sides = [...box.querySelectorAll('.memo-cmp-side')].map((s) => s.querySelectorAll('.memo-cmp-row').length);
          const joins = [...box.querySelectorAll('.memo-cmp-join')].filter((j) => j.getClientRects().length).length;
          return { packed: /url\(/.test(box.querySelector('.memo-cmp-pack').style.backgroundImage), sides, joins, coreBelow: core.top >= pack.bottom, inside: box.scrollWidth <= box.clientWidth };
        });
        assert.deepEqual(cmp, { packed: true, sides: [2, 2], joins: 2, coreBelow: true, inside: true }, 'memo compass draws the map');
      }
      await shelf.keyboard.press('Escape');
      await shelf.locator('.modal-overlay').waitFor({ state: 'detached' });
    }
    assert.equal(await badge(), before, 'looking at a summary does not collect');
    assert.equal(await shelf.locator('.ev-card.unknown').count(), EVS.filter((e) => !e.hidden).length);
    // '남은 증거 찾기' — 첫 미수집 증거(E1)의 요약 팝업, 증거 상세 화면으로 넘어가지 않는다
    await shelf.locator('.hidden-find').click();
    await shelf.locator('.popup').waitFor();
    assert.equal(new URL(shelf.url()).pathname, '/evidence');
    assert.equal(await shelf.locator('.popup .ev-title').innerText(), EVS.find((e) => e.id === 'E1').title);
    // 자기소개서에서 확인하기 — 그 증거가 처음 나오는 장의 그 문장으로 내려가 표시 · 초점, 수집은 문장을 눌러서
    await shelf.getByRole('button', { name: UI.popup.to_statement, exact: true }).click();
    await shelf.waitForURL('**/case/01');
    await shelf.waitForFunction(() => document.activeElement?.matches('.anchor.found[data-eid="E1"]'));
    assert.equal(await shelf.locator('.anchor.found').count(), 1);
    assert.equal(await shelf.locator('.anchor.found').evaluate((a) => { const r = a.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }), true, 'the sentence is on screen');
    assert.equal(await badge(), before, 'landing does not collect');
    // 장을 떠나면 그 장의 증거는 자동 수집된다(원래 규칙) — 보관함으로 돌아오면 E1이 수집돼 있다
    await shelf.locator('#tabs a[data-tab="evidence"]').click();
    await shelf.locator('.ev-card.collected[data-eid="E1"]').waitFor();
    // 잠금해제하고 ○○ — 수집하고 바로 연다: 원본 문서(E4)는 새 탭 + 카드가 수집으로 뒤집힌다, 인터랙티브(E2)는 그 페이지로
    await shelf.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
    await shelf.locator('.ev-card[data-eid="E4"]').click();
    await shelf.getByRole('button', { name: unlock(UI.common.open_doc), exact: true }).click();
    await shelf.locator('.ev-card.collected[data-eid="E4"]').waitFor();
    assert.deepEqual(await shelf.evaluate(() => window.__opened), [EVS.find((e) => e.id === 'E4').url]);
    assert.equal(await shelf.locator('.ev-card[data-eid="E4"] .ev-open').innerText(), UI.common.open_doc);
    assert.equal(await shelf.locator('.hidden-progress').innerText(), UI.evidence.hidden_progress.replace('{n}', '2').replace('{total}', '7'));
    // E9(추가 포트폴리오, 10/08) — 자기소개서에 나오지 않는다: 진술로 가는 버튼이 없고, 머리글은 장 대신 꼬리표,
    // 잠금해제하면 카드는 수집으로 뒤집히지만 수집 개수(배지 · 수첩 진행)에는 들지 않는다
    const E9 = EVS.find((e) => e.id === 'E9');
    const badgeBeforeE9 = await badge();
    await shelf.locator('.ev-card[data-eid="E9"]').click();
    assert.deepEqual(await shelf.locator('.popup-actions .btn').allInnerTexts(), [unlock(UI.common.open_doc)], 'E9 shelf popup has no statement link');
    assert.equal(await shelf.locator('.popup .ev-kicker').innerText(), UI.brief.kicker.replace('{id}', 'E9').replace('{type}', E9.doc_type));
    assert.equal(await shelf.locator('.popup .ev-memo .memo-spl').count(), 1, 'E9 memo draws its split block');
    await shelf.getByRole('button', { name: unlock(UI.common.open_doc), exact: true }).click();
    await shelf.locator('.ev-card.collected[data-eid="E9"]').waitFor();
    assert.equal(await shelf.locator('.ev-card[data-eid="E9"] .ev-code').innerText(), 'E9', 'no chapter on the card code');
    assert.equal(await badge(), badgeBeforeE9, 'E9 is not counted');
    assert.equal(await shelf.locator('.hidden-progress').innerText(), UI.evidence.hidden_progress.replace('{n}', '2').replace('{total}', '7'));
    if (E9.url) assert.equal((await shelf.evaluate(() => window.__opened)).at(-1), E9.url);
    await shelf.locator('.ev-card[data-eid="E2"]').click();
    await shelf.getByRole('button', { name: unlock(UI.common.to_interactive), exact: true }).click();
    await shelf.waitForURL('**/evidence/E2/interactive');
    await shelf.locator('#tabs a[data-tab="evidence"]').click();
    await shelf.locator('.ev-card.collected[data-eid="E2"]').waitFor();
    assert.equal(await shelf.locator('.ev-card[data-eid="E2"] .ev-open').innerText(), UI.evidence.open_interactive);
    // '원본 ↗'은 수집하지 않은 카드에도 — 원본이 있는 증거 전부(E8은 페이지가 곧 원문이라 없다)(10/07 사용자 요청)
    const unknownIds = await shelf.locator('.ev-card.unknown').evaluateAll((els) => els.map((e) => e.dataset.eid));
    assert.equal(await shelf.locator('.ev-card.unknown .ev-direct').count(), unknownIds.filter((id) => EVS.find((e) => e.id === id).url).length, 'every uncollected card with an original has the shortcut');
    assert.equal(await shelf.locator('.ev-card[data-eid="E8"] .ev-direct').count(), 0);
    assert.equal(await shelf.locator('.ev-card[data-eid="E8"] .play-chip').innerText(), UI.evidence.play);
    await shelf.locator('.ev-card[data-eid="E8"] .play-chip').click();
    await shelf.waitForURL('**/evidence/E8/interactive');
    await shelf.waitForFunction(() => document.activeElement?.matches('.lg-cta a'));
    assert.equal(await shelf.locator('.lg-cta a').evaluate(a => a.classList.contains('cue') && a.getAttribute('href') === '/api/play'), true, 'lands on the play button, marked, not pressed');
    await shelf.goto(origin + '/case/02');
    // 자기소개서 팝업은 진술을 끊지 않는다(10/09 사용자 결정) — 인터랙티브 · 회고로 가는 단추 없이 '증거 수집'(다시 열면 '닫기') 하나
    for (const id of ['E8', 'E5']) {
      for (const want of [UI.popup.collect, UI.popup.close]) {
        await shelf.locator(`.anchor[data-eid="${id}"]`).first().click();
        assert.deepEqual(await shelf.locator('.popup-actions .btn').allInnerTexts(), [want], `${id} essay popup: one button only`);
        await shelf.keyboard.press('Escape');
        await shelf.locator('.modal-overlay').waitFor({ state: 'detached' });
      }
    }
    // 수집한 카드에는 '원본 ↗'이 붙는다 — 긴 행동 문구에 밀려 카드 밖으로 잘리지 않는다(10/07 사용자 발견). 보관함은 탭으로 옮겨 수집 상태를 지킨다
    await shelf.locator('#tabs a[data-tab="evidence"]').click();
    await shelf.locator('.ev-card.collected[data-eid="E5"] .ev-direct').waitFor();
    assert.equal(await shelf.locator('.ev-card[data-eid="E5"] .ev-open').innerText(), UI.evidence.open_interactive);
    assert.equal(await shelf.locator('.ev-card[data-eid="E8"] .ev-open').innerText(), UI.evidence.open_retro);
    for (const width of [1440, 1100, 760, 390, 320]) {
      await shelf.setViewportSize({ width, height: 900 });
      const inside = await shelf.locator('.ev-card[data-eid="E5"]').evaluate((c) => {
        const cr = c.getBoundingClientRect();
        return [...c.querySelectorAll('.ev-foot *')].every((n) => { const r = n.getBoundingClientRect(); return r.left >= cr.left && r.right <= cr.right; });
      });
      assert.equal(inside, true, `the card foot stays inside the card at ${width}px`);
    }
    // 증거 상세(수첩의 증거 링크 · 주소로 직접 열기) — 브리프가 있는 증거는 인터랙티브 페이지로 가는 버튼이 나온다.
    // 10/07 최종 점검에서 E8과 '수집한' 브리프 증거의 상세가 오류 화면이었다(briefOpenKey를 불러오지 않았다). 여기서는 E5 · E8이 이미 수집돼 있다
    for (const [id, label] of [['E8', UI.evidence.open_retro], ['E5', UI.common.to_interactive]]) {
      await shelf.evaluate(async (to) => { const { navigate } = await import('/assets/js/router.js'); navigate(to); }, `/evidence/${id}`);
      await shelf.locator('.detail').waitFor();
      assert.equal(await shelf.locator(`.detail-actions a[href="/evidence/${id}/interactive"]`).innerText(), label, `${id} detail opens its page`);
    }
    await shelf.close();

    // 움직임 그대로 — 보일 때만 결과 영상이 돈다. 참고 영상은 멈춰 있고, 탭을 바꾸거나 화면을 떠나면 멈춘다
    const live = await open({ viewport: { width: 1440, height: 900 } });
    const lc2 = ch(B.chapters[1].no);
    const panels = live.locator(`${lc2} [role="tabpanel"]`);
    const pack = await panels.nth(0).locator('.lg-side.result video').elementHandle();
    const pocket = panels.nth(0).locator('.lg-side.ref video');
    const holo = await panels.nth(1).locator('.lg-side.result video').elementHandle();
    assert.equal(await live.locator('.lg video').evaluateAll(vs => vs.every(v => v.paused)), true, 'nothing plays off screen');
    await live.evaluate((s) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, lc2);
    await live.waitForFunction((v) => !v.paused, pack);
    assert.deepEqual(await state(pocket), { paused: true, label: t.video_play }, 'the reference clip waits');
    await live.locator(`${lc2} [role="tab"]`).nth(1).click();
    await live.waitForFunction((v) => v.paused, pack);
    await live.waitForFunction((v) => !v.paused, holo);
    await live.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await live.waitForFunction(() => [...document.querySelectorAll('.lg video')].every(v => v.paused), null, { timeout: 3000 });

    assert.deepEqual(errors, []);
    console.log('PASS E8 retro: map (pack, core, four a side, joins at the pack), cover panel stays with the cover, play links never clicked, no red spine or connectors, no lead line, map and rail jumps with focus, mine/AI split, tabs and keys, same-size pair, videos (reduced motion, toggle, play only in view, tab switch), notice open and credits folded, tables and sources, 320–1920px, shelf and popup labels (try vs read), shelf summary popup (no collect, memo compass = map, find in statement, unlock to page or document, remaining-evidence button), play chip lands on the play button.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
