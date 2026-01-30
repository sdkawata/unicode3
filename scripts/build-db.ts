import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
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
  parseEastAsianWidth,
  parseUnihan,
  parseJis0208,
  parseCp932,
  parseCldrAnnotations,
  parseStandardizedVariants,
  parseEmojiVariationSequences,
  findBlock,
  findScript,
  findEastAsianWidth,
} from './parse-ucd';

const UCD_DIR = './data/ucd';
const DB_PATH = './public/unicode.db';
const BATCH_SIZE = 500; // SQLite parameter limit workaround

// Helper to chunk array for batch inserts
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  console.log('Building Unicode database...\n');

  // Remove existing database
  if (existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
    console.log('Removed existing database');
  }

  // Create database and apply migrations
  const sqlite = new Database(DB_PATH);
  const db = drizzle(sqlite, { schema });

  // Apply migrations from drizzle folder
  console.log('Applying migrations...');
  migrate(db, { migrationsFolder: './drizzle' });

  // Parse UCD files
  console.log('Parsing UCD files...');
  const [unicodeData, nameAliases, blocks, scripts, eastAsianWidths, emojiSet, unihanData, jis0208Set, cp932Set, cldrAnnotations, standardizedVariants, emojiVariants] = await Promise.all([
    parseUnicodeData(join(UCD_DIR, 'UnicodeData.txt')),
    parseNameAliases(join(UCD_DIR, 'NameAliases.txt')),
    parseBlocks(join(UCD_DIR, 'Blocks.txt')),
    parseScripts(join(UCD_DIR, 'Scripts.txt')),
    parseEastAsianWidth(join(UCD_DIR, 'EastAsianWidth.txt')),
    parseEmojiData(join(UCD_DIR, 'emoji/emoji-data.txt')),
    parseUnihan(join(UCD_DIR, 'Unihan')),
    parseJis0208(join(UCD_DIR, 'mappings/JIS0208.TXT')),
    parseCp932(join(UCD_DIR, 'mappings/CP932.TXT')),
    parseCldrAnnotations(join(UCD_DIR, 'cldr/annotations-en.json')),
    parseStandardizedVariants(join(UCD_DIR, 'StandardizedVariants.txt')),
    parseEmojiVariationSequences(join(UCD_DIR, 'emoji/emoji-variation-sequences.txt')),
  ]);

  // Merge variation sequences (standardized + emoji)
  const allVariationSequences = [...standardizedVariants, ...emojiVariants];

  console.log(`  UnicodeData: ${unicodeData.length} characters`);
  console.log(`  NameAliases: ${nameAliases.length} aliases`);
  console.log(`  Blocks: ${blocks.length} blocks`);
  console.log(`  Scripts: ${scripts.length} ranges`);
  console.log(`  EastAsianWidth: ${eastAsianWidths.length} ranges`);
  console.log(`  Emoji: ${emojiSet.size} codepoints`);
  console.log(`  Unihan: ${unihanData.length} properties`);
  console.log(`  JIS X 0208: ${jis0208Set.size} codepoints`);
  console.log(`  CP932: ${cp932Set.size} codepoints`);
  console.log(`  CLDR Annotations: ${cldrAnnotations.length} entries`);
  console.log(`  Variation Sequences: ${allVariationSequences.length} entries`);

  // Insert blocks using Drizzle
  console.log('\nInserting blocks...');
  const blockValues = blocks.map(block => ({
    startCp: block.startCp,
    endCp: block.endCp,
    name: block.name,
  }));

  for (const batch of chunk(blockValues, BATCH_SIZE)) {
    db.insert(schema.blocks).values(batch).run();
  }
  console.log(`  Inserted ${blocks.length} blocks`);

  // Prepare character and decomposition data
  console.log('Inserting characters...');
  const characterValues: (typeof schema.characters.$inferInsert)[] = [];
  const decompositionValues: (typeof schema.decompositionMappings.$inferInsert)[] = [];

  for (const char of unicodeData) {
    const blockName = findBlock(char.codepoint, blocks);
    const scriptName = findScript(char.codepoint, scripts);
    const eaw = findEastAsianWidth(char.codepoint, eastAsianWidths);
    const isEmoji = emojiSet.has(char.codepoint);
    const isJis0208 = jis0208Set.has(char.codepoint);
    const isCp932 = cp932Set.has(char.codepoint);

    characterValues.push({
      codepoint: char.codepoint,
      name: char.name,
      category: char.category,
      block: blockName,
      script: scriptName,
      bidiClass: char.bidiClass,
      decompositionType: char.decompositionType,
      eastAsianWidth: eaw,
      isEmoji,
      isJis0208,
      isCp932,
    });

    // Collect decomposition mappings
    if (char.decompositionMapping.length > 0) {
      for (let i = 0; i < char.decompositionMapping.length; i++) {
        decompositionValues.push({
          sourceCp: char.codepoint,
          targetCp: char.decompositionMapping[i],
          position: i,
        });
      }
    }
  }

  // Insert characters in batches
  for (const batch of chunk(characterValues, BATCH_SIZE)) {
    db.insert(schema.characters).values(batch).run();
  }
  console.log(`  Inserted ${characterValues.length} characters`);

  // Insert decomposition mappings in batches
  console.log('Inserting decomposition mappings...');
  for (const batch of chunk(decompositionValues, BATCH_SIZE)) {
    db.insert(schema.decompositionMappings).values(batch).run();
  }
  console.log(`  Inserted ${decompositionValues.length} decomposition mappings`);

  // Insert name aliases using Drizzle
  console.log('Inserting name aliases...');
  const aliasValues = nameAliases.map(alias => ({
    codepoint: alias.codepoint,
    alias: alias.alias,
    type: alias.type,
  }));

  for (const batch of chunk(aliasValues, BATCH_SIZE)) {
    db.insert(schema.nameAliases).values(batch).onConflictDoNothing().run();
  }
  console.log(`  Inserted ${nameAliases.length} aliases`);

  // Insert Unihan properties
  console.log('Inserting Unihan properties...');
  const unihanValues = unihanData.map(u => ({
    codepoint: u.codepoint,
    property: u.property,
    value: u.value,
  }));

  for (const batch of chunk(unihanValues, BATCH_SIZE)) {
    db.insert(schema.unihanProperties).values(batch).onConflictDoNothing().run();
  }
  console.log(`  Inserted ${unihanData.length} Unihan properties`);

  // Insert CLDR annotations
  console.log('Inserting CLDR annotations...');
  const cldrValues = cldrAnnotations.map(a => ({
    codepoint: a.codepoint,
    keywords: a.keywords,
    tts: a.tts,
  }));

  for (const batch of chunk(cldrValues, BATCH_SIZE)) {
    db.insert(schema.cldrAnnotations).values(batch).onConflictDoNothing().run();
  }
  console.log(`  Inserted ${cldrAnnotations.length} CLDR annotations`);

  // Insert variation sequences
  console.log('Inserting variation sequences...');
  const variationValues = allVariationSequences.map(v => ({
    baseCp: v.baseCp,
    variationSelector: v.variationSelector,
    description: v.description,
  }));

  for (const batch of chunk(variationValues, BATCH_SIZE)) {
    db.insert(schema.variationSequences).values(batch).onConflictDoNothing().run();
  }
  console.log(`  Inserted ${allVariationSequences.length} variation sequences`);

  // Note: FTS4 search index removed. FlexSearch is used on browser side instead.
  // Search index is built dynamically from characters + unihan_properties tables.

  // Optimize database
  console.log('\nOptimizing database...');
  db.run(sql`VACUUM`);
  db.run(sql`ANALYZE`);

  sqlite.close();

  // Report file size
  const { statSync } = await import('fs');
  const stats = statSync(DB_PATH);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`\nDatabase created: ${DB_PATH} (${sizeMB} MB)`);
}

main().catch(console.error);
