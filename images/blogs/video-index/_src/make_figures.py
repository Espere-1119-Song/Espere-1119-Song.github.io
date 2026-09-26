"""Charts for the blog post "Which Video Benchmarks Still Need the Video?" (enxinsong.com/blog/video-index/).

Every number is transcribed from the Video-Index paper; the source of each block is named beside it
(data file of the paper repository, or the main-text section). Nothing here is computed from raw runs.

Style: style.py and fonts/ from github.com/wenhaochai/claude-plugins, writing/skills/plot (Epoch-style
charts, Instrument Sans, Google's GM2 tones). Point PLOT_SKILL at that directory, or clone the repo next
to this script under claude-plugins/.

Output, in the parent directory: fig1_census.png, fig3_profiles.png, fig4_levels.png, fig5_years.png,
fig6_groups.png, fig7_screen.png, fig8_results.png (1600 px wide, WIDTH_POST) and cover.png (2752 x 1536,
the blog card). The PDFs beside them are the vector twins that save() writes.
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLOT = Path(os.environ.get('PLOT_SKILL', HERE / 'claude-plugins' / 'writing' / 'skills' / 'plot'))
sys.path.insert(0, str(PLOT))

import numpy as np                              # noqa: E402
from matplotlib.patches import Polygon           # noqa: E402
from style import *                              # noqa: E402,F403

apply_style()
OUT = HERE.parent
WEB = dict(width=WIDTH_POST, title_pt=9.2, tick_pt=TEXT_PT, note_pt=TICK_PT, side=0.10)

LEVELS = ['Option', 'Text', 'Pool', 'Frame', 'Order', 'Unbroken']
RAMP = [tone('blue', g) for g in (200, 300, 400, 500, 600, 900)]   # one ordered scale for the six outcomes
RED = STRONG[1]


def transparent(fig):
    """The post's page is parchment, so the chart carries no background of its own."""
    fig.patch.set_facecolor('none')
    for ax in fig.get_axes():
        ax.set_facecolor('none')


def save_post(fig, stem):
    transparent(fig)
    save(fig, stem)


def categorical_x(ax):
    """A categorical x axis carries no grid lines (plot rule 4)."""
    ax.grid(axis='x', visible=False)


def categorical_y(ax):
    ax.grid(axis='y', visible=False)


# --- Figure 1: the census -----------------------------------------------------------------------------
# data/census_union.csv: rows dated 2021-2026 minus the watcher's exclusions = 605 benchmarks,
# data_public = yes on 342 of them (Section 1 and Section 3.1 of the paper).
YEARS = ['2021', '2022', '2023', '2024', '2025', '2026']
TOTAL = [1, 2, 9, 89, 242, 262]
PUBLIC = [1, 2, 8, 54, 138, 139]


def fig1_census():
    fig, axes = canvas(rows=1, cols=1, panel_height=1.55,
                       legend=[('Public data', tone('blue', 400), 'box'), ('Not public or unknown', GREY_300, 'box')],
                       quantity='Benchmarks released', **WEB)
    ax = axes[0, 0]
    x = np.arange(len(YEARS))
    rest = [t - p for t, p in zip(TOTAL, PUBLIC)]
    ax.bar(x, PUBLIC, 0.62, color=tone('blue', 400), zorder=3)
    ax.bar(x, rest, 0.62, bottom=PUBLIC, color=GREY_300, zorder=3)
    for i, t in enumerate(TOTAL):
        ax.text(i, t + 5, f'{t}', ha='center', va='bottom', fontsize=TEXT_PT, color=TICK)
    ax.set_xticks(x, YEARS)
    ax.set_xlim(-0.6, len(YEARS) - 0.4)
    nice_y(ax, 0, max(TOTAL), zero=True, headroom=0.18)
    room(ax)
    categorical_x(ax)
    save_post(fig, OUT / 'fig1_census')


