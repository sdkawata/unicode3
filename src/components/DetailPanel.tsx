import type { CharacterInfo } from '../db/query'
import { getDisplayName } from '../db/query'
import { formatCodePoint, formatCategory, formatEastAsianWidth } from './format'

export function DetailPanel({ info }: { info: CharacterInfo }) {
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

      {/* Basic info */}
      <div className="space-y-3">
        <div>
          <div className="text-sm text-gray-500 mb-1">カテゴリ</div>
          <div className="font-mono">{formatCategory(info.category)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-1">Script</div>
          <div>{info.script ?? '-'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-1">ブロック</div>
          <div>
            {info.block ?? '-'}
            {info.blockRange && (
              <span className="text-gray-400 ml-1">
                ({formatCodePoint(info.blockRange.start)}..{formatCodePoint(info.blockRange.end)})
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-1">Bidi Class</div>
          <div className="font-mono">{info.bidiClass ?? '-'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-1">East Asian Width</div>
          <div className="font-mono">{formatEastAsianWidth(info.eastAsianWidth)}</div>
        </div>
      </div>

      {/* Tags */}
      {(info.isEmoji || info.isJis0208 || info.isCp932) && (
        <div className="flex gap-2 flex-wrap">
          {info.isEmoji && (
            <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">
              Emoji
            </span>
          )}
          {info.isJis0208 && (
            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
              JIS X 0208
            </span>
          )}
          {info.isCp932 && (
            <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
              CP932
            </span>
          )}
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

      {/* Unihan Properties */}
      {info.unihanProperties.length > 0 && (
        <div>
          <div className="text-sm text-gray-500 mb-1">Unihan プロパティ</div>
          <div className="space-y-1">
            {info.unihanProperties.map((prop, i) => (
              <div key={i} className="text-sm">
                <span className="text-gray-400">{prop.property}</span>{' '}
                <span>{prop.value}</span>
              </div>
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
