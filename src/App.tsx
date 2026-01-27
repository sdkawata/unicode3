import { useState, useTransition, Suspense } from 'react'
import type { CharacterInfo } from './db/query'
import { getCharacterInfo } from './db/query'
import { getCodePoints } from './components/format'
import { CharacterView } from './components/CharacterView'

// Promise cache for character info fetching
const charInfoCache = new Map<string, Promise<Map<number, CharacterInfo>>>()

function fetchCharInfos(input: string): Promise<Map<number, CharacterInfo>> {
  const cached = charInfoCache.get(input)
  if (cached) return cached

  const codePoints = getCodePoints(input)
  if (codePoints.length === 0) {
    const empty = Promise.resolve(new Map<number, CharacterInfo>())
    charInfoCache.set(input, empty)
    return empty
  }

  const promise = (async () => {
    const infos = new Map<number, CharacterInfo>()
    for (const cp of codePoints) {
      if (!infos.has(cp)) {
        const info = await getCharacterInfo(cp)
        if (info) infos.set(cp, info)
      }
    }
    return infos
  })()

  charInfoCache.set(input, promise)
  return promise
}

function App() {
  const [input, setInput] = useState('')
  const [infoPromise, setInfoPromise] = useState(() => fetchCharInfos(''))
  const [, startTransition] = useTransition()

  const handleInputChange = (value: string) => {
    setInput(value)
    startTransition(() => {
      setInfoPromise(fetchCharInfos(value))
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Unicode Viewer
        </h1>

        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="文字列を入力..."
          className="w-full p-4 text-lg bg-white border border-gray-300 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
        />

        <Suspense fallback={<div className="text-gray-500">データベース読み込み中...</div>}>
          <CharacterView infoPromise={infoPromise} input={input} />
        </Suspense>
      </div>
    </div>
  )
}

export default App
