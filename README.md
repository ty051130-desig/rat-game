# Rat Escape v9.3

## v9.3

Stage 2「部室」の主人公を、中山の浮遊顔モデルから **テニス部員の全身キャラクター**へ変更しました。

- Stage 2 character: `tennisplayer.glb`
- character type: `animated`
- embedded animation names expected by the game: `Idle` / `Run`
- target height: `2.20`
- front direction: Blender `-Y`（ゲーム側の既存yaw補正を使用）
- v9.2の低めの部室カメラを維持
- v9.2の部室障害物・土管レイアウトを維持
- player start: `e6`
- cache version: `v=9.3`

## 重要: 最初に tennisplayer.glb を作る

ブラウザ / Three.js は `.blend` を直接読み込めません。そのため、添付された完成版 `tennisplayer.blend` を `assets/source/` に同梱し、GLBへ自動書き出しするスクリプトを用意しています。

### Windows

ZIPを展開して、ルートにある

```text
MAKE_TENNISPLAYER_GLB.bat
```

をダブルクリックしてください。PCにインストール済みのBlenderを自動検出し、

```text
assets/models/tennisplayer.glb
```

を生成します。

生成後は通常どおりサーバーを起動してください。

## Models

```text
assets/
├─ models/
│  ├─ main_character.glb   # Stage 1用。手元の青い主人公を配置
│  └─ tennisplayer.glb     # MAKE_TENNISPLAYER_GLB.bat で生成
└─ source/
   └─ tennisplayer.blend   # 今回の完成版Blenderソース
```

## Start (WSL example)

展開先を `rat_escape_v9_3` とした場合:

```bash
python3 -m http.server 8000 --directory "/mnt/c/Users/ty051/OneDrive/デスクトップ/Rat_Game/rat_escape_v9_3"
```

確認:

```text
http://localhost:8000/V9_3_OK.txt
```

ここに `Rat Escape v9.3` と表示されれば正しいフォルダです。

次に:

```text
http://localhost:8000/assets/models/tennisplayer.glb?v=9.3
```

が404にならなければ、部室用モデルの準備完了です。

## Stage 2 map

Obstacle cells:

```text
b2,b4,b5,b7,b8,b9,b11,
c2,c4,c5,c11,
d7,d9,d11,
e2,e4,e5,e7,e9,
f2,f4,f11,
g6,g8,g9,
h2,h3,h5,h6,h8,h9,h11
```

Pipes:

```text
a11 top
c1  left
i6  bottom
```

## Windows export-script fix
This package contains an encoding-safe `MAKE_TENNISPLAYER_GLB.bat`.
Double-click that BAT file to create `assets/models/tennisplayer.glb`.
The PowerShell helper is also ASCII-only so Windows PowerShell 5.1 will not misread Japanese UTF-8 text.
