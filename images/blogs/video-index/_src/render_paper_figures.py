"""Render the Video-Index paper's figures to transparent PNGs for the blog post.

Each PDF in the paper repository (figs/*.pdf, compiled locally with the paper's fonts) is rasterized at
380 dpi and its white background turned into alpha with GIMP's color-to-alpha rule: alpha is the pixel's
distance from white, and the colour is what would composite back to the original over white. The result
is exact over white and indistinguishable over the site's parchment. The figures keep the paper's
numbering, so fig06_year.png is Figure 6 of the paper.

Usage: python3 render_paper_figures.py <paper repo>/figs
Output: ../paper/fig01_screening.png ... fig12_agents.png, about 2100 px wide.
"""
import sys
from pathlib import Path

import numpy as np
import pymupdf as fitz
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'paper'
FIGS = {'fig_teaser_treemap': 'fig01_screening', 'fig_t01_levels': 'fig02_options_text', 'fig_t2_pool': 'fig03_pool',
        'fig_t3_frame': 'fig04_frame', 'fig_t4_order': 'fig05_order', 'fig_f0_funnel': 'fig06_year',
        'fig_f3_claims': 'fig07_claims', 'fig_f9_frames_pixels': 'fig08_frames_pixels',
        'fig_f5_longvideo': 'fig09_longvideo', 'fig_f10_ability': 'fig10_errors', 'fig_f7_size': 'fig11_duplicates',
        'fig_agent_comparison': 'fig12_agents'}


def white_to_alpha(rgb):
    """rgb in [0, 1]; returns rgba with the white background removed."""
    alpha = 1.0 - rgb.min(axis=2)
    a = np.maximum(alpha[..., None], 1e-6)
    colour = np.clip((rgb - (1.0 - alpha[..., None])) / a, 0.0, 1.0)
    colour[alpha < 1e-6] = 0.0
    return np.dstack([colour, alpha[..., None]])


def main(figdir):
    OUT.mkdir(exist_ok=True)
    for src, dst in FIGS.items():
        page = fitz.open(Path(figdir) / (src + '.pdf'))[0]
        pm = page.get_pixmap(dpi=380, alpha=False)
        rgb = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width, pm.n)[:, :, :3] / 255.0
        img = Image.fromarray((white_to_alpha(rgb) * 255 + 0.5).astype(np.uint8), 'RGBA')
        img.save(OUT / (dst + '.png'), optimize=True)
        print('wrote', dst, img.size)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Downloads/apex_paper/figs')
