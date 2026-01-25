import { useState } from 'react'
import { unicodeName } from 'unicode-name'

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

  const codePoints = getCodePoints(input)

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Unicode Viewer
        </h1>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="文字列を入力..."
          className="w-full p-4 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
        />

        {codePoints.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">文字</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">コードポイント</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">名前</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {codePoints.map((cp, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-2xl">{String.fromCodePoint(cp)}</td>
                    <td className="px-4 py-3 font-mono text-blue-600">{formatCodePoint(cp)}</td>
                    <td className="px-4 py-3 text-gray-700">{unicodeName(cp) ?? '(unknown)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
