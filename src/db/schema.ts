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
  eastAsianWidth: text('east_asian_width'),       // F, H, W, Na, A, N
  isEmoji: integer('is_emoji', { mode: 'boolean' }),
  isJis0208: integer('is_jis_0208', { mode: 'boolean' }),  // JIS X 0208 に含まれる
  isCp932: integer('is_cp932', { mode: 'boolean' }),       // CP932 (Windows-31J) に含まれる
}, (table) => [
  index('idx_characters_name').on(table.name),
  index('idx_characters_block').on(table.block),
]);

// 分解マッピングテーブル（複合主キー）
export const decompositionMappings = sqliteTable('decomposition_mappings', {
  sourceCp: integer('source_cp').notNull(),
  targetCp: integer('target_cp').notNull(),
  position: integer('position').notNull(),  // 分解先の順序 (0, 1, 2...)
}, (table) => [
  primaryKey({ columns: [table.sourceCp, table.position] }),
  index('idx_decomp_source').on(table.sourceCp),
  index('idx_decomp_target').on(table.targetCp),
]);

// 名前別名テーブル（複合主キー）
export const nameAliases = sqliteTable('name_aliases', {
  codepoint: integer('codepoint').notNull(),
  alias: text('alias').notNull(),
  type: text('type').notNull(),      // correction, control, figment, alternate, abbreviation
}, (table) => [
  primaryKey({ columns: [table.codepoint, table.type, table.alias] }),
]);

// Unihanプロパティテーブル（複合主キー）
export const unihanProperties = sqliteTable('unihan_properties', {
  codepoint: integer('codepoint').notNull(),
  property: text('property').notNull(),
  value: text('value').notNull(),
}, (table) => [
  primaryKey({ columns: [table.codepoint, table.property] }),
  index('idx_unihan_codepoint').on(table.codepoint),
]);

// ブロック範囲テーブル（複合主キー）
export const blocks = sqliteTable('blocks', {
  startCp: integer('start_cp').notNull(),
  endCp: integer('end_cp').notNull(),
  name: text('name').notNull(),
}, (table) => [
  primaryKey({ columns: [table.startCp, table.endCp] }),
]);
