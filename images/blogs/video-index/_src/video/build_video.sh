#!/bin/bash
# Splice the rendered scenes (render_frames.mjs, 60 fps JPEG frames) into the author's overview video at 13.9 s,
# where the example cards have closed and the full mosaic stands: original 0-13.9 s, the new scenes (which start
# and end on that same frame), then the original from 13.9 s (the mosaic breaking into dots and the wordmark).
# Usage: build_video.sh <original.mp4> <frames dir> <out.mp4>
# The author's original cut is overview.mp4 as of commit a629d91: git show a629d91:images/blogs/video-index/overview.mp4 > original.mp4
set -euo pipefail
ORIG=$1; FRAMES=$2; OUT=$3; CUT=13.9
ffmpeg -v error -y -i "$ORIG" -framerate 60 -i "$FRAMES/f_%05d.jpg" -filter_complex "
  [0:v]trim=end=$CUT,setpts=PTS-STARTPTS,format=yuv420p[a];
  [1:v]scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p,setpts=PTS-STARTPTS[b];
  [0:v]trim=start=$CUT,setpts=PTS-STARTPTS,format=yuv420p[c];
  [a][b][c]concat=n=3:v=1:a=0,fps=60[v]" \
  -map "[v]" -an -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
