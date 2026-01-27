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
