"""Export the per-benchmark audit data of the Video-Index paper for the post's interactive figures.

Reads the paper repository (figs/scripts/data.py for the breaking levels, audit_scope.py for the
capability groups, fig_tex/master_table.tex for release years with data/benchmark_registry.csv as the
fallback, data/pool_summary.csv for item counts, data/meta_census_hard_v6.json for the Video-Index items)
and writes js/video-index-data.js, a script that sets window.VI_DATA. The checks at the end reproduce
the paper's counts (breaking levels, release years, capability groups) before anything is written.

Usage: python3 export_data.py <paper repo>
"""
import collections
import csv
import json
import re
import sys
from pathlib import Path

REPO = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Downloads/apex_paper').resolve()
SITE = Path(__file__).resolve().parents[4]
OUT = SITE / 'js' / 'video-index-data.js'
sys.path.insert(0, str(REPO / 'figs' / 'scripts'))
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

payload = {
    'levels': LEVELS, 'benchmarks': rows,
    'results': [dict(zip(['model', 'protocol', 'video', 'blind', 'gain', 'perception', 'temporal', 'spatial', 'reasoning'], r)) for r in RESULTS],
    'screen': [{'stage': s, 'items': n} for s, n in SCREEN],
}
OUT.write_text('/* Data of the Video-Index paper for the blog post, written by images/blogs/video-index/_src/export_data.py. */\n'
               'window.VI_DATA = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print('wrote', OUT, OUT.stat().st_size // 1024, 'KB;', len(rows), 'benchmarks')
