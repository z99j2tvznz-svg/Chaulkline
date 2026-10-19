# labels-v1 -> YOLO one-class dataset. Boxes come from the verified circles: [x-r, y-r, 2r, 2r], clipped to the picture.
import json, os, shutil, sys
LAB = '/home/claude/Chaulkline/data/labels/label-set-v1.json'
IMG = '/mnt/project-files/chalkline-data/label-set-v1/'
INTERNAL_VAL = '2026-10-15_2107_V2.3.2'   # a training-side session held out only to watch training; the checking split is never used
L = json.load(open(LAB))
out = 'ds'; shutil.rmtree(out, ignore_errors=True)
counts = {}
for p in L['pictures']:
    part = 'check' if p['split'] == 'validation' else ('ival' if p['session'] == INTERNAL_VAL else 'train')
    os.makedirs(f'{out}/{part}/images', exist_ok=True); os.makedirs(f'{out}/{part}/labels', exist_ok=True)
    shutil.copy(IMG + p['image'], f"{out}/{part}/images/{p['id']}.jpg")
    W, H = p['w'], p['h']; lines = []
    for b in p['balls']:
        x0, y0, x1, y1 = max(0, b['x'] - b['r']), max(0, b['y'] - b['r']), min(W, b['x'] + b['r']), min(H, b['y'] + b['r'])
        if x1 <= x0 or y1 <= y0: continue
        lines.append(f"0 {(x0+x1)/2/W:.6f} {(y0+y1)/2/H:.6f} {(x1-x0)/W:.6f} {(y1-y0)/H:.6f}")
    open(f"{out}/{part}/labels/{p['id']}.txt", 'w').write('\n'.join(lines) + ('\n' if lines else ''))
    c = counts.setdefault(part, [0, 0]); c[0] += 1; c[1] += len(lines)
open(f'{out}/data.yaml', 'w').write(f"path: {os.path.abspath(out)}\ntrain: train/images\nval: ival/images\nnames:\n  0: ball\n")
print(counts)
