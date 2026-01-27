import { eq, and, lte, gte } from 'drizzle-orm';
import { getDb, schema } from './client-browser';

export type CharacterInfo = {
  codepoint: number;
  name: string | null;
  category: string | null;
  block: string | null;
  blockRange: { start: number; end: number } | null;
  script: string | null;
  bidiClass: string | null;
  decompositionType: string | null;
  eastAsianWidth: string | null;
  isEmoji: boolean;
  aliases: { alias: string; type: string }[];
  decomposition: number[];
  unihanProperties: { property: string; value: string }[];
};

export async function getCharacterInfo(codepoint: number): Promise<CharacterInfo | null> {
  const db = await getDb();

  // Get character data
  const [char] = await db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.codepoint, codepoint))
    .limit(1);

  if (!char) {
    return null;
  }

  // Get name aliases
  const aliases = await db
    .select({
      alias: schema.nameAliases.alias,
      type: schema.nameAliases.type,
    })
    .from(schema.nameAliases)
    .where(eq(schema.nameAliases.codepoint, codepoint));

  // Get decomposition mapping
  const decomp = await db
    .select({
      targetCp: schema.decompositionMappings.targetCp,
      position: schema.decompositionMappings.position,
    })
    .from(schema.decompositionMappings)
    .where(eq(schema.decompositionMappings.sourceCp, codepoint))
    .orderBy(schema.decompositionMappings.position);

  // Get block range
  const [blockRow] = await db
    .select({
      startCp: schema.blocks.startCp,
      endCp: schema.blocks.endCp,
    })
    .from(schema.blocks)
    .where(and(
      lte(schema.blocks.startCp, codepoint),
      gte(schema.blocks.endCp, codepoint),
    ))
    .limit(1);

  // Get Unihan properties
  const unihanProps = await db
    .select({
      property: schema.unihanProperties.property,
      value: schema.unihanProperties.value,
    })
    .from(schema.unihanProperties)
    .where(eq(schema.unihanProperties.codepoint, codepoint));

  return {
    codepoint: char.codepoint,
    name: char.name,
    category: char.category,
    block: char.block,
    blockRange: blockRow ? { start: blockRow.startCp, end: blockRow.endCp } : null,
    script: char.script,
    bidiClass: char.bidiClass,
    decompositionType: char.decompositionType,
    eastAsianWidth: char.eastAsianWidth,
    isEmoji: Boolean(char.isEmoji),
    aliases,
    decomposition: decomp.map(d => d.targetCp),
    unihanProperties: unihanProps,
  };
}

export async function getCharactersInfo(codepoints: number[]): Promise<Map<number, CharacterInfo>> {
  const results = new Map<number, CharacterInfo>();

  // Fetch all characters in parallel
  const promises = codepoints.map(async (cp) => {
    const info = await getCharacterInfo(cp);
    if (info) {
      results.set(cp, info);
    }
  });

  await Promise.all(promises);
  return results;
}

// Helper to get display name (prefer correction alias, then name, then label)
export function getDisplayName(info: CharacterInfo): string {
  // Check for correction alias first
  const correction = info.aliases.find(a => a.type === 'correction');
  if (correction) {
    return correction.alias;
  }

  // Use name if available
  if (info.name) {
    return info.name;
  }

  // Fall back to control alias
  const control = info.aliases.find(a => a.type === 'control');
  if (control) {
    return control.alias;
  }

  // Generate label for unnamed characters
  return `<${info.category}-${info.codepoint.toString(16).toUpperCase().padStart(4, '0')}>`;
}
