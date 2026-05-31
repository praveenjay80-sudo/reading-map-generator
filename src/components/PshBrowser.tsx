import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronDown, Search, BookOpen } from 'lucide-react'
import rawData from '../data/psh-taxonomy.json'

// {id, l: label, b: broader-id-or-empty}
interface Entry { id: string; l: string; b: string }

const ALL: Entry[] = rawData as Entry[]

// Build lookup maps once at module load
const byId = new Map<string, Entry>(ALL.map((e) => [e.id, e]))
const childrenOf = new Map<string, string[]>()
for (const e of ALL) {
  if (!childrenOf.has(e.b)) childrenOf.set(e.b, [])
  childrenOf.get(e.b)!.push(e.id)
}

// Top-level = broader is empty string
const TOP_IDS = (childrenOf.get('') ?? []).sort((a, b) =>
  (byId.get(a)?.l ?? '').localeCompare(byId.get(b)?.l ?? '')
)

function getChildren(id: string): string[] {
  return (childrenOf.get(id) ?? []).sort((a, b) =>
    (byId.get(a)?.l ?? '').localeCompare(byId.get(b)?.l ?? '')
  )
}

interface Props {
  onSelect: (label: string) => void
  onClose: () => void
}

export function PshBrowser({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const searchTerm = search.toLowerCase().trim()

  // When searching: collect all matching IDs and their ancestor chains
  const { matchIds, ancestorIds } = useMemo(() => {
    if (!searchTerm) return { matchIds: new Set<string>(), ancestorIds: new Set<string>() }
    const matches = new Set<string>()
    const ancestors = new Set<string>()
    for (const e of ALL) {
      if (e.l.toLowerCase().includes(searchTerm)) {
        matches.add(e.id)
        // Walk up the parent chain so we can auto-expand
        let cur = e.b
        while (cur) {
          ancestors.add(cur)
          cur = byId.get(cur)?.b ?? ''
        }
      }
    }
    return { matchIds: matches, ancestorIds: ancestors }
  }, [searchTerm])

  const isExpanded = (id: string) =>
    searchTerm ? ancestorIds.has(id) : expanded.has(id)

  function renderNode(id: string, depth: number): React.ReactNode {
    const entry = byId.get(id)
    if (!entry) return null

    // During search, only show nodes that are matches or ancestors of matches
    if (searchTerm && !matchIds.has(id) && !ancestorIds.has(id)) return null

    const children = getChildren(id)
    const hasChildren = children.length > 0
    const open = isExpanded(id)
    const isMatch = matchIds.has(id)

    return (
      <div key={id}>
        <div
          className={`flex items-center gap-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${isMatch && searchTerm ? 'bg-amber-500/8' : 'hover:bg-stone-800'}`}
          style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: 8 }}
          onClick={() => hasChildren && !searchTerm && toggle(id)}
        >
          <span className="w-4 shrink-0 text-stone-600 flex items-center justify-center">
            {hasChildren
              ? open
                ? <ChevronDown size={12} className="text-stone-400" />
                : <ChevronRight size={12} className="text-stone-500" />
              : <span className="w-2 h-2 rounded-full border border-stone-700 inline-block" />
            }
          </span>

          <span className={`text-sm font-body flex-1 leading-snug ${
            depth === 0 ? 'text-stone-200 font-medium' :
            depth === 1 ? 'text-stone-300' : 'text-stone-400'
          } ${isMatch && searchTerm ? 'text-amber-300' : ''}`}>
            {entry.l}
          </span>

          {children.length > 0 && (
            <span className="text-xs font-mono text-stone-700 mr-1 shrink-0">{children.length}</span>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onSelect(entry.l) }}
            className="opacity-0 group-hover:opacity-100 text-xs font-mono text-amber-500 hover:text-amber-300 transition-all px-2 py-0.5 border border-amber-500/30 rounded hover:border-amber-400/60 shrink-0"
          >
            use →
          </button>
        </div>

        {open && !searchTerm && children.length > 0 && (
          <div>{children.map((cid) => renderNode(cid, depth + 1))}</div>
        )}

        {searchTerm && ancestorIds.has(id) && children.length > 0 && (
          <div>{children.map((cid) => renderNode(cid, depth + 1))}</div>
        )}
      </div>
    )
  }

  const displayIds = searchTerm
    ? TOP_IDS.filter((id) => matchIds.has(id) || ancestorIds.has(id))
    : TOP_IDS

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl"
        style={{ maxHeight: '82vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-800 shrink-0">
          <BookOpen size={16} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-stone-100 font-body">PSH Taxonomy Browser</div>
            <div className="text-xs text-stone-500 font-mono">{ALL.length.toLocaleString()} terms · 44 domains · CC BY-SA 3.0</div>
          </div>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2 bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 focus-within:border-amber-500/50 transition-colors">
            <Search size={13} className="text-stone-500 shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all 14,200 terms..."
              className="flex-1 bg-transparent text-sm text-stone-300 font-body placeholder-stone-600 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-stone-600 hover:text-stone-400 shrink-0">
                <X size={12} />
              </button>
            )}
          </div>
          {searchTerm && (
            <div className="mt-1.5 text-xs text-stone-600 font-mono">
              {matchIds.size} {matchIds.size === 1 ? 'match' : 'matches'}
            </div>
          )}
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-2 px-3">
          <AnimatePresence mode="wait">
            {displayIds.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-16 text-stone-600 text-sm font-body">
                No terms match "{search}"
              </motion.div>
            ) : (
              <motion.div key="tree" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {displayIds.map((id) => renderNode(id, 0))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-600 font-mono shrink-0">
          Polytematic Structured Thesaurus · National Technical Library, Prague · hover any term → "use →" to select
        </div>
      </motion.div>
    </motion.div>
  )
}
