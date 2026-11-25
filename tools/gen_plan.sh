#!/bin/sh
# Ask Codex (image generation) for the top-down views of one map.
# usage: gen_plan.sh <workdir> <id> plan|height
#   plan   -> <workdir>/plan/<id>.png    the scene seen from straight above (needs in/<id>.png)
#   height -> <workdir>/height/<id>.png  a greyscale height map laid over that plan (needs plan/<id>.png too)
WD="$1"; ID="$2"; KIND="$3"
CODEX="${CODEX:-/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex}"
OUT="$KIND/${ID}.png"
[ -s "$WD/$OUT" ] && { echo "skip $KIND $ID"; exit 0; }
cd "$WD" || exit 1
mkdir -p plan height logs
if [ "$KIND" = "plan" ]; then
  IMGS="-i in/${ID}.png"
  PROMPT="The attached image in/${ID}.png is a hand-drawn 2.5D game map scene. Its camera stands on the SOUTH side, raised above the ground, looking NORTH: the bottom edge of the image is south (near), the top is north (far), left is west, right is east.

Use your image generation tool, with the attached image as the reference, to draw a floor plan of the SAME scene seen from straight above: an orthographic top-down view with the camera looking vertically down. No perspective, no horizon, no sky. North is at the top of the plan, south at the bottom, west on the left, east on the right, so every landmark keeps its left-right position from the original, and what is farther away in the original lies higher up in the plan.

Show the whole ground area that the original shows, edge to edge, and nothing beyond it. Every object appears as its top face (roofs, the tops of rocks and platforms, tree crowns from above) at its true spot on the ground with its true footprint; vertical walls are not visible from above, they collapse into the outline. Keep the ground markings, the colours and the flat vector cartoon style with dark outlines. Leave out characters and creatures, text, UI and any border.
Landscape format, 3:2.

Copy the generated image file unchanged (do not resize or re-encode it) to ./${OUT} and reply with only the saved path."
else
  [ -s "plan/${ID}.png" ] || { echo "no plan for $ID"; exit 1; }
  IMGS="-i plan/${ID}.png -i in/${ID}.png"
  PROMPT="Two images are attached. plan/${ID}.png is a top-down floor plan of a game map. in/${ID}.png is the same scene seen from the south at an angle; it shows how tall things are.

Use your image generation tool to draw a HEIGHT MAP of the floor plan: a greyscale image with exactly the same framing and layout as the plan, every outline in the same place, in which brightness means height above the ground. The ground or floor is black. Low ledges and steps are dark grey, taller things are lighter, the tallest structures are white. The top of each object is one flat, uniform grey with crisp edges that follow the object's outline in the plan. Water, lava and pits are black. No shading, no outlines, no texture, no text.
Same aspect ratio as the plan.

Copy the generated image file unchanged (do not resize or re-encode it) to ./${OUT} and reply with only the saved path."
fi
printf '%s\n' "$PROMPT" | "$CODEX" exec --ephemeral --skip-git-repo-check -s workspace-write -c model_reasoning_effort='"low"' -C "$WD" $IMGS - > "logs/${KIND}_${ID}.log" 2>&1
if [ -s "$OUT" ]; then echo "ok $KIND $ID"; else echo "FAIL $KIND $ID"; exit 1; fi
