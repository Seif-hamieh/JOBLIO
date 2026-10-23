#!/usr/bin/env bash
# Renders scripts/social/mockups/posts.html into public/social/mockups/<id>.png (1080×1350).
# Each post is drawn at 2x and scaled down for smooth edges. Usage (from the project root):
#   bash scripts/social/mockups/render.sh [id ...]   (default: all 12)
set -euo pipefail
BROWSER="${BROWSER:-/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe}"
ROOT="$(pwd -W 2>/dev/null || pwd)"
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && IDS=(post1 post2 job1 job2 job3 job4 job5 job6 job7 job8 job9 job10)
mkdir -p public/social/mockups scripts/social/mockups/out
for id in "${IDS[@]}"; do
  raw="scripts/social/mockups/out/$id@2x.png"
  rm -f "$raw"
  profile="$(mktemp -d)"
  "$BROWSER" --headless=new --user-data-dir="$(cygpath -w "$profile" 2>/dev/null || echo "$profile")" --disable-gpu \
    --hide-scrollbars --force-device-scale-factor=2 --window-size=1080,1350 --virtual-time-budget=5000 \
    --allow-file-access-from-files --screenshot="$ROOT/$raw" "file:///$ROOT/scripts/social/mockups/posts.html?p=$id" 2>/dev/null
  # The launcher can return before the screenshot is written: wait for the file (up to a minute).
  for _ in $(seq 60); do [ -s "$raw" ] && break; sleep 1; done
  rm -rf "$profile" 2>/dev/null || true
  node -e 'require("sharp")(process.argv[1]).resize(1080, 1350, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(process.argv[2])' "$raw" "public/social/mockups/$id.png"
  echo "$id"
done
