#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

echo "Rat Escape v6"
echo "公開フォルダ: $SCRIPT_DIR"
echo "PC: http://localhost:8000/"
echo
echo "スマホでは同じWi-Fiに接続し、PCのLAN IPアドレスを使って"
echo "http://<PCのIP>:8000/ を開いてください。"
echo
echo "※ 8000番ですでに別のサーバーが動いている場合は Ctrl+C で停止してください。"
echo

python3 -m http.server 8000 --bind 0.0.0.0 --directory "$SCRIPT_DIR"
