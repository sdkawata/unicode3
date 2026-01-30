import { useState, use } from 'react'
import type { CharacterInfo } from '../db/query'
import { getDisplayName } from '../db/query'
import { formatCodePoint } from './format'
import { DetailPanel } from './DetailPanel'

type Props = {
  searchResults: number[]
  charInfosPromise: Promise<Map<number, CharacterInfo>>
}

export function SearchResultView({ searchResults, charInfosPromise }: Props) {
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
    <div className="flex gap-6 h-full">
      {/* Left: Results Table with independent scroll */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">文字</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">コードポイント</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">名前</th>
            </tr>
          </thead>
        </table>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Detail Panel with independent scroll */}
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
