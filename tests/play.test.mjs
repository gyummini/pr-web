// /api/play 단위 테스트: node --test tests/play.test.mjs
// 입장권이 게임 게이트가 읽는 형식 그대로인지(서명 목적 문자열, base64url, 10분 만료, nonce), 설정 전에는 503인지,
// 설정 뒤에는 /claim으로 302인지 본다. 비밀값은 테스트용 문자열이다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import handler, { makeTicket, GAME_ORIGIN, TICKET_MINUTES } from '../api/play.mjs';

const SECRET = 'test-ticket-secret';

// 게이트(Web/cloudflare/game/gate/crypto.js unseal)와 같은 방식으로 되읽는다
function readTicket(text, secret) {
  const [body, mac, extra] = text.split('.');
  if (extra !== undefined) return null;
  const expected = createHmac('sha256', secret).update(`pokecollect-ticket:${body}`).digest('base64url');
  if (mac !== expected) return null;
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}

function call(env) {
  const saved = process.env.PLAY_TICKET_SECRET;
  if (env === undefined) delete process.env.PLAY_TICKET_SECRET;
  else process.env.PLAY_TICKET_SECRET = env;
  const res = { statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b = '') { this.body = b; } };
  try {
    handler({ method: 'GET', headers: {} }, res);
  } finally {
    if (saved === undefined) delete process.env.PLAY_TICKET_SECRET;
    else process.env.PLAY_TICKET_SECRET = saved;
  }
  return res;
}

test('입장권은 게이트가 읽는 형식이고 10분 뒤에 끝난다', () => {
  const now = Date.UTC(2026, 8, 30, 3, 0, 0);
  const t = makeTicket(SECRET, now, 'nonce-for-test-1234');
  assert.match(t, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(readTicket(t, SECRET), { exp: now / 1000 + TICKET_MINUTES * 60, nonce: 'nonce-for-test-1234' });
  assert.equal(readTicket(t, 'another-secret'), null, '다른 비밀값으로는 읽히지 않는다');
  const [body, mac] = t.split('.');
  assert.equal(readTicket(`${body}x.${mac}`, SECRET), null, '바뀐 입장권은 읽히지 않는다');
});

test('누를 때마다 nonce가 새로 만들어진다', () => {
  const a = readTicket(makeTicket(SECRET, Date.now()), SECRET);
  const b = readTicket(makeTicket(SECRET, Date.now()), SECRET);
  assert.notEqual(a.nonce, b.nonce);
  assert.ok(a.nonce.length >= 16);
});

test('설정 전에는 게임으로 보내지 않고, 설정 뒤에는 /claim으로 보낸다', () => {
  const off = call(undefined);
  assert.equal(off.statusCode, 503);
  assert.equal(off.headers['cache-control'], 'no-store');
  const on = call(SECRET);
  assert.equal(on.statusCode, 302);
  const location = new URL(on.headers.location);
  assert.equal(location.origin, GAME_ORIGIN);
  assert.equal(location.pathname, '/claim');
  assert.ok(readTicket(location.searchParams.get('t'), SECRET), '보낸 입장권은 같은 비밀값으로 읽힌다');
  assert.equal(on.headers['x-robots-tag'], 'noindex, nofollow');
});
