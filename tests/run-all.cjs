// 회귀 테스트 전부를 한 번에 돌린다 — `npm test`.
//
// 터미널 두 개를 띄우는 절차(서버 하나 + 테스트 하나)는 매번 건너뛰게 된다.
// 실제로 9/29에 E8 커밋이 회귀 테스트를 못 돌린 채 배포돼 E2가 깨진 채 나갔다.
// 서버를 직접 띄우고, 끝나면 반드시 내린다.
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const ORIGIN = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
const SUITES = [
  ['인터랙티브 공통 (E1·E2)', ['node', ['tests/brief-regression.cjs']]],
  ['E3 · reduction', ['node', ['tests/e3-regression.cjs']]],
  ['E5 · one_card', ['node', ['tests/e5-regression.cjs']]],
  ['입장권 API', ['node', ['--test', 'tests/play.test.mjs']]],
  ['화면 문구 · GPT 목록', ['node', ['tools/strings.cjs', 'check']]],
];

const root = path.resolve(__dirname, '..');
const run = (cmd, args) =>
  new Promise((resolve) => {
    // shell:true 는 인자를 이스케이프하지 않아 경고가 뜬다. node 는 PATH에서 바로 찾힌다.
    const p = spawn(cmd, args, { cwd: root, stdio: 'inherit' });
    p.on('close', (code) => resolve(code ?? 1));
  });

// 서버가 실제로 응답할 때까지 기다린다. 포트가 열리기 전에 테스트를 시작하면
// 첫 스위트만 이유 없이 실패한다.
function waitReady(timeoutMs = 10000) {
  const until = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(`${ORIGIN}/index.html`, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() > until) reject(new Error(`${ORIGIN} 에서 응답이 없다`));
          else setTimeout(tick, 150);
        });
    };
    tick();
  });
}

(async () => {
  let server = null;
  if (!process.env.TEST_ORIGIN) {
    server = spawn('node', ['tests/serve.cjs'], { cwd: root, stdio: 'ignore' });
    try {
      await waitReady();
    } catch (err) {
      server.kill();
      console.error(`정적 서버를 띄우지 못했다: ${err.message}`);
      process.exit(1);
    }
  }

  const failed = [];
  for (const [name, [cmd, args]] of SUITES) {
    console.log(`\n── ${name} ──`);
    const code = await run(cmd, args);
    if (code !== 0) failed.push(name);
  }

  if (server) server.kill();

  console.log('\n────────────');
  if (failed.length) {
    console.log(`실패 ${failed.length} / ${SUITES.length}: ${failed.join(', ')}`);
    process.exit(1);
  }
  console.log(`전부 통과 (${SUITES.length})`);
})();
