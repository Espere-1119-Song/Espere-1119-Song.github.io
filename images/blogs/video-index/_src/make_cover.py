"""The blog card's cover: the benchmark mosaic of Figure 1 of the Video-Index paper, cropped to the tiles
and at the card size (2752 x 1536, like the other covers), saved as JPEG.

Usage: python3 make_cover.py <paper repo>/figs/fig_teaser_treemap.pdf
"""
import sys
from pathlib import Path

import pymupdf as fitz
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'cover.jpg'
W, H = 2752, 1536


def main(pdf):
    page = fitz.open(pdf)[0]
    pm = page.get_pixmap(dpi=720, alpha=False)                         # ~3960 px wide
    img = Image.frombytes('RGB', (pm.width, pm.height), pm.samples)
    # the tile mosaic spans roughly 12% to 77% of the page height and the full width
    top, bottom = int(0.125 * pm.height), int(0.77 * pm.height)
    tiles = img.crop((0, top, pm.width, bottom))
    # crop to the card's aspect ratio around the centre, then scale to the card
    tw, th = tiles.size
    if tw / th > W / H:
        nw = int(th * W / H)
        tiles = tiles.crop(((tw - nw) // 2, 0, (tw - nw) // 2 + nw, th))
    else:
        nh = int(tw * H / W)
        tiles = tiles.crop((0, (th - nh) // 2, tw, (th - nh) // 2 + nh))
    tiles = tiles.resize((W, H), Image.LANCZOS)
    tiles.save(OUT, quality=86, optimize=True, progressive=True)
    print('wrote', OUT, tiles.size)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Downloads/apex_paper/figs/fig_teaser_treemap.pdf')
