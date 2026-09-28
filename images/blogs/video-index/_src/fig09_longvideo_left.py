"""Figure 9 of the Video-Index paper for the post: its left panel alone, wider and a little taller.

A copy of the data preparation and the left panel of the paper's figs/scripts/fig_f5_longvideo.py (same data,
groups, means, quartiles, colours and fonts). The author asked on 2026-09-27 to drop the right panel (largest
late gains), widen and lengthen the left one, and make it interactive; the paper's script also writes
data/figure9_longvideo_details.json, which this copy never does.

Not run directly: render_plain_figures.py and export_appendix.py run it with the paper's figs/scripts on
sys.path and OUT_DIR set. It writes OUT_DIR/fig09_longvideo_left.pdf and, beside it, fig09_longvideo_left.json
with every dot, mean and quartile bar in PDF points from the top left of the page, for the hover regions.
"""
import csv
import json
import math
from collections import defaultdict
from pathlib import Path
import numpy as np
from _paper_style import *          # noqa: F403 (the paper's style: colours, fonts, plt, fig_header, finalize_headers)
import data
from _figure_header import save_with_header_spacing

OUT_DIR = Path(globals()['OUT_DIR'])        # set by the caller
ROOT = data.TEX_DIR.parent; D = 5.0
reg = {r['benchmark_id']: r['short_name'] for r in csv.DictReader(open(ROOT / 'data' / 'benchmark_registry.csv'))}
REF, DIAG = 'claude-opus-5', 'Qwen/Qwen3-VL-8B-Instruct'
EXTRA = {'Qwen/Qwen3-VL-32B-Instruct': ('Qwen3-VL-32B', PENNBLUE2, [32, 128, 512, 1024]), 'lmms-lab-encoder/LLaVA-OneVision-2-8B-Instruct': ('LLaVA-OneVision-2', G_GREEN, [32, 128, 512]), 'MCG-NJU/VideoChat3-4B': ('VideoChat3', G_PURPLE, [32, 128, 512, 1024])}
acc = {m: defaultdict(dict) for m in [REF, DIAG] + list(EXTRA)}
COMPLETE = {}
for r in csv.DictReader(open(ROOT / 'data' / 'long_video_budget.csv')):
    m = r.get('model', REF)
    if m not in acc or r['acc'] in ('', 'NA') or data.excluded(r['bench']) or r.get('in_set', '1') == '0': continue
    acc[m][r['bench']][int(r['budget'])] = float(r['acc']) * 100
    COMPLETE[(m, r['bench'], int(r['budget']))] = float(r.get('n_scored') or 0) >= 0.9 * float(r.get('n_items') or 1)
def ladder(a, b, buds):
    ks = [k for k in buds if k in a[b]]; return ks, [a[b][k] for k in ks]
def classify(a, buds):
    names = [b for b in a if all(k in a[b] for k in (32, 128, 512))]; still = {}; flat = {}
    for b in names:
        ks, y = ladder(a, b, buds); top, prev = ks[-1], ks[-2]
        flat[b] = y[-1] - y[0] < D
        still[b] = (not flat[b]) and len(ks) >= 4 and (y[-1] - y[-2]) >= D * math.log2(top / prev)
    return names, still, flat
ref_names, ref_still, ref_flat = classify(acc[REF], [32, 128, 512, 600])
BUDS = [32, 128, 512, 1024]
def cell(m, b, k):
    kk = 600 if (m == REF and k == 512 and 600 in acc[m][b]) else k          # the reference's top rung (600) stands for 512
    if kk not in acc[m][b]: return None
    if m in EXTRA and not COMPLETE.get((m, b, kk), True): return None
    return acc[m][b][kk]
MODELS = [REF, DIAG] + list(EXTRA)
curves = {}
for b in ref_names:
    ys = []
    for k in BUDS[:3]:
        v = [cell(m, b, k) for m in MODELS]; v = [x for x in v if x is not None]
        ys.append(np.mean(v) if v else np.nan)
    d = [cell(m, b, 1024) - cell(m, b, 512) for m in MODELS if cell(m, b, 1024) is not None and cell(m, b, 512) is not None]
    ys.append(ys[2] + np.mean(d) if d and not np.isnan(ys[2]) else np.nan)
    curves[b] = ys

