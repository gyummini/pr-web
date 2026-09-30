// GET /api/play — E8(PokeCollect)의 '직접 플레이하기' 버튼.
//
// 입장권 {exp: 지금+10분, nonce}에 HMAC-SHA256 서명을 붙여 게임의 /claim으로 보낸다. 게임 쪽 게이트
// (pokecollect-unity 저장소 Web/cloudflare/game/gate)가 서명과 만료를 보고 nonce를 한 번만 받은 뒤,
// 이 브라우저에 개인 키를 발급한다. 형식은 게이트와 같다:
//   base64url(JSON) + "." + base64url(HMAC-SHA256(secret, "pokecollect-ticket:" + base64url(JSON)))
// 비밀값은 Vercel 환경변수 PLAY_TICKET_SECRET에만 있다(게임의 Pages 시크릿과 같은 값). 의존성 없음.
import { createHmac, randomBytes } from 'node:crypto';

export const GAME_ORIGIN = 'https://pokemoncollect.pages.dev';
export const TICKET_MINUTES = 10;

export function makeTicket(secret, nowMs, nonce = randomBytes(16).toString('base64url')) {
  const body = Buffer.from(JSON.stringify({ exp: Math.floor(nowMs / 1000) + TICKET_MINUTES * 60, nonce })).toString('base64url');
  const mac = createHmac('sha256', secret).update(`pokecollect-ticket:${body}`).digest('base64url');
  return `${body}.${mac}`;
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const secret = process.env.PLAY_TICKET_SECRET;
  if (!secret) {
    // 설정 전에는 게임으로 보내지 않는다(게이트가 서명을 확인할 수 없다)
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('아직 게임 입장을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.');
    return;
  }
  res.statusCode = 302;
  res.setHeader('Location', `${GAME_ORIGIN}/claim?t=${encodeURIComponent(makeTicket(secret, Date.now()))}`);
  res.end();
}
