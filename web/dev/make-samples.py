"""Generate the sample image and video used by demo mode and the mock upstream.

Run from the web/ folder:  python3 dev/make-samples.py
Needs Pillow and ffmpeg. The output goes to public/samples/.
"""
import os
import subprocess
import tempfile

from PIL import Image

W, H = 32, 18
SKY = ['#0A0E2A', '#0C1131', '#0E1438', '#11183F', '#141C47', '#18214F', '#1C2657',
       '#212C5F', '#263267', '#2B386F', '#303E77', '#35437E', '#3A4985', '#3F4E8B']
BUILDINGS = [(0, 3, 8), (4, 6, 5), (7, 10, 9), (11, 13, 4), (14, 17, 7), (18, 19, 10),
             (20, 23, 6), (24, 26, 9), (27, 29, 5), (30, 31, 8)]


def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def hsh(x, y):
    h = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return h


def scene(x, y):
    h = hsh(x, y)
    if y >= 14:
        if y == 14:
            return '#2A3170'
        if h % 6 == 0:
            return '#25327A'
        if h % 11 == 0:
            return '#5A3E6E'
        return '#070B24'
    for i, (a, b, top) in enumerate(BUILDINGS):
        if a <= x <= b and y >= top:
            if i == 3 and y == top + 1:
                return '#FF4FA3'
            if i == 6 and y == top + 1 and a < x < b:
                return '#5CE1E6'
            if y > top and (x + y) % 2 == 0 and h % 5 < 2:
                return '#5CE1E6' if i % 2 else '#FFC857'
            return '#0B0F22'
    if 26 <= x <= 27 and 1 <= y <= 2:
        return '#F4F1DE'
    if y < 7 and h % 29 == 0:
        return '#E8EBF2'
    return SKY[y]


def frame(f):
    koi = {}
    kx, ky = (f % 46) - 7, 9
    body, pale, fin = '#FF6A3D', '#FFF4E6', '#FF9A6B'
    parts = [(2, 0, pale), (3, 0, body), (4, 0, body), (5, 0, '#0B0D12'), (0, 1, fin), (1, 1, body),
             (2, 1, body), (3, 1, pale), (4, 1, body), (5, 1, body), (6, 1, body), (2, 2, body),
             (3, 2, body), (4, 2, pale), (0, 0 if f % 2 else 2, fin)]
    for dx, dy, c in parts:
        koi[(kx + dx, ky + dy)] = c
    im = Image.new('RGB', (W, H))
    px = im.load()
    for y in range(H):
        for x in range(W):
            px[x, y] = hx(koi.get((x, y), scene(x, y)))
    return im


def main():
    out = os.path.join(os.path.dirname(__file__), '..', 'public', 'samples')
    os.makedirs(out, exist_ok=True)
    frame(19).resize((2048, 1152), Image.NEAREST).save(os.path.join(out, 'koi.png'), optimize=True)
    with tempfile.TemporaryDirectory() as tmp:
        # 5 seconds at 24 fps; the koi moves one cell every 3 frames
        for i in range(120):
            frame(i // 3).resize((1280, 720), Image.NEAREST).save(os.path.join(tmp, f'f{i:04d}.png'))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '24', '-i',
                        os.path.join(tmp, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                        '-movflags', '+faststart', '-crf', '28', os.path.join(out, 'koi.mp4')], check=True)
    print('wrote', os.listdir(out))


if __name__ == '__main__':
    main()
