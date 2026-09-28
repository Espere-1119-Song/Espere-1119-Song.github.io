"""Render Figures 6 and 7 of the Video-Index paper without the numbers on their bars, for the post.

The post shows those numbers on hover instead. Each paper script (figs/scripts/fig_f0_funnel.py and
fig_f3_claims.py) runs unchanged except that every Axes.text whose string is a bare number or percentage
is drawn fully transparent; the text keeps its box, so the layout is the paper's. The PDFs go to a temporary
folder, their bars are checked against the paper's own PDFs (same rectangles to 0.05 pt, so the hover regions
recorded by export_data.py still fit), and each is rasterized at 380 dpi with the white background turned
into alpha, as in render_paper_figures.py.

Usage: python3 render_plain_figures.py <paper repo>
Output: ../paper/fig06_year_plain.png and ../paper/fig07_claims_plain.png
"""
import contextlib
import io
import re
import runpy
import sys
import tempfile
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.axes      # noqa: E402
import numpy as np          # noqa: E402
import pymupdf as fitz      # noqa: E402
from PIL import Image       # noqa: E402

from render_paper_figures import white_to_alpha   # noqa: E402

REPO = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Downloads/apex_paper').resolve()
SCRIPTS = REPO / 'figs' / 'scripts'
OUT = Path(__file__).resolve().parent.parent / 'paper'
FIGS = {'fig_f0_funnel': 'fig06_year_plain', 'fig_f3_claims': 'fig07_claims_plain'}
NUMBER = re.compile(r'\s*\d+(\.\d+)?%?\s*')


def rects(pdf):
    """The filled rectangles of a figure, rounded to 0.05 pt."""
    out = set()
    for d in fitz.open(pdf)[0].get_drawings():
        if d.get('fill') is not None and d['items'] and all(it[0] == 're' for it in d['items']):
            r = d['rect']
            out.add(tuple(round(v * 20) / 20 for v in (r.x0, r.y0, r.x1, r.y1)))
    return out


def render(stem, tmp):
    sys.path.insert(0, str(SCRIPTS))
    import _figure_header
    save = _figure_header.save_with_header_spacing
    text = matplotlib.axes.Axes.text

    def quiet_numbers(self, x, y, s, *a, **k):
        t = text(self, x, y, s, *a, **k)
        if NUMBER.fullmatch(str(s)):
            t.set_alpha(0)             # invisible but still laid out
        return t
    _figure_header.save_with_header_spacing = lambda fig, path, **k: save(fig, tmp / Path(path).name, **k)
    matplotlib.axes.Axes.text = quiet_numbers
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(SCRIPTS / (stem + '.py')), run_name=stem + '_plain')
    finally:
        _figure_header.save_with_header_spacing = save
        matplotlib.axes.Axes.text = text
    return tmp / (stem + '.pdf')


def main():
    tmp = Path(tempfile.mkdtemp(prefix='plain_'))
    for stem, out in FIGS.items():
        pdf = render(stem, tmp)
        paper = REPO / 'figs' / (stem + '.pdf')
        a, b = fitz.open(pdf)[0].rect, fitz.open(paper)[0].rect
        assert abs(a.width - b.width) < 0.05 and abs(a.height - b.height) < 0.05, (stem, a, b)
        assert rects(pdf) == rects(paper), (stem, len(rects(pdf) ^ rects(paper)))
        page = fitz.open(pdf)[0]
        pm = page.get_pixmap(dpi=380, alpha=False)
        rgb = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width, pm.n)[:, :, :3] / 255.0
        img = Image.fromarray((white_to_alpha(rgb) * 255 + 0.5).astype(np.uint8), 'RGBA')
        img.save(OUT / (out + '.png'), optimize=True)
        print('wrote', out, img.size, 'bars match the paper:', len(rects(paper)))


if __name__ == '__main__':
    main()
