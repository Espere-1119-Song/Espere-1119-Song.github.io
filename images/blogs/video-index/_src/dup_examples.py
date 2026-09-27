"""Summarise exp/results/duplicates_detail.jsonl for the Video-Index post: for every benchmark pair with at least
two near-duplicate question pairs (BGE-large cosine >= 0.9, confirmed with MPNet), the pair counts, the verbatim
ones, and up to three near-duplicate and two verbatim examples. Prints one JSON object (saved as
dup_examples.json next to this script). Run on the cluster from the BenchCheck root:
    cat dup_examples.py | pc --raw 'cd /vast/projects/jgu32/lab/enxin/BenchCheck && python3 -' > dup_examples.json
"""
import collections, json
rows = [json.loads(l) for l in open('exp/results/duplicates_detail.jsonl')]
def key(r):
    return tuple(sorted([r['bench_a'], r['bench_b']]))
stats = collections.defaultdict(lambda: {'pairs': 0, 'exact': 0, 'near': [], 'exact_ex': []})
for r in rows:
    if r['cos_bge'] < 0.9:
        continue
    k = key(r)
    s = stats[k]
    s['pairs'] += 1
    if r['exact_text']:
        s['exact'] += 1
        s['exact_ex'].append(r)
    else:
        s['near'].append(r)
top = sorted([kv for kv in stats.items() if kv[1]["pairs"] >= 2], key=lambda kv: -kv[1]["pairs"])
out = []
for (a, b), s in top:
    near = sorted(s['near'], key=lambda r: -r['cos_mpnet'])[:3]
    ex = s['exact_ex'][:2]
    pick = lambda r: {'a': r['bench_a'], 'qa': r['qid_a'], 'ta': r['text_a'], 'b': r['bench_b'], 'qb': r['qid_b'], 'tb': r['text_b'],
                      'bge': r['cos_bge'], 'mpnet': r['cos_mpnet'], 'exact': r['exact_text']}
    out.append({'pair': [a, b], 'pairs': s['pairs'], 'exact': s['exact'], 'near_examples': [pick(r) for r in near], 'exact_examples': [pick(r) for r in ex]})
print(json.dumps({'records': len(rows), 'mpnet_min_of_kept': min(r['cos_mpnet'] for r in rows if r['cos_bge'] >= 0.9), 'top': out}, ensure_ascii=False))
