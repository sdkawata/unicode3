import { useState, use } from 'react'
import type { CharacterInfo } from '../db/query'
import { getDisplayName } from '../db/query'
import { getCodePoints, getGraphemeClusterIndices, formatCodePoint } from './format'
import { DetailPanel } from './DetailPanel'

export function CharacterView({ infoPromise, input }: { infoPromise: Promise<Map<number, CharacterInfo>>, input: string }) {
  const charInfos = use(infoPromise)
  const codePoints = getCodePoints(input)
  const graphemeIndices = getGraphemeClusterIndices(input)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(codePoints.length > 0 ? 0 : null)

  if (codePoints.length === 0) return null

  const safeIndex = selectedIndex !== null && selectedIndex < codePoints.length ? selectedIndex : null
  const selectedInfo = safeIndex !== null ? charInfos.get(codePoints[safeIndex]) : null

  return (
    <div className="flex gap-6 h-full">
      {/* Left: Table with independent scroll */}
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
              {codePoints.map((cp, index) => {
                const info = charInfos.get(cp)
                const isSelected = safeIndex === index
                const graphemeIndex = graphemeIndices[index]
                const isEvenCluster = graphemeIndex % 2 === 0
                const clusterBg = isEvenCluster ? 'bg-white' : 'bg-green-50'
                const prevGraphemeIndex = index > 0 ? graphemeIndices[index - 1] : graphemeIndex
                const isClusterStart = graphemeIndex !== prevGraphemeIndex
                return (
                  <tr
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={`cursor-pointer ${isSelected ? 'bg-blue-100' : `${clusterBg} hover:bg-blue-50`} ${isClusterStart ? 'border-t-2 border-t-gray-400' : ''}`}
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
