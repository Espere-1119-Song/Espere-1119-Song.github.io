"""Write js/video-index-clips.js from _src/clip_items.json: each Figure 1 benchmark's clip, its size, and the
question it comes with (question, options, answer) for the card's ?q=1 variant.

Usage: python3 make_clip_manifest.py <items.jsonl>
items.jsonl: the Video-Index item list (Hugging Face Video-Index/Video-Index, items/test.jsonl), optionally
followed by more JSON lines for examples picked outside Video-Index (item_id, question, options, answer_idx).
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, '../../../..'))
items = {}
for line in open(sys.argv[1]):
    if line.strip():
        r = json.loads(line); items[r['item_id']] = r
clips = json.load(open(os.path.join(HERE, 'clip_items.json')))
out = {}
for c in clips:
    mp4 = os.path.join(SITE, 'images/blogs/video-index/clips', c['slug'] + '.mp4')
    w, h = [int(x) for x in subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', mp4],
                                            capture_output=True, text=True).stdout.strip().split(',')]
    r = items.get(c['item'], {})
    out[c['name']] = {'src': c['slug'] + '.mp4', 'poster': c['slug'] + '.jpg', 'w': w, 'h': h, 'item': c['item'],
                      'q': r.get('question'), 'opts': r.get('options'), 'ans': r.get('answer_idx')}
js = ('/* Example clips that Figure 1 plays when a benchmark is clicked, with the question each comes from.\n'
      '   Made by images/blogs/video-index/_src/make_clip_manifest.py from _src/clip_items.json. */\n'
      'window.VI_CLIPS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(SITE, 'js/video-index-clips.js'), 'w').write(js)
print(len(out), 'clips;', sum(1 for v in out.values() if v['q']), 'with a question')
