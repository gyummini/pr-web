import { animate, reducedMotion } from '../motion/animate.js';
import { fill } from '../text.js';

// E3 — 직접 해 보는 판단. CUT UNTIL IT'S FUN.
//
// ① 처음 만든 게임(MineSmith — 곡괭이 강화 + 채굴 + 경제)을 직접 해 본다. 곡괭이를 휘둘러 바위를 깨야 철광석이 하나 나오고,
//    깬 바위는 잠시 뒤에 다시 나온다. 강화에는 광석이 재료로 들고(2→3강부터 석탄도), 석탄은 시장에서 시세를 보고 판 돈으로 산다.
//    강화할 때마다 그 강화까지 몇 번을 눌렀는지 보여 준다.
// ② 판단 — 지인의 첫 반응과 플랫폼에서 본 것, '재미는 어디서 오는가'를 보고 방문자가 '채굴과 경제 덜어내기'를 직접 누른다.
//    두 칸에 줄이 그어지며 빈자리로 남고, 같은 판이 출시한 게임이 된다.
// ③ 출시한 게임(Brainrot Collector) — 줄지어 지나가는 브레인롯을 눌러 내 방(8칸)으로 가져오면 골드가 저절로 들어오고,
//    그중 하나를 강화대에 올려 강화한다. 성공하면 다음 브레인롯으로 바뀐다 — 무엇이 나올지가 이 게임의 웃음이다.
//
// 재료·확률·이름·스폰 확률은 게임 설계 문서의 값(brief.demo)이고, 시세·수익 속도·내구도는 체험용 예시다(각주가 그렇게 말한다).
// 결과와 스폰은 정해진 씨앗의 난수로 뽑아 매번 같은 순서로 나온다 — 테스트할 수 있게.
// 지금 누를 것(style.css .cue)은 할 일을 따라 옮겨 간다. 상태가 먼저이고 연출은 그 위에 얹는다 — 강화 결과는 누르는 순간 정하고,
// 잠깐의 긴장(setTimeout) 뒤에 보여 준다. 지나가는 줄의 움직임은 CSS가 그리고, 언제 나오고 사라지는지는 Date.now()로 정한다.
export function playCutPlay(host, cfg, onComplete) {
  const t = cfg.labels;
  const demo = cfg.demo || {};
  const A = demo.first || {};
  const B = demo.final || {};
  const goal = Number(demo.final_goal) || 1;
  const upgrades = A.upgrade || [{ iron: 1, coal: 0, success: 100, drop: 0 }];
  const prices = A.iron_prices || [1];
  const coalPrice = Number(A.coal_price) || 1;
  const durability = Number(A.durability) || 1;
  const rots = B.brainrots || [];
  const slots = Number(B.slots) || 8;
  const spawnMs = Number(B.spawn_ms) || 1600;
  const lifeMs = Number(B.life_ms) || 7000;
  const laneMax = Number(B.lane_max) || 4;
  // 줄에 나오는 브레인롯과 그 비율 — 게임의 스폰 표에서 그림이 있는 것만 쓴다(데이터의 _spawn_note)
  const spawnTable = B.spawn || [{ lvl: 0, w: 1 }];
  const minLevel = Math.min(...spawnTable.map((s) => s.lvl));
  const maxLevel = Number.isFinite(Number(B.max_level)) ? Number(B.max_level) : rots.length - 1;
  const speed = Number(B.speed) || 1;
  const systemOf = (id) => cfg.systems.find((s) => s.id === id) || {};
  const ask = cfg.chapters[2] || {}; // 재미는 어디서 오는가 — 질문과 관찰
  let state;
  let rollA; // 처음 게임의 강화 결과
  let rollB; // 출시한 게임의 강화 결과
  let rollC; // 줄에 나오는 브레인롯 — 셋이 서로의 순서를 밀지 않게 따로 뽑는다
  let priceTimer = null;
  let clockTimer = null;
  let cutTimer = null;
  let revealTimer = null;
  let respawnTimer = null;
  let cueEl = null;
  let stopCue = null;
  let recapShown = false;
  let dead = false;
  let walkerId = 0;

  const root = el('div', 'cp');
  root.innerHTML = `
    <section class="cp-game">
      <header class="cp-game-head"><h4 class="cp-game-title"></h4><p class="cp-game-line"></p></header>
      <div class="cp-zones">
        <div class="cp-zone" data-system="mining">
          <h5></h5><p class="cp-zone-note"></p>
          <div class="cp-pit" aria-hidden="true"><span class="cp-swing"></span><span class="cp-rock"><i></i><i></i><i></i></span><span class="cp-hp"></span><span class="cp-float"></span></div>
          <p class="cp-stock"><span class="cp-iron"></span><span class="cp-coal"></span></p>
          <button type="button" class="cp-act cp-mine"></button>
          <p class="cp-gone"></p>
        </div>
        <div class="cp-zone" data-system="economy">
          <h5></h5><p class="cp-zone-note"></p>
          <svg class="cp-chart" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><polyline></polyline></svg>
          <p class="cp-stock"><span class="cp-price"></span><span class="cp-gold"></span></p>
          <div class="cp-acts"><button type="button" class="cp-act cp-sell"></button><button type="button" class="cp-act cp-buy"></button></div>
          <p class="cp-gone"></p>
        </div>
        <div class="cp-zone cp-core" data-system="enhance">
          <h5></h5><p class="cp-zone-note"></p>
          <div class="cp-first">
            <div class="cp-target"><div class="cp-art" aria-hidden="true"></div><strong class="cp-level"></strong></div>
            <p class="cp-need"></p>
            <p class="cp-rate cp-rate-a"></p>
          </div>
          <div class="cp-final">
            <div class="cp-lanebox"><span class="cp-label cp-lane-label"></span><div class="cp-lane"><div class="cp-track"></div></div></div>
            <div class="cp-roomhead"><span class="cp-label cp-room-label"></span><span class="cp-income"></span><span class="cp-fgold"></span></div>
            <div class="cp-room"></div>
            <div class="cp-stand">
              <span class="cp-label cp-stand-label"></span>
              <div class="cp-rot">
                <span class="cp-rot-face" aria-hidden="true"></span>
                <span class="cp-rot-text"><strong class="cp-rot-name"></strong><span class="cp-rot-level"></span></span>
                <span class="cp-next"><span class="cp-next-icon" aria-hidden="true">?</span><span class="cp-next-label"></span></span>
              </div>
              <p class="cp-rate cp-rate-b"></p>
              <p class="cp-fcost"></p>
            </div>
          </div>
          <div class="cp-go"><button type="button" class="cp-enhance"></button></div>
          <p class="cp-msg" role="status" aria-live="polite"></p>
          <p class="cp-presses"></p>
        </div>
      </div>
      <button type="button" class="cp-skip"></button>
    </section>
    <section class="cp-judge" hidden>
      <span class="cp-judge-eyebrow"></span>
      <dl class="cp-evidence"></dl>
      <h4 class="cp-question"></h4>
      <p class="cp-observe"></p>
      <button type="button" class="cp-cut"></button>
    </section>
    <p class="cp-caption" role="status" aria-live="polite"></p>
    <figure class="cp-kept" hidden><span class="cp-kept-tag"></span><img alt=""><figcaption></figcaption></figure>
    <p class="cp-note"></p>
    <p class="cp-credit"></p>`;
  host.append(root);

  const $ = (s) => root.querySelector(s);
  const zone = (id) => root.querySelector(`.cp-zone[data-system="${id}"]`);
  // 덜어낸 뒤에도 두 칸은 빈자리로 남는다 — 같은 판에서 무엇을 뺐는지가 보이게
  [['mining', systemOf('mining'), t.mining_cut], ['economy', systemOf('economy'), t.economy_cut]].forEach(([id, s, gone]) => {
    zone(id).querySelector('h5').textContent = s.title || '';
    zone(id).querySelector('.cp-zone-note').textContent = s.note || '';
    zone(id).querySelector('.cp-gone').textContent = gone || '';
  });
  zone('enhance').querySelector('h5').textContent = t.identity || '';
  zone('enhance').querySelector('.cp-zone-note').textContent = t.core_note || '';
  $('.cp-next-label').textContent = t.next_label || '';
  $('.cp-lane-label').textContent = t.lane || '';
  $('.cp-stand-label').textContent = t.stand || '';
  const lane = $('.cp-lane'); // 지금 누를 것 표시가 붙는 바깥 틀
  const track = $('.cp-track'); // 지나가는 브레인롯이 움직이는 안쪽 길(밖으로 나간 것은 잘린다)
  const room = $('.cp-room');
  const mineBtn = $('.cp-mine');
  const sellBtn = $('.cp-sell');
  const buyBtn = $('.cp-buy');
  const enhanceBtn = $('.cp-enhance');
  const cutBtn = $('.cp-cut');
  const skipBtn = $('.cp-skip');

  // 잠깐 누를 수 없는 버튼(바위가 다시 나오는 중 · 충전 중)을 끄면 키보드 초점이 페이지 밖으로 빠진다(10/06 점검: 끝까지 10번).
  // 끄기 전에 버튼이 든 칸으로 초점을 옮겨 두었다가, 다시 켜지면 그 버튼으로 돌려준다.
  // 끄는 것 자체(disabled)는 그대로다 — 회귀 테스트와 다른 화면이 그 속성을 본다
  let parked = null;
  function setOff(btn, off) {
    if (off && !btn.disabled && document.activeElement === btn) {
      const holder = btn.closest('.cp-zone, .cp-judge, .cp-game') || root;
      holder.tabIndex = -1;
      holder.focus({ preventScroll: true });
      parked = { btn, holder };
    }
    btn.disabled = off;
    if (!off && parked && parked.btn === btn) {
      if (document.activeElement === parked.holder) btn.focus({ preventScroll: true });
      parked = null;
    }
  }
  // 초점을 맡아 둔 칸에 있는데 그 버튼이 끝내 돌아오지 않을 때(덜어내기처럼 한 번 내린 결정) — 다음 누를 것으로 넘긴다
  function passFocus(next) {
    if (!parked || document.activeElement !== parked.holder) return;
    if (!next || next.disabled || next === parked.btn) return; // 같은 버튼이면 다시 켜질 때 setOff가 돌려준다
    parked = null;
    next.focus({ preventScroll: true });
  }
  mineBtn.textContent = t.mine;
  sellBtn.textContent = t.sell;
  buyBtn.textContent = fill(t.buy_coal, { n: coalPrice });
  enhanceBtn.textContent = t.enhance;
  cutBtn.textContent = t.cut_both;
  skipBtn.textContent = t.skip_play;
  mineBtn.addEventListener('click', mine);
  sellBtn.addEventListener('click', sell);
  buyBtn.addEventListener('click', buy);
  enhanceBtn.addEventListener('click', enhance);
  cutBtn.addEventListener('click', cut);
  skipBtn.addEventListener('click', () => { if (state.phase === 'first') { state.judge = true; paint(); } });
  // 처음 누를 것: 처음 게임은 강화, 출시한 게임은 지나가는 줄. 안내는 껍데기가 머리말에서 뺐을 때만 붙는다(첫 행동까지만).
  const actionHints = cfg.lead?.prompt_at === 'action';
  const hint = actionHints && t.run_hint ? el('p', 'cue-note points-down', t.run_hint) : null;
  if (hint) $('.cp-go').prepend(hint);
  const takeHint = actionHints && t.take_hint ? el('p', 'cue-note points-down', t.take_hint) : null;
  if (takeHint) $('.cp-lanebox').insertBefore(takeHint, lane);
  drawPickaxe();
  // 방의 칸 — 비어 있거나, 가져온 브레인롯이 앉는다. 누르면 그 브레인롯이 강화대에 오른다.
  for (let i = 0; i < slots; i += 1) {
    const slot = el('button', 'cp-slot');
    slot.type = 'button';
    slot.dataset.i = String(i);
    slot.addEventListener('click', () => pickSlot(i));
    room.append(slot);
  }

  $('.cp-judge-eyebrow').textContent = t.judge || '';
  [[t.feedback_label, t.feedback], [t.research_label, t.research]].forEach(([k, v]) => {
    if (!k && !v) return;
    const row = el('div'); row.append(el('dt', '', k || ''), el('dd', '', v || '')); $('.cp-evidence').append(row);
  });
  $('.cp-question').textContent = ask.title || '';
  $('.cp-observe').textContent = ask.question || '';
  $('.cp-kept-tag').textContent = t.kept || '';
  const shot = $('.cp-kept img');
  shot.src = cfg.image; shot.alt = t.source_alt || ''; shot.loading = 'lazy';
  $('.cp-kept figcaption').textContent = t.source_label || '';
  $('.cp-note').textContent = t.preview || '';
  // 브레인롯 그림의 출처 — CC BY-SA 4.0이라 출처·라이선스를 그림 곁에 밝힌다
  const credit = $('.cp-credit');
  const uploaders = [...new Set(rots.map((r) => r.credit && r.credit.by).filter(Boolean))];
  if (t.art_credit) credit.append(document.createTextNode(`${fill(t.art_credit, { names: uploaders.join(', ') })} `));
  (B.art_sources || []).forEach((s, i) => {
    if (i) credit.append(document.createTextNode(' · '));
    const a = el('a', '', s.label); a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
    credit.append(a);
  });
  credit.hidden = !credit.childNodes.length;

  reset();

  // 시세는 처음 게임에서만 움직인다 — 지금 팔지 기다릴지 판단하게 만드는 것이 경제가 더한 일이었다
  priceTimer = setInterval(() => {
    if (dead || state.phase !== 'first' || document.hidden) return;
    const before = prices[state.pi];
    state.pi = (state.pi + 1) % prices.length;
    state.trend = Math.sign(prices[state.pi] - before);
    state.history = [...state.history.slice(1), prices[state.pi]];
    paint();
  }, Number(A.price_ms) || 1300);
  // 출시한 게임의 시계 — 줄에 브레인롯이 나오고 사라지며, 방의 브레인롯이 골드를 저절로 벌어 온다
  clockTimer = setInterval(() => {
    if (dead || state.phase !== 'final' || document.hidden) return;
    const now = Date.now();
    const before = state.lane.length;
    state.lane = state.lane.filter((w) => now - w.born < lifeMs);
    let spawned = false;
    if (now - state.lastSpawn >= spawnMs && state.lane.length < laneMax) { spawnWalker(now); spawned = true; }
    state.fgold += perSecond() / 4;
    if (spawned || before !== state.lane.length) paintLane();
    paint();
  }, 250);

  function reset() {
    const seed = Number(demo.seed) || 1;
    rollA = rng(seed);
    rollB = rng(seed + 1);
    rollC = rng(seed + 2);
    state = {
      phase: 'first', tried: false, judge: false, done: false, busy: false, presses: 0, pressLine: '', msg: '', tone: '',
      iron: 0, coal: 0, gold: 0, level: 0, hp: durability, broken: false, pi: 0, trend: 0,
      history: Array.from({ length: 12 }, (_, i) => prices[i % prices.length]),
      lane: [], room: Array(slots).fill(null), sel: -1, took: false, fgold: Number(B.start_gold) || 0, lastSpawn: 0, finalCount: 0, motion: '', popSlot: -1,
    };
  }

  // ---------- ① 처음 게임 ----------
  function mine() {
    if (dead || state.phase !== 'first' || state.broken || state.busy) return;
    state.presses += 1;
    state.hp -= 1;
    animate($('.cp-swing'), [{ transform: 'rotate(-55deg)' }, { transform: 'rotate(25deg)' }, { transform: 'none' }], { duration: 220 });
    animate($('.cp-rock'), [{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 160 });
    if (state.hp <= 0) {
      state.broken = true;
      state.iron += 1;
      floatUp('+1');
      // 깬 바위는 잠시 뒤에 다시 나온다 — 기다림도 이 게임의 일부였다(움직임과 상관없는 규칙이라 늘 기다린다)
      respawnTimer = setTimeout(() => { respawnTimer = null; if (dead) return; state.broken = false; state.hp = durability; paint(); }, Number(A.respawn_ms) || 900);
    }
    paint();
  }

  function sell() {
    if (dead || state.phase !== 'first' || !state.iron || state.busy) return;
    state.iron -= 1;
    state.gold += prices[state.pi];
    state.presses += 1;
    paint();
  }

  function buy() {
    if (dead || state.phase !== 'first' || state.gold < coalPrice || state.busy) return;
    state.gold -= coalPrice;
    state.coal += 1;
    state.presses += 1;
    paint();
  }

  const upgradeAt = (level) => upgrades[Math.min(level, upgrades.length - 1)];

  // ---------- ③ 출시한 게임 — 줄 · 방 · 강화대 ----------
  function spawnWalker(now) {
    let r = rollC() * spawnTable.reduce((a, s) => a + s.w, 0);
    let pick = spawnTable[spawnTable.length - 1];
    for (const s of spawnTable) { if (r < s.w) { pick = s; break; } r -= s.w; }
    state.lane.push({ id: ++walkerId, lvl: pick.lvl, born: now });
    state.lastSpawn = now;
  }

  const filled = () => state.room.filter(Boolean).length;

  // 누르기(클릭·키보드) — 첫 빈칸으로 가져온다
  function take(id) {
    if (dead || state.phase !== 'final') return;
    const w = state.lane.find((x) => x.id === id);
    if (!w) return;
    if (state.room.every(Boolean)) { state.msg = t.room_full; state.tone = 'short'; paint(); return; }
    // 가져온 브레인롯의 버튼은 줄에서 사라진다 — 키보드로 가져왔으면 앉은 방 칸으로 초점을 옮긴다(10/06 점검)
    const hadFocus = track.contains(document.activeElement);
    const at = state.room.findIndex((b) => !b);
    state.lane = state.lane.filter((x) => x !== w);
    paintLane();
    place(w, -1);
    if (hadFocus && room.children[at]) room.children[at].focus({ preventScroll: true });
  }

  // 방에 앉힌다 — at이 빈칸이면 그 칸, 아니면 첫 빈칸. 자리가 없으면 줄로 돌려보낸다.
  function place(w, at) {
    const i = at >= 0 && !state.room[at] ? at : state.room.findIndex((b) => !b);
    if (i < 0) { state.msg = t.room_full; state.tone = 'short'; returnToLane(w); return; }
    state.room[i] = { lvl: w.lvl };
    if (state.sel < 0 || !state.room[state.sel]) state.sel = i;
    state.took = true;
    state.popSlot = i;
    paint();
  }

  function returnToLane(w) {
    if (state.phase !== 'final') return;
    state.lane.push(w);
    paintLane();
    paint();
  }

  function pickSlot(i) {
    if (dead || state.phase !== 'final' || state.busy || !state.room[i]) return;
    state.sel = i;
    paint();
  }

  const perSecond = () => state.room.reduce((sum, b) => sum + (b ? (rots[b.lvl] || {}).gpm || 0 : 0), 0) / 60 * speed;

  // ---------- 끌어다 놓기 ----------
  // 지나가는 브레인롯을 집어 방의 칸에 놓는다. 끌지 않고 떼면 누른 것과 같다(그때는 버튼의 click이 가져온다).
  // 집어 든 동안에는 줄에서 빠져 있어 사라지지 않고, 방 밖에 놓으면 줄로 돌아간다. E1의 카드 맞히기와 같은 방식이다.
  let drag = null;
  track.addEventListener('pointerdown', onDown);
  track.addEventListener('dragstart', (e) => e.preventDefault());
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', cancelDrag);
  window.addEventListener('blur', cancelDrag);

  function onDown(e) {
    const node = e.target.closest('.cp-walker');
    if (!node || drag || e.button !== 0 || state.phase !== 'final') return;
    const w = state.lane.find((x) => String(x.id) === node.dataset.id);
    if (!w) return;
    e.preventDefault(); // 글자 선택·기본 끌기를 막는다(누르기의 click은 그대로 온다)
    const r = node.getBoundingClientRect();
    drag = { w, node, pointer: e.pointerId, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, width: r.width, ghost: null };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return; // 아직은 누르기다
      state.lane = state.lane.filter((x) => x !== drag.w);
      const ghost = drag.node.cloneNode(true);
      ghost.removeAttribute('style');
      ghost.classList.add('cp-held');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.tabIndex = -1;
      ghost.style.width = `${drag.width}px`;
      document.body.append(ghost);
      drag.ghost = ghost;
      paintLane();
    }
    e.preventDefault();
    drag.ghost.style.left = `${e.clientX - drag.dx}px`;
    drag.ghost.style.top = `${e.clientY - drag.dy}px`;
    markTarget(e.clientX, e.clientY);
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag;
    drag = null;
    if (!d.ghost) return;
    d.ghost.remove();
    const at = dropAt(e.clientX, e.clientY);
    markTarget(null);
    if (at === null) returnToLane(d.w);
    else place(d.w, at);
  }

  function cancelDrag() {
    if (!drag) return;
    const d = drag;
    drag = null;
    markTarget(null);
    if (d.ghost) { d.ghost.remove(); returnToLane(d.w); }
  }

  // 놓을 자리 — 빈 칸 위면 그 칸, 방 안의 다른 곳이면 첫 빈칸(-1), 방 밖이면 null
  function dropAt(x, y) {
    const els = document.elementsFromPoint(x, y) || [];
    const slot = els.find((n) => n.classList && n.classList.contains('cp-slot'));
    if (slot) { const i = Number(slot.dataset.i); return state.room[i] ? -1 : i; }
    return els.includes(room) ? -1 : null;
  }

  function markTarget(x, y) {
    const at = x === null ? null : dropAt(x, y);
    room.classList.toggle('is-target', at !== null);
    [...room.children].forEach((n, i) => n.classList.toggle('is-target', at === i));
  }

  // ---------- 강화 (두 게임 공통 버튼) ----------
  function enhance() {
    if (dead || state.busy || state.phase === 'cutting') return;
    if (state.phase === 'first') {
      state.presses += 1;
      state.tried = true;
      const up = upgradeAt(state.level);
      if (state.iron < up.iron || state.coal < up.coal) { state.msg = t.short; state.tone = 'short'; paint(); return; }
      state.iron -= up.iron; state.coal -= up.coal;
      const r = rollA() * 100;
      const outcome = r < up.success ? 'up' : r < up.success + up.drop ? 'down' : 'stay';
      charge(650, () => {
        if (outcome === 'up') state.level += 1;
        if (outcome === 'down') state.level = Math.max(0, state.level - 1);
        state.msg = outcome === 'up' ? t.success : outcome === 'down' ? t.drop : t.failure;
        settled(outcome);
        state.judge = true;
      });
      return;
    }
    const slot = state.room[state.sel];
    if (!slot) return;
    const rot = rots[slot.lvl] || {};
    if (state.fgold < rot.cost) return; // 골드가 모이는 중
    state.presses += 1;
    state.fgold -= rot.cost;
    const r = rollB() * 100;
    const outcome = r < rot.success ? 'up' : r < rot.success + rot.keep ? 'stay' : 'down';
    charge(280, () => {
      const from = rots[slot.lvl];
      if (outcome === 'up' && slot.lvl < maxLevel) slot.lvl += 1;
      if (outcome === 'down' && slot.lvl > minLevel) slot.lvl -= 1;
      const to = rots[slot.lvl];
      state.msg = outcome === 'up' ? fill(t.evolve, { from: from.name, to: to.name })
        : outcome === 'down' ? fill(t.devolve, { to: to.name }) : t.stay;
      settled(outcome);
      state.popSlot = state.sel;
      state.finalCount += 1;
      if (state.finalCount >= goal && !state.done) finish();
    });
  }

  function settled(outcome) {
    state.tone = outcome;
    state.motion = outcome;
    state.pressLine = fill(t.presses, { n: state.presses });
    state.presses = 0;
  }

  // 잠깐의 긴장 — 결과는 이미 정해져 있고 보여 주는 것만 미룬다
  function charge(ms, land) {
    state.busy = true;
    state.msg = ''; state.tone = '';
    paint();
    const go = () => { revealTimer = null; if (dead) return; state.busy = false; land(); paint(); };
    if (reducedMotion() || document.hidden) go();
    else revealTimer = setTimeout(go, ms);
  }

  // ---------- ② 판단 ----------
  function cut() {
    if (dead || state.phase !== 'first' || state.busy) return;
    state.phase = 'cutting';
    state.judge = true;
    state.msg = ''; state.tone = ''; state.pressLine = ''; state.presses = 0;
    paint();
    const land = () => {
      cutTimer = null;
      if (dead) return;
      state.phase = 'final';
      // 출시한 게임은 줄이 이미 지나가고 있는 데서 시작한다
      const now = Date.now();
      spawnWalker(now - lifeMs * 0.45);
      spawnWalker(now - lifeMs * 0.15);
      state.lastSpawn = now;
      paintLane();
      paint();
    };
    if (reducedMotion() || document.hidden) land();
    else cutTimer = setTimeout(land, 800);
  }

  function finish() {
    state.done = true;
    if (!recapShown) { recapShown = true; onComplete({ scroll: false }); }
  }

  // ---------- 그리기 ----------
  function paint() {
    const first = state.phase === 'first';
    const final = state.phase === 'final';
    root.dataset.phase = state.phase;
    $('.cp-game-title').textContent = final ? t.final_title : t.first_title;
    $('.cp-game-line').textContent = final ? (t.final_context || '') : (t.first_line || '');

    // 채굴
    $('.cp-iron').textContent = fill(t.iron, { n: state.iron });
    $('.cp-coal').textContent = fill(t.coal, { n: state.coal });
    $('.cp-rock').classList.toggle('is-broken', state.broken);
    // 바위의 남은 내구도 — 칸 하나가 곡괭이 한 번
    const pips = $('.cp-hp');
    while (pips.children.length < durability) pips.append(el('i'));
    [...pips.children].forEach((pip, i) => pip.classList.toggle('is-on', i < state.hp));
    setOff(mineBtn, !first || state.broken || state.busy);
    // 경제
    $('.cp-chart polyline').setAttribute('points', chartPoints(state.history));
    $('.cp-price').textContent = `${fill(t.price, { n: prices[state.pi] })} ${state.trend > 0 ? '▲' : state.trend < 0 ? '▼' : '·'}`;
    $('.cp-price').dataset.trend = String(state.trend);
    $('.cp-gold').textContent = fill(t.gold, { n: state.gold });
    setOff(sellBtn, !first || !state.iron || state.busy);
    setOff(buyBtn, !first || state.gold < coalPrice || state.busy);
    ['mining', 'economy'].forEach((id) => {
      zone(id).classList.toggle('is-cut', state.phase === 'cutting');
      zone(id).classList.toggle('is-gone', final);
    });

    // 강화대 — 처음 게임은 곡괭이, 출시한 게임은 방에서 고른 브레인롯
    $('.cp-first').hidden = final;
    $('.cp-final').hidden = !final;
    const up = upgradeAt(state.level);
    $('.cp-level').textContent = `+${state.level}`;
    const short = state.iron < up.iron || state.coal < up.coal;
    $('.cp-need').textContent = up.coal ? fill(t.need_coal, { iron: up.iron, coal: up.coal }) : fill(t.need, { iron: up.iron });
    $('.cp-need').classList.toggle('is-short', first && short);
    $('.cp-rate-a').textContent = fill(t.rate_first, { s: up.success, d: up.drop });
    if (final) paintFinal();
    zone('enhance').classList.toggle('is-charging', state.busy);
    const slot = state.room[state.sel];
    const cost = slot ? (rots[slot.lvl] || {}).cost : Infinity;
    setOff(enhanceBtn, state.phase === 'cutting' || state.busy || (final && (!slot || state.fgold < cost)));
    // 알림 칸(role=status)은 문장이 바뀔 때만 쓴다 — 같은 문장을 다시 쓰면 화면 낭독기가 되풀이해 읽었다(10/06 점검: 5초에 20번)
    if ($('.cp-msg').textContent !== state.msg) $('.cp-msg').textContent = state.msg;
    $('.cp-msg').dataset.tone = state.tone;
    $('.cp-presses').textContent = state.pressLine;
    if (state.motion) { flourish(state.motion, final); state.motion = ''; }

    skipBtn.hidden = !first || state.judge;
    $('.cp-judge').hidden = !state.judge;
    // 덜어낸 뒤 버튼은 내린 결정으로 남는다(체크, 다시 누를 수 없음)
    setOff(cutBtn, !first || state.busy);
    cutBtn.classList.toggle('is-done', !first);
    if (hint) hint.hidden = !first || state.tried || state.judge;
    if (takeHint) takeHint.hidden = !final || state.took;
    const caption = state.done ? (t.final_statement || '') : '';
    if ($('.cp-caption').textContent !== caption) $('.cp-caption').textContent = caption;
    $('.cp-kept').hidden = !state.done;
    const next = cueTarget();
    cueOn(next);
    if (final) passFocus(next === lane ? track.querySelector('.cp-walker') || enhanceBtn : next || enhanceBtn);
  }

  function paintFinal() {
    $('.cp-room-label').textContent = fill(t.room, { n: filled(), max: slots });
    $('.cp-income').textContent = fill(t.income, { n: Math.round(perSecond()) });
    $('.cp-fgold').textContent = fill(t.gold, { n: Math.floor(state.fgold) });
    [...room.children].forEach((node, i) => {
      const b = state.room[i];
      const lvl = b ? String(b.lvl) : '';
      if (node.dataset.lvl !== lvl) {
        node.dataset.lvl = lvl;
        node.replaceChildren();
        node.classList.toggle('is-filled', !!b);
        if (b) {
          const rot = rots[b.lvl] || {};
          node.append(face(rot, 'cp-slot-face'), el('span', 'cp-slot-name', rot.name || ''), el('span', 'cp-slot-level', `+${b.lvl}`));
          node.setAttribute('aria-label', `${rot.name || ''} +${b.lvl}`);
        } else node.removeAttribute('aria-label');
      }
      node.disabled = !b;
      node.classList.toggle('is-selected', !!b && i === state.sel);
    });
    if (state.popSlot >= 0) {
      animate(room.children[state.popSlot], [{ transform: 'scale(.7)' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 360 });
      state.popSlot = -1;
    }
    const slot = state.room[state.sel];
    $('.cp-stand').classList.toggle('is-empty', !slot);
    const rot = slot ? rots[slot.lvl] || {} : null;
    const faceBox = $('.cp-rot-face');
    const faceKey = rot ? rot.name : '';
    if (faceBox.dataset.key !== faceKey) {
      faceBox.dataset.key = faceKey;
      faceBox.replaceChildren(face(rot, 'cp-rot-icon'));
    }
    $('.cp-rot-name').textContent = rot ? rot.name : (t.stand_empty || '');
    $('.cp-rot-level').textContent = slot ? `+${slot.lvl}` : '';
    $('.cp-rate-b').textContent = rot ? fill(t.rate_final, { s: rot.success, k: rot.keep, d: rot.drop }) : '';
    $('.cp-fcost').textContent = rot ? fill(t.final_cost, { n: rot.cost }) : '';
    $('.cp-fcost').classList.toggle('is-short', !!rot && state.fgold < rot.cost);
  }

  // 지나가는 줄 — 있는 것은 그대로 두고(움직임이 끊기지 않게) 새로 나온 것만 더하고, 사라진 것만 뺀다
  function paintLane() {
    const ids = new Set(state.lane.map((w) => String(w.id)));
    [...track.children].forEach((node) => {
      if (ids.has(node.dataset.id)) return;
      // 초점이 있던 브레인롯이 줄 밖으로 나가면 다음 브레인롯(없으면 줄 자체)으로 초점을 넘긴다(10/06 점검)
      if (node === document.activeElement) {
        const nextWalker = [...track.children].find((n) => n !== node && ids.has(n.dataset.id));
        if (nextWalker) nextWalker.focus({ preventScroll: true });
        else { track.tabIndex = -1; track.focus({ preventScroll: true }); }
      }
      node.remove();
    });
    const now = Date.now();
    state.lane.forEach((w) => {
      if (track.querySelector(`[data-id="${w.id}"]`)) return;
      const rot = rots[w.lvl] || {};
      const node = el('button', 'cp-walker');
      node.type = 'button';
      node.dataset.id = String(w.id);
      node.setAttribute('aria-label', `${rot.name || ''} +${w.lvl}`);
      node.style.setProperty('--life', `${lifeMs}ms`);
      node.style.setProperty('--delay', `${-(now - w.born)}ms`);
      node.append(face(rot, 'cp-walker-face'), el('span', 'cp-walker-name', rot.name || ''), el('span', 'cp-walker-level', `+${w.lvl}`));
      node.addEventListener('click', () => take(w.id));
      track.append(node);
    });
  }

  // 브레인롯의 얼굴 — 위키의 그림(CC BY-SA). 그림이 없으면 빈 자리만 둔다(이모지로 대신하지 않는다).
  function face(rot, cls) {
    if (rot && rot.img) {
      // 그림은 브라우저가 따로 끌어 가지 못하게 한다 — 그러면 포인터가 끊겨 방으로 끌어다 놓기가 멈춘다
      const img = el('img', cls); img.src = rot.img; img.alt = ''; img.loading = 'lazy'; img.draggable = false;
      if (rot.credit) img.title = `${rot.credit.file} · ${rot.credit.by}`; // 그림마다 올린 사람
      return img;
    }
    return el('span', `${cls} is-blank`);
  }

  // 결과가 드러나는 순간의 손맛 — 성공은 튀어 오르고, 하락은 흔들린다
  function flourish(outcome, final) {
    const node = final ? $('.cp-rot') : $('.cp-target');
    if (outcome === 'up') animate(node, [{ transform: 'scale(.86) rotate(-4deg)' }, { transform: 'scale(1.08) rotate(2deg)' }, { transform: 'none' }], { duration: 380 });
    else if (outcome === 'down') animate(node, [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 320 });
    else animate(node, [{ opacity: .55 }, { opacity: 1 }], { duration: 260 });
  }

  function floatUp(text) {
    const f = $('.cp-float');
    f.textContent = text;
    animate(f, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-22px)' }], { duration: 650, fill: 'forwards' });
  }

  function chartPoints(values) {
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const span = hi - lo || 1;
    return values.map((v, i) => `${(i / (values.length - 1)) * 120},${32 - ((v - lo) / span) * 28}`).join(' ');
  }

  // 곡괭이 — 강화 칸의 그림과 채굴 칸에서 휘두르는 곡괭이가 같은 선이다
  function drawPickaxe() {
    const ns = 'http://www.w3.org/2000/svg';
    ['.cp-art', '.cp-swing'].forEach((sel) => {
      const icon = document.createElementNS(ns, 'svg'); icon.setAttribute('viewBox', '0 0 160 120');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M37 33 Q84 5 129 43 L123 51 Q79 26 42 44 Z M86 36 L60 105 L49 101 L75 31');
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '6');
      path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
      icon.append(path); $(sel).append(icon);
    });
  }

  // 지금 누를 것 — 할 일을 따라 옮겨 간다. 처음 게임은 강화부터(눌러 보면 재료가 필요하다는 걸 안다),
  // 출시한 게임은 지나가는 줄부터(가져와야 골드가 들어온다).
  function cueTarget() {
    if (state.busy) return cueEl;
    if (state.phase === 'first') {
      if (state.judge) return cutBtn;
      if (!state.tried) return enhanceBtn;
      const up = upgradeAt(state.level);
      if (state.iron >= up.iron && state.coal >= up.coal) return enhanceBtn;
      if (state.iron >= up.iron && state.coal < up.coal) {
        if (state.gold >= coalPrice) return buyBtn;
        if (state.iron > up.iron) return sellBtn;
      }
      return mineBtn;
    }
    if (state.phase === 'final' && !state.done) return filled() < 2 ? lane : enhanceBtn;
    return null;
  }

  // 표시가 여러 번 옮겨 가는 페이지라 화면에 들어온 뒤 세 번만 퍼지고 고정 테두리로 남는다(.cue-step, E1과 같다)
  function cueOn(target) {
    if (target === cueEl) return;
    stopCue?.(); stopCue = null;
    if (cueEl) cueEl.classList.remove('cue', 'cue-step', 'cue-seen');
    cueEl = target;
    if (!target) return;
    target.classList.add('cue', 'cue-step');
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      target.classList.add('cue-seen');
    }, { threshold: 0.6 });
    io.observe(target);
    stopCue = () => io.disconnect();
  }

  function clearTimers() {
    [cutTimer, revealTimer, respawnTimer].forEach((x) => x && clearTimeout(x));
    cutTimer = revealTimer = respawnTimer = null;
  }

  function restart(before) {
    if (dead) return;
    if (drag?.ghost) drag.ghost.remove();
    drag = null;
    markTarget(null);
    clearTimers();
    before?.();
    onComplete({ hide: true });
    recapShown = false;
    reset();
    // 방과 줄은 출시한 게임에서만 다시 그리므로, 처음으로 돌아갈 때는 여기서 비운다
    track.replaceChildren();
    [...room.children].forEach((n) => { n.dataset.lvl = 'x'; });
    paintFinal();
    paint();
    parked = null;
    // 다시 해보기 버튼(결론 칸)은 사라진다 — 첫 누를 것으로 초점을 옮기고 화면도 그리로 데려간다.
    // 초점만 옮기면 버튼이 화면 밖에 있어 키보드 사용자는 아무것도 보지 못했다(10/06 점검)
    enhanceBtn.focus({ preventScroll: true });
    enhanceBtn.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'instant' : 'smooth' });
  }

  function el(tag, cls = '', text) {
    const node = document.createElement(tag); if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text; return node;
  }

  paint();
  return {
    restart,
    destroy() {
      dead = true;
      clearInterval(priceTimer);
      clearInterval(clockTimer);
      clearTimers();
      stopCue?.();
      if (drag?.ghost) drag.ghost.remove();
      drag = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cancelDrag);
      window.removeEventListener('blur', cancelDrag);
    },
  };
}

// 정해진 씨앗으로 같은 순서를 내는 난수(mulberry32) — 결과와 스폰이 매번 같게
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
