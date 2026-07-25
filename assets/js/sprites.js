// 클루 스프라이트 매핑. 스탠딩 4종(투명 배경 확정본, 공통 bbox 크롭) + SD 통합 1종.
// 이미지를 교체할 때는 같은 파일명으로 덮어쓰면 된다.
export const SPRITE_KEYS = ['normal', 'happy', 'surprised', 'serious'];

export const SPRITES = {
  standing: {
    normal: './assets/img/Standing.png',
    happy: './assets/img/Happy.png',
    surprised: './assets/img/Surprised.png',
    serious: './assets/img/Serious.png',
  },
  sd: {
    normal: './assets/img/SD.png',
    happy: './assets/img/SD.png',
    surprised: './assets/img/SD.png',
    serious: './assets/img/SD.png',
  },
};

export function standingSprite(key) {
  return SPRITES.standing[key] || SPRITES.standing.normal;
}

export function sdSprite(key) {
  return SPRITES.sd[key] || SPRITES.sd.normal;
}
