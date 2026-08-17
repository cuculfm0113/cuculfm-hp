# CUCUL FM 公式キャラクター「ネオン・ファントムDJ」仕様書

CUCUL FM のロゴ(顔なしの黒い人物 + 白のXペイント + ネオンイエロー/シアン + 金の三日月)をベースにした全身3Dキャラクター。
このフォルダの画像を参考素材として、Claude Code で3Dモデルを制作するための仕様書。

## 参考画像

| ファイル | 内容 |
|---|---|
| `cucul-logo.png` | CUCUL FM 元ロゴ(デザインの原点。色・質感・三日月の参照元) |
| `cucul-design-01-phantom-dj.png` | メインコンセプトアート(全身・雰囲気の基準) |
| `cucul-phantom-dj-turnaround.png` | 三面図(正面/側面/背面、Aポーズ)。モデリングの形状基準 |
| `cucul-phantom-dj-details.png` | ディテールシート(頭部/ヘッドホン/コート裏地/背面エンブレム/ブーツ) |

## キャラクター仕様

### 全体
- 体型: 細身で長身。頭身は約7.5
- シルエット: ロングコートの裾が広がる縦長シルエット
- 雰囲気: ダーク、クール、ネオン、グランジ

### 頭部
- 顔は存在しない。頭部全体がマットな黒
- 表面はひび割れた石膏のようなクラックテクスチャ
- 顔面に白いXのラフなペイント(筆致が荒い)。Xの交点がわずかに暖色(白〜黄)で発光
- 目・鼻・口のジオメトリは不要。発光はエミッシブテクスチャで表現

### 服装
- ロングトレンチコート: マットブラックのテックウェア風。丈は膝下
  - 裏地に回路パターン状のネオンライン(イエロー #FFD400 / シアン #00E5FF)がエミッシブ発光
  - コートの縁(エッジ)にシアンの細い発光ライン
  - 背面に金色 #D4A017 の装飾的な三日月エンブレム(ロゴ由来。刺繍/箔押し風)
- インナー: 黒のシャツ + ストラップ類
- パンツ: 黒のタクティカルパンツ
- ブーツ: 黒のコンバットブーツ。側面に小さなシアンのXマーク

### 小物
- ヘッドホン: 首に掛けた状態。イヤーカップの縁がシアンに発光(リング状エミッシブ)

### カラーパレット
| 用途 | 色 |
|---|---|
| ベース(黒) | #111111 (マット) |
| Xペイント | #F5F5F5 (エミッシブ交点: #FFE9A0) |
| ネオンイエロー | #FFD400 |
| ネオンシアン | #00E5FF |
| ゴールド(三日月) | #D4A017 |

### マテリアル方針
- 布(コート/パンツ): ラフネス高め、メタリック0
- 頭部: マット + クラックのノーマルマップ
- 発光部: エミッシブマップ(Bloomはレンダラー側で付与)
- 三日月エンブレム: メタリック高め、ゴールド

## Claude Code への依頼プロンプト例

### A. Three.js でWeb表示用モデルを作る場合

```text
character-design/phantom-dj/ フォルダの README.md と参考画像4枚を読んでください。
この仕様のキャラクター「ネオン・ファントムDJ」を Three.js で表示するページを作ってください。

要件:
- 三面図(cucul-phantom-dj-turnaround.png)のプロポーションに合わせてプリミティブ+カスタムジオメトリで全身を構築
- カラーパレットとマテリアル方針はREADME通り(エミッシブ発光 + UnrealBloomPass)
- OrbitControlsで回転できるターンテーブル表示
- 背景は暗めのグラデーション + 薄いフォグ
```

### B. Blender (Pythonスクリプト) でモデルを作る場合

```text
character-design/phantom-dj/ フォルダの README.md と参考画像4枚を読んでください。
この仕様のキャラクターを生成する Blender 用 Python スクリプトを書いてください。

要件:
- 三面図に合わせたプロポーションでベースメッシュを構築(頭部、胴体、コート、脚、ブーツ、ヘッドホン)
- マテリアルはPrincipled BSDFで README のパレット通りに設定(発光部はEmission)
- リギングしやすいようにパーツごとにオブジェクトを分ける
- スクリプト実行だけで完結すること
```

### C. 画像生成/image-to-3D ツール(Meshy, Tripoなど)に渡す場合

```text
Full-body 3D character: tall slim faceless humanoid, matte black cracked-plaster head,
glowing white X paint across the face, long black techwear trench coat with neon yellow
and cyan glowing circuit-pattern inner lining, golden ornamental crescent moon emblem
on the back, cyan-glowing headphones around neck, black tactical pants and combat boots,
A-pose, dark grunge aesthetic, game character, PBR materials
```
