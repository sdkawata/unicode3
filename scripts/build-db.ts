import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

import * as schema from '../src/db/schema';
import {
  parseUnicodeData,
  parseNameAliases,
  parseBlocks,
  parseScripts,
  parseEmojiData,
  findBlock,
  findScript,
} from './parse-ucd';

const UCD_DIR = './data/ucd';
const DB_PATH = './public/unicode.db';

async function main() {
  console.log('Building Unicode database...\n');

  // Remove existing database
  if (existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
    console.log('Removed existing database');
  }

  // Create database
  const sqlite = new Database(DB_PATH);
  const db = drizzle(sqlite, { schema });

  // Create tables
  console.log('Creating tables...');
  sqlite.exec(`
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
      source_cp INTEGER NOT NULL,
      target_cp INTEGER NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (source_cp, position)
    );

    CREATE TABLE name_aliases (
      codepoint INTEGER NOT NULL,
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

    CREATE INDEX idx_characters_name ON characters(name);
    CREATE INDEX idx_characters_block ON characters(block);
    CREATE INDEX idx_decomp_source ON decomposition_mappings(source_cp);
    CREATE INDEX idx_decomp_target ON decomposition_mappings(target_cp);
  `);

  // Parse UCD files
  console.log('Parsing UCD files...');
  const [unicodeData, nameAliases, blocks, scripts, emojiSet] = await Promise.all([
    parseUnicodeData(join(UCD_DIR, 'UnicodeData.txt')),
    parseNameAliases(join(UCD_DIR, 'NameAliases.txt')),
    parseBlocks(join(UCD_DIR, 'Blocks.txt')),
    parseScripts(join(UCD_DIR, 'Scripts.txt')),
    parseEmojiData(join(UCD_DIR, 'emoji/emoji-data.txt')),
  ]);

  console.log(`  UnicodeData: ${unicodeData.length} characters`);
  console.log(`  NameAliases: ${nameAliases.length} aliases`);
  console.log(`  Blocks: ${blocks.length} blocks`);
  console.log(`  Scripts: ${scripts.length} ranges`);
  console.log(`  Emoji: ${emojiSet.size} codepoints`);

  // Insert blocks
  console.log('\nInserting blocks...');
  const insertBlock = sqlite.prepare(
    'INSERT INTO blocks (start_cp, end_cp, name) VALUES (?, ?, ?)'
  );
  for (const block of blocks) {
    insertBlock.run(block.startCp, block.endCp, block.name);
  }

  // Insert characters
  console.log('Inserting characters...');
  const insertChar = sqlite.prepare(`
    INSERT INTO characters (codepoint, name, category, block, script, bidi_class, decomposition_type, is_emoji)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertDecomp = sqlite.prepare(
    'INSERT INTO decomposition_mappings (source_cp, target_cp, position) VALUES (?, ?, ?)'
  );

  let charCount = 0;
  let decompCount = 0;

  const insertTransaction = sqlite.transaction(() => {
    for (const char of unicodeData) {
      const blockName = findBlock(char.codepoint, blocks);
      const scriptName = findScript(char.codepoint, scripts);
      const isEmoji = emojiSet.has(char.codepoint) ? 1 : 0;

      insertChar.run(
        char.codepoint,
        char.name,
        char.category,
        blockName,
        scriptName,
        char.bidiClass,
        char.decompositionType,
        isEmoji
      );
      charCount++;

      // Insert decomposition mappings
      if (char.decompositionMapping.length > 0) {
        for (let i = 0; i < char.decompositionMapping.length; i++) {
          insertDecomp.run(char.codepoint, char.decompositionMapping[i], i);
          decompCount++;
        }
      }
    }
  });

  insertTransaction();
  console.log(`  Inserted ${charCount} characters`);
  console.log(`  Inserted ${decompCount} decomposition mappings`);

  // Insert name aliases
  console.log('Inserting name aliases...');
  const insertAlias = sqlite.prepare(
    'INSERT OR IGNORE INTO name_aliases (codepoint, alias, type) VALUES (?, ?, ?)'
  );

  const aliasTransaction = sqlite.transaction(() => {
    for (const alias of nameAliases) {
      insertAlias.run(alias.codepoint, alias.alias, alias.type);
    }
  });

  aliasTransaction();
  console.log(`  Inserted ${nameAliases.length} aliases`);

  // Optimize database
  console.log('\nOptimizing database...');
  sqlite.exec('VACUUM');
  sqlite.exec('ANALYZE');

  sqlite.close();

  // Report file size
  const { statSync } = await import('fs');
  const stats = statSync(DB_PATH);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`\nDatabase created: ${DB_PATH} (${sizeMB} MB)`);
}

main().catch(console.error);
