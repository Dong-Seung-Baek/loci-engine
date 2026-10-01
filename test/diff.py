# Pixel diff two screenshot folders; prints per-image changed-pixel ratio and max channel delta.
import sys, os
import numpy as np
from PIL import Image
a, b = sys.argv[1:3]
for f in sorted(os.listdir(a)):
    x = np.asarray(Image.open(f'{a}/{f}').convert('RGB')).astype(int)
    y = np.asarray(Image.open(f'{b}/{f}').convert('RGB')).astype(int)
    d = np.abs(x - y).max(axis=2)
    print(f, f'changed {(d > 8).mean()*100:.3f}%', 'max', d.max())
    if len(sys.argv) > 3 and d.max() > 8:
        Image.fromarray(((d > 8) * 255).astype('uint8')).save(f'{sys.argv[3]}/{f}')
