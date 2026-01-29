import { useState, useTransition, Suspense } from 'react'
import type { CharacterInfo } from './db/query'
import { getCharacterInfo, searchCharacters } from './db/query'
import { getCodePoints } from './components/format'
import { CharacterView } from './components/CharacterView'
import { SearchResultView } from './components/SearchResultView'

type Mode = 'input' | 'search'

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

// Cache for search results
const searchCache = new Map<string, Promise<number[]>>()

function fetchSearchResults(query: string): Promise<number[]> {
  if (query.length < 2) {
    return Promise.resolve([])
  }

  const cached = searchCache.get(query)
  if (cached) return cached

  const promise = searchCharacters(query)
  searchCache.set(query, promise)
  return promise
}

// Cache for fetching char infos by codepoints array
const searchCharInfoCache = new Map<string, Promise<Map<number, CharacterInfo>>>()

function fetchCharInfosForSearch(codepoints: number[]): Promise<Map<number, CharacterInfo>> {
  if (codepoints.length === 0) {
    return Promise.resolve(new Map())
  }

  const key = codepoints.join(',')
  const cached = searchCharInfoCache.get(key)
  if (cached) return cached

  const promise = (async () => {
    const infos = new Map<number, CharacterInfo>()
    for (const cp of codepoints) {
      if (!infos.has(cp)) {
        const info = await getCharacterInfo(cp)
        if (info) infos.set(cp, info)
      }
    }
    return infos
  })()

  searchCharInfoCache.set(key, promise)
  return promise
}

function App() {
  const [mode, setMode] = useState<Mode>('input')
  const [input, setInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [infoPromise, setInfoPromise] = useState(() => fetchCharInfos(''))
  const [searchResultsPromise, setSearchResultsPromise] = useState<Promise<number[]>>(() => Promise.resolve([]))
  const [, startTransition] = useTransition()

  const handleInputChange = (value: string) => {
    setInput(value)
    startTransition(() => {
      setInfoPromise(fetchCharInfos(value))
    })
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    startTransition(() => {
      setSearchResultsPromise(fetchSearchResults(value))
    })
  }

  const handleAddToInput = (char: string) => {
    const newInput = input + char
    setInput(newInput)
    setMode('input')
    startTransition(() => {
      setInfoPromise(fetchCharInfos(newInput))
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-[1600px] mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Unicode Viewer
        </h1>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('input')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'input'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            文字を入力
          </button>
          <button
            onClick={() => setMode('search')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'search'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            検索
          </button>
        </div>

        {/* Input / Search Field */}
        {mode === 'input' ? (
          <input
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="文字列を入力..."
            className="w-full p-4 text-lg bg-white border border-gray-300 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
          />
        ) : (
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="検索... (例: LATIN, YAMA, HIRAGANA)"
            className="w-full p-4 text-lg bg-white border border-gray-300 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
          />
        )}

        {/* Results */}
        <Suspense fallback={<div className="text-gray-500">読み込み中...</div>}>
          {mode === 'input' ? (
            <CharacterView infoPromise={infoPromise} input={input} />
          ) : (
            <SearchResults
              searchResultsPromise={searchResultsPromise}
              onAddToInput={handleAddToInput}
            />
          )}
        </Suspense>
      </div>
    </div>
  )
}

// Wrapper component to handle search results with Suspense
function SearchResults({
  searchResultsPromise,
  onAddToInput,
}: {
  searchResultsPromise: Promise<number[]>
  onAddToInput: (char: string) => void
}) {
  const searchResults = React.use(searchResultsPromise)
  const charInfosPromise = fetchCharInfosForSearch(searchResults)

  if (searchResults.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        検索ワードを入力してください（2文字以上）
      </div>
    )
  }

  return (
    <SearchResultView
      searchResults={searchResults}
      charInfosPromise={charInfosPromise}
      onAddToInput={onAddToInput}
    />
  )
}

import React from 'react'

export default App
