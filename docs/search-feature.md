# Unicode 検索機能 設計ドキュメント

## 概要

Unicode 文字を名前や読みで検索できる機能を追加する。検索結果から文字を選択すると、現在の文字分解表示と同じ詳細パネルで情報を確認できる。

## 検索対象

| フィールド | 説明 | 例 |
|-----------|------|-----|
| name | Unicode 文字名 | "LATIN CAPITAL LETTER A" |
| kJapaneseKun | 訓読み（ローマ字） | "YAMA" |
| kJapaneseOn | 音読み（ローマ字） | "SAN" |

※ Unihan の読みはローマ字で格納されている

## アーキテクチャ: FTS4 全文検索

SQLite の FTS4 (Full-Text Search) を使用。DB ビルド時に FTS4 仮想テーブルを作成する。

### パフォーマンス

| 方法 | 検索時間 | 追加サイズ (gzip) |
|------|---------|-----------------|
| **FTS4** | **0.05-0.2ms** | +4MB |
| SQL LIKE | 100-300ms | なし |

### FTS4 トークナイザー (simple) の仕様

| 機能 | 例 | 結果 |
|------|-----|------|
| 大文字小文字 | `latin` | LATIN にマッチ (case-insensitive) |
| 単語境界 | スペース・ハイフンで分割 | `A-B C` → `A`, `B`, `C` |
| 前方一致 | `LAT*` | LATIN にマッチ |
| 複数単語 | `CAPITAL LETTER` | 両方含む行 (AND) |
| OR検索 | `CAPITAL OR SMALL` | どちらか含む行 |
| フレーズ | `"CAPITAL LETTER"` | 連続する単語のみ |

## DB スキーマ

```sql
-- FTS4 仮想テーブル (rowid = codepoint)
CREATE VIRTUAL TABLE search_fts USING fts4(name, readings);

-- データ例
-- rowid: 23665 (U+5C71 山)
-- name: "CJK UNIFIED IDEOGRAPH-5C71"
-- readings: "YAMA SAN"
```

## 検索クエリ

```typescript
// src/db/query.ts
export async function searchCharacters(query: string, limit = 100): Promise<number[]> {
  const db = await getDb()

  // FTS4 MATCH 検索
  const results = await db.all(
    `SELECT rowid as codepoint FROM search_fts WHERE search_fts MATCH ? LIMIT ?`,
    [query, limit]
  )

  return results.map(r => r.codepoint)
}
```

## UI 設計

### モード切り替え方式

```
┌─────────────────────────────────────────────────────────┐
│  [文字を入力] [検索]  ← タブで切り替え                 │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │ 入力/検索欄                                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌────────────────────────┐  ┌─────────────────────┐  │
│  │ 結果リスト             │  │ 詳細パネル          │  │
│  │ (分解 or 検索結果)     │  │ (共通)              │  │
│  └────────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- 「文字を入力」モード: 現在の動作（文字列をコードポイント分解）
- 「検索」モード: FTS4 で検索、結果をリスト表示
- 右側の詳細パネルは共通

### 検索結果からの連携

- クリック: 詳細パネルに表示
- ダブルクリック: 「入力」モードの入力欄に追加

## 実装ステップ

1. **DB ビルド更新**: `scripts/build-db.ts`
   - FTS4 テーブル `search_fts` を作成
   - characters + unihan からデータ投入

2. **検索クエリ追加**: `src/db/query.ts`
   - `searchCharacters(query)` 関数

3. **UI 追加**:
   - モード切り替えタブ
   - SearchResultView コンポーネント
   - App.tsx の状態管理

## 検索結果の表示

```
┌─────┬───────────┬────────────────────────────────────┐
│ 文字 │ コードポイント │ 名前 / 読み                        │
├─────┼───────────┼────────────────────────────────────┤
│  山  │ U+5C71    │ CJK UNIFIED IDEOGRAPH-5C71        │
│  岳  │ U+5CB3    │ CJK UNIFIED IDEOGRAPH-5CB3        │
└─────┴───────────┴────────────────────────────────────┘
```

## ファイル変更一覧

```
scripts/build-db.ts     # FTS4 テーブル作成・データ投入追加
src/db/query.ts         # searchCharacters() 追加
src/App.tsx             # モード切り替え、状態管理
src/components/
  SearchResultView.tsx  # 新規: 検索結果表示
  ModeToggle.tsx        # 新規: タブ切り替え
```
