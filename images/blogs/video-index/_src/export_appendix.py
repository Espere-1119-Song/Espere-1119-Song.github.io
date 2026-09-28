"""Export the appendix material of the Video-Index paper that the post shows interactively.

Reads the paper repository's presentation tables (fig_tex/presentation/*.tex) for Tables 7, 8, 11, 12,
14 to 20, 34 to 38 and 48 to 50, runs figs/scripts/fig_f9_frames_pixels_panels.py (Figure Q1) with its
output sent to a temporary folder to record where each benchmark's line sits in the paper's figure,
records Figure 8's dots and ticks and the dots of the post's one-panel Figure 9 (fig09_longvideo_left.py)
for hover regions, lists the report cards of Appendix X, and adds example question pairs to the duplicate flows of Table 11
from dup_examples.json (exp/results/duplicates_detail.jsonl on the cluster, summarised by dup_examples.py).
Writes js/video-index-appendix-data.js, which sets window.VI_APPX.

Before anything is written, every table is checked against its header and row count, every benchmark
name against the 115 of js/video-index-data.js, the Figure Q1 lines against the stroked paths of
figs/fig_f9_frames_pixels_panels.pdf, the duplicate examples against the counts of Table 11, and the
report cards against the PNGs of render_report_cards.py.

Usage: python3 export_appendix.py <paper repo>
"""
import contextlib
import csv
import io
import json
import re
import runpy
import sys
import tempfile
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import numpy as np  # noqa: E402
import pymupdf as fitz       # noqa: E402

REPO = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Downloads/apex_paper').resolve()
HERE = Path(__file__).resolve().parent
SITE = HERE.parents[3]
OUT = SITE / 'js' / 'video-index-appendix-data.js'
PRES = REPO / 'fig_tex' / 'presentation'
SCRIPTS = REPO / 'figs' / 'scripts'
CARDS = HERE.parent / 'cards'
sys.path.insert(0, str(SCRIPTS))

vi = (SITE / 'js' / 'video-index-data.js').read_text(encoding='utf-8')
VI = json.loads(vi[vi.index('{'):vi.rindex('}') + 1])
NAMES = {b['name'] for b in VI['benchmarks']}
assert len(NAMES) == 115, len(NAMES)


def slug(name):
    """File name of a benchmark's report card; render_report_cards.py uses the same rule."""
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


# --- the presentation tables ---------------------------------------------------------------------------
def braced(s, i):
    """Content of the brace group opening at s[i], and the index after it."""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '{':
            depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0:
                return s[i + 1:j], j + 1
    raise ValueError('unbalanced braces')


def untex(c):
    c = c.strip()
    while True:
        m = re.search(r'\\shortstack(?:\[[a-z]\])?\{', c)
        if not m:
            break
        inner, end = braced(c, m.end() - 1)
        c = c[:m.start()] + inner.replace('\\\\', ' ') + c[end:]
    c = re.sub(r'\\mbox\{([^}]*)\}', r'\1', c)
    c = re.sub(r'\\citep\{[^}]*\}', '', c)
    c = c.replace('\\%', '%').replace('$^\\dagger$', '')
    c = re.sub(r'\$([^$]*)\$', r'\1', c)
    return re.sub(r'\s+', ' ', c).strip()


def cells(line):
    return [untex(c) for c in re.split(r'(?<!\\)&', line)]


def num(c):
    if c in ('--', ''):
        return None
    if re.fullmatch(r'[+-]?\d+', c):
        return int(c)
    if re.fullmatch(r'[+-]?\d*\.\d+', c):
        return float(c)
    return c


def tables(fname):
    """{label: (caption, raw header, rows of cleaned cells)} for every captioned table of a file."""
    s = (PRES / fname).read_text(encoding='utf-8')
    starts = [m.start() for m in re.finditer(r'\\caption\{', s)]
    out = {}
    for k, i in enumerate(starts):
        cap, j = braced(s, i + len('\\caption'))
        chunk = s[j:starts[k + 1] if k + 1 < len(starts) else len(s)]
        label = re.match(r'\s*\\label\{([^}]*)\}', chunk).group(1)
        head, rows = None, []
        for line in chunk.split('\n'):
            line = re.split(r'(?<!\\)%', line, 1)[0].strip()
            if line.startswith('\\rowcolor{SkillPaleBlue}'):
                if head is None:
                    head = re.sub(r'\s*\\\\$', '', line[len('\\rowcolor{SkillPaleBlue}'):]).strip()
                continue
            if not line.endswith('\\\\') or '&' not in line or line.startswith(('\\multicolumn', '\\rowcolor')):
                continue
            rows.append(cells(line[:-2]))
        out[label] = (untex(cap), head, rows)
    return out


