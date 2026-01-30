import { useTransition, Suspense, useSyncExternalStore, useEffect, useState, useRef } from 'react'
import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router'
import type { CharacterInfo } from './db/query'
import { getCharacterInfo, searchCharacters, preloadSearchIndex, isSearchIndexReady, onSearchIndexReady } from './db/query'
import { getCodePoints } from './components/format'
import { CharacterView } from './components/CharacterView'
import { SearchResultView } from './components/SearchResultView'
import React from 'react'

type Mode = 'input' | 'search'

// Custom hook for IME-aware input with URL sync
function useUrlSyncedInput(paramName: string, searchParams: URLSearchParams, setSearchParams: (params: Record<string, string>, options?: { replace?: boolean }) => void) {
  const urlValue = searchParams.get(paramName) ?? ''
  const [localValue, setLocalValue] = useState(urlValue)
  const isComposingRef = useRef(false)

  // Sync local value when URL changes (e.g., browser back/forward)
  useEffect(() => {
    if (!isComposingRef.current) {
      setLocalValue(urlValue)
    }
  }, [urlValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    // Only update URL if not composing
    if (!isComposingRef.current) {
      setSearchParams(newValue ? { [paramName]: newValue } : {}, { replace: true })
    }
  }

  const handleCompositionStart = () => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false
    // Update URL with the final composed value
    const newValue = e.currentTarget.value
    setSearchParams(newValue ? { [paramName]: newValue } : {}, { replace: true })
  }

  return {
    value: localValue,
    onChange: handleChange,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
  }
}

// Start loading search index immediately on module load
preloadSearchIndex()

// Hook to subscribe to search index ready state
function useSearchIndexReady(): boolean {
  return useSyncExternalStore(
    onSearchIndexReady,
    isSearchIndexReady,
    isSearchIndexReady
  );
}

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

function AppContent({ mode }: { mode: Mode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [, startTransition] = useTransition()

  // IME-aware input handling
  const inputProps = useUrlSyncedInput('text', searchParams, setSearchParams)
  const searchProps = useUrlSyncedInput('q', searchParams, setSearchParams)

  // Get values for data fetching (from URL for consistency)
  const input = mode === 'input' ? (searchParams.get('text') ?? '') : ''
  const searchQuery = mode === 'search' ? (searchParams.get('q') ?? '') : ''

  // Initialize promises based on URL params
  const [infoPromise, setInfoPromise] = React.useState(() => fetchCharInfos(input))
  const [searchResultsPromise, setSearchResultsPromise] = React.useState<Promise<number[]>>(() =>
    mode === 'search' ? fetchSearchResults(searchQuery) : Promise.resolve([])
  )

  // Update promises when URL params change
  useEffect(() => {
    if (mode === 'input') {
      startTransition(() => {
        setInfoPromise(fetchCharInfos(input))
      })
    }
  }, [input, mode])

  useEffect(() => {
    if (mode === 'search') {
      startTransition(() => {
        setSearchResultsPromise(fetchSearchResults(searchQuery))
      })
    }
  }, [searchQuery, mode])

  const handleModeChange = (newMode: Mode) => {
    if (newMode === 'input') {
      navigate('/input')
    } else {
      navigate('/search')
    }
  }

  const handleAddToInput = (char: string) => {
    const newInput = input + char
    navigate(`/input?text=${encodeURIComponent(newInput)}`)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Fixed Header */}
      <div className="shrink-0 px-8 pt-8 pb-4 bg-gray-100">
        <div className="max-w-[1600px] mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            Unicode Viewer
          </h1>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleModeChange('input')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'input'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              文字を入力
            </button>
            <button
              onClick={() => handleModeChange('search')}
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
              value={inputProps.value}
              onChange={inputProps.onChange}
              onCompositionStart={inputProps.onCompositionStart}
              onCompositionEnd={inputProps.onCompositionEnd}
              placeholder="文字列を入力..."
              className="w-full p-4 text-lg bg-white border border-gray-300 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <input
              type="text"
              value={searchProps.value}
              onChange={searchProps.onChange}
              onCompositionStart={searchProps.onCompositionStart}
              onCompositionEnd={searchProps.onCompositionEnd}
              placeholder="検索... (例: LATIN, YAMA, HIRAGANA)"
              className="w-full p-4 text-lg bg-white border border-gray-300 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 px-8 pb-8">
        <div className="max-w-[1600px] mx-auto h-full">
          <Suspense fallback={<div className="text-gray-500">読み込み中...</div>}>
            {mode === 'input' ? (
              <CharacterView infoPromise={infoPromise} input={input} />
            ) : (
              <SearchResults
                searchResultsPromise={searchResultsPromise}
                searchQuery={searchQuery}
                onAddToInput={handleAddToInput}
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )
}

// Wrapper component to handle search results with Suspense
function SearchResults({
  searchResultsPromise,
  searchQuery,
  onAddToInput,
}: {
  searchResultsPromise: Promise<number[]>
  searchQuery: string
  onAddToInput: (char: string) => void
}) {
  const isIndexReady = useSearchIndexReady()
  const searchResults = React.use(searchResultsPromise)
  const charInfosPromise = fetchCharInfosForSearch(searchResults)

  // Show building message if index is not ready and user is trying to search
  if (!isIndexReady && searchQuery.length >= 2) {
    return (
      <div className="text-gray-500 text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600 mr-3 align-middle"></div>
        検索インデックスを構築中...
      </div>
    )
  }

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

function App() {
  return (
    <Routes>
      <Route path="/input" element={<AppContent mode="input" />} />
      <Route path="/search" element={<AppContent mode="search" />} />
      <Route path="/" element={<Navigate to="/input" replace />} />
    </Routes>
  )
}

export default App
