import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronDown, Search, BookOpen, Loader2, List } from 'lucide-react'

// ── LCSH search ───────────────────────────────────────────────────────────────

interface LcshHit { label: string; uri: string; hasSubdivision: boolean }

async function searchLcsh(q: string, count = 25): Promise<LcshHit[]> {
  const url = `https://id.loc.gov/authorities/subjects/suggest/?q=${encodeURIComponent(q)}&count=${count}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`LCSH API ${res.status}`)
  const data: [string, string[], string[], string[]] = await res.json()
  const labels: string[] = data[1] ?? []
  const uris: string[] = data[3] ?? []
  return labels.map((label, i) => ({
    label,
    uri: uris[i] ?? '',
    hasSubdivision: label.includes('--'),
  }))
}

// ── PSH taxonomy (lazy-loaded) ────────────────────────────────────────────────

interface Entry { id: string; l: string; b: string }
interface Taxonomy { byId: Map<string, Entry>; childrenOf: Map<string, string[]>; TOP_IDS: string[] }

let _taxonomy: Taxonomy | null = null

async function loadTaxonomy(): Promise<Taxonomy> {
  if (_taxonomy) return _taxonomy
  const { default: rawData } = await import('../data/psh-taxonomy.json')
  const ALL = rawData as Entry[]
  const byId = new Map<string, Entry>(ALL.map((e) => [e.id, e]))
  const childrenOf = new Map<string, string[]>()
  for (const e of ALL) {
    if (!childrenOf.has(e.b)) childrenOf.set(e.b, [])
    childrenOf.get(e.b)!.push(e.id)
  }
  const TOP_IDS = (childrenOf.get('') ?? []).sort((a, b) =>
    (byId.get(a)?.l ?? '').localeCompare(byId.get(b)?.l ?? ''))
  _taxonomy = { byId, childrenOf, TOP_IDS }
  return _taxonomy
}

function pshChildren(tax: Taxonomy, id: string): string[] {
  return (tax.childrenOf.get(id) ?? []).sort((a, b) =>
    (tax.byId.get(a)?.l ?? '').localeCompare(tax.byId.get(b)?.l ?? ''))
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props { onSelect: (label: string) => void; onClose: () => void }

type Tab = 'lcsh' | 'psh'

export function PshBrowser({ onSelect, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('lcsh')

  // LCSH state
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<LcshHit[]>([])
  const [searching, setSearching] = useState(false)
  const [lcshError, setLcshError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // PSH state
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)
  const [pshSearch, setPshSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Load PSH when that tab is opened
  useEffect(() => {
    if (tab === 'psh' && !taxonomy) loadTaxonomy().then(setTaxonomy)
  }, [tab, taxonomy])

  // LCSH debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) { setHits([]); setLcshError(''); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setLcshError('')
      try {
        setHits(await searchLcsh(q, 30))
      } catch {
        setLcshError('Could not reach LCSH — check your connection.')
        setHits([])
      } finally {
        setSearching(false)
      }
    }, 320)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // PSH tree
  const togglePsh = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const pshTerm = pshSearch.toLowerCase().trim()
  const { matchIds, ancestorIds } = useMemo(() => {
    if (!pshTerm || !taxonomy) return { matchIds: new Set<string>(), ancestorIds: new Set<string>() }
    const matches = new Set<string>()
    const ancestors = new Set<string>()
    for (const [, e] of taxonomy.byId) {
      if (e.l.toLowerCase().includes(pshTerm)) {
        matches.add(e.id)
        let cur = e.b
        while (cur) { ancestors.add(cur); cur = taxonomy.byId.get(cur)?.b ?? '' }
      }
    }
    return { matchIds: matches, ancestorIds: ancestors }
  }, [pshTerm, taxonomy])

  function renderPshNode(id: string, depth: number): React.ReactNode {
    if (!taxonomy) return null
    const entry = taxonomy.byId.get(id)
    if (!entry) return null
    if (pshTerm && !matchIds.has(id) && !ancestorIds.has(id)) return null
    const children = pshChildren(taxonomy, id)
    const open = pshTerm ? ancestorIds.has(id) : expanded.has(id)
    const isMatch = matchIds.has(id)
    return (
      <div key={id}>
        <div
          className={`flex items-center gap-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${isMatch && pshTerm ? 'bg-amber-500/8' : 'hover:bg-stone-800'}`}
          style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: 8 }}
          onClick={() => children.length > 0 && !pshTerm && togglePsh(id)}
        >
          <span className="w-4 shrink-0 flex items-center justify-center text-stone-600">
            {children.length > 0
              ? open ? <ChevronDown size={12} className="text-stone-400" /> : <ChevronRight size={12} className="text-stone-500" />
              : <span className="w-2 h-2 rounded-full border border-stone-700 inline-block" />}
          </span>
          <span className={`text-sm font-body flex-1 leading-snug capitalize
            ${depth === 0 ? 'text-stone-200 font-medium' : depth === 1 ? 'text-stone-300' : 'text-stone-400'}
            ${isMatch && pshTerm ? 'text-amber-300' : ''}`}>
            {entry.l}
          </span>
          {children.length > 0 && <span className="text-xs font-mono text-stone-700 mr-1 shrink-0">{children.length}</span>}
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(entry.l) }}
            className="opacity-0 group-hover:opacity-100 text-xs font-mono text-amber-500 hover:text-amber-300 transition-all px-2 py-0.5 border border-amber-500/30 rounded hover:border-amber-400/60 shrink-0"
          >use →</button>
        </div>
        {(open || (pshTerm && ancestorIds.has(id))) && children.length > 0 && (
          <div>{children.map((cid) => renderPshNode(cid, depth + 1))}</div>
        )}
      </div>
    )
  }

  const pshDisplayIds = taxonomy
    ? pshTerm
      ? taxonomy.TOP_IDS.filter((id) => matchIds.has(id) || ancestorIds.has(id))
      : taxonomy.TOP_IDS
    : []

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl"
        style={{ maxHeight: '82vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-800 shrink-0">
          <BookOpen size={16} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-stone-100 font-body">Subject Heading Browser</div>
            <div className="text-xs text-stone-500 font-mono">
              {tab === 'lcsh' ? 'LCSH · ~350,000 headings · Library of Congress' : `PSH · ${taxonomy ? taxonomy.byId.size.toLocaleString() : '…'} terms · National Technical Library`}
            </div>
          </div>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors shrink-0"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-800 shrink-0">
          <button
            onClick={() => setTab('lcsh')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-mono transition-colors border-b-2 ${tab === 'lcsh' ? 'border-amber-500 text-amber-400' : 'border-transparent text-stone-500 hover:text-stone-300'}`}
          >
            <Search size={11} /> LCSH Search
          </button>
          <button
            onClick={() => setTab('psh')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-mono transition-colors border-b-2 ${tab === 'psh' ? 'border-amber-500 text-amber-400' : 'border-transparent text-stone-500 hover:text-stone-300'}`}
          >
            <List size={11} /> PSH Browse
          </button>
        </div>

        {/* ── LCSH TAB ── */}
        {tab === 'lcsh' && (
          <>
            <div className="px-5 py-3 border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2 bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 focus-within:border-amber-500/60 transition-colors">
                {searching
                  ? <Loader2 size={13} className="text-amber-500 animate-spin shrink-0" />
                  : <Search size={13} className="text-stone-500 shrink-0" />}
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search 350,000 Library of Congress headings..."
                  className="flex-1 bg-transparent text-sm text-stone-300 font-body placeholder-stone-600 focus:outline-none"
                />
                {query && <button onClick={() => { setQuery(''); setHits([]) }} className="text-stone-600 hover:text-stone-400 shrink-0"><X size={12} /></button>}
              </div>
              {lcshError && <p className="mt-1.5 text-xs text-red-400 font-mono">{lcshError}</p>}
              {!lcshError && hits.length > 0 && (
                <p className="mt-1.5 text-xs text-stone-600 font-mono">{hits.length} headings</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto py-2 px-3">
              <AnimatePresence mode="wait">
                {!query.trim() ? (
                  <motion.div key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <Search size={28} className="text-stone-700" />
                    <p className="text-stone-500 text-sm font-body">Type any academic topic to search<br />the Library of Congress Subject Headings</p>
                    <p className="text-xs text-stone-700 font-mono">e.g. "quantum chromodynamics", "cognitive load theory"</p>
                  </motion.div>
                ) : searching && hits.length === 0 ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2 py-16 text-stone-500 text-sm font-body">
                    <Loader2 size={16} className="animate-spin text-amber-500" />Searching LCSH…
                  </motion.div>
                ) : hits.length === 0 && !searching ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center py-16 text-stone-600 text-sm font-body">
                    No headings found for "{query}"
                  </motion.div>
                ) : (
                  <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-0.5">
                    {hits.map((hit) => (
                      <div
                        key={hit.uri}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-800 cursor-pointer group transition-colors"
                        onClick={() => onSelect(hit.label)}
                      >
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-body leading-snug ${hit.hasSubdivision ? 'text-stone-400' : 'text-stone-200'}`}>
                            {hit.hasSubdivision
                              ? <>
                                  <span className="text-stone-300">{hit.label.split('--')[0]}</span>
                                  <span className="text-stone-600"> — {hit.label.split('--').slice(1).join(' — ')}</span>
                                </>
                              : hit.label}
                          </span>
                          {hit.uri && (
                            <div className="text-xs text-stone-700 font-mono mt-0.5 truncate">{hit.uri.replace('http://id.loc.gov/authorities/subjects/', 'lcsh:')}</div>
                          )}
                        </div>
                        <span className="opacity-0 group-hover:opacity-100 text-xs font-mono text-amber-500 hover:text-amber-300 transition-all px-2 py-0.5 border border-amber-500/30 rounded hover:border-amber-400/60 shrink-0 mt-0.5">
                          use →
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-600 font-mono shrink-0">
              Library of Congress Linked Data Service · id.loc.gov · Public domain
            </div>
          </>
        )}

        {/* ── PSH TAB ── */}
        {tab === 'psh' && (
          <>
            <div className="px-5 py-3 border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2 bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 focus-within:border-amber-500/60 transition-colors">
                <Search size={13} className="text-stone-500 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={pshSearch}
                  onChange={(e) => setPshSearch(e.target.value)}
                  placeholder="Filter 14,143 PSH terms..."
                  className="flex-1 bg-transparent text-sm text-stone-300 font-body placeholder-stone-600 focus:outline-none"
                />
                {pshSearch && <button onClick={() => setPshSearch('')} className="text-stone-600 hover:text-stone-400 shrink-0"><X size={12} /></button>}
              </div>
              {pshTerm && taxonomy && <p className="mt-1.5 text-xs text-stone-600 font-mono">{matchIds.size} matches</p>}
            </div>

            <div className="flex-1 overflow-y-auto py-2 px-3">
              <AnimatePresence mode="wait">
                {!taxonomy ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2 py-16 text-stone-500 text-sm font-body">
                    <Loader2 size={16} className="animate-spin text-amber-500" />Loading PSH taxonomy…
                  </motion.div>
                ) : pshDisplayIds.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center py-16 text-stone-600 text-sm font-body">
                    No terms match "{pshSearch}"
                  </motion.div>
                ) : (
                  <motion.div key="tree" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {pshDisplayIds.map((id) => renderPshNode(id, 0))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-600 font-mono shrink-0">
              Polytematic Structured Thesaurus · National Technical Library, Prague · CC BY-SA 3.0 · hover → "use →" to select
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