DECIMALS = {}   # (label, column) -> the most decimals the paper prints in that column


def load(fname, label, header, width, count=None, raw=False):
    """Caption and rows of one table; cells become numbers unless raw, where they stay as the paper prints them."""
    cap, head, rows = tables(fname)[label]
    assert head == header, (label, head)
    assert all(len(r) == width for r in rows), (label, [r for r in rows if len(r) != width][:2])
    assert count is None or len(rows) == count, (label, len(rows), count)
    for j in range(1, width):
        DECIMALS[label, j] = max((len(r[j].split('.')[1]) for r in rows if re.fullmatch(r'[+-]?\d*\.\d+', r[j])), default=0)
    if raw:
        return cap, [[c.replace('--', '–') for c in r] for r in rows]
    return cap, [[r[0]] + [num(c) for c in r[1:]] for r in rows]


def decimals(label, width):
    return [DECIMALS[label, j] for j in range(1, width)]


def benchmark_rows(fname, label, header, width, count=None):
    cap, rows = load(fname, label, header, width, count)
    unknown = [r[0] for r in rows if r[0] not in NAMES]
    assert not unknown, (label, unknown)
    return cap, rows


T, CAPS = {}, {}
CAPS[7], T[7] = benchmark_rows('e1_five_conditions.tex', 'tab:e1', 'Benchmark & blind & 1f & 32f', 4)
CAPS[8], T[8] = benchmark_rows('e1_five_conditions.tex', 'tab:e1_cols2', 'Benchmark & 32f & video cap. & Frame cap. & Cov.', 5)
assert [r[0] for r in T[7]] == [r[0] for r in T[8]]
CAPS[11], T[11] = load('duplicate_pairs.tex', 'tab:dups', 'Benchmark A & Benchmark B & Pairs & Exact', 4, 30)
CAPS[12], T[12] = load('tab_duplicate_share.tex', 'tab:dupshare', 'Items of & PA & PU & KF & LV & VK & VS & SI & VU & MM & SV & VM & VC', 13, 12)
CAPS[14], T[14] = benchmark_rows('t2_eps_by_benchmark.tex', 'tab:t2eps', 'Benchmark & $n$ & $\\varepsilon_{\\mathrm{pool}}^{\\mathrm{w}}$ & Att.$^{\\mathrm{w}}$ & ALC$^{\\mathrm{w}}$', 5)
CAPS[15], T[15] = benchmark_rows('t2_eps_by_benchmark.tex', 'tab:t2eps_cols2', 'Benchmark & $n$ & $\\varepsilon_{\\mathrm{pool}}^{\\mathrm{c}}$ & Att.$^{\\mathrm{c}}$', 4)
CAPS[16], T[16] = benchmark_rows('diversity.tex', 'tab:diversity', 'Benchmark & VS/n & NearDup \\% & SameVid \\% & TemplEnt & AnsPosEnt & EffN', 7, 114)
CAPS[17], T[17] = benchmark_rows('p1_condition_accuracies.tex', 'tab:p1acc', 'Benchmark & blind & 1f & 32f & 448px & 224px & 128f & shuf & half1 & half2 & off1 & off2', 12)
CAPS[18], T[18] = benchmark_rows('p2_profiles.tex', 'tab:profiles', 'Benchmark & $m$ & $S$ & $T_{coarse}$ & $O$ & $L$ & PosBias & $\\Phi_{flip}$ & PriorDom', 9)
CAPS[19], T[19] = benchmark_rows('e1b_probes.tex', 'tab:e1b', 'Benchmark & 8f & 32f & 128f & Window ret. & Shuffle ret.', 6, 91)   # the caption says 88
CAPS[20], T[20] = benchmark_rows('long_video_budget.tex', 'tab:lvbudget', 'Benchmark & $n$ & Chance & 32f & 128f & 512f & 600f & Med. frames & Sat.', 9, 30)
for k, label in zip((34, 35, 36, 37), ('tab:rankperception', 'tab:ranktemporal', 'tab:rankspatial', 'tab:rankreasoning')):
    CAPS[k], rows = load('tab_group_ranking.tex', label, 'Rank & Benchmark & Level & Margin', 4, 10, raw=True)
    assert [r[0] for r in rows] == [str(i) for i in range(1, 11)], rows
    assert all(r[1] in NAMES and r[2] in ('Survives', 'Option', 'Text', 'Pool', 'Frame', 'Order') and re.fullmatch(r'[+-]\d+\.\d', r[3]) for r in rows), rows
    T[k] = [[r[1], r[2], r[3]] for r in rows]
