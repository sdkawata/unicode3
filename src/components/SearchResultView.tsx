import { useState, use } from 'react'
import type { CharacterInfo } from '../db/query'
import { getDisplayName } from '../db/query'
import { formatCodePoint } from './format'
import { DetailPanel } from './DetailPanel'

type Props = {
  searchResults: number[]
  charInfosPromise: Promise<Map<number, CharacterInfo>>
  onAddToInput: (char: string) => void
}

export function SearchResultView({ searchResults, charInfosPromise, onAddToInput }: Props) {
  const charInfos = use(charInfosPromise)
  const [selectedCp, setSelectedCp] = useState<number | null>(
    searchResults.length > 0 ? searchResults[0] : null
  )

  if (searchResults.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        検索結果がありません
      </div>
    )
  }

  const selectedInfo = selectedCp !== null ? charInfos.get(selectedCp) : null

  return (
    <div className="flex gap-6">
      {/* Left: Results Table */}
      <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">文字</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">コードポイント</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">名前</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {searchResults.map((cp) => {
              const info = charInfos.get(cp)
              const isSelected = selectedCp === cp
              return (
                <tr
                  key={cp}
                  onClick={() => setSelectedCp(cp)}
                  className={`cursor-pointer ${isSelected ? 'bg-blue-100' : 'bg-white hover:bg-blue-50'}`}
                >
                  <td className="px-4 py-3 text-2xl">{String.fromCodePoint(cp)}</td>
                  <td className="px-4 py-3 font-mono text-blue-600">{formatCodePoint(cp)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {info
                      ? getDisplayName(info)
                      : <span className="inline-block h-4 w-48 bg-gray-200 rounded animate-pulse" />
                    }
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddToInput(String.fromCodePoint(cp))
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="入力欄に追加"
                    >
                      + 追加
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Right: Detail Panel */}
      <div className="w-[480px] shrink-0 bg-white rounded-lg shadow p-6 overflow-y-auto">
        {selectedInfo ? (
          <DetailPanel info={selectedInfo} />
        ) : (
          <div className="text-gray-400 text-center py-8">
            文字を選択してください
          </div>
        )}
      </div>
    </div>
  )
}
