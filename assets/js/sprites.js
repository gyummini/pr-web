// 클루 스프라이트 매핑. 스탠딩 4종(투명 배경 확정본, 공통 bbox 크롭) + SD 통합 1종.
// 이미지를 교체할 때는 같은 파일명으로 덮어쓰면 된다. 10/10부터 WebP(품질 90, 투명 배경 그대로 — 표정 4장 1.09MB → 242KB,
// SD는 화면에서 45~185px로만 쓰여 370px로 줄임 243KB → 36KB). 원본 PNG는 같은 폴더에 남아 있다(가6)
export const SPRITE_KEYS = ['normal', 'happy', 'surprised', 'serious'];

export const SPRITES = {
  standing: {
    normal: '/assets/img/Standing.webp',
    happy: '/assets/img/Happy.webp',
    surprised: '/assets/img/Surprised.webp',
    serious: '/assets/img/Serious.webp',
  },
  sd: {
    normal: '/assets/img/SD.webp',
    happy: '/assets/img/SD.webp',
    surprised: '/assets/img/SD.webp',
    serious: '/assets/img/SD.webp',
  },
};

export function standingSprite(key) {
  return SPRITES.standing[key] || SPRITES.standing.normal;
}

export function sdSprite(key) {
  return SPRITES.sd[key] || SPRITES.sd.normal;
}
