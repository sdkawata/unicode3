import { useState, useEffect } from 'react'
import type { CharacterInfo } from './lib/unicode-db'
import { getCharacterInfo, getDisplayName } from './lib/unicode-db'

function getCodePoints(str: string): number[] {
  const codePoints: number[] = []
  for (const char of str) {
    const cp = char.codePointAt(0)
    if (cp !== undefined) {
      codePoints.push(cp)
    }
  }
  return codePoints
}

function formatCodePoint(cp: number): string {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
}

function DetailPanel({ info }: { info: CharacterInfo }) {
  return (
    <div className="space-y-4">
      {/* Character display */}
      <div className="text-center py-6 bg-gray-50 rounded-lg">
        <div className="text-8xl mb-2">{String.fromCodePoint(info.codepoint)}</div>
        <div className="font-mono text-blue-600 text-xl">{formatCodePoint(info.codepoint)}</div>
      </div>

      {/* Name */}
      <div>
        <div className="text-sm text-gray-500 mb-1">名前</div>
        <div className="font-medium">{getDisplayName(info)}</div>
      </div>

      {/* Basic info grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-500 mb-1">カテゴリ</div>
          <div className="font-mono">{info.category ?? '-'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-1">Script</div>
          <div>{info.script ?? '-'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-1">ブロック</div>
          <div>{info.block ?? '-'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-1">Bidi Class</div>
          <div className="font-mono">{info.bidiClass ?? '-'}</div>
        </div>
      </div>

      {/* Emoji */}
      {info.isEmoji && (
        <div>
          <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">
            Emoji
          </span>
        </div>
      )}

      {/* Decomposition */}
      {info.decompositionType && (
        <div>
          <div className="text-sm text-gray-500 mb-1">分解 ({info.decompositionType})</div>
          <div className="flex gap-2 flex-wrap">
            {info.decomposition.map((cp, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                <span className="text-lg">{String.fromCodePoint(cp)}</span>
                <span className="font-mono text-xs text-gray-500">{formatCodePoint(cp)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Aliases */}
      {info.aliases.length > 0 && (
        <div>
          <div className="text-sm text-gray-500 mb-1">別名</div>
          <div className="space-y-1">
            {info.aliases.map((alias, i) => (
              <div key={i} className="text-sm">
                <span className="text-gray-400">[{alias.type}]</span>{' '}
                <span>{alias.alias}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [input, setInput] = useState('')
  const [charInfos, setCharInfos] = useState<Map<number, CharacterInfo>>(new Map())
  const [loading, setLoading] = useState(false)
  const [dbReady, setDbReady] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const codePoints = getCodePoints(input)

  // Initialize DB on mount
  useEffect(() => {
    getCharacterInfo(0x0041).then(() => {
      setDbReady(true)
    }).catch(console.error)
  }, [])

  // Fetch character info when input changes
  useEffect(() => {
    if (!dbReady || codePoints.length === 0) {
      setCharInfos(new Map())
      setSelectedIndex(null)
      return
    }

    setLoading(true)

    const fetchInfos = async () => {
      const newInfos = new Map<number, CharacterInfo>()
      for (const cp of codePoints) {
        if (!newInfos.has(cp)) {
          const info = await getCharacterInfo(cp)
          if (info) {
            newInfos.set(cp, info)
          }
        }
      }
      setCharInfos(newInfos)
      setLoading(false)
      // Select first character by default
      if (codePoints.length > 0) {
        setSelectedIndex(0)
      }
    }

    fetchInfos()
  }, [input, dbReady])

  const selectedInfo = selectedIndex !== null ? charInfos.get(codePoints[selectedIndex]) : null

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Unicode Viewer
        </h1>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={dbReady ? "文字列を入力..." : "データベース読み込み中..."}
          disabled={!dbReady}
          className="w-full p-4 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6 disabled:bg-gray-200"
        />

        {loading && (
          <div className="text-gray-500 mb-4">読み込み中...</div>
        )}

        {codePoints.length > 0 && !loading && (
          <div className="flex gap-6">
            {/* Left: Table */}
            <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">文字</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">コードポイント</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">名前</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {codePoints.map((cp, index) => {
                    const info = charInfos.get(cp)
                    const isSelected = selectedIndex === index
                    return (
                      <tr
                        key={index}
                        onClick={() => setSelectedIndex(index)}
                        className={`cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3 text-2xl">{String.fromCodePoint(cp)}</td>
                        <td className="px-4 py-3 font-mono text-blue-600">{formatCodePoint(cp)}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {info ? getDisplayName(info) : '(unknown)'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Right: Detail Panel */}
            <div className="w-80 bg-white rounded-lg shadow p-6">
              {selectedInfo ? (
                <DetailPanel info={selectedInfo} />
              ) : (
                <div className="text-gray-400 text-center py-8">
                  文字を選択してください
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
