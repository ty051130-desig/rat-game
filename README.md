# Rat Escape v10.0

v10.0 では、これまでのシングルプレイ2ステージに加えて、**オンライン2人対戦の試作版**を追加しています。

## 収録内容

- **STAGE 1: 地下室**
  - `assets/models/main_character.glb`
- **STAGE 2: 部室**
  - `assets/models/tennisplayer.glb`
  - 同梱の `assets/source/tennisplayer.blend` から生成可能
- **ONLINE BATTLE**
  - 青: `assets/models/main_character_blue.glb`
  - 赤: `assets/models/main_character_red.glb`
  - 60秒でどちらが多くネズミを捕まえられるか競うモード

## 2人対戦ステージ仕様

- 縦: `a` ～ `l`
- 横: `1` ～ `18`
- 土管:
  - `a4` の上
  - `j1` の左
  - `l11` の下
  - `c18` の右
- 初期位置:
  - 青: 中央付近
  - 赤: 中央付近

## まず最初にやること

### 1. 部室キャラを使う場合（未生成なら）

`assets/source/tennisplayer.blend` から `assets/models/tennisplayer.glb` を作ってください。

Windows なら:

- `MAKE_TENNISPLAYER_GLB.bat`

をダブルクリック。

---

### 2. オンライン対戦を動かす

この v10.0 は **Node.js サーバー** を使って動かします。
GitHub Pages の静的公開だけではオンライン対戦は動きません。

#### Windows で簡単に起動

- `START_ONLINE_SERVER.bat` をダブルクリック

#### 手動で起動する場合

```bash
npm install
npm start
```

起動後、ブラウザで以下を開いてください。

```text
http://localhost:3000
```

## スマホで遊ぶ方法

同じWi-Fi内なら、PCでサーバーを起動した上で、スマホから

```text
http://PCのIPアドレス:3000
```

へアクセスすると遊べます。

例:

```text
http://192.168.1.8:3000
```

## オンライン対戦の流れ

1. タイトルで **ONLINE BATTLE** を押す
2. サーバーURLを確認して **サーバーへ接続**
3. 片方が **部屋を作成**
4. 表示された4文字コードを相手に伝える
5. 相手がコードを入れて **参加**
6. 2人そろうと自動で対戦開始

## 注意

- オンライン対戦は **試作版** です。
- 正面からネズミに触れると、その場で少し足止めされます。
- 背後から触れたプレイヤーに得点が入ります。
- GitHub に push しても、**オンライン対戦には別途サーバー起動が必要** です。