# --- Figure 3: four benchmarks under the pyramid ------------------------------------------------------
# data/breaking_levels.csv: eps_opt, eps_text, eps_pool, eps_frame, eps_order in points over chance;
# the bar is s_star_used - c - 5 (Section 2 break rule, delta = 5 points); the index is the first level
# whose exploitability reaches the bar, None when no level does.
PROFILES = [
    ('TempCompass', [14.7, 14.7, 17.8, 17.8, 17.8], 10.3, 0),
    ('MMWorld', [36.2, 52.3, 52.3, 54.8, 56.9], 43.5, 1),
    ('Video-MMMU', [30.2, 44.6, 44.6, 44.6, 59.4], 53.6, 4),
    ('TVBench', [2.5, 6.8, 9.7, 16.3, 16.3], 24.5, None),
]


def fig3_profiles():
    fig, axes = canvas(rows=2, cols=2, panel_height=1.12,
                       legend=[('Exploitability', BLUE), ('Break bar', GREY, 'dash'), ('First break', RED, 'dot')],
                       quantity='Points over chance', **WEB)
    for ax, (name, eps, bar, brk) in zip(axes.flat, PROFILES):
        x = np.arange(5)
        ax.axhline(bar, color=GREY, ls=(0, (4, 2.5)), lw=1.0, zorder=2)
        ax.plot(x, eps, color=BLUE, marker='o', ms=3.0, lw=1.4, zorder=3)
        if brk is not None:
            ax.plot([brk], [eps[brk]], 'o', color=RED, ms=5.2, zorder=4)
        ax.set_xticks(x, LEVELS[:5])
        ax.set_xlim(-0.5, 4.5)
        nice_y(ax, 0, 60, zero=True, headroom=0.35)
        room(ax)
        panel_label(ax, name)
        categorical_x(ax)
    save_post(fig, OUT / 'fig3_profiles')


# --- Figure 4: breaking levels of the 115 -------------------------------------------------------------
# Section 4.1: option 17, text 13, pool 5, frame 27, order 15, unbroken 38 (115 audited benchmarks).
COUNTS = [17, 13, 5, 27, 15, 38]


def fig4_levels():
    fig, axes = canvas(rows=1, cols=1, panel_height=1.45, xlabel='Benchmarks', extra=(-0.16, 0, 0, 0), **WEB)
    ax = axes[0, 0]
    y = np.arange(len(LEVELS))[::-1]
    ax.barh(y, COUNTS, 0.62, color=RAMP, zorder=3)
    for yi, c in zip(y, COUNTS):
        ax.text(c + 0.7, yi, str(c), va='center', ha='left', fontsize=TEXT_PT, color=TICK)
    ax.set_yticks(y, LEVELS)
    ax.set_ylim(-0.6, len(LEVELS) - 0.4)
    ax.set_xticks([0, 10, 20, 30, 40])
    ax.set_xlim(0, 44)
    categorical_y(ax)
    save_post(fig, OUT / 'fig4_levels')


# --- Figures 5 and 6: shares by release year and by capability group ----------------------------------
# data/figure6_reported_counts.json (years follow the master table): option, text, pool, frame, order,
# unbroken per release year. Figure 7 of the paper (fig_f3_claims.pdf): the same six counts per
# capability group, each benchmark in the group that most of its items require.
YEAR_ROWS = [('≤ 2023', [1, 0, 0, 2, 2, 1]), ('2024', [3, 1, 0, 6, 2, 8]),
             ('2025', [7, 11, 3, 12, 6, 15]), ('2026', [6, 1, 2, 7, 5, 14])]
GROUP_ROWS = [('Temporal', [6, 0, 1, 1, 0, 10]), ('Spatial / physical', [4, 1, 2, 2, 4, 7]),
              ('Perception', [3, 5, 1, 17, 6, 13]), ('Reasoning / knowledge', [4, 7, 1, 7, 5, 8])]


