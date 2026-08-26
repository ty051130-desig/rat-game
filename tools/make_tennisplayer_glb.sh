#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLEND="$ROOT/assets/source/tennisplayer.blend"
EXPORTER="$ROOT/tools/export_tennisplayer_glb.py"
OUTPUT="$ROOT/assets/models/tennisplayer.glb"
if ! command -v blender >/dev/null 2>&1; then
  echo "blender コマンドが見つかりません。Windowsでは MAKE_TENNISPLAYER_GLB.bat を実行してください。" >&2
  exit 2
fi
blender -b "$BLEND" --python "$EXPORTER" -- --output "$OUTPUT"
echo "Created: $OUTPUT"
