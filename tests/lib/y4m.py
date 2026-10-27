"""Write a still picture as a short Y4M video, for Chromium's fake camera (--use-file-for-fake-video-capture).
usage: y4m.py <picture> <out.y4m> [frames] [rotate: 0 | 90]"""
import sys
from PIL import Image

def main(src, out, frames=3, rot=0):
    im = Image.open(src).convert('RGB')
    if rot: im = im.rotate(-rot, expand=True)  # 90: turned a quarter turn clockwise (an upright phone)
    w, h = im.size; w -= w % 2; h -= h % 2; im = im.crop((0, 0, w, h))
    y, cb, cr = im.convert('YCbCr').split(); cb = cb.resize((w // 2, h // 2)); cr = cr.resize((w // 2, h // 2))
    frame = y.tobytes() + cb.tobytes() + cr.tobytes()
    with open(out, 'wb') as f:
        f.write(f'YUV4MPEG2 W{w} H{h} F30:1 Ip A1:1 C420jpeg\n'.encode())
        for _ in range(frames): f.write(b'FRAME\n' + frame)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3, int(sys.argv[4]) if len(sys.argv) > 4 else 0)
