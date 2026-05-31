import { useState } from 'react'
import { BookCard } from './BookCard'
import type { ReadingMap, UserProgress } from '../types'
import { useStore } from '../stores/useStore'

const TIER_ORDER = ['foundational', 'core', 'optional', 'advanced', 'paper'] as const

interface Props { map: ReadingMap; progress?: UserProgress }

export function ListView({ map, progress }: Props) {
  const { selectedBookId, setSelectedBook, updateBookStatus, currentMap, progress: allProgress } = useStore()
  const [filterStatus, setFilterStatus] = useState('all')
  const [groupBy, setGroupBy] = useState<'track' | 'tier'>('track')

  const updateConfidence = (bookId: string, confidence: number) => {
    if (!currentMap) return
    const existing = allProgress[currentMap.id]?.bookProgress[bookId]
    if (existing) updateBookStatus(currentMap.id, bookId, existing.status, confidence)
  }

  const filteredBooks = map.books.filter((b) => {
    const status = progress?.bookProgress[b.id]?.status ?? 'unread'
    return filterStatus === 'all' || status === filterStatus
  })

  const totalBooks = map.books.length
  const completedBooks = Object.values(progress?.bookProgress ?? {}).filter((p) => p.status === 'completed').length

  // Build groups
  type Group = { id: string; label: string; color?: string; subtitle?: string; books: typeof filteredBooks }
  const groups: Group[] = groupBy === 'track'
    ? (() => {
        const trackGroups: Group[] = map.tracks
          .map((track) => ({
            id: track.id,
            label: track.name,
            color: track.color,
            subtitle: track.type,
            books: filteredBooks.filter((b) => track.bookIds.includes(b.id)),
          }))
          .filter((g) => g.books.length > 0)
        const inTrack = new Set(map.tracks.flatMap((t) => t.bookIds))
        const orphans = filteredBooks.filter((b) => !inTrack.has(b.id))
        if (orphans.length > 0) {
          trackGroups.push({ id: '__other', label: 'Other', color: '#78716c', subtitle: 'uncategorised', books: orphans })
        }
        return trackGroups
      })()
    : TIER_ORDER.map((tier) => ({
        id: tier, label: tier, books: filteredBooks.filter((b) => b.tier === tier),
      })).filter((g) => g.books.length > 0)

  return (
    <div className="h-full flex flex-col">
      {/* Progress bar */}
      <div className="px-6 py-3 border-b border-stone-800 flex items-center gap-4">
        <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(completedBooks / totalBooks) * 100}%` }} />
        </div>
        <span className="text-xs font-mono text-stone-500 whitespace-nowrap">{completedBooks}/{totalBooks} completed</span>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-stone-800 flex gap-3 flex-wrap items-center">
        {/* Group-by toggle */}
        <div className="flex items-center border border-stone-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setGroupBy('track')}
            className={`px-3 py-1.5 text-xs font-mono transition-colors ${groupBy === 'track' ? 'bg-stone-800 text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}
          >
            By specialization
          </button>
          <button
            onClick={() => setGroupBy('tier')}
            className={`px-3 py-1.5 text-xs font-mono border-l border-stone-800 transition-colors ${groupBy === 'tier' ? 'bg-stone-800 text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}
          >
            By tier
          </button>
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-stone-900 border border-stone-700 rounded-md px-2 py-1 text-xs text-stone-300 font-mono focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="unread">Unread</option>
          <option value="reading">Reading</option>
          <option value="completed">Completed</option>
          <option value="skipped">Skipped</option>
        </select>

        <span className="text-xs text-stone-600 font-mono ml-auto self-center">{filteredBooks.length} items</span>
      </div>

      {/* Track key (only in track mode) */}
      {groupBy === 'track' && map.tracks.length > 0 && (
        <div className="px-6 py-2 border-b border-stone-800 flex flex-wrap gap-3">
          {map.tracks.map((track) => (
            <div key={track.id} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: track.color + '44', border: `1.5px solid ${track.color}` }} />
              <span className="text-xs font-mono" style={{ color: track.color }}>{track.name}</span>
              <span className="text-xs text-stone-600 font-mono">· {track.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* Book list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
        {groups.map(({ id, label, color, subtitle, books }) => (
          <div key={id}>
            <div className="flex items-center gap-3 mb-3">
              {color && (
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color + '33', border: `2px solid ${color}` }} />
              )}
              <h3 className="text-xs font-mono uppercase tracking-widest" style={{ color: color ?? '#78716c' }}>
                {label}
              </h3>
              {subtitle && (
                <span className="text-xs font-mono text-stone-600">· {subtitle}</span>
              )}
              <span className="text-xs font-mono text-stone-600 ml-auto">{books.length}</span>
            </div>

            {/* Papers section within group */}
            {(() => {
              const papers = books.filter((b) => b.tier === 'paper')
              const rest = books.filter((b) => b.tier !== 'paper')
              return (
                <div className="space-y-2">
                  {rest.map((book) => {
                    const node = map.nodes.find((n) => n.bookId === book.id)
                    return (
                      <BookCard key={book.id} book={book} progress={progress?.bookProgress[book.id]}
                        isSelected={selectedBookId === book.id} isCriticalPath={node?.isCriticalPath}
                        isBottleneck={node?.isBottleneck} isUnlocked={node?.isUnlocked}
                        trackColor={color}
                        onClick={() => setSelectedBook(book.id === selectedBookId ? null : book.id)}
                        onStatusChange={(status) => { if (currentMap) updateBookStatus(currentMap.id, book.id, status) }}
                        onConfidenceChange={(c) => updateConfidence(book.id, c)} />
                    )
                  })}
                  {papers.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mt-4 mb-2">
                        <span className="text-xs font-mono text-stone-600 uppercase tracking-widest">📄 Key Papers</span>
                        <div className="flex-1 h-px bg-stone-800" />
                      </div>
                      {papers.map((book) => {
                        const node = map.nodes.find((n) => n.bookId === book.id)
                        return (
                          <BookCard key={book.id} book={book} progress={progress?.bookProgress[book.id]}
                            isSelected={selectedBookId === book.id} isCriticalPath={node?.isCriticalPath}
                            isBottleneck={node?.isBottleneck} isUnlocked={node?.isUnlocked}
                            trackColor={color}
                            onClick={() => setSelectedBook(book.id === selectedBookId ? null : book.id)}
                            onStatusChange={(status) => { if (currentMap) updateBookStatus(currentMap.id, book.id, status) }}
                            onConfidenceChange={(c) => updateConfidence(book.id, c)} />
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        ))}
      </div>
    </div>
  )
}
