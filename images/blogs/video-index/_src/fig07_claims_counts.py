"""Figure 7 of the Video-Index paper for the post, with each group's bar as long as the group.

A copy of the paper's figs/scripts/fig_f3_claims.py (same data, order, colours and layout) in which a group's
bar is as long as its number of benchmarks instead of 100%, and the group labels drop their (n=...), as the
author asked on 2026-09-27.

Not run directly: render_plain_figures.py and export_data.py run it with the paper's figs/scripts on
sys.path and OUT_DIR set, and it writes OUT_DIR/fig07_claims_counts.pdf, never into the paper repository.
"""
import json
from pathlib import Path
import numpy as np
from _legacy_paper_style import *
import data

LV = data.levels('all')   # both batches (whole-set recount 2026-09-12)
_D = data.TEX_DIR.parent / 'data'          # the paper repository's data, wherever this copy lives
cat = json.load(open(_D / 'task_categories.json'))
_draft = json.load(open(_D / 'task_categories_n1_draft.json'))   # author's DRAFT classes for the second batch
for _k, _v in _draft.items():
    cat.setdefault(_k, []); cat[_k] += [n for n in _v if n not in cat[_k]]
print('second-batch draft classes merged:', {k: len(v) for k, v in _draft.items()})
ROOT_D = _D
ALIAS = {'Camera Movement Understanding (BU_Google)': 'CMU', 'MEGA-Bench(video)': 'MEGA-Bench', 'QBench-Video': 'Q-Bench-Video', 'VideoMMMU': 'Video-MMMU',
         'PerceptionTest': 'Perception Test', 'SpatialTreeBench': 'SpatialTree', 'TimeLens': 'TimeLens-Bench', 'MMSI-Video': 'MMSI-Video-Bench', 'E-VQA': 'ST-Evidence',
         'LongVT': 'VideoSIAH-Eval', 'PAIBench-U': 'PAI-Bench-U', 'PhysicalAI-Understanding': 'PhysicalAI', 'IntPhys2': 'IntPhys 2', 'Lemonade': 'LEMONADE', 'VStaT': 'VSTAT',
         'SiteBench-Video': 'SITE-Bench', 'MF2 (Movie Facts and Fibs)': 'MF2', 'OMTGBench': 'OMTG-Bench', 'DSRBench': 'DSR-Bench'}
EN = {'时序/运动': 'Temporal / motion', '空间/物理': 'Spatial / physical', '长视频/叙事': 'Long video / narrative', '第一人称/具身': 'Egocentric / embodied',
      '幻觉/鲁棒': 'Hallucination / robustness', '知识/推理': 'Knowledge / reasoning', '定位/时刻': 'Grounding / moments', '流式': 'Streaming', '通用/综合': 'General / comprehensive'}

# 2026-09-16 (user): one taxonomy for Figures 1, 7, 10 and Table 1 = the four capability groups of the attribution taxonomy,
# assigned per benchmark by the majority Claude label of its items (data/task_categories_v2.json). TAXONOMY=claims restores
# the manual 9-class file.
import os as _os
_V2 = ROOT_D / 'task_categories_v2.json'
if _os.environ.get('TAXONOMY', 'v2') == 'v2' and _V2.exists():
    from audit_scope import capability_groups
    cat = {}
    short_by_id = {row['bench']: name for name, row in LV.items()}
    for bid, group in capability_groups().items():
        cat.setdefault(group, []).append(short_by_id[bid])
    EN = {k: k for k in cat}
    _USE_V2 = True
else:
    _USE_V2 = False
LEVELS = ['option', 'text', 'pool', 'frame', 'order', 'unbroken']
LABEL = {'option': 'Option', 'text': 'Text', 'pool': 'Pool', 'frame': 'Frame', 'order': 'Order', 'unbroken': 'Survives'}
COL = {'option': PENNRED3, 'text': PENNRED2, 'pool': PENNRED, 'frame': PENNBLUE4, 'order': PENNBLUE3, 'unbroken': PENNBLUE}
rows = []
for k, v in cat.items():
    names = [ALIAS.get(n, n) for n in v if ALIAS.get(n, n) in LV]
    if len(names) < 3:
        continue
    c = {lv: sum(1 for n in names if LV[n]['break_level'] == lv) for lv in LEVELS}
    rows.append((EN[k], len(names), c))
rows.sort(key=lambda r: (r[2]['unbroken'] / r[1], -(r[2]['option'] + r[2]['text']) / r[1]))
print({r[0]: (r[1], r[2]) for r in rows})
m_ = data.master()   # median video dependence m (32f - blind of the row's frame model, master_table) per class, for the text of 4.2
for k, v in cat.items():
    names = [ALIAS.get(n, n) for n in v if ALIAS.get(n, n) in LV]
    ms = [m_[n]['m'] for n in names if n in m_ and isinstance(m_[n].get('m'), (int, float))]
    print(f'  {EN[k]:28s} n={len(names):2d} m median {np.median(ms) if ms else float("nan"):+.1f} (n={len(ms)}); draft names unmatched: {[n for n in _draft.get(k, []) if ALIAS.get(n, n) not in LV]}')

fig, ax = plt.subplots(figsize=(5.5, 1.22), constrained_layout=True)   # 2026-09-23 author: flatter bars, tighter rows (was 1.65 in; bars about 8 pt)
from _plot_spacing import PLOT_GAP_PT
fig._paper_plot_gap_pt = PLOT_GAP_PT - 3.0   # legend closer to the plot, as in Figures 6 and 10
y = np.arange(len(rows))
for i, (name, n, c) in enumerate(rows):
    left = 0.0
    for lv in LEVELS:
        w = c[lv]                                  # the post: counts, not shares
        if w == 0:
            continue
        ax.barh(i, w, left=left, color=COL[lv], edgecolor='white', lw=0.6, height=0.73, zorder=3)   # was 0.64: smaller gaps between bars
        # Label every nonzero segment, including single-benchmark blocks.
        ax.text(left + w / 2, i, str(c[lv]), ha='center', va='center', fontsize=7.5, color='white' if lv in ('text', 'pool', 'unbroken') else INK, zorder=4)
        left += w
ax.set_yticks(y, [name for name, n, _ in rows], fontsize=8)
ax.set_xlim(0, max(n for _, n, _ in rows) * 1.06); ax.set_xticks([0, 10, 20, 30, 40])
ax.tick_params(axis='x', labelsize=8); ax.tick_params(axis='y', length=0)
ax.set_xlabel('Benchmarks in the group', fontsize=9)
ax.spines['left'].set_visible(False)
ax.set_title('')
header_legend(ax, [(LABEL[lv], COL[lv], 's') for lv in LEVELS], legend_size=8)
finalize_headers(fig); fig_title(fig, 'Each claim breaks at its own level', gap=4.0)
from _figure_header import save_with_header_spacing
save_with_header_spacing(fig, Path(globals()['OUT_DIR']) / 'fig07_claims_counts', dpi=220, bbox_inches='tight', header_row=True)   # the paper's save(), aimed at OUT_DIR
