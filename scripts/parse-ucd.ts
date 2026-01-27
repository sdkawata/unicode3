import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

// Types for parsed data
export interface CharacterData {
  codepoint: number;
  name: string | null;
  category: string;
  bidiClass: string;
  decompositionType: string | null;
  decompositionMapping: number[];
}

export interface NameAlias {
  codepoint: number;
  alias: string;
  type: string;
}

export interface Block {
  startCp: number;
  endCp: number;
  name: string;
}

export interface ScriptRange {
  startCp: number;
  endCp: number;
  script: string;
}

export interface EmojiData {
  codepoint: number;
  isEmoji: boolean;
}

// Parse UnicodeData.txt
// Format: codepoint;name;category;combining;bidi;decomposition;...
export async function parseUnicodeData(filepath: string): Promise<CharacterData[]> {
  const content = await readFile(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  const characters: CharacterData[] = [];
  let rangeStart: { codepoint: number; name: string } | null = null;

  for (const line of lines) {
    const fields = line.split(';');
    const codepoint = parseInt(fields[0], 16);
    let name = fields[1];
    const category = fields[2];
    const bidiClass = fields[4];
    const decomposition = fields[5];

    // Handle range (e.g., "CJK UNIFIED IDEOGRAPH" range)
    if (name.endsWith(', First>')) {
      rangeStart = { codepoint, name: name.replace(', First>', '').replace('<', '') };
      continue;
    }

    if (name.endsWith(', Last>') && rangeStart) {
      const baseName = rangeStart.name;
      // Generate entries for the range
      for (let cp = rangeStart.codepoint; cp <= codepoint; cp++) {
        characters.push({
          codepoint: cp,
          name: `${baseName}-${cp.toString(16).toUpperCase().padStart(4, '0')}`,
          category,
          bidiClass,
          decompositionType: null,
          decompositionMapping: [],
        });
      }
      rangeStart = null;
      continue;
    }

    // Parse decomposition
    let decompositionType: string | null = null;
    let decompositionMapping: number[] = [];

    if (decomposition) {
      const match = decomposition.match(/^<(\w+)>\s*(.*)$/);
      if (match) {
        decompositionType = match[1];
        decompositionMapping = match[2].split(' ').filter(Boolean).map(cp => parseInt(cp, 16));
      } else {
        decompositionType = 'canonical';
        decompositionMapping = decomposition.split(' ').filter(Boolean).map(cp => parseInt(cp, 16));
      }
    }

    // Handle control characters with no name
    if (name.startsWith('<') && name.endsWith('>')) {
      name = null as unknown as string;
    }

    characters.push({
      codepoint,
      name: name || null,
      category,
      bidiClass,
      decompositionType: decompositionMapping.length > 0 ? decompositionType : null,
      decompositionMapping,
    });
  }

  return characters;
}

// Parse NameAliases.txt
// Format: codepoint;alias;type
export async function parseNameAliases(filepath: string): Promise<NameAlias[]> {
  const content = await readFile(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  return lines.map(line => {
    const [cp, alias, type] = line.split(';');
    return {
      codepoint: parseInt(cp, 16),
      alias,
      type,
    };
  });
}

// Parse Blocks.txt
// Format: start..end; Block_Name
export async function parseBlocks(filepath: string): Promise<Block[]> {
  const content = await readFile(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  return lines.map(line => {
    const match = line.match(/^([0-9A-F]+)\.\.([0-9A-F]+)\s*;\s*(.+)$/i);
    if (!match) {
      throw new Error(`Invalid block line: ${line}`);
    }
    return {
      startCp: parseInt(match[1], 16),
      endCp: parseInt(match[2], 16),
      name: match[3].trim(),
    };
  });
}

// Parse Scripts.txt
// Format: codepoint or range ; Script_Name
export async function parseScripts(filepath: string): Promise<ScriptRange[]> {
  const content = await readFile(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  const scripts: ScriptRange[] = [];

  for (const line of lines) {
    const match = line.match(/^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*(\w+)/i);
    if (match) {
      const startCp = parseInt(match[1], 16);
      const endCp = match[2] ? parseInt(match[2], 16) : startCp;
      const script = match[3];
      scripts.push({ startCp, endCp, script });
    }
  }

  return scripts;
}

// Parse emoji-data.txt
// Format: codepoint or range ; Emoji property
export async function parseEmojiData(filepath: string): Promise<Set<number>> {
  const content = await readFile(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  const emojiCodepoints = new Set<number>();

  for (const line of lines) {
    // Only look for "Emoji" property (not Extended_Pictographic, etc.)
    const match = line.match(/^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*Emoji\b/i);
    if (match) {
      const startCp = parseInt(match[1], 16);
      const endCp = match[2] ? parseInt(match[2], 16) : startCp;
      for (let cp = startCp; cp <= endCp; cp++) {
        emojiCodepoints.add(cp);
      }
    }
  }

  return emojiCodepoints;
}

export interface EastAsianWidthRange {
  startCp: number;
  endCp: number;
  width: string;
}

// Parse EastAsianWidth.txt
// Format: codepoint or range ; East_Asian_Width
export async function parseEastAsianWidth(filepath: string): Promise<EastAsianWidthRange[]> {
  const content = await readFile(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  const widths: EastAsianWidthRange[] = [];

  for (const line of lines) {
    const match = line.match(/^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*(\w+)/i);
    if (match) {
      const startCp = parseInt(match[1], 16);
      const endCp = match[2] ? parseInt(match[2], 16) : startCp;
      const width = match[3];
      widths.push({ startCp, endCp, width });
    }
  }

  return widths;
}

export interface UnihanProperty {
  codepoint: number;
  property: string;
  value: string;
}

// Parse all Unihan files in a directory
// Format: U+XXXX\tkPropertyName\tvalue
export async function parseUnihan(dirPath: string): Promise<UnihanProperty[]> {
  const files = await readdir(dirPath);
  const unihanFiles = files.filter(f => f.startsWith('Unihan') && f.endsWith('.txt'));
  const results: UnihanProperty[] = [];

  for (const file of unihanFiles) {
    const content = await readFile(join(dirPath, file), 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const cpMatch = parts[0].match(/^U\+([0-9A-F]+)$/i);
      if (!cpMatch) continue;
      results.push({
        codepoint: parseInt(cpMatch[1], 16),
        property: parts[1],
        value: parts.slice(2).join('\t'),
      });
    }
  }

  return results;
}

// Helper: Find East Asian Width for a codepoint
export function findEastAsianWidth(codepoint: number, widths: EastAsianWidthRange[]): string | null {
  for (const range of widths) {
    if (codepoint >= range.startCp && codepoint <= range.endCp) {
      return range.width;
    }
  }
  return null;
}

// Helper: Find block for a codepoint
export function findBlock(codepoint: number, blocks: Block[]): string | null {
  for (const block of blocks) {
    if (codepoint >= block.startCp && codepoint <= block.endCp) {
      return block.name;
    }
  }
  return null;
}

// Helper: Find script for a codepoint
export function findScript(codepoint: number, scripts: ScriptRange[]): string | null {
  for (const range of scripts) {
    if (codepoint >= range.startCp && codepoint <= range.endCp) {
      return range.script;
    }
  }
  return null;
}
