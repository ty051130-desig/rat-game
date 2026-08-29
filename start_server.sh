#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MODEL="$SCRIPT_DIR/assets/models/tennisplayer.glb"

echo "Rat Escape v10.0"
echo "公開フォルダ: $SCRIPT_DIR"


if [[ ! -f "$MODEL" ]]; then
  echo "[注意] assets/models/tennisplayer.glb がまだありません。"
  echo "Windowsで MAKE_TENNISPLAYER_GLB.bat を先に実行してください。"
  echo
fi

echo "PC: http://localhost:8000/"
echo "確認: http://localhost:8000/V10_0_OK.txt"

echo "スマホでは同じWi-Fiに接続し、PCのLAN IPアドレスを使って"
echo "http://<PCのIP>:8000/ を開いてください。"

echo "※ 8000番ですでに別のサーバーが動いている場合は先に停止してください。"


python3 -m http.server 8000 --bind 0.0.0.0 --directory "$SCRIPT_DIR"