CAPS[38], rows = load('metahard_leaderboard_attrs.tex', 'tab:metahardattrs', 'Model & Overall & Blind & Gain & Long video & First person & Authenticity', 7, 11, raw=True)
assert rows[-1][0] == 'Items', rows[-1]
T[38] = {'rows': rows[:-1], 'items': rows[-1][1:]}
CAPS[48], T[48] = load('tab_agent_behaviour.tex', 'tab:agentbehaviour', 'Measure & Astra & Fable 5.1 & Gemini 3.1 Pro & Flash-Lite & Opus 5', 6, 12, raw=True)
CAPS[49], T[49] = load('tab_agent_strategy.tex', 'tab:agentstrategy', 'Strategy & \\shortstack{Astra} & \\shortstack{Fable\\\\5.1} & \\shortstack{Gemini\\\\3.1 Pro} & \\shortstack{Flash-Lite} & \\shortstack{Opus 5}', 6, 7, raw=True)
CAPS[50], rows = load('tab_agent_strategy.tex', 'tab:agentduration', '\\shortstack{Video\\\\duration} & Agent & Strategy & \\shortstack{Share\\\\(\\%)} & Images & \\shortstack{Acc.\\\\(\\%)}', 6, 20, raw=True)
t50, dur = [], None
for r in rows:
    if r[0]:
        m = re.fullmatch(r'(.+) \((\d+) items\)', r[0])
        dur = [m.group(1), int(m.group(2))]
    t50.append(dur + r[1:])
T[50] = t50

# the paper's Table 38 names the fixed-input Claude row by its API id; the post uses Table 1's name for it
T[38]['rows'] = [[{'claude-opus-5': 'Claude Opus 5'}.get(r[0], r[0])] + r[1:] for r in T[38]['rows']]

# Table 12's columns follow its rows, and its caption spells out the codes
codes = re.findall(r'\b([A-Z]{2}) ([^,.]+)', CAPS[12].split('row order are ')[1])
assert [c for c, _ in codes] == 'PA PU KF LV VK VS SI VU MM SV VM VC'.split(), codes
assert [n for _, n in codes] == [r[0] for r in T[12]], (codes, [r[0] for r in T[12]])
T[12] = {'codes': [c for c, _ in codes], 'rows': T[12]}

# --- example questions for the duplicate flows of Table 11 ------------------------------------------------
CLUSTER = {'PAIBench-U': 'PAI-Bench-U', 'PhysicalAI-Understanding': 'PhysicalAI', 'SiteBench-Video': 'SITE-Bench',
           'VideoMMMU': 'Video-MMMU', 'SpatialTreeBench': 'SpatialTree', 'PerceptionTest': 'Perception Test'}
dups = json.load(open(HERE / 'dup_examples.json', encoding='utf-8'))
by_pair = {}
for p in dups['top']:
    a, b = (CLUSTER.get(x, x) for x in p['pair'])
    by_pair[frozenset((a, b))] = p
t11 = []
for a, b, pairs, exact in T[11]:
    p = by_pair[frozenset((a, b))]
    assert (p['pairs'], p['exact']) == (pairs, exact), (a, b, p['pairs'], p['exact'], pairs, exact)

    def oriented(e):    # the example's two questions in the order of the table row
        return (e['ta'], e['tb']) if CLUSTER.get(e['a'], e['a']) == a else (e['tb'], e['ta'])
    near = [list(oriented(e)) + [round(e['bge'], 3), round(e['mpnet'], 3)] for e in p['near_examples']]
    same = [list(oriented(e)) for e in p['exact_examples']]
    t11.append([a, b, pairs, exact, near, same])
