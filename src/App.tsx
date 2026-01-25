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

function App() {
  const [input, setInput] = useState('')
  const [charInfos, setCharInfos] = useState<Map<number, CharacterInfo>>(new Map())
  const [loading, setLoading] = useState(false)
  const [dbReady, setDbReady] = useState(false)

  const codePoints = getCodePoints(input)

  // Initialize DB on mount
  useEffect(() => {
    // Trigger DB initialization
    getCharacterInfo(0x0041).then(() => {
      setDbReady(true)
    }).catch(console.error)
  }, [])

  // Fetch character info when input changes
  useEffect(() => {
    if (!dbReady || codePoints.length === 0) {
      setCharInfos(new Map())
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
    }

    fetchInfos()
  }, [input, dbReady])

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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">文字</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">コードポイント</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">名前</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">カテゴリ</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">ブロック</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Script</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {codePoints.map((cp, index) => {
                  const info = charInfos.get(cp)
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-2xl">
                        {String.fromCodePoint(cp)}
                        {info?.isEmoji && <span className="ml-1 text-xs text-orange-500">emoji</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-blue-600">{formatCodePoint(cp)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {info ? getDisplayName(info) : '(unknown)'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm font-mono">
                        {info?.category ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {info?.block ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {info?.script ?? '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
