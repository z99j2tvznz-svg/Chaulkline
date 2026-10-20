"""Build the train / dev / test example lists from the package (read only) and check the split for leaks.
Writes out/data/{train,dev,test}.npz + examples.csv + split-check.json."""
import collections, hashlib, json, os, re
import numpy as np
from PIL import Image
from common import PKG, CFG, out, read_csv, write_csv, crop_square, to_input

IDX = os.path.join(PKG, '01-images', 'reader-inputs')
SCORED_STATUS = {'player-verified', 'player-verified, partly hidden'}


def shot_no(s):
    m = re.search(r'shot(\d+)', s); return int(m.group(1)) if m else None


def dev_or_train(session, clip):
    if session.startswith('2026-10-15'): return 'dev'
    if session.startswith('2026-10-16') and shot_no(clip) % 2 == 1: return 'dev'
    return 'train'


def main():
    ex, X40, X24 = [], [], []

    # ---- training / dev: player-verified labels-v1 (Oct 12-16). Unverified sources are not used. ----
    lab = read_csv(os.path.join(PKG, '02-ground-truth', 'player-verified', 'all-verified-ball-labels.csv'))
    imgs = {}
    for r in lab:
        if r['label_set'] != 'labels-v1': continue  # calibration labels are held-out sessions: test only (via index.csv)
        nb = r['entry'] != 'ball'
        if not nb and r['number_known'] != '1': continue  # verified ball, unknown number: no identity to learn
        y = 10 if nb else int(r['number'])
        im = imgs.get(r['image']) or imgs.setdefault(r['image'], Image.open(os.path.join(PKG, r['image'])).convert('RGB'))
        crop = crop_square(im, float(r['x_px']), float(r['y_px']), float(r['r_px']))
        clip = r['source_file']
        ex.append(dict(id=f"L:{r['picture_id']}:{r['ball_index']}:{'nb' if nb else 'b'}", source='labels-v1 ' + r['picture_kind'],
                       session=r['session'], clip=clip, frame='', ball_key=f"{r['picture_id']}:{r['ball_index']}",
                       split=dev_or_train(r['session'], clip), y=y, status='player-verified',
                       partly_hidden=r['partly_hidden'], radius_px=r['r_px'], md5=hashlib.md5(crop.tobytes()).hexdigest()))
        X40.append((to_input(crop) * 255).round().astype(np.uint8)); X24.append(None)

    # ---- index.csv: Oct 16 video crops (train/dev) and every held-out picture (test) ----
    rows = read_csv(os.path.join(IDX, 'index.csv')); seen = set(); skipped = collections.Counter()
    by_frame = collections.defaultdict(list)
    for r in rows:
        if not r['image_id'].startswith('audit'): by_frame[(r['session'], r['clip'], r['frame_30fps'])].append(r)
    for r in rows:
        key = (r['session'], r['clip'], r['frame_30fps'], r['spot_index'])
        if r['image_id'].startswith('audit'): skipped['audit duplicate of another row'] += 1; continue
        if key in seen: skipped['duplicate key'] += 1; continue
        seen.add(key)
        test = r['split'] == 'held-out test'
        verified_id = r['truth_status'] in SCORED_STATUS and r['truth_number'] != ''
        if not test and not verified_id: skipped['train/dev picture without verified number'] += 1; continue
        crop = np.asarray(Image.open(os.path.join(IDX, 'crop-before-resize', r['image_id'] + '.png')).convert('RGB'))
        # touching / overlapping: another labelled spot in the same frame closer than 2.5 ball radii (centre to centre)
        rad = float(r['ball_radius_px']); px, py = float(r['px_1280x720']), float(r['py_1280x720'])
        dmin = min([((float(o['px_1280x720']) - px) ** 2 + (float(o['py_1280x720']) - py) ** 2) ** .5
                    for o in by_frame[key[:3]] if o['spot_index'] != r['spot_index']] or [1e9])
        status = r['truth_status'] if not verified_id else 'player-verified'
        ex.append(dict(id='I:' + r['image_id'], source='index.csv video crop', session=r['session'], clip=r['clip'],
                       frame=r['frame_30fps'], ball_key=r['label_id'],
                       split='test' if test else dev_or_train(r['session'], r['clip']),
                       y=int(r['truth_number']) if verified_id else -1, status=status, partly_hidden='1' if 'partly' in r['truth_status'] else '0',
                       radius_px=r['ball_radius_px'], touching='1' if dmin < 2.5 * rad else '0', nearest_spot_radii=round(dmin / rad, 2),
                       one_frame_per_ball=r['frame_used_in_experiments'], light_step='1' if 'light' in r['truth_status'].lower() else '0',
                       md5=hashlib.md5(crop.tobytes()).hexdigest(), image_id=r['image_id']))
        X40.append((to_input(crop) * 255).round().astype(np.uint8))
        X24.append(np.asarray(Image.open(os.path.join(IDX, 'input-24x24', r['image_id'] + '.png')).convert('RGB')) if test else None)

    cols = ['id', 'image_id', 'source', 'session', 'clip', 'frame', 'ball_key', 'split', 'y', 'status', 'partly_hidden', 'touching',
            'nearest_spot_radii', 'one_frame_per_ball', 'light_step', 'radius_px', 'md5']
    write_csv(out('data', 'examples.csv'), ex, cols)
    for sp in ('train', 'dev', 'test'):
        ii = [i for i, e in enumerate(ex) if e['split'] == sp]
        d = dict(X40=np.stack([X40[i] for i in ii]), y=np.array([ex[i]['y'] for i in ii]), ids=np.array([ex[i]['id'] for i in ii]))
        if sp == 'test': d['X24'] = np.stack([X24[i] for i in ii])
        np.savez_compressed(out('data', sp + '.npz'), **d)

    # ---- leak check: sessions disjoint, no identical crops, nearest-neighbour distance train->test ----
    sess = {sp: sorted({e['session'] for e in ex if e['split'] == sp}) for sp in ('train', 'dev', 'test')}
    md5 = {sp: {e['md5'] for e in ex if e['split'] == sp} for sp in ('train', 'dev', 'test')}
    thumb = lambda a: np.asarray(Image.fromarray(a).convert('L').resize((12, 12), Image.BILINEAR), np.float32).ravel() / 255
    T = {sp: np.stack([thumb(X40[i]) for i, e in enumerate(ex) if e['split'] == sp]) for sp in ('train', 'dev', 'test')}
    norm = lambda m: (m - m.mean(1, keepdims=True)) / (m.std(1, keepdims=True) + 1e-6)
    def nn(a, b):
        a, b = norm(a), norm(b); d = (a ** 2).sum(1)[:, None] + (b ** 2).sum(1)[None] - 2 * a @ b.T; return np.sqrt(np.maximum(d, 0) / a.shape[1])
    d_tt = nn(T['test'], np.vstack([T['train'], T['dev']])).min(1)
    within = nn(T['test'], T['test']); np.fill_diagonal(within, 9); d_within = within.min(1)
    chk = dict(sessions=sess, session_overlap_train_test=sorted(set(sess['train'] + sess['dev']) & set(sess['test'])),
               identical_crops_train_or_dev_in_test=len((md5['train'] | md5['dev']) & md5['test']),
               identical_crops_train_in_dev=len(md5['train'] & md5['dev']),
               clips_in_both_train_and_dev=sorted({(e['session'], e['clip']) for e in ex if e['split'] == 'train'} & {(e['session'], e['clip']) for e in ex if e['split'] == 'dev'}),
               nearest_train_or_dev_distance_for_test={'min': float(d_tt.min()), 'p1': float(np.percentile(d_tt, 1)), 'median': float(np.median(d_tt))},
               nearest_other_test_distance_for_test={'min': float(d_within.min()), 'median': float(np.median(d_within))},
               test_with_train_neighbour_closer_than_median_within_test_neighbour=int((d_tt < np.median(d_within)).sum()),
               note='Distances: 12x12 grey thumbnails, each normalised (mean 0, sd 1), RMS difference. Test pictures of the same ball in '
                    'consecutive frames are near-identical to each other (within-test distance), which is why scores are also given per ball.',
               skipped=dict(skipped),
               counts={sp: {f'{a} | class {b}': v for (a, b), v in collections.Counter((e['status'], e['y']) for e in ex if e['split'] == sp).most_common()} for sp in ('train', 'dev')} | {
                   'test': dict(collections.Counter(e['status'] for e in ex if e['split'] == 'test'))},
               counts_by_class={sp: {str(k): v for k, v in sorted(collections.Counter(e['y'] for e in ex if e['split'] == sp).items())} for sp in ('train', 'dev', 'test')})
    json.dump(chk, open(out('data', 'split-check.json'), 'w'), indent=1, default=str)
    print(json.dumps({k: chk[k] for k in ('session_overlap_train_test', 'identical_crops_train_or_dev_in_test', 'clips_in_both_train_and_dev',
                                          'nearest_train_or_dev_distance_for_test', 'nearest_other_test_distance_for_test', 'skipped', 'counts_by_class')}, default=str))


if __name__ == '__main__':
    main()