T[11] = t11
for k, label, width in ((7, 'tab:e1', 4), (8, 'tab:e1_cols2', 5), (14, 'tab:t2eps', 5), (15, 'tab:t2eps_cols2', 4), (16, 'tab:diversity', 7),
                        (17, 'tab:p1acc', 12), (18, 'tab:profiles', 9), (19, 'tab:e1b', 6), (20, 'tab:lvbudget', 9)):
    T[k] = {'rows': T[k], 'dec': decimals(label, width)}

# --- Figure Q1: where each benchmark's line sits in the paper's figure --------------------------------------
def figure_q1():
    import _figure_header
    save = _figure_header.save_with_header_spacing
    tmp = Path(tempfile.mkdtemp(prefix='q1_'))
    _figure_header.save_with_header_spacing = lambda fig, path, **k: save(fig, tmp / Path(path).name, **k)
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            g = runpy.run_path(str(SCRIPTS / 'fig_f9_frames_pixels_panels.py'), run_name='q1_capture')
    finally:
        _figure_header.save_with_header_spacing = save
    fig, axs, rows, reg, D = g['fig'], g['axs'], g['rows'], g['reg'], g['D']
    W, H, dpi = fig.get_figwidth() * 72, fig.get_figheight() * 72, fig.dpi
    renderer = fig.canvas.get_renderer()

    def pt(xy):
        return [[round(x * 72 / dpi, 2), round(H - y * 72 / dpi, 2)] for x, y in xy]

    def box(bb):
        return [round(bb.x0 * 72 / dpi, 2), round(H - bb.y1 * 72 / dpi, 2), round(bb.width * 72 / dpi, 2), round(bb.height * 72 / dpi, 2)]
    order = sorted(rows, key=lambda t: abs(t[3]) >= D)            # the plotting order of the paper's script
    fp = {r['benchmark']: r for r in csv.DictReader(l for l in open(REPO / 'data' / 'frames_pixels.csv', encoding='utf-8') if not l.startswith('#'))}
    gain = g['g'] if 'g' in g else (lambda v: float(v) * (100 if abs(float(v)) <= 1.0 else 1))
    colour = {g['PENNBLUE']: 'frames', g['PENNRED']: 'pixels', g['RULEGREY']: 'within'}
    lines = []
    for k, t in enumerate(order):
        pref = 'frames' if t[3] <= -D else 'pixels' if t[3] >= D else 'within'
        pts = []
        for ax in axs:
            ln = ax.lines[k]
            assert colour[ln.get_color()] == pref, (t[0], ln.get_color(), pref)
            pts.append(pt(ax.transData.transform(ln.get_xydata())))
        pix, frm = gain(fp[t[0]]['res_gain']), gain(fp[t[0]]['fps_gain'])
        assert abs(pix - frm - t[3]) < 1e-6, (t[0], pix, frm, t[3])
        lines.append({'name': reg.get(t[0], t[0]), 'pref': pref, 'res': [round(v, 1) for v in t[1]], 'fps': [round(v, 1) for v in t[2]],
                      'pix': round(pix, 1), 'frm': round(frm, 1), 'pts': pts})
    assert all(len(ax.lines) == len(order) + 1 for ax in axs)       # plus the dashed zero line
    unknown = [ln['name'] for ln in lines if ln['name'] not in NAMES]
    assert not unknown, unknown
    labels = []
    for p, ax in enumerate(axs):
        for tx in ax.texts:
            if tx.get_text() in NAMES:
                labels.append({'name': tx.get_text(), 'panel': p, 'box': box(tx.get_window_extent(renderer))})
    axes = [box(ax.get_window_extent(renderer)) for ax in axs]

    # the captured geometry must be the paper's figure: every line matches a stroked path of the PDF
    page = fitz.open(REPO / 'figs' / 'fig_f9_frames_pixels_panels.pdf')[0]
    assert abs(page.rect.width - W) < 0.1 and abs(page.rect.height - H) < 0.1, (page.rect, W, H)
    paths = []
    for d in page.get_drawings():
        items = d['items']
        if items and all(it[0] == 'l' for it in items):
            paths.append([[items[0][1].x, items[0][1].y]] + [[it[2].x, it[2].y] for it in items])
    # the legend entries, read from the PDF: each handle is a short stroke just left of its label
    legend = []
    for text, key in (('Frame gain larger', 'frames'), ('Pixel gain larger', 'pixels'), ('Within 5%', 'within')):
        (r,) = page.search_for(text)
        handle = [d['rect'] for d in page.get_drawings() if d['type'] == 's' and d['rect'].height < 0.01
                  and r.y0 < d['rect'].y0 < r.y1 and 0 < r.x0 - d['rect'].x1 < 4]
        assert len(handle) == 1, (text, handle)
        x0 = handle[0].x0 - 1
        legend.append({'key': key, 'box': [round(x0, 2), round(r.y0 - 1, 2), round(r.x1 + 1 - x0, 2), round(r.height + 2, 2)]})
    for ln in lines:
        for p in ln['pts']:
            assert any(len(q) == len(p) and max(abs(a[0] - b[0]) + abs(a[1] - b[1]) for a, b in zip(p, q)) < 0.3 for q in paths), \
                'no drawn path for ' + ln['name']
    return {'w': round(W, 2), 'h': round(H, 2), 'axes': axes, 'legend': legend, 'labels': labels, 'lines': lines}



