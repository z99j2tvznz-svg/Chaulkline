"""Shared helpers for Reader v2 Cycle 1 (experimental; nothing here is used by the app)."""
import json, math, os, pickle, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); BENCH = os.path.join(HERE, '..', '..', 'recognition-2026-10-20')
sys.path.insert(0, os.path.join(BENCH, 'bench'))
from common import softmax, fit_temperature, decide, frozen_reader, crop_square, PKG  # noqa: E402,F401
OUT = os.environ.get('CYCLE_OUT', os.path.join(HERE, '..', 'out'))


def o(*p):
    f = os.path.join(OUT, *p); os.makedirs(os.path.dirname(f), exist_ok=True); return f


def make_input(crop, side_frac=1.0, px=40):
    """crop = native 3.2-radius crop (uint8). side_frac < 1 keeps only the centre (e.g. 2.6/3.2 = 2.6-radius crop).
    Bilinear resize to px x px (same as the benchmark's to_input when side_frac=1, px=40). Returns uint8."""
    n = crop.shape[0]; im = Image.fromarray(crop)
    if side_frac < 1:
        s = n * side_frac; a = (n - s) / 2
        im = im.resize((px, px), Image.BILINEAR, box=(a, a, a + s, a + s))
    else:
        im = im.resize((px, px), Image.BILINEAR)
    return np.asarray(im, np.uint8)


def load_native(): return pickle.load(open(o('native.pkl'), 'rb'))
