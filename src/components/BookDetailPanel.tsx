import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, ExternalLink, AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import type { Book, ReadingMap, BookProgress } from '../types'
import { explainBook } from '../lib/generator'

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  foundational: { label: 'Foundational', color: '#f97316' },
  core:         { label: 'Core',         color: '#3b82f6' },
  optional:     { label: 'Optional',     color: '#22c55e' },
  advanced:     { label: 'Advanced',     color: '#a855f7' },
  paper:        { label: 'Paper',        color: '#e879f9' },
}

interface Props {
  book: Book
  map: ReadingMap
  apiKey: string
  progress?: BookProgress
  onClose: () => void
}

export function BookDetailPanel({ book, map, apiKey, progress, onClose }: Props) {
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [explainError, setExplainError] = useState<string | null>(null)

  const track = map.tracks.find((t) => t.bookIds.includes(book.id))
  const tier = TIER_CONFIG[book.tier] ?? TIER_CONFIG.core
  const isPaper = book.tier === 'paper'

  const prereqBooks = book.prerequisites
    .map((id) => map.books.find((b) => b.id === id))
    .filter(Boolean) as Book[]
  const unlockBooks = book.unlocks
    .map((id) => map.books.find((b) => b.id === id))
    .filter(Boolean) as Book[]

  const fetchExplanation = async () => {
    if (explanation || loading) return
    setLoading(true)
    setExplainError(null)
    try {
      const text = await explainBook(apiKey, book, map.topic, track?.name)
      setExplanation(text)
    } catch (e) {
      setExplainError(e instanceof Error ? e.message : 'Failed to load explanation')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch on mount
  useEffect(() => { fetchExplanation() }, [book.id])

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="absolute right-0 top-0 bottom-0 w-96 bg-stone-950 border-l border-stone-800 flex flex-col z-40 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-stone-800 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: tier.color, background: tier.color + '18', border: `1px solid ${tier.color}40` }}>
              {isPaper ? '📄 ' : ''}{tier.label}
            </span>
            {track && (
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: track.color, background: track.color + '18', border: `1px solid ${track.color}40` }}>
                {track.name}
              </span>
            )}
            {map.criticalPath.includes(book.id) && (
              <span className="text-xs font-mono px-2 py-0.5 rounded text-amber-400 bg-amber-400/10 border border-amber-400/30">
                ★ Critical Path
              </span>
            )}
          </div>
          <h2 className="font-display font-semibold text-stone-100 text-base leading-snug">{book.title}</h2>
          <p className="text-sm text-stone-500 mt-1 font-body">{book.author} · {book.year}</p>
        </div>
        <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors mt-1 shrink-0">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Quick stats */}
        <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-stone-800">
          <div className="text-center">
            <div className="text-xs text-stone-600 font-mono mb-1">Difficulty</div>
            <div className="text-sm text-stone-300">{'●'.repeat(book.difficulty)}{'○'.repeat(5 - book.difficulty)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-stone-600 font-mono mb-1">Math</div>
            <div className="text-sm text-stone-300 font-mono">∑{'█'.repeat(book.mathIntensity)}{'░'.repeat(5 - book.mathIntensity)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-stone-600 font-mono mb-1">
              {isPaper ? 'Type' : 'Time'}
            </div>
            {isPaper
              ? <div className="text-sm text-stone-300 font-mono">paper</div>
              : <div className="text-sm text-stone-300 flex items-center justify-center gap-1"><Clock size={11} />{book.estimatedWeeks}w</div>
            }
          </div>
        </div>

        {/* Description */}
        <div className="px-5 py-4 border-b border-stone-800">
          <p className="text-sm text-stone-400 font-body leading-relaxed">{book.description}</p>
          {book.url && (
            <a href={book.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-amber-500 hover:text-amber-400 font-mono transition-colors">
              <ExternalLink size={11} /> Read online
            </a>
          )}
        </div>

        {/* AI Explanation ──────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-stone-800">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-amber-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">What you'll actually learn</span>
          </div>

          <AnimatePresence mode="wait">
            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-stone-500 text-sm font-body py-2">
                <Loader2 size={14} className="animate-spin text-amber-500" />
                <span>Explaining in plain language...</span>
              </motion.div>
            )}
            {explainError && !loading && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <p className="text-xs text-red-400 font-mono">{explainError}</p>
                <button onClick={fetchExplanation} className="text-xs text-amber-500 hover:text-amber-400 font-mono transition-colors">retry →</button>
              </motion.div>
            )}
            {explanation && !loading && (
              <motion.p key="explanation" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="text-sm text-stone-300 font-body leading-relaxed">
                {explanation}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Why read */}
        <div className="px-5 py-4 border-b border-stone-800">
          <div className="text-xs font-mono uppercase tracking-widest text-stone-600 mb-2">Why read this</div>
          <p className="text-sm text-stone-400 font-body italic">"{book.whyRead}"</p>
        </div>

        {/* Prerequisites */}
        {prereqBooks.length > 0 && (
          <div className="px-5 py-4 border-b border-stone-800">
            <div className="text-xs font-mono uppercase tracking-widest text-stone-600 mb-2">Read first</div>
            <div className="space-y-1">
              {prereqBooks.map((b) => (
                <div key={b.id} className="text-xs text-stone-400 font-body flex items-center gap-2">
                  <span className="text-stone-700">→</span> {b.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unlocks */}
        {unlockBooks.length > 0 && (
          <div className="px-5 py-4 border-b border-stone-800">
            <div className="text-xs font-mono uppercase tracking-widest text-stone-600 mb-2">Unlocks</div>
            <div className="space-y-1">
              {unlockBooks.map((b) => (
                <div key={b.id} className="text-xs text-stone-400 font-body flex items-center gap-2">
                  <span className="text-green-600">✓</span> {b.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings & notes */}
        <div className="px-5 py-4 space-y-3">
          {book.controversyNote && (
            <div className="flex items-start gap-2 text-xs text-amber-600 font-body">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{book.controversyNote}</span>
            </div>
          )}
          {book.editionNote && (
            <p className="text-xs text-stone-500 font-body"><span className="text-stone-400">Edition note:</span> {book.editionNote}</p>
          )}
          {book.skipIf.length > 0 && (
            <p className="text-xs text-stone-500 font-body"><span className="text-stone-400">Skip if:</span> {book.skipIf.join('; ')}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {book.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-stone-800 rounded text-xs text-stone-500 font-mono">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Availability footer */}
      <div className="px-5 py-3 border-t border-stone-800 flex items-center justify-between">
        <span className={`text-xs font-mono ${book.availability === 'free' || book.availability === 'open-access' ? 'text-green-500' : 'text-stone-500'}`}>
          {book.availability}
        </span>
        <span className="text-xs text-stone-700 font-mono">{book.year}</span>
      </div>
    </motion.div>
  )
}