# --- Figure 8: each benchmark's better settings, over the paper's own figure -------------------------------
def figure8_regions():
    """Run figs/scripts/fig_f9_frames_pixels.py with its output sent to a temporary folder for its data, and read
    the dots (the survivors) and the rug ticks (the other benchmarks) from the paper's PDF, matched in x order."""
    import _figure_header
    save = _figure_header.save_with_header_spacing
    tmp = Path(tempfile.mkdtemp(prefix='fig8_'))
    _figure_header.save_with_header_spacing = lambda fig, path, **k: save(fig, tmp / Path(path).name, **k)
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            g = runpy.run_path(str(SCRIPTS / 'fig_f9_frames_pixels.py'), run_name='fig8_capture')
    finally:
        _figure_header.save_with_header_spacing = save
    rows, Pc, surv, reg = g['rows'], g['Pc'], g['surv'], g['reg']
    assert not g['PROV'], 'Figure 8 is on the provisional two-rung data'
    fp = {r['benchmark']: r for r in csv.DictReader(l for l in open(REPO / 'data' / 'frames_pixels.csv', encoding='utf-8') if not l.startswith('#'))}

    def acc(r, k):
        v = r.get(k, '')
        return None if v in ('', 'NA') else round(float(v) * 100, 1)
    page = fitz.open(REPO / 'figs' / 'fig_f9_frames_pixels.pdf')[0]
    dots, ticks = [], []
    for d in page.get_drawings():
        r, kinds = d['rect'], [it[0] for it in d['items']]
        if d.get('fill') and 'c' in kinds and r.width < 6 and r.height < 6:
            dots.append((round((r.x0 + r.x1) / 2, 2), round((r.y0 + r.y1) / 2, 2)))
        elif d['type'] == 's' and kinds == ['l'] and r.width < 0.01 and 0.5 < r.height < 6 and abs((d.get('width') or 0) - 0.8) < 0.01:
            ticks.append((round(r.x0, 2), round(r.y0, 2), round(r.y1, 2)))
    others = sorted((i for i in range(len(rows)) if i not in set(surv)), key=lambda i: Pc[i])
    assert len(dots) == len(surv) and len(ticks) == len(others), (len(dots), len(surv), len(ticks), len(others))
    dots.sort(); ticks.sort()
    # x grows linearly with the plotted value, so matched in order every mark sits where its value maps (0.3 pt)
    xs = [x for x, *_ in dots] + [x for x, *_ in ticks]
    vs = [float(Pc[i]) for i in surv] + [float(Pc[i]) for i in others]
    slope, icept = np.polyfit(vs, xs, 1)
    worst = max(abs(x - (slope * v + icept)) for x, v in zip(xs, vs))
    assert worst < 0.3, ('Figure 8 marks off their values by', worst)
    items = []

    def item(i, **where):
        b, pix, frm = rows[i]
        r = fp[b]
        items.append(dict(name=reg.get(b, {}).get('short_name', b), pix=round(pix, 1), frm=round(frm, 1),
                          res=[acc(r, k) for k in ('acc_s168', 'acc_s224', 'acc_s336', 'acc_s448', 'acc_store')],
                          fps=[acc(r, k) for k in ('acc_fps025', 'acc_fps05', 'acc_fps1', 'acc_fps2')], **where))
    for (x, y), i in zip(dots, surv):
        item(i, dot=[x, y])
    for (x, y0, y1), i in zip(ticks, others):
        item(i, tick=[x, y0, y1])
    for it in items:                                             # the gains follow from the ladders, as the paper defines them
        res, fps = [v for v in it['res'] if v is not None], it['fps']
        if res and it['res'][0] is not None:
            assert abs(max(res) - it['res'][0] - it['pix']) < 0.2, (it['name'], it['pix'], it['res'])
        if fps[0] is not None and fps[-1] is not None:
            assert abs(fps[-1] - fps[0] - it['frm']) < 0.2, (it['name'], it['frm'], fps)
    labels = []
    for it in items[:len(dots)]:
        hits = page.search_for(it['name'])
        if hits:
            assert len(hits) == 1, (it['name'], hits)
            h = hits[0]
            labels.append({'name': it['name'], 'box': [round(h.x0, 2), round(h.y0, 2), round(h.width, 2), round(h.height, 2)]})
    return {'w': round(page.rect.width, 2), 'h': round(page.rect.height, 2), 'items': items, 'labels': labels}


