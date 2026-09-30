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
import bz2, http.client, io, json, os, re, subprocess, sys, tarfile, tempfile, urllib.parse, urllib.request, zipfile, zlib

TOKEN = os.environ.get('HF_TOKEN', '')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def resolve(repo, path):
    """The signed download URL of a file in a dataset repository, and its size. Redirects are followed hop by hop
    (a renamed repository answers 307 first) and the token is sent to huggingface.co only, never to the CDN."""
    url = 'https://huggingface.co/datasets/%s/resolve/main/%s' % (repo, urllib.parse.quote(path))
    opener = urllib.request.build_opener(NoRedirect)
    loc, size = url, 0
    for _ in range(6):
        if not urllib.parse.urlsplit(loc).netloc.endswith('huggingface.co'):
            break
        auth = {'Authorization': 'Bearer ' + TOKEN} if TOKEN else {}
        try:
            r = opener.open(urllib.request.Request(loc, method='HEAD', headers=auth))
            size = size or int(r.headers.get('Content-Length', 0))
            try:   # Xet-backed files are served to a token without a redirect; an anonymous GET names the CDN
                opener.open(urllib.request.Request(loc, headers={'Range': 'bytes=0-0'})).close()
                break
            except urllib.error.HTTPError as e:
                if e.code not in (301, 302, 303, 307, 308):
                    break
                loc = urllib.parse.urljoin(loc, e.headers['Location'])
        except urllib.error.HTTPError as e:
            if e.code not in (301, 302, 303, 307, 308):
                raise
            size = size or int(e.headers.get('X-Linked-Size') or 0)
            loc = urllib.parse.urljoin(loc, e.headers['Location'])
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


class Ranger:
    """Byte-range reads over one kept-alive HTTPS connection (a tar is walked header by header)."""
    def __init__(self, url):
        u = urllib.parse.urlsplit(url)
        self.host, self.path, self.conn = u.netloc, u.path + ('?' + u.query if u.query else ''), None
    def get(self, start, end):
        for _ in range(4):
            try:
                if self.conn is None:
                    self.conn = http.client.HTTPSConnection(self.host, timeout=60)
                self.conn.request('GET', self.path, headers={'Range': 'bytes=%d-%d' % (start, end)})
                r = self.conn.getresponse()
                data = r.read()
                if r.status in (200, 206):
                    return data
            except (OSError, http.client.HTTPException):
                pass
            try:
                self.conn.close()
            except Exception:
                pass
            self.conn = None
        raise IOError('range read failed at %d' % start)


def tar_spans(url, size, members, rg=None):
    """Byte spans of named members of an uncompressed tar, found by hopping from header to header.
    rg reads byte ranges; by default one kept-alive connection to url (a split tar passes a reader over its parts)."""
    want = {m.lstrip('./'): m for m in members}
    found, rg, off, longname, pax = {}, rg or Ranger(url), 0, None, None
    while off + 512 <= size and len(found) < len(want):
        h = rg.get(off, off + 511)
        if h.count(0) == 512:
            break
        name = h[0:100].split(b'\0')[0].decode('utf-8', 'replace')
        prefix = h[345:500].split(b'\0')[0].decode('utf-8', 'replace')
        if prefix:
            name = prefix + '/' + name
        raw = h[124:136]
        sz = int.from_bytes(raw[1:], 'big') if raw[0] & 0x80 else int(raw.split(b'\0')[0].strip() or b'0', 8)
        typ, data = h[156:157], off + 512
        if typ == b'L':
            longname = rg.get(data, data + sz - 1).split(b'\0')[0].decode('utf-8', 'replace')
        elif typ == b'x':
            m = re.search(r'\d+ path=(.*)\n', rg.get(data, data + sz - 1).decode('utf-8', 'replace'))
            pax = m.group(1) if m else None
        else:
            nm = (pax or longname or name).lstrip('./')
            if nm in want:
                found[want[nm]] = (data, data + sz)
            longname = pax = None
        off = data + (sz + 511) // 512 * 512
    return found


def targz_member(url, member, out):
    """Stream a .tar.gz and write one member to out, stopping as soon as it has been read."""
    want = member.lstrip('./')
    with urllib.request.urlopen(url) as resp, tarfile.open(fileobj=resp, mode='r|gz') as tf:
        for ti in tf:
            if ti.name.lstrip('./') == want:
                with tf.extractfile(ti) as f, open(out, 'wb') as w:
                    while True:
                        chunk = f.read(1 << 20)
                        if not chunk:
                            return True
                        w.write(chunk)
    return False


def repo_files(repo, pattern):
    """Files of a dataset repository matching a glob such as videos/videos_part_*.tar.gz."""
    import fnmatch
    d = os.path.dirname(pattern)
    url = 'https://huggingface.co/api/datasets/%s/tree/main/%s' % (repo, urllib.parse.quote(d))
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + TOKEN} if TOKEN else {})
    return sorted(x['path'] for x in json.load(urllib.request.urlopen(req)) if fnmatch.fnmatch(x['path'], pattern))


def local_copy(repo, arc, member, slug):
    """For a member of a tar, tar.gz or a large zip entry: a local path or a subfile URL ffmpeg can read."""
    tmp = os.path.join(tempfile.gettempdir(), 'vi_clip_' + slug + os.path.splitext(member)[1])
    if arc.endswith('.tar'):
        url, size = resolve(repo, arc)
        span = tar_spans(url, size, [member]).get(member)
        if not span:
            raise IOError('member not in tar')
        return 'subfile,,start,%d,end,%d,,:%s' % (span[0], span[1], url), None
    if '.tar.gz' in arc or arc.endswith('.tgz'):
        parts = repo_files(repo, arc) if '*' in arc else [arc]
        for part in parts:
            url, _ = resolve(repo, part)
            if targz_member(url, member, tmp):
                return tmp, tmp
        raise IOError('member not in any part')
    raise IOError('unknown archive ' + arc)


def cut(src, start, dur, fps, out, seekable_input):
    fps = min(30.0, fps or 30.0)
    vf = 'scale=854:480:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=%.3f,format=yuv420p' % fps
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
            elif zpath and not zpath.endswith('.zip'):
                src, tmp = local_copy(repo, zpath, member, slug)
            elif zpath:
                url, size = resolve(repo, zpath)
                span = member_span(url, size, member)
                if span[2] == zipfile.ZIP_STORED:
                    src = 'subfile,,start,%d,end,%d,,:%s' % (span[0], span[1], url)
                elif span[2] in (zipfile.ZIP_DEFLATED, zipfile.ZIP_BZIP2) and span[1] - span[0] < 4e9:
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
