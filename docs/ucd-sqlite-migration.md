# Unicode Viewer データ基盤改修 企画書

## 1. 概要

外部ライブラリ（unicode-name）への依存を排除し、Unicode Character Database (UCD) から直接データを取得・加工してSQLiteデータベースを構築。ブラウザ上ではsql.jsを使用してクエリを実行する。

## 2. 目的

- 外部ライブラリへの依存排除
- Unicodeバージョンの柔軟な管理
- より詳細なUnicode情報の提供
- クエリによる柔軟なデータ取得

## 3. 技術スタック

| 項目 | 技術 |
|------|------|
| データソース | UCD (Unicode 16.0) |
| ORM | Drizzle ORM（スキーマ共有・型安全） |
| DB生成 (Node) | drizzle-orm + better-sqlite3 |
| ブラウザSQL | drizzle-orm + sql.js (SQLite WASM) |
| 配信形式 | .dbファイル (public/に配置) |

## 4. UCDデータソース

取得するファイル（unicode.org/Public/16.0.0/ucd/）:

| ファイル | 内容 |
|----------|------|
| `UnicodeData.txt` | 基本情報（Name, Category, Bidi, 分解など） |
| `NameAliases.txt` | 名前の別名（correction, control, figment等） |
| `Blocks.txt` | ブロック範囲と名前 |
| `Scripts.txt` | Script情報 |
| `PropertyValueAliases.txt` | プロパティ値の別名 |
| `emoji/emoji-data.txt` | Emoji判定用 |

## 5. データベース設計（Drizzle スキーマ）

```typescript
// src/db/schema.ts - Node/ブラウザ両環境で共有
import { sqliteTable, integer, text, index, primaryKey } from 'drizzle-orm/sqlite-core';

// メインテーブル: 文字情報
export const characters = sqliteTable('characters', {
  codepoint: integer('codepoint').primaryKey(),
  name: text('name'),
  category: text('category'),        // General_Category (Lu, Ll, etc.)
  block: text('block'),
  script: text('script'),
  bidiClass: text('bidi_class'),
  decompositionType: text('decomposition_type'),  // canonical, compat, circle, wide, narrow, etc. (null = 分解なし)
  isEmoji: integer('is_emoji', { mode: 'boolean' }),
}, (table) => [
  index('idx_characters_name').on(table.name),
  index('idx_characters_block').on(table.block),
]);

// 分解マッピングテーブル（複合主キー）
export const decompositionMappings = sqliteTable('decomposition_mappings', {
  sourceCp: integer('source_cp').notNull().references(() => characters.codepoint),
  targetCp: integer('target_cp').notNull().references(() => characters.codepoint),
  position: integer('position').notNull(),  // 分解先の順序 (0, 1, 2...)
}, (table) => [
  primaryKey({ columns: [table.sourceCp, table.position] }),
  index('idx_decomp_target').on(table.targetCp),
]);

// 名前別名テーブル（複合主キー）
export const nameAliases = sqliteTable('name_aliases', {
  codepoint: integer('codepoint').notNull().references(() => characters.codepoint),
  alias: text('alias').notNull(),
  type: text('type').notNull(),      // correction, control, figment, alternate, abbreviation
}, (table) => [
  primaryKey({ columns: [table.codepoint, table.type, table.alias] }),
]);

// ブロック範囲テーブル（複合主キー）
export const blocks = sqliteTable('blocks', {
  startCp: integer('start_cp').notNull(),
  endCp: integer('end_cp').notNull(),
  name: text('name').notNull(),
}, (table) => [
  primaryKey({ columns: [table.startCp, table.endCp] }),
]);
```

### 生成されるSQL

```sql
CREATE TABLE characters (
  codepoint INTEGER PRIMARY KEY,
  name TEXT,
  category TEXT,
  block TEXT,
  script TEXT,
  bidi_class TEXT,
  decomposition_type TEXT,
  is_emoji INTEGER
);

CREATE TABLE decomposition_mappings (
  source_cp INTEGER NOT NULL REFERENCES characters(codepoint),
  target_cp INTEGER NOT NULL REFERENCES characters(codepoint),
  position INTEGER NOT NULL,
  PRIMARY KEY (source_cp, position)
);

CREATE TABLE name_aliases (
  codepoint INTEGER NOT NULL REFERENCES characters(codepoint),
  alias TEXT NOT NULL,
  type TEXT NOT NULL,
  PRIMARY KEY (codepoint, type, alias)
);

CREATE TABLE blocks (
  start_cp INTEGER NOT NULL,
  end_cp INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (start_cp, end_cp)
);
```

