# 사무소 밤 그림(10/11 나4 — 한국 시간 밤에만 보이는 이스터에그). 새로 그리지 않고 원래 낮 그림을 밤으로 색 보정한다:
# 전체를 어둡고 푸르게, 해가 들던 밝은 곳(창 · 바닥 빛 자국)은 푸른 달빛으로, 창은 밤하늘과 작은 달, 초록 책상 등에는 따뜻한 불빛.
# 사용: python office_night.py <원래 낮 그림.jpg> <결과.jpg>
# 원래 낮 그림은 git의 처음 그림(9194750:assets/img/bg_office.jpg — 10/10 색 보정 전)을 쓴다. 자리 값은 1672×941 기준 비율이다.
import sys
import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.float32) / 255.0
lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
X, Y = xx / W, yy / H


def soft_rect(x0, y0, x1, y1, blur):
    m = np.zeros((H, W), dtype=np.float32)
    m[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = 1.0
    img = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=blur))
    return np.asarray(img).astype(np.float32) / 255.0


# 1) 밤의 바탕 — 어둡게, 그늘은 살짝 푸르게
night = a * np.array([0.34, 0.37, 0.46], dtype=np.float32) + np.array([0.012, 0.016, 0.034], dtype=np.float32)

# 2) 해가 들던 밝은 곳은 푸른 달빛으로(바닥 빛 자국 · 창틀 · 벽의 반사) — 밝을수록 강하게
# 책상 등 둘레는 달빛에서 뺀다 — 등의 밝은 전구가 푸른 점이 됐다
lamp_zone = np.exp(-((((X - 0.262) * W) / 90.0) ** 2 + (((Y - 0.43) * H) / 70.0) ** 2))
moon = (np.clip((lum - 0.42) / 0.45, 0, 1) * (1 - lamp_zone))[..., None]
moon_col = lum[..., None] * np.array([0.50, 0.60, 0.86], dtype=np.float32) * 0.62
night = night * (1 - moon * 0.85) + moon_col * (moon * 0.85)

# 3) 창 — 유리 칸은 밤하늘(위는 짙은 남색, 아래로 조금 밝게), 나무 그림자는 원래 밝기로 희미하게 남긴다. 블라인드는 어둡게
# 유리 칸 안에서도 원래 밝았던 곳(하늘 · 나무)만 하늘로 바꾼다 — 창살 · 화분 · 서류철은 원래 어두워 실루엣으로 남는다
glass = (soft_rect(0.645, 0.205, 0.843, 0.495, 3) * np.clip((lum - 0.50) / 0.22, 0, 1))[..., None]
sky = (np.array([0.040, 0.062, 0.125], dtype=np.float32) * (1 - (Y[..., None] - 0.2) * 0.8)
       + np.array([0.020, 0.030, 0.050], dtype=np.float32) * (Y[..., None] - 0.2) * 2.0)
trees = (1 - lum[..., None]) * np.array([0.010, 0.014, 0.022], dtype=np.float32)
night = night * (1 - glass) + (sky - trees * 2.2) * glass
blinds = soft_rect(0.640, 0.0, 0.845, 0.205, 4)[..., None]
night = night * (1 - blinds * 0.55)

# 4) 달 — 창 오른쪽 위에 작은 달과 옅은 빛무리
mx, my = 0.795, 0.262
d = np.sqrt(((X - mx) * W) ** 2 + ((Y - my) * H) ** 2)
disc = np.clip(1 - (d - 10) / 2.0, 0, 1)[..., None]
halo = (np.exp(-(d / 40.0) ** 2) * 0.28)[..., None]
moon_light = np.array([0.86, 0.90, 1.0], dtype=np.float32)
night = night + halo * moon_light * glass
night = night * (1 - disc * glass) + moon_light * disc * glass

# 5) 책상 등 — 초록 갓 아래 따뜻한 불빛(타원으로 퍼진다), 갓 자체도 밝게
lx, ly = 0.262, 0.432
dx, dy = (X - lx) * W, (Y - ly) * H
glow = np.exp(-((dx / 210.0) ** 2 + (dy / 120.0) ** 2))[..., None]
warm = np.array([1.0, 0.72, 0.40], dtype=np.float32)
night = 1 - (1 - night) * (1 - glow * warm * 0.42)  # 스크린 섞기
shade = np.exp(-(((X - 0.262) * W / 70.0) ** 2 + ((Y - 0.397) * H / 18.0) ** 2))[..., None]
night = night + shade * np.array([0.10, 0.30, 0.10], dtype=np.float32) * 0.9

# 6) 가장자리 그늘 — 대화창이 앉는 아래쪽과 바깥을 조금 더 어둡게
r = np.sqrt(((X - 0.5) * 1.15) ** 2 + ((Y - 0.45) * 1.35) ** 2)
vig = np.clip((r - 0.35) / 0.55, 0, 1) ** 1.5 * 0.45
night = night * (1 - vig)[..., None]

out = Image.fromarray((np.clip(night, 0, 1) * 255 + 0.5).astype(np.uint8))
out.save(dst, quality=84, optimize=True, progressive=True)
print('saved', dst, out.size)
