#!/usr/bin/env bash
# Phone-sized screenshots of live pages (500×1083 CSS px — headless Edge won't lay out narrower — at 3x,
# dark mode) into scripts/social/mockups/shots/. Headless visits aren't counted as job views (bot user agent).
# Usage (from the project root): bash scripts/social/mockups/shoot.sh name=url [name=url ...]
# A name ending in @N captures a window N px tall at 2x instead (for cropping a section further down the page).
set -euo pipefail
# Each capture gets its own throwaway profile: a profile still locked by the previous run makes Edge exit silently.
BROWSER="${BROWSER:-/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe}"
ROOT="$(pwd -W 2>/dev/null || pwd)"
for pair in "$@"; do
  name="${pair%%=*}"; url="${pair#*=}"; height=1083; dpr=3
  if [[ "$name" == *@* ]]; then height="${name#*@}"; name="${name%@*}"; dpr=2; fi # tall windows at 3x exceed the GPU size limit
  rm -f "scripts/social/mockups/shots/$name.png"
  profile="$(mktemp -d)"
  "$BROWSER" --headless=new --user-data-dir="$(cygpath -w "$profile" 2>/dev/null || echo "$profile")" --disable-gpu --hide-scrollbars \
    --force-dark-mode --blink-settings=preferredColorScheme=0 --force-device-scale-factor="$dpr" \
    --window-size=500,"$height" --virtual-time-budget=15000 \
    --screenshot="$ROOT/scripts/social/mockups/shots/$name.png" "$url" 2>/dev/null
  # The launcher can return before the screenshot is written: wait for the file (up to a minute).
  for _ in $(seq 60); do [ -s "scripts/social/mockups/shots/$name.png" ] && break; sleep 1; done
  rm -rf "$profile" 2>/dev/null || true # Edge may still hold a lock for a moment
  test -f "scripts/social/mockups/shots/$name.png" && echo "$name ok" || echo "$name FAILED"
done