def stacked_shares(rows, stem, xlabel):
    fig, axes = canvas(rows=1, cols=1, panel_height=0.34 * len(rows) + 0.25, xlabel=xlabel,
                       legend=[(lv, col, 'box') for lv, col in zip(LEVELS, RAMP)],
                       extra=(0.16, 0.62, 0, 0), **WEB)
    ax = axes[0, 0]
    y = np.arange(len(rows))[::-1]
    for yi, (name, counts) in zip(y, rows):
        n = sum(counts)
        left = 0.0
        for k, (c, col) in enumerate(zip(counts, RAMP)):
            w = 100.0 * c / n
            ax.barh(yi, w, 0.62, left=left, color=col, edgecolor='white', linewidth=0.6, zorder=3)
            if w >= 5.5:
                ax.text(left + w / 2, yi, str(c), ha='center', va='center', fontsize=TICK_PT,
                        color='white' if k >= 3 else INK, zorder=4)
            left += w
        before = 100.0 * sum(counts[:3]) / n
        ax.text(103, yi, f'{before:.0f}%', ha='left', va='center', fontsize=TEXT_PT, color=TICK, zorder=4)
    top = len(rows) - 0.4
    ax.text(103, top + 0.02, 'Before\nvideo', ha='left', va='bottom', fontsize=TICK_PT, color=MUTED,
            linespacing=1.1, zorder=4)
    ax.set_yticks(y, [f'{name}  (n = {sum(c)})' for name, c in rows])
    ax.set_ylim(-0.6, top)
    ax.set_xticks([0, 25, 50, 75, 100], ['0', '25', '50', '75', '100%'])
    ax.set_xlim(0, 100)
    categorical_y(ax)
    save_post(fig, OUT / stem)


def fig5_years():
    stacked_shares(YEAR_ROWS, 'fig5_years', 'Share of the year’s benchmarks, by breaking level')


def fig6_groups():
    stacked_shares(GROUP_ROWS, 'fig6_groups', 'Share of the group’s benchmarks, by breaking level')


# --- Figure 7: the screening chain --------------------------------------------------------------------
# Figure 1 of the paper (fig_teaser_treemap.pdf, bottom): items after each stage, from the 505,518
# pooled items of the 112 screened benchmarks to the 840 items of Video-Index.
STAGES = [('All items', 505518), ('Multiple choice', 381614), ('Distinct questions', 269930),
          ('Not from the options', 191092), ('Not answered blind', 145047), ('Not from one frame', 97077),
          ('Not by the 2B model', 65818), ('Unique across benchmarks', 63630),
          ('Labelled and complete', 62142), ('Video-Index', 840)]


def fig7_screen():
    fig, axes = canvas(rows=1, cols=1, panel_height=0.22 * len(STAGES) + 0.2, xlabel='Items, log scale',
                       extra=(-0.16, 0.5, 0, 0), **WEB)
    ax = axes[0, 0]
    y = np.arange(len(STAGES))[::-1]
    v = [n for _, n in STAGES]
    ax.set_xscale('log')
    ax.plot(v, y, color=GREY_400, lw=1.0, zorder=2)
    ax.plot(v, y, 'o', color=BLUE, ms=4.2, zorder=3)
    for yi, n in zip(y, v):
        ax.text(n * 1.3, yi, f'{n:,}', va='center', ha='left', fontsize=TEXT_PT, color=TICK, zorder=4)
    ax.set_yticks(y, [s for s, _ in STAGES])
    ax.set_ylim(-0.6, len(STAGES) - 0.4)
    ax.set_xticks([1e3, 1e4, 1e5, 1e6], ['1,000', '10,000', '100,000', '1,000,000'])
    ax.set_xticks([], minor=True)
    ax.set_xlim(500, 2.5e6)
    categorical_y(ax)
    save_post(fig, OUT / 'fig7_screen')


