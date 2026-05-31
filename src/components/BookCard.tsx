import { motion } from 'framer-motion'
import { ExternalLink, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { Book, BookProgress } from '../types'

const TIER_CONFIG = {
  foundational: { label: 'Foundational', color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
  core: { label: 'Core', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  optional: { label: 'Optional', color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  advanced: { label: 'Advanced', color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
  paper: { label: 'Paper', color: 'text-stone-400 bg-stone-400/10 border-stone-400/30' },
}

const STATUS_OPTIONS = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
] as const

interface Props {
  book: Book; progress?: BookProgress; isSelected?: boolean
  isCriticalPath?: boolean; isBottleneck?: boolean; isUnlocked?: boolean
  trackColor?: string
  onClick?: () => void
  onStatusChange?: (status: BookProgress['status']) => void
  onConfidenceChange?: (confidence: number) => void
}

export function BookCard({ book, progress, isSelected, isCriticalPath, isBottleneck, isUnlocked = true, trackColor, onClick, onStatusChange, onConfidenceChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const tier = TIER_CONFIG[book.tier]
  const status = progress?.status ?? 'unread'
  const isPaper = book.tier === 'paper'
  const accentColor = trackColor ?? undefined
  return (
    <motion.div layout onClick={onClick}
      style={accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : undefined}
      className={`rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-amber-500 bg-stone-800 shadow-lg shadow-amber-500/10' : isUnlocked ? 'border-stone-700 bg-stone-900 hover:border-stone-500' : 'border-stone-800 bg-stone-950 opacity-50'} ${isCriticalPath ? 'ring-1 ring-amber-500/30' : ''} ${isPaper ? 'border-dashed' : ''}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${tier.color}`}>{tier.label}</span>
              {isCriticalPath && <span className="text-xs font-mono px-1.5 py-0.5 rounded border text-amber-400 bg-amber-400/10 border-amber-400/30">Critical Path</span>}
              {isBottleneck && <span className="text-xs font-mono px-1.5 py-0.5 rounded border text-red-400 bg-red-400/10 border-red-400/30">Bottleneck</span>}
            </div>
            <h3 className="font-display font-semibold text-stone-100 text-sm leading-snug">{book.title}</h3>
            <p className="text-xs text-stone-500 mt-0.5 font-body">{book.author} · {book.year}</p>
          </div>
          {book.url && (
            <a href={book.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-stone-600 hover:text-amber-400 transition-colors flex-shrink-0">
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-500 mb-3">
          <span className="flex items-center gap-1"><Clock size={10} /> {book.estimatedWeeks}w</span>
          <span title="Difficulty">{'●'.repeat(book.difficulty)}{'○'.repeat(5 - book.difficulty)}</span>
          <span title="Math" className="font-mono">∑{'█'.repeat(book.mathIntensity)}{'░'.repeat(5 - book.mathIntensity)}</span>
          <span className={`ml-auto ${book.availability === 'free' || book.availability === 'open-access' ? 'text-green-500' : 'text-stone-600'}`}>{book.availability}</span>
        </div>
        <p className="text-xs text-stone-400 font-body italic mb-3">"{book.whyRead}"</p>
        <div className="flex items-center gap-2">
          <select value={status} onChange={(e) => { e.stopPropagation(); onStatusChange?.(e.target.value as BookProgress['status']) }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-stone-800 border border-stone-700 rounded-md px-2 py-1 text-xs text-stone-300 font-mono focus:outline-none focus:border-amber-500">
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {status === 'completed' && (
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map((star) => (
                <button key={star} onClick={(e) => { e.stopPropagation(); onConfidenceChange?.(star) }}
                  className={`text-sm transition-colors ${star <= (progress?.confidence ?? 0) ? 'text-amber-400' : 'text-stone-700'}`}>★</button>
              ))}
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }} className="text-stone-600 hover:text-stone-400 transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 pt-3 border-t border-stone-800 space-y-2 text-xs">
            <p className="text-stone-400 font-body">{book.description}</p>
            {book.controversyNote && <div className="flex items-start gap-2 text-amber-600"><AlertTriangle size={12} className="flex-shrink-0 mt-0.5" /><span>{book.controversyNote}</span></div>}
            {book.editionNote && <p className="text-stone-500"><span className="text-stone-400">Edition:</span> {book.editionNote}</p>}
            {book.skipIf.length > 0 && <p className="text-stone-500"><span className="text-stone-400">Skip if:</span> {book.skipIf.join('; ')}</p>}
            {book.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{book.tags.map((tag) => <span key={tag} className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-500 font-mono">{tag}</span>)}</div>}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
