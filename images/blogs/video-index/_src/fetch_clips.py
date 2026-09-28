"""Cut the example clips that Figure 1 of the Video-Index post plays when a benchmark is clicked.

One Video-Index item per source benchmark (76 sources; the item whose video lasts closest to 20 s), a five-second
cut of its original video at up to 30 fps, fitted in 640 x 360, muted, with a poster frame. The originals live in
the benchmarks' own Hugging Face repositories, often inside large zip files: this script reads a zip's central
directory with HTTP range requests and has ffmpeg read only the member's bytes (ffmpeg's subfile protocol), so
nothing is downloaded whole. Gated repositories need HF_TOKEN in the environment.

Input: sources.json, {slug: {source_key: "repo::zip_path::member", original_fps, ...}} with the start time and
length of each cut in clip_jobs.json (both made from the Video-Index item list and the census metadata).
Usage: python3 fetch_clips.py <sources.json> <clip_jobs.json> <out dir> [slug ...]
"""
import bz2, io, json, os, subprocess, sys, tempfile, urllib.parse, urllib.request, zipfile, zlib

TOKEN = os.environ.get('HF_TOKEN', '')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def resolve(repo, path):
    """The signed download URL of a file in a dataset repository, and its size (the token is sent to huggingface.co only)."""
    url = 'https://huggingface.co/datasets/%s/resolve/main/%s' % (repo, urllib.parse.quote(path))
    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, method='HEAD', headers={'Authorization': 'Bearer ' + TOKEN} if TOKEN else {})
    try:
        r = opener.open(req)
        loc, size = url, int(r.headers.get('Content-Length', 0))
    except urllib.error.HTTPError as e:
        if e.code not in (301, 302, 303, 307, 308):
            raise
        loc = urllib.parse.urljoin(url, e.headers['Location'])
        size = int(e.headers.get('X-Linked-Size') or 0)
    if not size:
        size = int(urllib.request.urlopen(urllib.request.Request(loc, method='HEAD')).headers['Content-Length'])
    return loc, size


class RangeFile(io.RawIOBase):
    """A read-only, seekable view of a remote file through HTTP range requests."""
    def __init__(self, url, size):
        self.url, self.size, self.pos = url, size, 0
    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos
    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        if n <= 0 or self.pos >= self.size:
            return b''
        end = min(self.size, self.pos + n) - 1
        data = urllib.request.urlopen(urllib.request.Request(self.url, headers={'Range': 'bytes=%d-%d' % (self.pos, end)})).read()
        self.pos += len(data)
        return data
    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d
        return len(d)


def member_span(url, size, member):
    """(start, end, compress_type, file_size) of a zip member's data within the zip."""
    f = RangeFile(url, size)
    zf = zipfile.ZipFile(f)
    info = zf.getinfo(member)
    f.seek(info.header_offset)
    head = f.read(30)
    n, m = int.from_bytes(head[26:28], 'little'), int.from_bytes(head[28:30], 'little')
    start = info.header_offset + 30 + n + m
    return start, start + info.compress_size, info.compress_type, info.file_size


def inflate(url, span, out):
    """Download a deflated or bzip2 member in one range request and decompress it to a local file."""
    req = urllib.request.Request(url, headers={'Range': 'bytes=%d-%d' % (span[0], span[1] - 1)})
    d = zlib.decompressobj(-15) if span[2] == zipfile.ZIP_DEFLATED else bz2.BZ2Decompressor()
    with urllib.request.urlopen(req) as r, open(out, 'wb') as w:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            w.write(d.decompress(chunk))
        if hasattr(d, 'flush'):
            w.write(d.flush())


def cut(src, start, dur, fps, out, seekable_input):
    fps = min(30.0, fps or 30.0)
    vf = 'scale=640:360:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=%.3f,format=yuv420p' % fps
    cmd = ['ffmpeg', '-nostdin', '-v', 'error', '-y', '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,subfile',
           '-ss', '%.3f' % start, '-i', src, '-t', '%.3f' % dur, '-an', '-vf', vf,
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-movflags', '+faststart', out + '.mp4']
    subprocess.run(cmd, check=True)
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', out + '.mp4', '-frames:v', '1', '-q:v', '4', out + '.jpg'], check=True)


def main():
    sources, jobs, outdir = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])), sys.argv[3]
    only = set(sys.argv[4:])
    jobs = {j['slug']: j for j in jobs}
    os.makedirs(outdir, exist_ok=True)
    for slug, s in sources.items():
        if only and slug not in only:
            continue
        repo, zpath, member = s['source_key'].split('::', 2)
        j = jobs[slug]
        try:
            tmp = None
            if repo == 'url':                     # a plain address (url::name::::address)
                src = member.split('::', 1)[1] if '::' in member else member
            elif repo in ('yt', 'local'):
                print('skipped', slug, repo); continue
            elif zpath:
                url, size = resolve(repo, zpath)
                span = member_span(url, size, member)
                if span[2] == zipfile.ZIP_STORED:
                    src = 'subfile,,start,%d,end,%d,,:%s' % (span[0], span[1], url)
                elif span[2] in (zipfile.ZIP_DEFLATED, zipfile.ZIP_BZIP2) and span[1] - span[0] < 400e6:
                    tmp = src = os.path.join(tempfile.gettempdir(), 'vi_clip_' + slug + os.path.splitext(member)[1])
                    inflate(url, span, tmp)
                else:
                    print('skipped', slug, 'compression', span[2], 'size', span[1] - span[0]); continue
            else:
                url, size = resolve(repo, member)
                src = url
            cut(src, j['start'], j['dur'], s.get('original_fps'), os.path.join(outdir, slug), True)
            if tmp:
                os.remove(tmp)
            print('ok', slug)
        except Exception as e:
            print('FAIL', slug, type(e).__name__, str(e)[:160])


if __name__ == '__main__':
    main()