# one wide panel: 4.85 in by 1.20 in (the paper's left panel is 2.20 in by 0.80 in)
W, H = 5.5, 2.45
plt.rcParams['figure.constrained_layout.use'] = False
fig = plt.figure(figsize=(W, H))
fig.set_layout_engine(None)
heavy, regular = lato_fonts()
ax = fig.add_axes([.45 / W, .36 / H, 4.85 / W, 1.20 / H])
GROUPS = [
    ('Still gaining in reference', PENNBLUE, [b for b in ref_names if ref_still[b]]),
    ('Remaining', PENNRED, [b for b in ref_names if not ref_still[b]]),
]
X = np.arange(len(BUDS))
dots, bars = [], []                       # what the hover regions need, in data units until the save
for group_index, (label, color, names) in enumerate(GROUPS):
    offset = -.14 if group_index == 0 else .14
    for j, x in enumerate(X):
        kept = [b for b in names if not np.isnan(curves[b][j])]
        vals = np.array([curves[b][j] for b in kept])
        mu, q1, q3 = vals.mean(), np.percentile(vals, 25), np.percentile(vals, 75)
        xpos = x + offset
        jitter = np.linspace(-.1, .1, len(vals))
        ax.scatter(xpos + jitter, vals, s=7, color=color, alpha=.32, linewidths=0, zorder=1)
        ax.vlines(xpos, q1, q3, color=lighten(color, .35), linewidth=4.5, zorder=2)
        ax.scatter(xpos, mu, s=28, color=color, edgecolors='white', linewidth=.7, zorder=3)
        dots.extend({'bench': b, 'group': group_index, 'budget': BUDS[j], 'value': float(v), 'x': float(xpos + dx), 'y': float(v)}
                    for b, v, dx in zip(kept, vals, jitter))
        bars.append({'group': group_index, 'budget': BUDS[j], 'n': len(vals), 'mean': float(mu), 'q1': float(q1), 'q3': float(q3), 'x': float(xpos)})
ax.set(xlim=(-.45, 3.45), ylim=(15, 100), xticks=X,
       xticklabels=[str(b) for b in BUDS], yticks=[20, 40, 60, 80, 100],
       xlabel='Frame budget', ylabel='Accuracy (%)')
ax.tick_params(labelsize=7, length=2)
ax.tick_params(axis='x', pad=1)
ax.xaxis.labelpad = 1
ax.yaxis.labelpad = 2
ax.xaxis.label.set_size(8)
ax.yaxis.label.set_size(8)
ax.set_title('Accuracy across budgets', loc='left', fontproperties=sized(heavy, 8.5), pad=12)
ax.text(0, 1.015, 'Dots mark benchmarks and means, bars span Q1–Q3',
        transform=ax.transAxes, fontsize=6.5, color=G_GREY)
for spine in ('top', 'right'):
    ax.spines[spine].set_visible(False)
# the paper's finish(), without its save into the paper repository
fig_header(fig, 'Most long videos gain from larger budgets', [(f'{label} ({len(names)})', color, 'o') for label, color, names in GROUPS], ncol=2)
finalize_headers(fig, gap=4, min_pad=5, level_all=False)
fig.canvas.draw()
save_with_header_spacing(fig, OUT_DIR / 'fig09_longvideo_left', dpi=200, bbox_inches=None)

def pt(x, y):
    px, py = ax.transData.transform((x, y))
    return [round(px * 72 / fig.dpi, 2), round(H * 72 - py * 72 / fig.dpi, 2)]
out = {'w': round(W * 72, 2), 'h': round(H * 72, 2), 'groups': [label for label, _, _ in GROUPS], 'budgets': BUDS,
       'names': {b: reg.get(b, b) for b in ref_names},
       'curves': {b: [None if np.isnan(v) else round(float(v), 1) for v in ys] for b, ys in curves.items()},
       'dots': [dict(d, at=pt(d['x'], d['y'])) for d in dots],
       'bars': [dict(b, top=pt(b['x'], b['q3']), bottom=pt(b['x'], b['q1']), at=pt(b['x'], b['mean'])) for b in bars]}
(OUT_DIR / 'fig09_longvideo_left.json').write_text(json.dumps(out))
