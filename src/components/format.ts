export function getCodePoints(str: string): number[] {
  const codePoints: number[] = []
  for (const char of str) {
    const cp = char.codePointAt(0)
    if (cp !== undefined) {
      codePoints.push(cp)
    }
  }
  return codePoints
}

// Returns an array mapping each codepoint index to its grapheme cluster index
export function getGraphemeClusterIndices(str: string): number[] {
  const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' })
  const segments = [...segmenter.segment(str)]
  const indices: number[] = []

  for (let clusterIndex = 0; clusterIndex < segments.length; clusterIndex++) {
    const segment = segments[clusterIndex]
    const codePointCount = [...segment.segment].length
    for (let i = 0; i < codePointCount; i++) {
      indices.push(clusterIndex)
    }
  }

  return indices
}

export function formatCodePoint(cp: number): string {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
}

const categoryNames: Record<string, string> = {
  Lu: 'Uppercase Letter',
  Ll: 'Lowercase Letter',
  Lt: 'Titlecase Letter',
  Lm: 'Modifier Letter',
  Lo: 'Other Letter',
  Mn: 'Nonspacing Mark',
  Mc: 'Spacing Mark',
  Me: 'Enclosing Mark',
  Nd: 'Decimal Number',
  Nl: 'Letter Number',
  No: 'Other Number',
  Pc: 'Connector Punctuation',
  Pd: 'Dash Punctuation',
  Ps: 'Open Punctuation',
  Pe: 'Close Punctuation',
  Pi: 'Initial Punctuation',
  Pf: 'Final Punctuation',
  Po: 'Other Punctuation',
  Sm: 'Math Symbol',
  Sc: 'Currency Symbol',
  Sk: 'Modifier Symbol',
  So: 'Other Symbol',
  Zs: 'Space Separator',
  Zl: 'Line Separator',
  Zp: 'Paragraph Separator',
  Cc: 'Control',
  Cf: 'Format',
  Cs: 'Surrogate',
  Co: 'Private Use',
  Cn: 'Unassigned',
}

export function formatCategory(cat: string | null): string {
  if (!cat) return '-'
  const name = categoryNames[cat]
  return name ? `${cat} (${name})` : cat
}

export function formatEastAsianWidth(eaw: string | null): string {
  if (!eaw) return '-'
  const names: Record<string, string> = {
    F: 'Fullwidth',
    H: 'Halfwidth',
    W: 'Wide',
    Na: 'Narrow',
    A: 'Ambiguous',
    N: 'Neutral',
  }
  return `${eaw} (${names[eaw] ?? 'Unknown'})`
}