### データ例: 分解マッピング

```
À (U+00C0) → カノニカル分解 → A (U+0041) + ◌̀ (U+0300)
```

**characters:**
| codepoint | name | decomposition_type |
|-----------|------|-------------------|
| 0x00C0 | LATIN CAPITAL LETTER A WITH GRAVE | canonical |
| 0x0041 | LATIN CAPITAL LETTER A | null |
| 0x0300 | COMBINING GRAVE ACCENT | null |

**decomposition_mappings:**
| source_cp | target_cp | position |
|-----------|-----------|----------|
| 0x00C0 | 0x0041 | 0 |
| 0x00C0 | 0x0300 | 1 |

## 6. システム構成

```
unicode3/
├── scripts/                    # データ生成スクリプト
│   ├── download-ucd.ts        # UCDダウンロード
│   ├── parse-ucd.ts           # UCDパース
│   └── build-db.ts            # SQLite DB生成（Drizzle使用）
├── src/
│   ├── db/
│   │   ├── schema.ts          # Drizzleスキーマ定義（共有）
│   │   ├── client-node.ts     # Node.js用DBクライアント
│   │   └── client-browser.ts  # ブラウザ用DBクライアント
│   ├── lib/
│   │   └── unicode-db.ts      # アプリ用ラッパー
│   └── App.tsx                # UI（既存を改修）
├── public/
│   └── unicode.db             # 生成されたDB（約10-15MB想定）
├── drizzle.config.ts          # Drizzle設定
└── package.json
```

## 7. Drizzle ORM 使用例

### Node.js側（DB生成時）

```typescript
// scripts/build-db.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/db/schema';

const sqlite = new Database('public/unicode.db');
const db = drizzle(sqlite, { schema });

// データ挿入
await db.insert(schema.characters).values({
  codepoint: 0x0041,
  name: 'LATIN CAPITAL LETTER A',
  category: 'Lu',
  block: 'Basic Latin',
  script: 'Latin',
  bidiClass: 'L',
  isEmoji: false,
});
```

### ブラウザ側（データ取得時）

```typescript
// src/db/client-browser.ts
import initSqlJs from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import { eq } from 'drizzle-orm';
import * as schema from './schema';

export async function createBrowserDb() {
  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
  });

  const response = await fetch('/unicode.db');
  const buffer = await response.arrayBuffer();
  const sqlite = new SQL.Database(new Uint8Array(buffer));

  return drizzle(sqlite, { schema });
}

// クエリ例
const char = await db.select()
  .from(schema.characters)
  .where(eq(schema.characters.codepoint, 0x0041));
```

## 8. 実装タスク

### Phase 1: 基盤構築
1. Drizzle ORM + 関連パッケージ導入
2. `src/db/schema.ts` - スキーマ定義

### Phase 2: データ生成（Node.js）
3. `scripts/download-ucd.ts` - UCDファイルのダウンロード
4. `scripts/parse-ucd.ts` - 各UCDファイルのパーサー
5. `scripts/build-db.ts` - SQLite DB生成（Drizzle使用）

### Phase 3: ブラウザ側実装
6. sql.js導入・Vite設定
7. `src/db/client-browser.ts` - ブラウザ用DBクライアント
8. `src/lib/unicode-db.ts` - アプリ用ラッパー
9. `src/App.tsx` 改修 - 新DBを使用

### Phase 4: 統合・最適化
10. npm scriptsでビルドパイプライン構築
11. DBサイズ最適化（必要に応じて）

## 9. 依存パッケージ

### 本番依存 (dependencies)
```
drizzle-orm          # ORM本体
sql.js               # ブラウザ用SQLite WASM
```

### 開発依存 (devDependencies)
```
better-sqlite3       # Node.js用SQLiteドライバ
@types/better-sqlite3
drizzle-kit          # マイグレーション・スキーマ生成ツール
tsx                  # TypeScript実行
```

## 10. npm scripts (予定)

```json
{
  "scripts": {
    "ucd:download": "tsx scripts/download-ucd.ts",
    "ucd:build": "tsx scripts/build-db.ts",
    "ucd:all": "npm run ucd:download && npm run ucd:build",
    "db:generate": "drizzle-kit generate"
  }
}
```

## 11. 想定データサイズ

| 項目 | 推定サイズ |
|------|-----------|
| UnicodeData.txt | 約2MB |
| 生成DB (圧縮前) | 約10-15MB |
| sql.js WASM | 約1MB |
| drizzle-orm | 約50KB (gzip) |
