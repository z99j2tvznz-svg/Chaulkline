"""Write the V3 finder graphs: detector-v1 at the table-strip input shapes, all sharing one external weights file.
usage: make_finder_shapes.py <detector-v1 1280x1280 onnx> <out dir>
Each shape has about 520-560 thousand input pixels (the cost the phone was measured at: about 80 ms on the GPU), with
aspects from 1.76 to 4.45. The app crops the picture to the table and picks the shape closest to the crop's aspect, so a
table seen from the side (a thin strip) gets about 1.7 times more pixels per ball than the whole frame would."""
import hashlib, os, shutil, sys, onnx
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import resize_det

SHAPES = [(1568, 352), (1408, 384), (1280, 416), (1184, 448), (1088, 480), (1024, 544), (960, 544)]

def main(src, out):
    os.makedirs(out, exist_ok=True); hs = set()
    for w, h in SHAPES:
        d = os.path.join(out, f'.{w}x{h}'); os.makedirs(d, exist_ok=True); tmp = os.path.join(d, 'tmp.onnx')
        resize_det.main(src, tmp, w, h); m = onnx.load(tmp); os.remove(tmp)
        onnx.save(m, os.path.join(d, f'finder-{w}x{h}.onnx'), save_as_external_data=True, all_tensors_to_one_file=True, location='finder-v1.weights', size_threshold=0)
        hs.add(hashlib.sha256(open(os.path.join(d, 'finder-v1.weights'), 'rb').read()).hexdigest())
        shutil.move(os.path.join(d, f'finder-{w}x{h}.onnx'), os.path.join(out, f'finder-{w}x{h}.onnx'))
        shutil.move(os.path.join(d, 'finder-v1.weights'), os.path.join(out, 'finder-v1.weights')); shutil.rmtree(d)
    assert len(hs) == 1, 'weights differ between shapes'
    print('wrote', len(SHAPES), 'shapes, weights sha256', hs.pop()[:16])

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
