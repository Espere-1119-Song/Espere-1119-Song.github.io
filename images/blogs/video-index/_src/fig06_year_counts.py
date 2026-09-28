"""Figure 6 of the Video-Index paper for the post, with the right panel in counts.

A copy of the paper's figs/scripts/fig_f0_funnel.py (same data, style and layout) in which each release
year's bar is as long as the number of benchmarks released that year, instead of 100%. The author asked
for this on 2026-09-27 so that the bars also compare the years. The left panel is unchanged.

Not run directly: render_plain_figures.py and export_data.py run it with the paper's figs/scripts on
sys.path and OUT_DIR set, and it writes OUT_DIR/fig06_year_counts.pdf, never into the paper repository.
"""
import json
from pathlib import Path
import numpy as np
from _legacy_paper_style import *          # noqa: F403 (the paper's style: colours, fonts, plt, fig_title)
import _legacy_paper_style
from _figure_header import save_with_header_spacing

OUT_DIR = Path(globals()['OUT_DIR'])        # set by the caller
REPO = Path(_legacy_paper_style.__file__).resolve().parents[2]

LEVELS = ['option', 'text', 'pool', 'frame', 'order']
LABEL = {'option': 'Option', 'text': 'Text', 'pool': 'Pool', 'frame': 'Frame', 'order': 'Order', 'unbroken': 'Survives'}
COL = {'option': PENNRED3, 'text': PENNRED2, 'pool': PENNRED, 'frame': PENNBLUE4, 'order': PENNBLUE3, 'unbroken': PENNBLUE}
GREY = CTRLGREY
snapshot = REPO / 'data/figure6_reported_counts.json'
by = {int(year): counts for year, counts in json.loads(snapshot.read_text())['by_year'].items()}
years = sorted(by)
N = sum(sum(counts.values()) for counts in by.values())
brk = {level: sum(counts[level] for counts in by.values()) for level in LEVELS}
surv = sum(counts['unbroken'] for counts in by.values())
reaching = {level: N - sum(brk[earlier] for earlier in LEVELS[:i]) for i, level in enumerate(LEVELS)}
early = {year: sum(by[year][level] for level in LEVELS[:3]) / sum(by[year].values()) for year in years}

fig, (axl, axr) = plt.subplots(1, 2, figsize=(5.5, 2.0), constrained_layout=True, gridspec_kw={'width_ratios': [1.15, 1]})
from _plot_spacing import PLOT_GAP_PT
fig._paper_plot_gap_pt = PLOT_GAP_PT - 3.0
# (a) funnel, as in the paper
rows = LEVELS + ['unbroken']
for i, lv in enumerate(rows):
    if lv == 'unbroken':
        axl.barh(i, surv, color=COL['unbroken'], edgecolor='white', lw=0.6, height=0.74, zorder=3)
        axl.text(surv / 2, i, str(surv), ha='center', va='center', fontsize=7.5, color='white', zorder=4)
        axl.text(surv + 1.2, i, 'survive every level', ha='left', va='center', fontsize=7.5, color=INK, zorder=4)
        continue
    n_r, n_b = reaching[lv], brk[lv]
    axl.barh(i, n_r - n_b, color=GREY, edgecolor='white', lw=0.6, height=0.74, zorder=3)
    axl.barh(i, n_b, left=n_r - n_b, color=COL[lv], edgecolor='white', lw=0.6, height=0.74, zorder=3)
    if n_b < 8:
        axl.text(n_r + 2, i, str(n_b), ha='left', va='center', fontsize=7.5, color=PENNRED, zorder=4)
    else:
        axl.text(n_r - n_b / 2, i, str(n_b), ha='center', va='center', fontsize=7.5, color='white' if lv in ('text', 'pool') else INK, zorder=4)
    axl.text((n_r - n_b) / 2, i, f'{n_r - n_b}', ha='center', va='center', fontsize=7.5, color=INK, zorder=4)
axl.set_yticks(range(len(rows)), [LABEL[lv] for lv in rows], fontsize=8); axl.invert_yaxis()
axl.set_xlim(0, N * 1.35); axl.set_xticks([0, 50, N] if N > 80 else [0, 25, 50, N])
axl.set_xlabel('Benchmarks reaching the level', fontsize=9); axl.spines['left'].set_visible(False)
axl.set_title('Through the pyramid', loc='left', fontsize=9, fontweight='bold', pad=4)
# (b) by release year, in counts: a bar is as long as the year's releases
top = max(sum(by[y].values()) for y in years)
for i, y in enumerate(years):
    row_y = i * 1.35
    n = sum(by[y].values()); left = 0.0
    for lv in LEVELS + ['unbroken']:
        w = by[y][lv]
        if w == 0:
            continue
        axr.barh(row_y, w, left=left, color=COL[lv], edgecolor='white', lw=0.6, height=0.74, zorder=3)
        color = 'white' if lv in ('text', 'pool', 'unbroken') and w / top >= 0.04 else INK
        axr.text(left + w / 2, row_y, str(w), ha='center', va='center', fontsize=7.5, color=color, zorder=4)
        left += w
    axr.text(n + top * 0.02, row_y, f'{100 * early[y]:.0f}%', ha='left', va='center', fontsize=7.5, color=PENNRED, zorder=4)
axr.set_yticks(np.arange(len(years)) * 1.35, [f'{"$\\leq$" if y == 2023 else ""}{y} ($n$={sum(by[y].values())})' for y in years], fontsize=8); axr.invert_yaxis()
axr.set_xlim(0, top * 1.22); axr.set_xticks([0, 25, 50]); axr.tick_params(axis='x', labelsize=8); axr.tick_params(axis='y', length=0)
axr.set_xlabel('Benchmarks released', fontsize=9); axr.spines['left'].set_visible(False)
axr.set_title('By release year', loc='left', fontsize=9, fontweight='bold', pad=4)
from _legacy_style import legend_handles
entries = [('Continue', GREY, 's')] + [(f'{LABEL[lv]} break', COL[lv], 's') for lv in LEVELS] + [('Survive', COL['unbroken'], 's')]
fig.legend(handles=legend_handles(entries), loc='outside upper left', ncol=7,
           frameon=False, fontsize=8, handlelength=0.75, handletextpad=0.3,
           columnspacing=1.05)
fig_title(fig, 'Newer benchmarks break earlier', gap=4.0)
save_with_header_spacing(fig, OUT_DIR / 'fig06_year_counts', dpi=220, bbox_inches='tight', header_row=True)   # the paper's save(), aimed at OUT_DIR
