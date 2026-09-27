"""Export the per-benchmark audit data of the Video-Index paper for the post's interactive figures.

Reads the paper repository (figs/scripts/data.py for the breaking levels, audit_scope.py for the
capability groups, fig_tex/master_table.tex for release years with data/benchmark_registry.csv as the
fallback, data/pool_summary.csv for item counts, data/meta_census_hard_v6.json for the Video-Index items)
and writes js/video-index-data.js, a script that sets window.VI_DATA. The checks at the end reproduce
the paper's counts (breaking levels, release years, capability groups) before anything is written.

It also records where each piece of the paper's Figures 1, 6 and 7 sits, in PDF points from the top
left of the page, so the post can lay hover regions over the paper's own figures. Figure 1's tiles and
chain come from running figs/scripts/fig_teaser_treemap.py with saving disabled; the bars of Figures 6
and 7 are read from figs/fig_f0_funnel.pdf and figs/fig_f3_claims.pdf. Both are checked against the
PDFs and the data before anything is written.

Usage: python3 export_data.py <paper repo>
"""
import collections
import contextlib
import csv
import io
import json
import re
import runpy
import sys
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.figure     # noqa: E402
import pymupdf as fitz       # noqa: E402

REPO = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Downloads/apex_paper').resolve()
SITE = Path(__file__).resolve().parents[4]
OUT = SITE / 'js' / 'video-index-data.js'
SCRIPTS = REPO / 'figs' / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import data            # noqa: E402
import audit_scope     # noqa: E402

LEVELS = ['option', 'text', 'pool', 'frame', 'order']
LV = data.levels('all')
groups_by_id = audit_scope.capability_groups()

years = {}
master = (REPO / 'fig_tex' / 'master_table.tex').read_text(encoding='utf-8')
for m in re.finditer(r'\\mbox\{([^}]*)\}\s*(?:\\citep\{[^}]*\})?\s*&\s*(?:(?:CL|GM)\s*&\s*)?(\d{4})\s*&', master):
    years[m.group(1).replace('\\', '')] = int(m.group(2))
registry = {}
for r in csv.DictReader(open(REPO / 'data' / 'benchmark_registry.csv', encoding='utf-8')):
    for key in (r['short_name'], r['benchmark_id']):
        registry[key] = r
pool = {r['benchmark']: r for r in csv.DictReader(open(REPO / 'data' / 'pool_summary.csv', encoding='utf-8'))}
vi_items = json.load(open(REPO / 'data' / 'meta_census_hard_v6.json', encoding='utf-8'))
vi_count = collections.Counter(it['benchmark'] for it in vi_items)

rows = []
for name, row in LV.items():
    bid = row['bench']
    year = years.get(name)
    if year is None:
        reg = registry.get(name) or registry.get(bid)
        year = int(reg['year']) if reg and reg.get('year') else None
    p = pool.get(bid) or pool.get(name)
    items = int(p['n_total']) if p else None
    mcq = (int(p['n_total']) - int(p['n_open']) - int(p['n_yesno'])) if p else None
    eps = [row.get('eps_opt' if lv == 'option' else 'eps_' + lv) for lv in LEVELS]
    rows.append({
        'name': name, 'id': bid, 'year': year, 'group': groups_by_id[bid],
        'items': items, 'mcq': mcq,
        'c': round(100 * row['c'], 1), 'ref': round(100 * row['s_star'], 1),
        'bar': float(f"{100 * (row['s_star'] - row['c'] - 0.05):.1f}"),   # the break bar, from unrounded accuracies
        'eps': [None if e is None or e != e else round(100 * e, 1) for e in eps],
        'measured': row['measured'], 'level': row['break_level'],
        'vi': vi_count.get(bid, 0) + (vi_count.get(name, 0) if name != bid else 0),
    })
rows.sort(key=lambda r: r['name'].lower())

# --- checks against the paper -------------------------------------------------------------------------
levels = collections.Counter(r['level'] for r in rows)
assert len(rows) == 115, len(rows)
assert [levels[k] for k in LEVELS + ['unbroken']] == [17, 13, 5, 27, 15, 38], levels
by_year = collections.Counter(('≤ 2023' if r['year'] <= 2023 else str(r['year'])) for r in rows)
assert dict(by_year) == {'≤ 2023': 6, '2024': 20, '2025': 54, '2026': 35}, by_year
by_group = collections.Counter(r['group'] for r in rows)
assert by_group == {'Temporal': 18, 'Spatial / physical': 20, 'Perception': 45, 'Reasoning / knowledge': 32}, by_group
assert sum(r['vi'] for r in rows) == 840, sum(r['vi'] for r in rows)
assert sum(1 for r in rows if r['vi']) == 76, sum(1 for r in rows if r['vi'])
missing_items = [r['name'] for r in rows if r['items'] is None]
print('items missing for', len(missing_items), missing_items)

