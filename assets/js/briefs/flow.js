// E2 · Cost 스킬 시스템 — 한 번의 클릭이 읽는 데이터와 쓰는 데이터.
//
//   ① 읽기 — 마스터 데이터(하늘). 기획자가 정의한 정적 데이터.
//      Student_Master → Skill_Master → Skill_Level_Detail → Skill_String
//      FK를 타고 내려간 끝에 툴팁 한 문장이 조립된다.
//   ② 쓰기 — 상태 데이터(분홍). 전투 중 변하는 값.
//      플로우 차트를 지나며 current_cost·deck_order·is_in_hand가 바뀐다.
//
// 하늘/분홍의 구분은 역기획서 플로우 차트의 범례를 그대로 쓴 것이다.
//
// 차트의 노드·라벨·설명은 전부 콘텐츠_증거카드.json에서 온다 (하드코딩 금지).
// 경로(어떤 순서로 지나가는가)만 코드가 안다 — 그건 콘텐츠가 아니라 로직이다.
//
// 상태 변경은 애니메이션 완료를 기다리지 않는다. 탭이 가려지면 WAAPI가 멈춰
// onfinish가 오지 않기 때문(함정 2와 같은 부류). 진행은 setTimeout이 몬다.

const TICK_MS = 100;

export function playFlow(host, cfg, onComplete) {
  const play = cfg.play || {};
  const byId = new Map((play.students || []).map((s) => [s.id, s]));
  const nodeById = new Map(((cfg.chart || {}).nodes || []).map((n) => [n.id, n]));
  const total = Number(play.uses) || 0;
  const max = Number(play.max_cost) || 10;
  const baseRate = Number(play.rate) || 0;
  const boostRate = Number(play.boosted_rate) || baseRate;
  // 흐름 속도 — 처음에는 천천히 짚어주고, 반복될수록 빨라진다
  const stepStart = Number(play.step_ms_start) || 620;
  const stepMin = Number(play.step_ms_min) || 45;
  const speedupUses = Math.max(1, Number(play.speedup_uses) || 5);

  let hand = [];
  let deck = [];
  let costs = new Map(); // 학생별 EX_스킬_Cost_소모 (예외 4로 깎일 수 있다)
  let scrolled = false;
  let cost = 0;
  let boosted = false;
  let used = 0;
  let running = false;
  let last = 0;
  let timer = null;
  let stepTimers = [];
  let revealed = false; // 결론을 이미 열었는가 (조작은 계속 가능하다)

  const root = document.createElement('div');
  root.className = 'fx';
  // 왼쪽은 이 시스템을 '왜 그렇게 짰는가'(분석)와 조작, 오른쪽 두 칸은 '어떻게 짰는가'(구조).
  // 분석과 구조를 갈라 놓고, 넓은 면적은 구조에 준다 — 이 문서가 보여주려는 것이 그쪽이다.
  root.innerHTML = `
    <div class="fx-grid">
      <section class="fx-side">
        <div class="fx-play">
          <span class="fx-sec fx-sec-play"></span>
          <div class="fx-meter">
            <div class="fx-meter-head"><span class="fx-cost"></span><span class="fx-rate"></span></div>
            <div class="fx-bar"><div class="fx-bar-fill"></div></div>
            <p class="fx-rate-note"></p>
          </div>
          <span class="fx-sub">손패</span>
          <div class="fx-hand" role="group"></div>
          <span class="fx-sub">덱</span>
          <ol class="fx-deck"></ol>
        </div>
      </section>
      <section class="fx-chartcol">
        <span class="fx-sec fx-sec-chart"></span>
        <div class="fx-chart"></div>
      </section>
      <section class="fx-datacol">
        <div class="fx-dgroup">
          <span class="fx-sec fx-sec-master"></span>
          <div class="fx-master"></div>
          <p class="fx-master-note"></p>
        </div>
        <div class="fx-dgroup">
          <span class="fx-sec fx-sec-tables"></span>
          <div class="fx-tables"></div>
        </div>
      </section>
    </div>
    <p class="fx-caption" aria-live="polite"></p>
    <div class="fx-foot"><span class="fx-count"></span><span class="fx-legend"></span></div>`;

  const sec = cfg.sections || {};
  const mst = cfg.master || {};
  root.querySelector('.fx-sec-play').textContent = sec.play || '';
  root.querySelector('.fx-sec-chart').textContent = sec.chart || '';
  root.querySelector('.fx-sec-master').textContent = sec.master || '';
  root.querySelector('.fx-sec-tables').textContent = sec.tables || '';
  root.querySelector('.fx-master-note').textContent = mst.note || '';
  root.querySelector('.fx-rate-note').textContent = play.rate_note || '';

  buildMaster();
  buildLegend();
  buildChart();
  buildTables();

  const handWrap = root.querySelector('.fx-hand');
  const deckWrap = root.querySelector('.fx-deck');
  const caption = root.querySelector('.fx-caption');
  host.appendChild(root);

  reset();
  timer = setInterval(() => {
    // 흐름이 도는 동안에는 회복을 멈춘다 — 차트를 보는 사이에 게이지가 차면
    // 무엇 때문에 쓸 수 있게 됐는지가 흐려진다
    if (running) {
      last = Date.now();
      return;
    }
    tick();
  }, TICK_MS);
  document.addEventListener('visibilitychange', onVisible);

  /* ---------- 뼈대 ---------- */

  function buildLegend() {
    const wrap = root.querySelector('.fx-legend');
    ((cfg.chart || {}).legend || []).forEach((g) => {
      const s = document.createElement('span');
      s.className = 'fx-key';
      s.innerHTML = `<i class="fx-key-m" data-k="${g.k}"></i><span></span>`;
      s.querySelector('span').textContent = g.l;
      wrap.appendChild(s);
    });
  }

  // 차트는 문서의 '최종 플로우 차트' 중 한 번의 선택이 지나는 구간을 그대로 옮긴 것
  function buildChart() {
    const c = root.querySelector('.fx-chart');
    const yes = (cfg.chart || {}).yes || '예';
    const no = (cfg.chart || {}).no || '아니오';
    c.append(
      row([node('env'), edge('현재 Cost 제공'), node('runtime')]),
      down(),
      row([node('q_cost')]),
      branch([
        { label: no, nodes: [node('deny')], cls: 'no' },
        { label: yes, nodes: [node('spend')], cls: 'yes' },
      ]),
      down(),
      row([node('q_draw')]),
      branch([
        { label: yes, nodes: [node('to_top')], cls: 'yes' },
        { label: no, nodes: [node('to_bottom')], cls: 'no' },
      ]),
      down(),
      row([node('draw')]),
      down(),
      row([node('queue')]),
      down('예외'),
      row([node('q_change')]),
      down(),
      row([node('skilltable'), edge('회복력 다시 읽기'), node('reset')])
    );
  }

  function node(id) {
    const n = nodeById.get(id) || { label: id, kind: 'process' };
    const el = document.createElement('div');
    el.className = 'fx-node';
    el.dataset.n = id;
    el.dataset.k = n.kind;
    el.innerHTML = `<span class="fx-node-l"></span><span class="fx-node-n"></span>`;
    el.querySelector('.fx-node-l').textContent = n.label;
    const nt = el.querySelector('.fx-node-n');
    if (n.note) nt.textContent = n.note;
    else nt.remove();
    return el;
  }

  function row(kids) {
    const el = document.createElement('div');
    el.className = 'fx-row';
    kids.forEach((k) => el.appendChild(k));
    return el;
  }

  function edge(label) {
    const el = document.createElement('span');
    el.className = 'fx-edge';
    el.textContent = label;
    return el;
  }

  function down(label) {
    const el = document.createElement('div');
    el.className = 'fx-down';
    el.textContent = label ? `↓ ${label}` : '↓';
    return el;
  }

  function branch(arms) {
    const el = document.createElement('div');
    el.className = 'fx-branch';
    arms.forEach((a) => {
      const arm = document.createElement('div');
      arm.className = `fx-arm ${a.cls}`;
      arm.dataset.arm = a.cls;
      const lab = document.createElement('span');
      lab.className = 'fx-arm-l';
      lab.textContent = a.label;
      arm.appendChild(lab);
      a.nodes.forEach((n) => arm.appendChild(n));
      el.appendChild(arm);
    });
    return el;
  }

  // 마스터 데이터 — 엑셀 시트 구조 그대로. 지금 읽히는 행만 채운다.
  function buildMaster() {
    const wrap = root.querySelector('.fx-master');
    ((cfg.master || {}).tables || []).forEach((t) => {
      const box = document.createElement('div');
      box.className = 'fx-table fx-master-table';
      box.dataset.m = t.id;
      box.dataset.k = 'data';
      box.innerHTML = `<div class="fx-table-h"><b></b><span></span></div>
        <div class="fx-tscroll"><table><thead></thead><tbody></tbody></table></div>`;
      box.querySelector('.fx-table-h b').textContent = t.label;
      box.querySelector('.fx-table-h span').textContent = t.desc || '';
      const tr = document.createElement('tr');
      (t.ko || t.cols).forEach((h, i) => {
        const th = document.createElement('th');
        th.innerHTML = `<b></b><span></span>`;
        th.querySelector('b').textContent = h;
        th.querySelector('span').textContent = t.cols[i];
        tr.appendChild(th);
      });
      box.querySelector('thead').appendChild(tr);
      wrap.appendChild(box);
    });
    // 조립 결과 — 치환자에 값이 꽂힌 최종 문장
    const out = document.createElement('div');
    out.className = 'fx-assembled';
    out.innerHTML = `<span class="fx-assembled-l"></span><p class="fx-assembled-t"></p>`;
    out.querySelector('.fx-assembled-l').textContent = (cfg.master || {}).assembled_label || '';
    wrap.appendChild(out);
  }

  // 클릭한 스킬의 FK 체인을 마스터 테이블에 채운다
  function fillMaster(sid) {
    const rows = ((cfg.master || {}).rows || {})[sid];
    ((cfg.master || {}).tables || []).forEach((t) => {
      const body = root.querySelector(`.fx-master-table[data-m="${t.id}"] tbody`);
      if (!body) return;
      body.textContent = '';
      if (!rows) return;
      const data = rows[t.id];
      if (!data) return;
      const list = Array.isArray(data[0]) ? data : [data];
      list.forEach((cells) => {
        const tr = document.createElement('tr');
        cells.forEach((v, ci) => {
          const td = document.createElement('td');
          td.dataset.c = t.cols[ci];
          td.textContent = v;
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    });
    assemble(rows);
  }

  // 툴팁 조립 — 템플릿이 '{PARAM}%' 형태일 때만 100을 곱한다.
  // 문자열 자신이 단위를 선언하므로 파라미터 이름 목록을 따로 둘 필요가 없다.
  function assemble(rows) {
    const out = root.querySelector('.fx-assembled-t');
    if (!out) return;
    out.textContent = '';
    if (!rows || !rows.string) return;
    const tpl = rows.string[1] || '';
    const vals = new Map((rows.detail || []).map((r) => [r[6], Number(r[7])]));
    const re = /\{([A-Z0-9_]+)\}(%?)/g;
    let at = 0;
    let m;
    while ((m = re.exec(tpl))) {
      out.append(tpl.slice(at, m.index));
      at = m.index + m[0].length;
      const raw = vals.get(m[1]);
      const chip = document.createElement('span');
      chip.className = 'fx-slot';
      if (raw == null) chip.textContent = m[0];
      else {
        const n = m[2] === '%' ? raw * 100 : raw;
        chip.textContent = `${Math.round(n * 100) / 100}${m[2]}`;
      }
      out.append(chip);
    }
    out.append(tpl.slice(at));
  }

  function buildTables() {
    const wrap = root.querySelector('.fx-tables');
    (cfg.tables || []).forEach((t) => {
      const box = document.createElement('div');
      box.className = 'fx-table';
      box.dataset.t = t.id;
      box.dataset.k = t.kind || 'state';
      box.innerHTML = `<div class="fx-table-h"></div>
        <div class="fx-tscroll"><table><thead></thead><tbody></tbody></table></div>`;
      box.querySelector('.fx-table-h').textContent = t.label;
      const tr = document.createElement('tr');
      (t.ko || t.cols).forEach((h, i) => {
        const th = document.createElement('th');
        th.innerHTML = `<b></b><span></span>`;
        th.querySelector('b').textContent = h;
        th.querySelector('span').textContent = t.cols[i];
        tr.appendChild(th);
      });
      box.querySelector('thead').appendChild(tr);
      wrap.appendChild(box);
    });
  }

  /* ---------- 상태 → 화면 ---------- */

  function reset() {
    clearTimers();
    stepTimers = [];
    hand = (play.hand || []).map((id) => byId.get(id)).filter(Boolean);
    deck = (play.deck || []).map((id) => byId.get(id)).filter(Boolean);
    costs = new Map((play.students || []).map((x) => [x.id, Number(x.cost) || 0]));
    cost = Number(play.start_cost) || 0;
    boosted = false;
    used = 0;
    revealed = false;
    running = false;
    last = Date.now();
    caption.textContent = '';
    fillMaster(null);
    clearLit();
    drawHand();
    drawDeck();
    paintTables();
    paint();
  }

  function costOf(s) {
    return costs.has(s.id) ? costs.get(s.id) : Number(s.cost) || 0;
  }

  // 사용 횟수에 따라 한 걸음의 길이를 줄인다 (speedupUses 회에서 최소값)
  function stepMs() {
    const t = Math.min(1, used / speedupUses);
    return Math.round(stepStart + (stepMin - stepStart) * t);
  }

  function rate() {
    return boosted ? boostRate : baseRate;
  }

  // stepTimers에는 setTimeout·setInterval 핸들이 섞여 있다
  function clearTimers() {
    stepTimers.forEach((h) => {
      clearTimeout(h);
      clearInterval(h);
    });
  }

  function onVisible() {
    last = Date.now(); // 가려져 있던 시간은 버린다
    if (!document.hidden) paint();
  }

  function tick() {
    const now = Date.now();
    const dt = document.hidden ? 0 : Math.max(0, (now - last) / 1000);
    last = now;
    if (!dt) return;
    cost = Math.min(max, cost + rate() * dt);
    paint();
  }

  function paint() {
    root.querySelector('.fx-cost').textContent = `현재 Cost ${cost.toFixed(2)} / ${max}`;
    root.querySelector('.fx-rate').textContent = `회복 ${rate().toFixed(4)} /sec`;
    root.querySelector('.fx-bar-fill').style.width = `${(cost / max) * 100}%`;
    const more = used >= total && play.more_note ? ` · ${play.more_note}` : '';
    root.querySelector('.fx-count').textContent = `${used} / ${total}${more}`;
    const envCell = root.querySelector('.fx-table[data-t="env"] [data-c="current_cost"]');
    if (envCell && !running) envCell.textContent = cost.toFixed(2);

    handWrap.querySelectorAll('.fx-card').forEach((el) => {
      const need = Number(el.dataset.cost);
      const ok = !running && cost >= need;
      el.classList.toggle('ready', ok);
      el.style.setProperty('--fill', `${Math.min(1, cost / need) * 360}deg`);
      const w = el.querySelector('.fx-card-wait');
      if (w) w.textContent = ok ? '' : `${((need - cost) / rate()).toFixed(1)}s`;
    });
  }

  function drawHand() {
    handWrap.textContent = '';
    hand.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fx-card';
      b.dataset.cost = costOf(s);
      b.dataset.sid = s.id;
      b.innerHTML = `<span class="fx-card-top"><span class="fx-card-name"></span><span class="fx-card-cost"></span></span>
        <span class="fx-card-ex"></span><span class="fx-card-wait" aria-hidden="true"></span>`;
      b.querySelector('.fx-card-name').textContent = s.name;
      b.querySelector('.fx-card-cost').textContent = costOf(s);
      b.querySelector('.fx-card-ex').textContent = s.ex || '';
      b.addEventListener('click', () => use(s));
      handWrap.appendChild(b);
    });
  }

  function drawDeck() {
    deckWrap.textContent = '';
    deck.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'fx-deck-item';
      li.dataset.sid = s.id;
      li.innerHTML = `<span class="fx-deck-n"></span><span class="fx-deck-name"></span><span class="fx-deck-cost"></span>`;
      li.querySelector('.fx-deck-n').textContent = hand.length + i + 1;
      li.querySelector('.fx-deck-name').textContent = s.name;
      li.querySelector('.fx-deck-cost').textContent = costOf(s);
      deckWrap.appendChild(li);
    });
  }

  // 상태 데이터 테이블 — 문서의 세 테이블을 그대로 그린다.
  // 회복력 합계는 호시노 EX가 지속되는 동안 boost_add 만큼 올라가고,
  // 그 값이 곧바로 회복 속도로 계산된다 (문서 예외 1).
  function paintTables() {
    const sum = Number(play.recovery_sum) || 0;
    const ratio = Number(play.recovery_ratio) || 0;
    const order = [...hand, ...deck];
    fill('env', [
      [
        String(sum + (boosted ? Number(play.boost_add) || 0 : 0)),
        String(ratio),
        rate().toFixed(4),
        cost.toFixed(2),
      ],
    ]);
    fill(
      'runtime',
      order.map((s) => [
        s.name,
        String(costOf(s)),
        hand.includes(s) ? '1' : '0',
        hand.includes(s) && cost >= costOf(s) ? '1' : '0',
      ]),
      order.map((s) => s.id)
    );
    fill(
      'queue',
      order.map((s, i) => [s.name, String(i + 1)]),
      order.map((s) => s.id)
    );
  }

  function fill(tid, rows, sids) {
    const t = root.querySelector(`.fx-table[data-t="${tid}"] tbody`);
    if (!t) return;
    const spec = (cfg.tables || []).find((x) => x.id === tid) || { cols: [] };
    t.textContent = '';
    rows.forEach((cells, ri) => {
      const tr = document.createElement('tr');
      if (sids) tr.dataset.sid = sids[ri];
      cells.forEach((v, ci) => {
        const td = document.createElement('td');
        td.dataset.c = spec.cols[ci];
        td.textContent = v;
        tr.appendChild(td);
      });
      t.appendChild(tr);
    });
  }

  /* ---------- 한 번의 선택이 차트를 지나간다 ---------- */

  function use(s) {
    // 네 번을 채운 뒤에도 계속 눌러볼 수 있다 — 결론만 한 번 열리고 판은 살아 있다
    if (running) return;
    const afford = cost >= costOf(s);
    running = true;
    tick();
    clearLit();
    fillMaster(s.id);
    paint();

    // 첫 조작에서 판 전체를 화면에 맞춘다 — 아래쪽 상태 테이블이 접혀 있으면 변화가 안 보인다
    if (!scrolled) {
      scrolled = true;
      const top = root.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }

    // 한 걸음씩 나아가는 것을 타이머 하나가 몬다. 단계마다 setTimeout을 새로 거는
    // 사슬은 중간에 한 칸만 끊겨도 영영 멈추므로, 종료 조건을 매 틱 직접 확인한다.
    const path = afford ? okPath(s) : denyPath(s);
    let i = 0;
    step(path[i++]);
    const ms = stepMs();
    const walker = setInterval(() => {
      if (i < path.length) {
        step(path[i++]);
        return;
      }
      clearInterval(walker);
      running = false;
      if (afford) {
        used += 1;
        if (!revealed && used >= total) {
          revealed = true;
          stepTimers.push(setTimeout(onComplete, 900));
        }
      }
      paint();
    }, ms);
    stepTimers.push(walker);
  }

  function okPath(s) {
    const p = [
      // ① 읽기 — FK를 타고 마스터 데이터를 훑는다
      { m: 'student' },
      { m: 'skill' },
      { m: 'detail' },
      { m: 'string', assembled: true },
      // ② 쓰기 — 플로우 차트를 지나며 상태 데이터가 바뀐다
      { n: 'env' },
      { n: 'runtime', sid: s.id, t: 'runtime' },
      { n: 'q_cost', arm: 'yes', t: 'env', c: 'current_cost' },
      { n: 'spend', do: () => (cost -= costOf(s)), t: 'env', c: 'current_cost' },
      { n: 'q_draw', arm: 'no' },
      { n: 'to_bottom', do: () => cycle(s), t: 'queue', fly: s.id },
      { n: 'draw', t: 'runtime' },
      { n: 'queue', t: 'queue' },
    ];
    if (s.reduce) {
      p.push({ n: 'q_change', do: () => applyReduce(s), t: 'runtime', c: 'ex_skill_cost', cap: 'reduce' });
    }
    if (s.boost) {
      p.push(
        { n: 'q_change' },
        { n: 'skilltable' },
        { n: 'reset', do: () => (boosted = true), t: 'env', c: 'cost_recovery_speed' }
      );
    }
    return p;
  }

  function denyPath(s) {
    return [
      { m: 'student' },
      { m: 'skill' },
      { m: 'detail', assembled: true },
      { n: 'env' },
      { n: 'runtime', sid: s.id, t: 'runtime' },
      { n: 'q_cost', arm: 'no', t: 'env', c: 'current_cost' },
      { n: 'deny' },
    ];
  }

  // 예외 4 — 손패에서 가장 비싼 다른 스킬의 EX_스킬_Cost_소모를 깎는다.
  // 감소량은 소수점 이하 절삭 (Skill_String에 명시된 규칙).
  function applyReduce(s) {
    const r = Number(s.reduce) || 0;
    const target = hand.filter((x) => x.id !== s.id).sort((a, b) => costOf(b) - costOf(a))[0];
    if (!target) return;
    const cut = Math.floor(costOf(target) * r);
    if (cut > 0) costs.set(target.id, costOf(target) - cut);
  }

  // 순환 구조 — 쓴 스킬은 덱 최후미로, 빈 핸드 자리에 덱 최상단이 들어온다
  function cycle(s) {
    const slot = hand.indexOf(s);
    const drawn = deck.shift();
    if (drawn) hand[slot] = drawn;
    else hand.splice(slot, 1);
    deck.push(s);
  }

  function step(st) {
    root.querySelectorAll('.fx-node.on, .fx-arm.on').forEach((el) => {
      el.classList.remove('on');
      el.classList.add('past');
    });
    // 움직임은 전부 장식이다 — 재생되지 않아도 아래 상태 변경은 이미 옳다
    const preHand = new Set(
      [...handWrap.querySelectorAll('.fx-card')].map((el) => el.dataset.sid)
    );
    const preDeck = rectsOf(deckWrap, '.fx-deck-item');
    const ghost = st.fly ? ghostOf(handWrap.querySelector(`.fx-card[data-sid="${st.fly}"]`)) : null;

    if (st.do) st.do();

    root.querySelectorAll('.fx-master-table.on').forEach((e) => {
      e.classList.remove('on');
      e.classList.add('past');
    });
    if (st.m) {
      const mt = root.querySelector(`.fx-master-table[data-m="${st.m}"]`);
      if (mt) {
        mt.classList.add('on');
        mt.classList.remove('past');
      }
    }
    root.classList.toggle('fx-assembled-on', !!st.assembled);

    const n = st.n && root.querySelector(`.fx-node[data-n="${st.n}"]`);
    if (n) {
      n.classList.add('on');
      n.classList.remove('past');
    }
    if (st.arm) {
      const arm = root.querySelector(`.fx-arm[data-arm="${st.arm}"]`);
      if (arm) arm.classList.add('on');
    }

    drawHand();
    drawDeck();
    paintTables();
    paint();

    if (ghost) flyGhost(ghost);
    flipDeck(preDeck, st.fly);
    handWrap.querySelectorAll('.fx-card').forEach((el) => {
      if (!preHand.has(el.dataset.sid)) enterCard(el);
    });

    // 지나가는 노드가 건드리는 테이블·행·칸을 같이 밝힌다
    // 상태 테이블만 끈다 — .fx-master-table도 .fx-table을 갖고 있어 함께 지우면 안 된다
    root
      .querySelectorAll('.fx-tables .fx-table.on, .fx-tables tr.on, .fx-tables td.on')
      .forEach((e) => e.classList.remove('on'));
    if (st.t) {
      const tb = root.querySelector(`.fx-table[data-t="${st.t}"]`);
      if (tb) {
        tb.classList.add('on');
        if (st.sid) {
          const tr = tb.querySelector(`tr[data-sid="${st.sid}"]`);
          if (tr) tr.classList.add('on');
        }
        if (st.c) tb.querySelectorAll(`td[data-c="${st.c}"]`).forEach((td) => td.classList.add('on'));
      }
    }

    const key = st.cap || (st.m ? `m_${st.m}` : st.arm ? `${st.n}_${st.arm}` : st.n);
    const cap = (cfg.captions || {})[key];
    if (cap) caption.textContent = cap;
  }

  /* ---------- 손패·덱의 움직임 ---------- */

  function rectsOf(scope, sel) {
    const m = new Map();
    scope.querySelectorAll(sel).forEach((el) => m.set(el.dataset.sid, el.getBoundingClientRect()));
    return m;
  }

  // 쓴 카드의 복제본을 원래 자리에 띄운다 (원본은 곧바로 손패에서 사라진다)
  function ghostOf(node) {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    const g = node.cloneNode(true);
    g.className = 'fx-card ready fx-ghost';
    g.disabled = true;
    g.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;z-index:60;pointer-events:none`;
    document.body.appendChild(g);
    return { el: g, rect: r };
  }

  // 덱 쪽으로 날려보낸다 — 어디로 갔는지가 보여야 순환이 전달된다
  function flyGhost(ghost) {
    const { el, rect } = ghost;
    const to = deckWrap.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (rect.left + rect.width / 2);
    const dy = to.bottom - rect.bottom;
    if (el.animate) {
      el.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: 0 },
        ],
        { duration: 380, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' }
      );
    }
    // 정리는 타이머로 — 애니메이션이 재생되지 않아도 복제본이 남지 않는다
    stepTimers.push(setTimeout(() => el.remove(), 460));
  }

  // 덱은 FLIP으로 되감아 한 칸씩 당겨지는 것이 보이게 한다
  function flipDeck(prev, landedId) {
    deckWrap.querySelectorAll('.fx-deck-item').forEach((el) => {
      const id = el.dataset.sid;
      if (id && id === landedId) {
        el.classList.add('landed');
        stepTimers.push(setTimeout(() => el.classList.remove('landed'), 900));
        return;
      }
      const was = prev.get(id);
      if (!was || !el.animate) return;
      const dy = was.top - el.getBoundingClientRect().top;
      if (!dy) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], {
        duration: 300,
        easing: 'cubic-bezier(.22,.61,.36,1)',
      });
    });
  }

  // 덱에서 올라온 새 카드 — 손패가 바뀌었다는 것을 알아채게 한다
  function enterCard(el) {
    el.classList.add('fresh');
    if (el.animate) {
      el.animate(
        [
          { opacity: 0, transform: 'translateY(-14px) scale(.96)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 340, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'backwards' }
      );
    }
    stepTimers.push(setTimeout(() => el.classList.remove('fresh'), 1300));
  }

  function clearLit() {
    root.querySelectorAll('.on, .past').forEach((el) => el.classList.remove('on', 'past'));
  }

  return {
    restart(before) {
      if (before) before();
      reset();
    },
    destroy() {
      clearInterval(timer);
      clearTimers();
      document.removeEventListener('visibilitychange', onVisible);
      document.querySelectorAll('.fx-ghost').forEach((n) => n.remove());
      running = true; // 화면을 떠난 뒤 남은 콜백이 조작을 되살리지 않도록
    },
  };
}
