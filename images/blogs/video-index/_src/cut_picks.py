"""Cut the Figure 1 example clips the author picked in the picker dashboard (2026-09-29).

Every clip comes from the benchmark's original video, never from the 2 fps census copies: five seconds at the
start the picker previewed (for a candidate the picker could only show as a crossfade of census frames, 35% of
the video's duration), at the source frame rate up to 30 fps, fitted in 854 x 480. Sources are read by byte range
with the helpers of fetch_clips.py (zip members, plain tars, tar.gz streams) and, for tars a repository now
stores in parts (videos.tar.part.aa, ...), by hopping headers across the parts. A job may carry alt_key, another
copy of the same original video where the benchmark's own archive cannot be read by range: E.T. Bench's
Perception Test video from the Perception Test validation zips, VideoEval-Pro's YouTube video from LVBench.

Input: plan.json, one record per pick {slug, key, kind, start, dur, ...}, made from the dashboard's db collection
`picks` and the candidate lists. Only kinds 'hf' and 'url' are cut here; 'yt' and 'local' need the cluster.
Usage: HF_TOKEN=... python3 cut_picks.py <plan.json> <out dir> [slug ...]
"""
import concurrent.futures, json, os, shutil, subprocess, sys, tempfile, urllib.error, urllib.request, zipfile

import fetch_clips as F


class Parts:
    """Byte-range reads over a file that a repository stores as consecutive parts (videos.tar.part.aa, ab, ...)."""
    def __init__(self, repo, names):
        self.parts, off = [], 0
        for name in names:
            url, size = F.resolve(repo, name)
            self.parts.append((off, size, url, F.Ranger(url)))
            off += size
        self.size = off

    def pieces(self, start, end):
        """(part, local start, local end) covering [start, end) of the joined file."""
        return [(i, max(start, off) - off, min(end, off + size) - off)
                for i, (off, size, _, _) in enumerate(self.parts) if max(start, off) < min(end, off + size)]

    def get(self, start, end):
        return b''.join(self.parts[i][3].get(a, b - 1) for i, a, b in self.pieces(start, end + 1))


def split_tar_member(repo, arc, member, slug):
    """The member of a tar stored as arc.part* (.part.aa or .part00 ...): a subfile URL when it sits in one part, else a local copy."""
    parts = Parts(repo, F.repo_files(repo, arc + '.part*'))
    span = F.tar_spans(None, parts.size, [member], rg=parts).get(member)
    if not span:
        raise IOError('member not in split tar')
    pieces = parts.pieces(*span)
    if len(pieces) == 1:
        i, a, b = pieces[0]
        return 'subfile,,start,%d,end,%d,,:%s' % (a, b, parts.parts[i][2]), None
    tmp = os.path.join(tempfile.gettempdir(), 'vi_clip_' + slug + os.path.splitext(member)[1])
    with open(tmp, 'wb') as w:
        for i, a, b in pieces:
            req = urllib.request.Request(parts.parts[i][2], headers={'Range': 'bytes=%d-%d' % (a, b - 1)})
            with urllib.request.urlopen(req) as r:
                shutil.copyfileobj(r, w, 1 << 20)
    return tmp, tmp


def source(job):
    """A path or URL ffmpeg can read for the job's original video, and a temporary file to remove afterwards."""
    slug, key = job['slug'], job.get('alt_key') or job['key']
    repo, zpath, member = key.split('::', 2)
    if repo == 'url':
        return (member.split('::', 1)[1] if '::' in member else member), None
    if zpath.endswith('.tar'):
        try:
            F.resolve(repo, zpath)
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
            return split_tar_member(repo, zpath, member, slug)
    if zpath and not zpath.endswith('.zip'):
        return F.local_copy(repo, zpath, member, slug)
    if zpath:
        url, size = F.resolve(repo, zpath)
        span = F.member_span(url, size, member)
        if span[2] == zipfile.ZIP_STORED:
            return 'subfile,,start,%d,end,%d,,:%s' % (span[0], span[1], url), None
        tmp = os.path.join(tempfile.gettempdir(), 'vi_clip_' + slug + os.path.splitext(member)[1])
        F.inflate(url, span, tmp)
        return tmp, tmp
    url, _ = F.resolve(repo, member)
    return url, None


def fps_of(src):
    out = subprocess.run(['ffprobe', '-v', 'error', '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,subfile',
                          '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate,r_frame_rate',
                          '-of', 'json', src], capture_output=True, text=True, timeout=300)
    for field in ('avg_frame_rate', 'r_frame_rate'):
        try:
            num, den = json.loads(out.stdout)['streams'][0][field].split('/')
            if float(den) and 1 <= float(num) / float(den) <= 120:
                return float(num) / float(den)
        except Exception:
            pass
    return 30.0


def run(job, outdir):
    tmp = None
    try:
        src, tmp = source(job)
        fps = fps_of(src)
        F.cut(src, job['start'], job['dur'], fps, os.path.join(outdir, job['slug']), True)
        return job['slug'], 'ok', round(fps, 3)
    except Exception as e:
        return job['slug'], 'FAIL', '%s %s' % (type(e).__name__, str(e)[:200])
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)


def main():
    plan, outdir = json.load(open(sys.argv[1])), sys.argv[2]
    only = set(sys.argv[3:])
    os.makedirs(outdir, exist_ok=True)
    jobs = [j for j in plan if j['kind'] in ('hf', 'url') and (not only or j['slug'] in only)]
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for slug, status, info in pool.map(lambda j: run(j, outdir), jobs):
            print(status, slug, info, flush=True)


if __name__ == '__main__':
    main()