RESULTS = [  # Table 1 of the paper: video, blind, gain, perception, temporal, spatial, reasoning
    ('VideoChat3-4B', 'fixed', 9.4, 3.8, 5.7, 9.5, 12.4, 6.2, 9.5),
    ('Qwen3-VL-8B', 'fixed', 9.5, 1.4, 8.1, 9.0, 11.4, 6.7, 11.0),
    ('Cambrian-S-7B', 'fixed', 11.3, 5.3, 6.0, 12.4, 10.0, 3.8, 19.0),
    ('InternVideo2.5-8B', 'fixed', 12.4, 7.5, 4.9, 12.9, 11.0, 8.1, 17.6),
    ('VideoLLaMA3-7B', 'fixed', 12.4, 5.2, 7.1, 11.9, 18.6, 8.6, 10.5),
    ('Video-XL-2', 'fixed', 12.4, 7.3, 5.1, 12.4, 15.7, 9.0, 12.4),
    ('LLaVA-OneVision-2-8B', 'fixed', 14.2, 1.8, 12.4, 11.4, 21.0, 11.9, 12.4),
    ('InternVL3.5-8B', 'fixed', 15.2, 4.4, 10.8, 13.3, 20.0, 8.1, 19.5),
    ('Molmo2-8B', 'fixed', 19.0, 4.8, 14.2, 20.0, 16.2, 17.1, 22.9),
    ('Claude Opus 5', 'fixed', 56.8, 21.3, 35.5, 62.4, 56.2, 46.7, 61.9),
    ('Gemini 3.5 Flash-Lite', 'agent', 22.5, 17.5, 5.0, 20.0, 30.0, 10.0, 30.0),
    ('Gemini 3.1 Pro', 'agent', 54.7, 23.9, 30.8, 58.2, 59.1, 60.6, 40.9),
    ('Claude Opus 5', 'agent', 70.6, 24.9, 45.7, 68.4, 77.2, 69.1, 67.6),
    ('Claude Fable 5.1', 'agent', 71.5, 20.7, 50.8, 68.4, 77.7, 71.1, 68.7),
    ('GPT-6-Astra', 'agent', 79.3, 18.7, 60.6, 75.4, 83.7, 80.4, 77.1),
    ('Human volunteers', 'human', 55.0, 17.5, 37.5, 56.0, 68.0, 56.0, 40.0),
]
SCREEN = [('All items', 505518), ('Multiple choice', 381614), ('Distinct questions', 269930),
          ('Not from the options', 191092), ('Not answered blind', 145047), ('Not from one frame', 97077),
          ('Not by the 2B model', 65818), ('Unique across benchmarks', 63630), ('Labelled and complete', 62142),
          ('One per video and scene', 10000), ('Video-Index', 840)]


# --- regions of the paper's figures ----------------------------------------------------------------------
def pdf_rects(pdf):
    """Filled rectangles of a figure PDF: (hex colour, Rect), page rect."""
    page = fitz.open(pdf)[0]
    out = []
    for dr in page.get_drawings():
        fill = dr.get('fill')
        if fill is None:
            continue
        out.append(('#%02x%02x%02x' % tuple(int(round(255 * c)) for c in fill[:3]), dr['rect']))
    return page.rect, out


def pt_box(r):
    return [round(r.x0, 2), round(r.y0, 2), round(r.width, 2), round(r.height, 2)]


def figure1_regions():
    """Run the paper's Figure 1 script without saving and read off each tile and chain stage."""
    saved = matplotlib.figure.Figure.savefig
    matplotlib.figure.Figure.savefig = lambda self, *a, **k: None     # never rewrite the paper's figure
    import fig_sources_treemap as T
    captured, layout = {}, T.quadrant_layout

    def capture(*a, **k):
        res = layout(*a, **k)
        captured['pieces'] = res[0]
        return res
    T.quadrant_layout = capture
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            g = runpy.run_path(str(SCRIPTS / 'fig_teaser_treemap.py'), run_name='teaser_capture')
    finally:
        T.quadrant_layout = layout
        matplotlib.figure.Figure.savefig = saved
    fig, ax = g['fig'], g['ax']
    W, H = fig.get_size_inches()

    def box(x, y, w, h):
        (x0, y0), (x1, y1) = ax.transData.transform([(x, y), (x + w, y + h)])
        return [round(x0 / fig.dpi * 72, 2), round((H - y1 / fig.dpi) * 72, 2),
                round((x1 - x0) / fig.dpi * 72, 2), round((y1 - y0) / fig.dpi * 72, 2)]
    tiles = [{'name': d, 'box': box(*rect)} for d, _, rect in captured['pieces']]
    stages, X0, X1 = g['stages'], g['X0'], g['X1']
    segw = (X1 - X0) / len(stages)
    chain = [{'stage': name.replace('-\n', '-').replace('\n', ' '), 'items': n,
              'box': box(X0 + i * segw, g['STEP_LABEL_BOT'], segw, g['CHAIN_TOP'] - g['STEP_LABEL_BOT'])}
             for i, (name, n) in enumerate(stages)]
    # the captured layout must be the one in the PDF the post shows: every tile has a drawn piece that
    # covers its rectangle and sticks out only where a jigsaw knob bulges (at most two knob radii, 6 pt)
    page, drawn = pdf_rects(REPO / 'figs' / 'fig_teaser_treemap.pdf')
    assert abs(page.width - W * 72) < 0.1 and abs(page.height - H * 72) < 0.1, (page, W, H)

    def covers(r, x, y, w, h):
        out = [x - r.x0, y - r.y0, r.x1 - x - w, r.y1 - y - h]
        return all(-0.6 < v < 6.5 for v in out) and sum(abs(v) < 0.6 for v in out) >= 2
    for t in tiles:
        assert any(covers(r, *t['box']) for _, r in drawn), 'no drawn piece for ' + t['name']
    return {'w': round(page.width, 2), 'h': round(page.height, 2), 'tiles': tiles, 'chain': chain}


