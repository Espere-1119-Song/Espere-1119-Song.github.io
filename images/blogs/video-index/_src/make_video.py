"""The overview video of the Video-Index post: eight short scenes drawn with matplotlib and piped to
ffmpeg (H.264, 1920 x 1080, 30 fps, about 46 seconds), plus a poster frame.

Every number is transcribed from the paper (Sections 1, 3, 4 and 5, Table 1). The look follows the
post's charts: Instrument Sans (from the plot skill of github.com/wenhaochai/claude-plugins), Google's
GM2 blues for the pyramid levels, red for a break, grey for context, on the site's parchment.

Usage: PLOT_SKILL=<claude-plugins>/writing/skills/plot python3 make_video.py
Output: ../overview.mp4 and ../overview-poster.jpg
"""
import os
import subprocess
import sys
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt                      # noqa: E402
import numpy as np                                    # noqa: E402
from matplotlib import font_manager                   # noqa: E402
from matplotlib.patches import FancyBboxPatch, Polygon, Rectangle  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
PLOT = Path(os.environ.get('PLOT_SKILL', HERE / 'claude-plugins' / 'writing' / 'skills' / 'plot'))
for f in (PLOT / 'fonts').glob('*.ttf'):
    font_manager.fontManager.addfont(str(f))
plt.rcParams['font.family'] = 'Instrument Sans'

W, H, FPS = 1920, 1080, 30
BG, INK, MUTED, TICK, GRID, RULE = '#F4F7FC', '#202124', '#5F6368', '#3C4043', '#E3E6EC', '#D6DAE2'
RAMP = ['#AECBFA', '#8AB4F8', '#669DF6', '#4285F4', '#1A73E8', '#174EA6']
BLUE, RED, RED_SOFT, GREY, GREY_SOFT = '#1A73E8', '#D93025', '#EE675C', '#80868B', '#BDC1C6'
LEVELS = ['Option', 'Text', 'Pool', 'Frame', 'Order']
SEES = ['sees the answer options', 'adds the question', 'adds the other evaluated items',
        'adds one frame or captions', 'adds the video, shuffled or a tenth']
REACH = [115, 98, 85, 80, 53]

