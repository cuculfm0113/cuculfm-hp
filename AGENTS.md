# HP プロジェクト

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

- サイトURL: https://cuculfm-hp.netlify.app
- 管理画面: https://app.netlify.com/projects/cuculfm-hp
- Site ID: `6121d456-5d60-4371-b63c-25372f32737d`

```bash
# 手動デプロイ（本番）
netlify deploy --prod --dir=.

# プレビューデプロイ（確認用）
netlify deploy --dir=.
```

### 更新の流れ

1. コードを編集
2. `git add . && git commit -m "説明" && git push`
3. `netlify deploy --prod --dir=.` で本番反映
