"""Render Figures 6 and 7 of the Video-Index paper without the numbers on their bars, for the post.

The post shows those numbers on hover instead. Figure 7 comes from fig07_claims_counts.py here (the paper's
fig_f3_claims.py with its bars in counts), Figure 6 from fig06_year_counts.py (the paper's fig_f0_funnel.py
with its right panel in counts), and
Figure 9 from fig09_longvideo_left.py here (the left panel of fig_f5_longvideo.py, wider, on its own).
Each runs unchanged except that every Axes.text whose string is a bare number or percentage is drawn fully
transparent; the text keeps its box, so the layout is the script's. The PDFs go to a temporary folder, Figure 7's
bars are checked against the paper's own PDF (same rectangles to 0.05 pt, so the hover regions recorded by
export_data.py still fit; export_data.py reads Figure 6's regions from this same render), and each is
rasterized at 380 dpi with the white background turned into alpha, as in render_paper_figures.py.

Usage: python3 render_plain_figures.py <paper repo>
Output: ../paper/fig06_year_counts.png, fig07_claims_counts.png and fig09_longvideo_left.png
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
HERE = Path(__file__).resolve().parent
OUT = HERE.parent / 'paper'
FIGS = [(HERE / 'fig06_year_counts.py', 'fig06_year_counts', None),                       # (script, output, paper PDF with the same bars)
        (HERE / 'fig07_claims_counts.py', 'fig07_claims_counts', None),
        (HERE / 'fig09_longvideo_left.py', 'fig09_longvideo_left', None)]
NUMBER = re.compile(r'\s*\d+(\.\d+)?%?\s*')


def rects(pdf):
    """The filled rectangles of a figure, rounded to 0.05 pt."""
    out = set()
    for d in fitz.open(pdf)[0].get_drawings():
        if d.get('fill') is not None and d['items'] and all(it[0] == 're' for it in d['items']):
            r = d['rect']
            out.add(tuple(round(v * 20) / 20 for v in (r.x0, r.y0, r.x1, r.y1)))
    return out


def render(script, tmp, quiet=True):
    """Run a figure script with its output sent to tmp and return the PDF; quiet draws bare numbers transparent.
    It runs in a fresh interpreter, since the paper's scripts change matplotlib's settings as they run and a
    figure saved with a tight box would otherwise come out a different size after another script."""
    import subprocess
    subprocess.run([sys.executable, str(Path(__file__).resolve()), str(REPO), '--render', str(script), str(tmp), '1' if quiet else '0'],
                   check=True, cwd=str(HERE))
    return Path(tmp) / (Path(script).stem + '.pdf')


def render_here(script, tmp, quiet=True):
    sys.path.insert(0, str(SCRIPTS))
    import _figure_header
    save = _figure_header.save_with_header_spacing
    text = matplotlib.axes.Axes.text

    def quiet_numbers(self, x, y, s, *a, **k):
        t = text(self, x, y, s, *a, **k)
        if quiet and NUMBER.fullmatch(str(s)):
            t.set_alpha(0)             # invisible but still laid out
        return t
    _figure_header.save_with_header_spacing = lambda fig, path, **k: save(fig, tmp / Path(path).name, **k)
    matplotlib.axes.Axes.text = quiet_numbers
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(script), init_globals={'OUT_DIR': str(tmp)}, run_name=Path(script).stem + '_plain')
    finally:
        _figure_header.save_with_header_spacing = save
        matplotlib.axes.Axes.text = text
    return tmp / (Path(script).stem + '.pdf')


def main():
    tmp = Path(tempfile.mkdtemp(prefix='plain_'))
    for script, out, paper in FIGS:
        pdf = render(script, tmp)
        if paper is not None:
            a, b = fitz.open(pdf)[0].rect, fitz.open(paper)[0].rect
            assert abs(a.width - b.width) < 0.05 and abs(a.height - b.height) < 0.05, (out, a, b)
            assert rects(pdf) == rects(paper), (out, len(rects(pdf) ^ rects(paper)))
        page = fitz.open(pdf)[0]
        pm = page.get_pixmap(dpi=380, alpha=False)
        rgb = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width, pm.n)[:, :, :3] / 255.0
        img = Image.fromarray((white_to_alpha(rgb) * 255 + 0.5).astype(np.uint8), 'RGBA')
        img.save(OUT / (out + '.png'), optimize=True)
        print('wrote', out, img.size, 'bars match the paper' if paper is not None else 'regions come from export_data.py')


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[2] == '--render':
        render_here(Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5] == '1')
    else:
        main()
