#!/bin/sh
# Contact sheets of the walkable world (page hook ?shots=): the original camera, third person, first person.
# usage: qa_world.sh <outDir> <profileDir> <mode 0-3> <shots: 1 = eight views, 4 = four views> <id>...
OUT="$1"; PROF="$2"; MODE="$3"; SHOTS="$4"; shift 4
H=560; [ "$SHOTS" = "4" ] && H=280
for ID in "$@"; do
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir="$PROF" --no-first-run --disable-extensions --hide-scrollbars \
    --window-size=1920,$H --virtual-time-budget=25000 --screenshot="$OUT/world_$ID.png" \
    "http://localhost:8131/?shots=$SHOTS&mode=$MODE&t=$(date +%s)#map-$ID" >/dev/null 2>&1
  [ -s "$OUT/world_$ID.png" ] && echo "world $ID" || echo "FAILED $ID"
done