PAPER_LEVEL = {'#efaba5': 'option', '#e67c73': 'text', '#db4437': 'pool', '#d5e4fd': 'frame',
               '#aac8fa': 'order', '#4285f4': 'unbroken', '#dcddde': 'continue'}
ORDER6 = LEVELS + ['unbroken']


def bar_rows(rects, x_lo, x_hi):
    """Bars (height of at least 8 pt, legend swatches are 6 pt) in a panel, grouped into rows by y."""
    rows = collections.defaultdict(list)
    for hexc, r in rects:
        if hexc in PAPER_LEVEL and r.height >= 8 and x_lo <= r.x0 < x_hi:
            rows[round(r.y0, 1)].append((r.x0, PAPER_LEVEL[hexc], r))
    return [sorted(rows[y]) for y in sorted(rows)]


def check_shares(row, members, label):
    """The segments of a row follow the level order, and their widths the data's counts."""
    counts = collections.Counter(b['level'] for b in members)
    levels = [lv for _, lv, _ in row]
    assert levels == [lv for lv in ORDER6 if counts[lv]], (label, levels, counts)
    total = sum(r.width for _, _, r in row)
    for _, lv, r in row:
        assert abs(r.width / total - counts[lv] / len(members)) < 0.01, (label, lv)


def figure6_regions():
    page, rects = pdf_rects(REPO / 'figs' / 'fig_f0_funnel.pdf')
    mid = page.width / 2
    funnel, years = [], []
    left = bar_rows(rects, 0, mid)
    assert len(left) == 6, len(left)
    reach = list(rows)
    for k, row in enumerate(left):
        level = ORDER6[k]
        for _, lv, r in row:
            kind = 'continue' if lv == 'continue' else ('survive' if level == 'unbroken' else 'break')
            n = sum(1 for b in reach if b['level'] != level) if kind == 'continue' else sum(1 for b in reach if b['level'] == level)
            funnel.append({'level': level, 'kind': kind, 'n': n, 'box': pt_box(r)})
        reach = [b for b in reach if b['level'] != level]
    right = bar_rows(rects, mid, page.width)
    labels = ['≤ 2023', '2024', '2025', '2026']
    assert len(right) == 4, len(right)
    for label, row in zip(labels, right):
        members = [b for b in rows if ('≤ 2023' if b['year'] <= 2023 else str(b['year'])) == label]
        check_shares(row, members, label)
        years.extend({'year': label, 'level': lv, 'box': pt_box(r)} for _, lv, r in row)
    return {'w': round(page.width, 2), 'h': round(page.height, 2), 'funnel': funnel, 'years': years}


def figure7_regions():
    page, rects = pdf_rects(REPO / 'figs' / 'fig_f3_claims.pdf')
    out = []
    ordered = ['Temporal', 'Spatial / physical', 'Perception', 'Reasoning / knowledge']   # top to bottom
    found = bar_rows(rects, 0, page.width)
    assert len(found) == 4, len(found)
    for group, row in zip(ordered, found):
        check_shares(row, [b for b in rows if b['group'] == group], group)
        out.extend({'group': group, 'level': lv, 'box': pt_box(r)} for _, lv, r in row)
    return {'w': round(page.width, 2), 'h': round(page.height, 2), 'groups': out}


figures = {'fig1': figure1_regions(), 'fig6': figure6_regions(), 'fig7': figure7_regions()}
names = {r['name'] for r in rows}
assert {t['name'] for t in figures['fig1']['tiles']} == names
assert [c['items'] for c in figures['fig1']['chain']] == [n for _, n in SCREEN]
print('figure regions:', len(figures['fig1']['tiles']), 'tiles,', len(figures['fig1']['chain']), 'chain stages,',
      len(figures['fig6']['funnel']) + len(figures['fig6']['years']), 'bars in Figure 6,', len(figures['fig7']['groups']), 'in Figure 7')

payload = {
    'levels': LEVELS, 'benchmarks': rows,
    'results': [dict(zip(['model', 'protocol', 'video', 'blind', 'gain', 'perception', 'temporal', 'spatial', 'reasoning'], r)) for r in RESULTS],
    'screen': [{'stage': s, 'items': n} for s, n in SCREEN],
    'figures': figures,
}
OUT.write_text('/* Data of the Video-Index paper for the blog post, written by images/blogs/video-index/_src/export_data.py. */\n'
               'window.VI_DATA = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print('wrote', OUT, OUT.stat().st_size // 1024, 'KB;', len(rows), 'benchmarks')