# --- Figure 8: Video-Index results --------------------------------------------------------------------
# Table 1 of the paper: video accuracy in % on the 840 items; fixed input = at most 512 frames at 1 fps,
# agent tools = local tools on the same 2-fps videos; the human row averages five volunteers.
FIXED, AGENT, HUMAN = tone('blue', 400), tone('red', 400), GREY_400
RESULTS = [('GPT-6-Astra', 79.3, AGENT), ('Claude Fable 5.1', 71.5, AGENT), ('Claude Opus 5, agent', 70.6, AGENT),
           ('Claude Opus 5, fixed input', 56.8, FIXED), ('Human volunteers', 55.0, HUMAN),
           ('Gemini 3.1 Pro', 54.7, AGENT), ('Gemini 3.5 Flash-Lite', 22.5, AGENT), ('Molmo2-8B', 19.0, FIXED),
           ('InternVL3.5-8B', 15.2, FIXED), ('LLaVA-OneVision-2-8B', 14.2, FIXED), ('VideoLLaMA3-7B', 12.4, FIXED),
           ('Video-XL-2', 12.4, FIXED), ('InternVideo2.5-8B', 12.4, FIXED), ('Cambrian-S-7B', 11.3, FIXED),
           ('Qwen3-VL-8B', 9.5, FIXED), ('VideoChat3-4B', 9.4, FIXED)]


def fig8_results():
    fig, axes = canvas(rows=1, cols=1, panel_height=0.19 * len(RESULTS) + 0.2, xlabel='Accuracy on Video-Index (%)',
                       legend=[('Fixed input', FIXED, 'box'), ('Agent tools', AGENT, 'box'), ('Human', HUMAN, 'box')],
                       extra=(-0.16, 0.2, 0, 0), **WEB)
    ax = axes[0, 0]
    y = np.arange(len(RESULTS))[::-1]
    ax.barh(y, [v for _, v, _ in RESULTS], 0.66, color=[c for _, _, c in RESULTS], zorder=3)
    for yi, (_, v, _) in zip(y, RESULTS):
        ax.text(v + 1.2, yi, f'{v:.1f}', va='center', ha='left', fontsize=TICK_PT, color=TICK, zorder=4)
    ax.set_yticks(y, [n for n, _, _ in RESULTS])
    ax.set_ylim(-0.6, len(RESULTS) - 0.4)
    ax.set_xticks([0, 20, 40, 60, 80])
    ax.set_xlim(0, 88)
    categorical_y(ax)
    save_post(fig, OUT / 'fig8_results')


# --- Cover: the pyramid, sized by the benchmarks that reach each level --------------------------------
# Figure 6 of the paper (left): 115 reach the option level, 98 the text level, 85 the pool level, 80 the
# frame level, 53 the order level, and 38 survive every level.
REACH = [('Option', 115), ('Text', 98), ('Pool', 85), ('Frame', 80), ('Order', 53)]


def cover():
    import matplotlib.pyplot as plt
    W, H, DPI = 8.6, 4.8, 320                       # 2752 x 1536 px, the blog card's size
    fig = plt.figure(figsize=(W, H), dpi=DPI)
    fig.patch.set_facecolor('#F3F2ED')
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.axis('off')
    cx, base_w, layer_h, gap = W / 2, 4.6, 0.56, 0.06
    y0 = 0.62
    for k, (name, n) in enumerate(REACH):
        w_lo = base_w * n / 115
        w_hi = base_w * (REACH[k + 1][1] if k + 1 < len(REACH) else 38) / 115
        yb, yt = y0 + k * (layer_h + gap), y0 + k * (layer_h + gap) + layer_h
        ax.add_patch(Polygon([(cx - w_lo / 2, yb), (cx + w_lo / 2, yb), (cx + w_hi / 2, yt), (cx - w_hi / 2, yt)],
                             closed=True, facecolor=RAMP[k], edgecolor='none'))
        ax.text(cx, (yb + yt) / 2, name, ha='center', va='center', fontsize=13, weight='medium',
                color='white' if k >= 2 else INK)
        ax.text(cx + w_lo / 2 + 0.18, yb + 0.02, f'{n}', ha='left', va='bottom', fontsize=9.5, color=TICK)
    ytop = y0 + len(REACH) * (layer_h + gap)
    ax.text(cx, ytop + 0.16, '38 survive every level', ha='center', va='bottom', fontsize=10.5, color=MUTED)
    fig.savefig(OUT / 'cover.png', dpi=DPI, facecolor=fig.get_facecolor())


if __name__ == '__main__':
    for f in (fig1_census, fig3_profiles, fig4_levels, fig5_years, fig6_groups, fig7_screen, fig8_results, cover):
        f()
        print('wrote', f.__name__)
