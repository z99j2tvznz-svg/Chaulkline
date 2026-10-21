"""Check that the experimental score-racks.js keeps the frozen scorer's scoring functions byte-for-byte."""
import os, re, sys
H = os.path.dirname(os.path.abspath(__file__)); P = os.path.join(H, '..', '..', '..', 'collab', 'recognition-package-2026-10-20', 'code', 'tools', 'score-racks.js')
E = os.path.join(H, '..', 'exp', 'tools', 'score-racks.js')
def fn(src, name):
    m = re.search(r'^function ' + name + r'\(.*?^}\n', src, re.S | re.M); return m.group(0) if m else None
a, b = open(P).read(), open(E).read(); ok = True
for name in ('truthWalk', 'scoreClip', 'totals', 'diagnostics', 'obsSplit'):
    same = fn(a, name) == fn(b, name) and fn(a, name) is not None; ok &= same; print(name, 'identical' if same else 'DIFFERENT')
for const in ('truthMemory', 'truthLook', 'truthPockets'):
    la = [l for l in a.splitlines() if l.startswith('const ' + const)]; lb = [l for l in b.splitlines() if l.startswith('const ' + const)]
    ok &= la == lb; print(const, 'identical' if la == lb else 'DIFFERENT')
sys.exit(0 if ok else 1)
