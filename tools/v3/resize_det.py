"""Re-size the static detector-v1 ONNX graph (exported at 1280 x 1280) to another input size (multiples of 32).
Only the size-dependent constants change: the attention reshapes at stride 32, the head's box reshapes, anchors and strides.
usage: resize_det.py in.onnx out.onnx W H"""
import sys, numpy as np, onnx
from onnx import numpy_helper as nh, helper

def anchors(W, H):
    pts, strides = [], []
    for s in (8, 16, 32):
        w, h = W // s, H // s
        sx, sy = np.arange(w) + 0.5, np.arange(h) + 0.5
        yy, xx = np.meshgrid(sy, sx, indexing='ij')
        pts.append(np.stack([xx.ravel(), yy.ravel()], 0)); strides.append(np.full(w * h, s, np.float32))
    return np.concatenate(pts, 1)[None].astype(np.float32), np.concatenate(strides)[None]

def main(src, dst, W, H):
    assert W % 32 == 0 and H % 32 == 0
    m = onnx.load(src); g = m.graph
    a0, s0 = anchors(1280, 1280)
    a, s = anchors(W, H); N = a.shape[2]; h32, w32 = H // 32, W // 32
    new = {'/model.10/m/m.0/attn/Constant': np.array([1, 2, 128, h32 * w32], np.int64),
           '/model.10/m/m.0/attn/Constant_2': np.array([1, 128, h32, w32], np.int64),
           '/model.10/m/m.0/attn/Constant_3': np.array([1, 128, h32, w32], np.int64),
           '/model.23/dfl/Constant': np.array([1, 4, 16, N], np.int64),
           '/model.23/dfl/Constant_1': np.array([1, 4, N], np.int64),
           '/model.23/Constant_12': a, '/model.23/Constant_13': a, '/model.23/Constant_15': s}
    seen = set()
    for n in g.node:
        if n.op_type == 'Constant' and n.name in new:
            old = nh.to_array(n.attribute[0].t)
            if n.name in ('/model.23/Constant_12', '/model.23/Constant_13'): assert np.allclose(old, a0), n.name  # anchor layout check
            if n.name == '/model.23/Constant_15': assert np.allclose(old, s0), n.name
            n.attribute[0].t.CopyFrom(nh.from_array(new[n.name], n.attribute[0].t.name)); seen.add(n.name)
    assert seen == set(new), set(new) - seen
    d = g.input[0].type.tensor_type.shape.dim; d[2].dim_value = H; d[3].dim_value = W
    o = g.output[0].type.tensor_type.shape.dim; o[2].dim_value = N
    del g.value_info[:]
    meta = {p.key: p for p in m.metadata_props}
    if 'imgsz' in meta: meta['imgsz'].value = f'[{H}, {W}]'
    onnx.checker.check_model(m); onnx.save(m, dst); print(dst, W, H, N)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
