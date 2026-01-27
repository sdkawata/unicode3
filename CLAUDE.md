# Unicode Viewer

Unicode 文字のプロパティを閲覧できる Web アプリ。入力文字列をコードポイント単位で分解し、各文字の詳細情報を表示する。

## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Tailwind CSS (Vite)
- **DB**: SQLite (sql.js でブラウザ上で動作) + Drizzle ORM
- **ビルド時DB構築**: better-sqlite3 + Drizzle ORM (Node.js)
- **データソース**: Unicode Character Database (UCD) 16.0.0 + Unihan

## ディレクトリ構成

```
src/
  App.tsx              # メイン UI (入力欄、文字テーブル、詳細パネル)
  main.tsx             # エントリポイント
  db/
    schema.ts          # Drizzle テーブル定義 (characters, decompositionMappings, nameAliases, blocks, unihanProperties)
    client-browser.ts  # ブラウザ用 sql.js DB クライアント
  lib/
    unicode-db.ts      # DB アクセス関数 (getCharacterInfo, getDisplayName)
scripts/
  download-ucd.ts      # UCD ファイル + Unihan.zip をダウンロード → data/ucd/
  parse-ucd.ts         # UCD テキストファイルをパースする関数群
  build-db.ts          # パース結果を SQLite DB に投入 → public/unicode.db
drizzle/               # Drizzle マイグレーション SQL (gitignore)
data/ucd/              # ダウンロードした UCD ファイル (gitignore)
public/unicode.db      # ビルド済み DB (gitignore)
```

## npm scripts

```
npm run ucd:download   # UCD ファイルをダウンロード
npm run ucd:build      # マイグレーション生成 + DB ビルド
npm run ucd:all        # download → build を一括実行
npm run db:generate    # Drizzle マイグレーション生成 (drizzle-kit generate)
npm run dev            # Vite 開発サーバー起動
npm run build          # プロダクションビルド
```

## データパイプライン

1. `ucd:download` — unicode.org から UCD テキストファイルと Unihan.zip を取得・展開
2. `db:generate` — `src/db/schema.ts` からマイグレーション SQL を生成
3. `build-db.ts` — マイグレーション適用 → UCD パース → バッチインサート → VACUUM/ANALYZE
4. ブラウザは `public/unicode.db` を fetch して sql.js で開く

## 注意事項

- `drizzle/` はコミットしない。毎回 DB を新規作成するため過去のマイグレーション履歴は不要。

## スキーマ変更時の手順

1. `src/db/schema.ts` を編集
2. `npx drizzle-kit generate` でマイグレーション生成
3. `scripts/parse-ucd.ts` にパーサー追加 (必要なら)
4. `scripts/build-db.ts` にインサート処理追加
5. `src/lib/unicode-db.ts` でクエリ追加
6. `src/App.tsx` で UI 追加
7. `npm run ucd:all` で検証