fig = plt.figure(figsize=(W / 100, H / 100), dpi=100)
fig.patch.set_facecolor(BG)


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def ease(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def seg(t, t0, dur):
    """Progress 0..1 of an animation that starts at t0 and lasts dur seconds."""
    return clamp((t - t0) / dur)


def canvas():
    fig.clf()
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.axis('off')
    ax.set_facecolor(BG)
    return ax


def text(ax, x, y, s, size=28, color=INK, weight='regular', ha='left', va='baseline', alpha=1.0, **kw):
    if alpha <= 0:
        return
    ax.text(x, y, s, fontsize=size, color=color, weight=weight, ha=ha, va=va, alpha=alpha, **kw)


def fade_overlay(ax, alpha):
    if alpha > 0:
        ax.add_patch(Rectangle((0, 0), W, H, facecolor=BG, edgecolor='none', alpha=clamp(alpha), zorder=50))


def fmt_int(v):
    return f'{int(round(v)):,}'


# --- scenes: each draws its state at time t (seconds into the scene) -----------------------------------
def scene_title(ax, t):
    a1, a2 = ease(seg(t, 0.2, 0.9)), ease(seg(t, 0.9, 0.9))
    text(ax, W / 2, 600 + 20 * (1 - a1), 'Which Video Benchmarks', 78, weight='semibold', ha='center', alpha=a1)
    text(ax, W / 2, 500 + 20 * (1 - a1), 'Still Need the Video?', 78, weight='semibold', ha='center', alpha=a1)
    text(ax, W / 2, 400, 'Five attacks on 115 video benchmarks, and the 840 questions that survive them',
         30, color=MUTED, ha='center', alpha=a2)
    text(ax, W / 2, 330, 'Video-Index · Enxin Song', 22, color=GREY, ha='center', alpha=a2)


def scene_census(ax, t):
    text(ax, W / 2, 900, 'Video benchmarks, in the past five years', 40, weight='semibold', ha='center',
         alpha=ease(seg(t, 0.0, 0.6)))
    items = [(605, 'video benchmarks released', 0.4), (342, 'of them with public data', 1.5),
             (115, 'multiple-choice benchmarks audited', 2.6)]
    xs = [W / 2 - 560, W / 2, W / 2 + 560]
    for (n, label, t0), x in zip(items, xs):
        p = ease_out(seg(t, t0, 1.1))
        if p <= 0:
            continue
        text(ax, x, 560, fmt_int(n * p), 150, color=BLUE, weight='semibold', ha='center', alpha=min(1, p * 3))
        text(ax, x, 470, label, 27, color=MUTED, ha='center', alpha=min(1, p * 3))
    a = ease(seg(t, 3.9, 0.8))
    text(ax, W / 2, 300, '528,172 questions over 123,281 videos', 30, color=INK, ha='center', alpha=a)
    text(ax, W / 2, 250, 'Each was built against the models of its year.', 26, color=MUTED, ha='center', alpha=a)


def scene_pyramid(ax, t):
    text(ax, 140, 940, 'The attack pyramid', 46, weight='semibold', alpha=ease(seg(t, 0, 0.6)))
    text(ax, 140, 885, 'Five attackers with growing access to an item, none with the claimed capability',
         24, color=MUTED, alpha=ease(seg(t, 0.3, 0.6)))
    cx, base_w, layer_h, gap, y0 = 700, 900, 118, 10, 150
    for k in range(5):
        p = ease_out(seg(t, 0.8 + 0.6 * k, 0.6))
        if p <= 0:
            continue
        w_lo = base_w * REACH[k] / 115
        w_hi = base_w * (REACH[k + 1] if k + 1 < 5 else 38) / 115
        yb = y0 + k * (layer_h + gap) - 30 * (1 - p)
        yt = yb + layer_h
        ax.add_patch(Polygon([(cx - w_lo / 2, yb), (cx + w_lo / 2, yb), (cx + w_hi / 2, yt), (cx - w_hi / 2, yt)],
                             closed=True, facecolor=RAMP[k], edgecolor='none', alpha=p))
        text(ax, cx, (yb + yt) / 2, LEVELS[k], 34, color='white' if k >= 2 else INK, weight='semibold',
             ha='center', va='center', alpha=p)
        text(ax, 1240, (yb + yt) / 2, SEES[k], 27, color=INK, va='center', alpha=p)
        q = ease(seg(t, 4.2 + 0.25 * k, 0.5))
        text(ax, cx - w_lo / 2 - 30, yb + 12, f'{REACH[k]} reach', 24, color=TICK, ha='right', alpha=q)
    a = ease(seg(t, 5.6, 0.7))
    ytop = y0 + 5 * (layer_h + gap)
    text(ax, cx, ytop + 20, '38 survive every level', 30, color=RAMP[5], weight='semibold', ha='center', alpha=a)


def ladder(ax, t, name, eps, bar, brk, note, t0=0.0):
    """Five bars grow one after another; the one that reaches the dashed bar turns red."""
    a = ease(seg(t, t0, 0.5))
    text(ax, 140, 940, name, 46, weight='semibold', alpha=a)
    text(ax, 140, 885, 'Exploitability at each level, in points over chance', 24, color=MUTED, alpha=a)
    x0, x1, y_base, y_top = 260, 1640, 220, 760
    scale = (y_top - y_base) / 70.0
    for g in (0, 20, 40, 60):
        ax.plot([x0, x1], [y_base + g * scale] * 2, color=GRID, lw=1.2, alpha=a, zorder=1)
        text(ax, x0 - 16, y_base + g * scale, str(g), 20, color=TICK, ha='right', va='center', alpha=a)
    ax.plot([x0, x1], [y_base] * 2, color=TICK, lw=1.6, alpha=a, zorder=2)
    ax.plot([x0, x1], [y_base + bar * scale] * 2, color=GREY, lw=2.2, ls=(0, (7, 5)), alpha=a, zorder=3)
    text(ax, x0 + 8, y_base + bar * scale + 10, 'bar = reference − chance − 5', 20, color=GREY, ha='left', alpha=a)
    slot = (x1 - x0) / 5
    broke = False
    for k in range(5):
        p = ease_out(seg(t, t0 + 0.6 + 0.55 * k, 0.55))
        cx = x0 + slot * (k + 0.5)
        text(ax, cx, y_base - 34, LEVELS[k], 24, color=TICK, ha='center', alpha=a)
        if p <= 0:
            continue
        h = eps[k] * p * scale
        hit = (brk is not None and k == brk and eps[k] * p >= bar)
        broke = broke or hit
        color = RED if (brk is not None and k >= brk and eps[k] * p >= bar and k == brk) else (RAMP[k] if not (brk is not None and k > brk) else GREY_SOFT)
        ax.add_patch(Rectangle((cx - slot * 0.28, y_base), slot * 0.56, h, facecolor=color, edgecolor='none', zorder=4))
        if p >= 1:
            text(ax, cx, y_base + h + 10, f'{eps[k]:.1f}', 22, color=RED if color == RED else TICK, ha='center', weight='semibold' if color == RED else 'regular')
    q = ease(seg(t, t0 + 0.6 + 0.55 * (brk if brk is not None else 5) + 0.5, 0.6))
    if q > 0:
        label, color = note, RED if brk is not None else RAMP[5]
        ax.add_patch(Rectangle((x0, 786), 10, 28, facecolor=color, edgecolor='none', alpha=q, zorder=5))
        text(ax, x0 + 24, 800, label, 28, color=color, weight='semibold', va='center', alpha=q, zorder=6)


def scene_ladder(ax, t):
    if t < 4.6:
        ladder(ax, t, 'MMWorld, knowledge questions on videos', [36.2, 52.3, 52.3, 54.8, 56.9], 43.5, 1,
               'Breaks at the text level: the question gives the answer away')
    else:
        ladder(ax, t, 'TVBench, temporal questions', [2.5, 6.8, 9.7, 16.3, 16.3], 24.5, None,
               'Unbroken: every attacker stays below the bar', t0=4.6)


def scene_year(ax, t):
    text(ax, 140, 940, 'Newer benchmarks break earlier', 46, weight='semibold', alpha=ease(seg(t, 0, 0.6)))
    text(ax, 140, 885, 'Share of benchmarks that break before any attacker sees a frame', 24, color=MUTED,
         alpha=ease(seg(t, 0.3, 0.6)))
    cols = [('Released through 2024', 26, 19, [4, 1, 0, 8, 4, 9], 0.8), ('Released in 2025 and 2026', 89, 34, [13, 12, 5, 19, 11, 29], 1.6)]
    xs = [560, 1360]
    for (label, n, pct, counts, t0), x in zip(cols, xs):
        p = ease_out(seg(t, t0, 1.2))
        if p <= 0:
            continue
        text(ax, x, 700, f'{int(round(pct * p))}%', 170, color=RED if pct > 30 else BLUE, weight='semibold', ha='center', alpha=min(1, 3 * p))
        text(ax, x, 610, f'{label} · {n} benchmarks', 26, color=MUTED, ha='center', alpha=min(1, 3 * p))
        left, width = x - 300, 600
        run = 0
        for k, c in enumerate(counts):
            wseg = width * c / n * p
            ax.add_patch(Rectangle((left + run, 470), wseg, 46, facecolor=RAMP[k], edgecolor='white', lw=1.2))
            run += wseg
        for k, name in enumerate(LEVELS + ['Unbroken']):
            text(ax, left + 100 * k, 430, name, 18, color=RAMP[k] if k < 5 else RAMP[5], weight='semibold', alpha=min(1, 3 * p))
    a = ease(seg(t, 3.4, 0.7))
    text(ax, W / 2, 300, 'The text and pool levels hold 17 of their 18 breaks in the newer releases.', 27, color=INK, ha='center', alpha=a)


SCREEN = [('All items', 505518), ('Multiple choice', 381614), ('Distinct questions', 269930),
          ('Not from the options', 191092), ('Not answered blind', 145047), ('Not from one frame', 97077),
          ('Not by the 2B model', 65818), ('Unique across benchmarks', 63630), ('Labelled and complete', 62142),
          ('Video-Index', 840)]


def scene_screen(ax, t):
    text(ax, 140, 940, 'Screening keeps 840 of 505,518 items', 46, weight='semibold', alpha=ease(seg(t, 0, 0.6)))
    text(ax, 140, 885, 'Items remaining after each stage, bars on a log scale', 24, color=MUTED, alpha=ease(seg(t, 0.3, 0.6)))
    x0, xmax = 560, 1700
    lo, hi = np.log10(500), np.log10(600000)
    for k, (stage, n) in enumerate(SCREEN):
        p = ease_out(seg(t, 0.6 + 0.38 * k, 0.5))
        if p <= 0:
            continue
        y = 790 - k * 62
        wbar = (xmax - x0) * (np.log10(n) - lo) / (hi - lo) * p
        last = k == len(SCREEN) - 1
        ax.add_patch(Rectangle((x0, y - 20), wbar, 40, facecolor=RAMP[5] if last else RAMP[3], edgecolor='none', alpha=p))
        text(ax, x0 - 18, y, stage, 24, color=INK if last else TICK, ha='right', va='center', weight='semibold' if last else 'regular', alpha=p)
        text(ax, x0 + wbar + 14, y, fmt_int(n * p) if not last else fmt_int(n), 22, color=INK, va='center', weight='semibold' if last else 'regular', alpha=p)
    a = ease(seg(t, 4.8, 0.7))
    text(ax, W / 2, 110, 'Answers verified against the frames · 210 items per capability group · one per video', 25, color=MUTED, ha='center', alpha=a)


RESULTS = [('GPT-6-Astra · agent tools', 79.3, RED_SOFT), ('Claude Fable 5.1 · agent tools', 71.5, RED_SOFT),
           ('Claude Opus 5 · agent tools', 70.6, RED_SOFT), ('Claude Opus 5 · fixed input', 56.8, RAMP[3]),
           ('Human volunteers', 55.0, GREY_SOFT), ('Gemini 3.1 Pro · agent tools', 54.7, RED_SOFT),
           ('Molmo2-8B · best open model', 19.0, RAMP[3])]


def scene_results(ax, t):
    text(ax, 140, 940, 'Agents lead open models on Video-Index', 46, weight='semibold', alpha=ease(seg(t, 0, 0.6)))
    text(ax, 140, 885, 'Accuracy on the 840 items, in %', 24, color=MUTED, alpha=ease(seg(t, 0.3, 0.6)))
    x0, xmax = 640, 1720
    for k, (name, v, color) in enumerate(RESULTS):
        p = ease_out(seg(t, 0.6 + 0.4 * k, 0.8))
        if p <= 0:
            continue
        y = 760 - k * 84
        wbar = (xmax - x0) * v / 100 * p
        ax.add_patch(Rectangle((x0, y - 26), wbar, 52, facecolor=color, edgecolor='none'))
        text(ax, x0 - 18, y, name, 25, color=INK, ha='right', va='center', alpha=min(1, 3 * p))
        text(ax, x0 + wbar + 14, y, f'{v * p:.1f}', 25, color=INK, va='center', weight='semibold')
    a = ease(seg(t, 4.2, 0.7))
    text(ax, W / 2, 120, 'Same fixed input: Claude Opus 5 leads every open model by more than 37 points. Tools add 19.8 more.', 25, color=MUTED, ha='center', alpha=a)


def scene_end(ax, t):
    a1, a2 = ease(seg(t, 0.1, 0.8)), ease(seg(t, 0.8, 0.8))
    text(ax, W / 2, 600, 'Video-Index', 96, color=INK, weight='semibold', ha='center', alpha=a1)
    text(ax, W / 2, 510, '840 verified questions from 76 benchmarks', 32, color=MUTED, ha='center', alpha=a2)
    text(ax, W / 2, 440, 'enxinsong.com/blog/video-index', 28, color=BLUE, ha='center', alpha=a2)


SCENES = [(scene_title, 4.5), (scene_census, 5.5), (scene_pyramid, 7.5), (scene_ladder, 8.5),
          (scene_year, 5.5), (scene_screen, 7.0), (scene_results, 7.5), (scene_end, 4.0)]
FADE = 0.45


def frame(t_global):
    t = t_global
    for fn, dur in SCENES:
        if t < dur:
            ax = canvas()
            fn(ax, t)
            fade_overlay(ax, max(0.0, 1 - t / FADE) if t < FADE else max(0.0, (t - (dur - FADE)) / FADE) if t > dur - FADE else 0.0)
            return True
        t -= dur
    return False


def main():
    total = sum(d for _, d in SCENES)
    n = int(total * FPS)
    proc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}',
                             '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
                             '-preset', 'medium', '-movflags', '+faststart', str(OUT / 'overview.mp4')], stdin=subprocess.PIPE)
    poster_done = False
    for i in range(n):
        t = i / FPS
        frame(t)
        fig.canvas.draw()
        buf = np.asarray(fig.canvas.buffer_rgba())
        proc.stdin.write(buf.tobytes())
        if not poster_done and t >= 4.5 + 5.5 + 6.9:          # the finished pyramid
            fig.savefig(OUT / 'overview-poster.jpg', dpi=100, pil_kwargs={'quality': 88})
            poster_done = True
        if i % 300 == 0:
            print(f'frame {i}/{n}', flush=True)
    proc.stdin.close()
    proc.wait()
    print('wrote', OUT / 'overview.mp4', 'and the poster;', n, 'frames,', f'{total:.1f} s')


if __name__ == '__main__':
    main()