# --- Figure 9: the post's one-panel version, with each benchmark's dots --------------------------------------
def figure9_regions():
    from render_plain_figures import render
    tmp = Path(tempfile.mkdtemp(prefix='fig9_'))
    pdf = render(HERE / 'fig09_longvideo_left.py', tmp)
    side = json.loads((tmp / 'fig09_longvideo_left.json').read_text())
    page = fitz.open(pdf)[0]
    from PIL import Image
    png = Image.open(HERE.parent / 'paper' / 'fig09_longvideo_left.png')
    assert abs(png.size[0] / 380 * 72 - page.rect.width) < 0.5 and abs(png.size[1] / 380 * 72 - page.rect.height) < 0.5, (png.size, page.rect)
    assert abs(page.rect.width - side['w']) < 0.1 and abs(page.rect.height - side['h']) < 0.1, (page.rect, side['w'], side['h'])
    marks = []
    for d in page.get_drawings():
        r = d['rect']
        if d.get('fill') and r.width < 8 and r.height < 8:          # benchmark dots (2.6 pt) and means (6 pt)
            marks.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))
    for dot in side['dots'] + side['bars']:
        x, y = dot['at']
        assert any(abs(x - a) < 0.35 and abs(y - b) < 0.35 for a, b in marks), ('no drawn marker at', dot)
    names = side['names']
    assert all(n in NAMES for n in names.values()), [n for n in names.values() if n not in NAMES]
    return {'w': side['w'], 'h': side['h'], 'groups': side['groups'], 'budgets': side['budgets'],
            'curves': {names[b]: ys for b, ys in side['curves'].items()},
            'dots': [[names[d['bench']], d['group'], side['budgets'].index(d['budget']), round(d['value'], 1)] + d['at'] for d in side['dots']],
            'bars': [[b['group'], side['budgets'].index(b['budget']), b['n'], round(b['mean'], 1), round(b['q1'], 1), round(b['q3'], 1)] + b['top'] + b['bottom'] + b['at'] for b in side['bars']]}


FIG8 = figure8_regions()
FIG9 = figure9_regions()

Q1 = figure_q1()
assert len(Q1['lines']) == 57, len(Q1['lines'])      # "57 have both ladders" (Appendix Q)

# --- report cards (Appendix X) ------------------------------------------------------------------------------
card_names = re.findall(r'report_cards/([^}]*)\.pdf', (REPO / 'figs' / 'report_cards.tex').read_text(encoding='utf-8'))
assert sorted(card_names) == sorted(NAMES), set(card_names) ^ NAMES
assert len({slug(n) for n in card_names}) == 115
missing = [n for n in card_names if not (CARDS / (slug(n) + '.png')).exists()]
assert not missing, 'run render_report_cards.py first: ' + ', '.join(missing[:5])
cards = [{'name': n, 'file': slug(n) + '.png'} for n in sorted(card_names, key=str.lower)]

out = {'tables': {str(k): v for k, v in T.items()}, 'q1': Q1, 'fig8': FIG8, 'fig9': FIG9, 'cards': cards}
OUT.write_text('/* Generated by images/blogs/video-index/_src/export_appendix.py from the Video-Index paper; do not edit. */\n'
               'window.VI_APPX = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print('wrote', OUT.relative_to(SITE), f'{OUT.stat().st_size / 1024:.0f} KB')
for k in sorted(CAPS):
    print(f'Table {k}: {CAPS[k]}')
