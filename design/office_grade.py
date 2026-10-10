# 사무소 그림에 '지금 빛에 깊이만'(10/10 나4 시안 가)을 입힌다 — 새로 그리지 않고 색 보정 + 창 빛줄기 + 구석 그늘.
# 사용: python office_grade.py <원본.jpg> <결과.jpg> [미리보기.png]
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
prev = sys.argv[3] if len(sys.argv) > 3 else None
im = Image.open(src).convert('RGB')
W, H = im.size
a = np.asarray(im).astype(np.float32) / 255.0

# 1) 밝은 곳은 조금 따뜻하게, 어두운 곳은 조금 깊게(S 곡선) — 낮빛의 대비를 올린다
lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
s = lum + 0.16 * (lum - 0.5) * (1 - np.abs(2 * lum - 1))  # 부드러운 S 곡선(가운데 기울기만 키움)
s = np.clip(s, 0, 1)
ratio = np.where(lum > 1e-4, s / np.maximum(lum, 1e-4), 1.0)[..., None]
a = np.clip(a * ratio, 0, 1)
warm = np.clip((lum - 0.45) / 0.55, 0, 1)[..., None]  # 밝은 곳일수록
a = a * (1 + warm * np.array([0.06, 0.025, -0.05], dtype=np.float32))

# 2) 창 빛줄기 — 창(오른쪽 위)에서 바닥(가운데 아래)으로 비스듬히 내려오는 옅은 빛. 흐리게 펴서 스크린으로 얹는다
beam = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(beam)
win_top_l, win_top_r = (int(W * 0.60), int(H * 0.02)), (int(W * 0.84), int(H * 0.02))
win_bot_l, win_bot_r = (int(W * 0.60), int(H * 0.52)), (int(W * 0.84), int(H * 0.50))
for i, (dx, alpha) in enumerate([(-0.27, 70), (-0.20, 52), (-0.13, 44)]):
    off = int(W * 0.05 * i)
    poly = [
        (win_top_l[0] + off, win_top_l[1] + int(H * 0.08)),
        (win_top_l[0] + off + int(W * 0.05), win_top_l[1] + int(H * 0.08)),
        (int(W * (0.62 + dx)) + off + int(W * 0.09), H),
        (int(W * (0.62 + dx)) + off, H),
    ]
    d.polygon(poly, fill=alpha)
beam = beam.filter(ImageFilter.GaussianBlur(radius=W * 0.02))
b = np.asarray(beam).astype(np.float32) / 255.0
# 바닥에 닿기 전 공기 중에서는 옅고, 창 가까이에서 가장 밝다
fade = np.linspace(1.0, 0.35, H, dtype=np.float32)[:, None]
b = (b * fade)[..., None] * 0.55
light = np.array([1.0, 0.86, 0.62], dtype=np.float32)
a = 1 - (1 - a) * (1 - b * light)  # screen

# 3) 바닥 햇빛 자국을 또렷하게 — 이미 밝은 바닥(아래 25%)의 밝은 곳만 조금 더
floor = np.zeros((H, W), dtype=np.float32)
floor[int(H * 0.78):, :] = 1.0
floor = np.asarray(Image.fromarray((floor * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=H * 0.04))).astype(np.float32) / 255.0
lum2 = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
hot = np.clip((lum2 - 0.5) / 0.4, 0, 1) * floor
a = a * (1 + hot[..., None] * np.array([0.10, 0.07, 0.02], dtype=np.float32))

# 4) 구석 그늘 — 위 · 아래 가장자리와 왼쪽 아래를 조금 더 어둡게(대화창이 앉는 아래쪽이 차분해진다)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
nx, ny = xx / W - 0.62, yy / H - 0.42
r = np.sqrt((nx * 1.05) ** 2 + (ny * 1.35) ** 2)
vig = np.clip((r - 0.38) / 0.55, 0, 1) ** 1.6 * 0.30
bottom = np.clip((yy / H - 0.70) / 0.30, 0, 1) ** 1.4 * 0.14
a = a * (1 - (vig + bottom))[..., None]

out = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
out.save(dst, quality=84, optimize=True, progressive=True)
if prev:
    both = Image.new('RGB', (W // 2, H), 'white')
    both.paste(im.resize((W // 2, H // 2)), (0, 0))
    both.paste(out.resize((W // 2, H // 2)), (0, H // 2))
    both.save(prev)
print('saved', dst)
