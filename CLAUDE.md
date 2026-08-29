# HP プロジェクト

## 進行中の改修プロジェクト（2026-08）

FDE・AI実装支援の追加を軸としたサイト改修を実装中。
**実装作業の前に必ず `docs/redesign/00-implementation-brief.md` を全文読むこと**
（要件全文・確定事項・コードベース調査・フェーズ手順を集約した引き継ぎ書）。

## Git バージョン管理の使い方

リモートリポジトリ: `cuculfm0113/cuculfm-hp`

```bash
# 変更をコミットしてpush
git add .
git commit -m "変更内容の説明"
git push

# 変更履歴を確認
git log --oneline

# 変更内容を確認
git status
git diff
```

## Netlify デプロイ

- 本番URL: https://cucul-fm.com （旧: https://cuculfm-hp.netlify.app）
- 管理画面: https://app.netlify.com/projects/cuculfm-hp
- Site ID: `6121d456-5d60-4371-b63c-25372f32737d`

### ⚠️ push すると本番に出る

このサイトは GitHub リポジトリと連携していて、**`main` に push した時点で自動的に
本番へ反映される**。`netlify deploy --prod` を打つ必要はなく、**打たなくても出る**。
（2026-08-29 実測。以前ここに書かれていた「手動デプロイ」の手順は誤りだった）

### 更新の流れ

1. コードを編集
2. `content/` を触ったら `node scripts/build-content.mjs` で各HTMLへ反映
3. `node scripts/test-build-content.mjs` が全件合格することを確認
4. `git add . && git commit -m "説明" && git push` → これで本番反映

プレビューで確認したい変更は、`main` ではなく別ブランチへ push する。

```bash
# デプロイ状況の確認
netlify api listSiteDeploys --data '{"site_id":"6121d456-5d60-4371-b63c-25372f32737d","per_page":3}'

# 本番の状態を見る
curl -s -o /dev/null -w "%{http_code}\n" https://cucul-fm.com/
```

運用手順（フォーム通知先・GA4・会社情報の更新）は `docs/redesign/07-update-guide.md` を参照。
