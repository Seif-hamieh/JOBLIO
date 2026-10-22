#!/usr/bin/env bash
# Renders scripts/social/posts.html into public/social/post{1,2,3}.png (1080×1080) with headless Edge/Chrome.
# Usage (from the project root): bash scripts/social/render.sh
set -euo pipefail
BROWSER="${BROWSER:-/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W 2>/dev/null || pwd)"
mkdir -p public/social
for p in 1 2 3; do
  "$BROWSER" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1080,1080 --virtual-time-budget=5000 --allow-file-access-from-files \
    --screenshot="$ROOT/public/social/post$p.png" "file:///$ROOT/scripts/social/posts.html?p=$p" 2>/dev/null
done
ls -la public/social
