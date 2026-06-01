import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronDown, Search, BookOpen, Loader2, List, Globe } from 'lucide-react'
import {
  LCSH_ROOTS, fetchLcshChildren, resolveLcshId,
  type LcshBrowseNode,
} from '../lib/lcshBrowse'

// ── LCSH search ───────────────────────────────────────────────────────────────

interface LcshHit { label: string; uri: string; hasSubdivision: boolean }

async function searchLcsh(q: string, count = 30): Promise<LcshHit[]> {
  const url = `https://id.loc.gov/authorities/subjects/suggest/?q=${encodeURIComponent(q)}&count=${count}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`LCSH ${res.status}`)
  const data: [string, string[], string[], string[]] = await res.json()
  return (data[1] ?? []).map((label, i) => ({
    label,
    uri: data[3]?.[i] ?? '',
    hasSubdivision: label.includes('--'),
  }))
}

// ── PSH taxonomy (lazy-loaded) ────────────────────────────────────────────────

interface PshEntry { id: string; l: string; b: string }
interface PshTaxonomy {
  byId: Map<string, PshEntry>
  childrenOf: Map<string, string[]>
  TOP_IDS: string[]
}

let _psh: PshTaxonomy | null = null

async function loadPsh(): Promise<PshTaxonomy> {
  if (_psh) return _psh
  const { default: rawData } = await import('../data/psh-taxonomy.json')
  const ALL = rawData as PshEntry[]
  const byId = new Map<string, PshEntry>(ALL.map((e) => [e.id, e]))
  const childrenOf = new Map<string, string[]>()
  for (const e of ALL) {
    if (!childrenOf.has(e.b)) childrenOf.set(e.b, [])
    childrenOf.get(e.b)!.push(e.id)
  }
  const TOP_IDS = (childrenOf.get('') ?? []).sort((a, b) =>
    (byId.get(a)?.l ?? '').localeCompare(byId.get(b)?.l ?? ''))
  _psh = { byId, childrenOf, TOP_IDS }
  return _psh
}

// ── LCSH browse tree node state ───────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

interface LcshTreeNode {
  label: string
  id: string | null           // null until resolved
  loadState: LoadState
  children: LcshTreeNode[]
}

function makeRoots(): LcshTreeNode[] {
  return LCSH_ROOTS.map((label) => ({ label, id: null, loadState: 'idle', children: [] }))
}

function updateTreeNode(
  tree: LcshTreeNode[],
  label: string,
  updater: (n: LcshTreeNode) => LcshTreeNode,
): LcshTreeNode[] {
  return tree.map((n) => {
    if (n.label === label) return updater(n)
    if (n.children.length) return { ...n, children: updateByLabel(n.children, label, updater) }
    return n
  })
}
function updateByLabel(
  nodes: LcshTreeNode[],
  label: string,
  updater: (n: LcshTreeNode) => LcshTreeNode,
): LcshTreeNode[] {
  return nodes.map((n) => {
    if (n.label === label) return updater(n)
    if (n.children.length) return { ...n, children: updateByLabel(n.children, label, updater) }
    return n
  })
}
function updateById(
  nodes: LcshTreeNode[],
  id: string,
  updater: (n: LcshTreeNode) => LcshTreeNode,
): LcshTreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) return updater(n)
    if (n.children.length) return { ...n, children: updateById(n.children, id, updater) }
    return n
  })
}

function browsedNodeFromApi(n: LcshBrowseNode): LcshTreeNode {
  return {
    label: n.label || n.id,
    id: n.id,
    loadState: 'idle',
    children: [],
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { onSelect: (label: string) => void; onClose: () => void }
type Tab = 'lcsh-search' | 'lcsh-browse' | 'psh'

export function PshBrowser({ onSelect, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('lcsh-search')

  // LCSH search state
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<LcshHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // LCSH browse state
  const [lcshTree, setLcshTree] = useState<LcshTreeNode[]>(makeRoots)
  const [lcshExpanded, setLcshExpanded] = useState<Set<string>>(new Set())

  // PSH state
  const [psh, setPsh] = useState<PshTaxonomy | null>(null)
  const [pshSearch, setPshSearch] = useState('')
  const [pshExpanded, setPshExpanded] = useState<Set<string>>(new Set())

  // Load PSH when tab opened
  useEffect(() => {
    if (tab === 'psh' && !psh) loadPsh().then(setPsh)
  }, [tab, psh])

  // LCSH search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) { setHits([]); setSearchError(''); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true); setSearchError('')
      try { setHits(await searchLcsh(q)) }
      catch { setSearchError('Could not reach LCSH — check your connection.'); setHits([]) }
      finally { setSearching(false) }
    }, 320)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // ── LCSH browse expand ────────────────────────────────────────────────────

  const expandLcsh = useCallback(async (node: LcshTreeNode) => {
    const key = node.id ?? node.label
    if (lcshExpanded.has(key)) {
      setLcshExpanded((s) => { const n = new Set(s); n.delete(key); return n })
      return
    }
    setLcshExpanded((s) => new Set(s).add(key))
    if (node.loadState !== 'idle') return

    // Mark as loading
    const setLoading = (n: LcshTreeNode) => ({ ...n, loadState: 'loading' as LoadState })
    if (node.id) setLcshTree((t) => updateById(t, node.id!, setLoading))
    else setLcshTree((t) => updateTreeNode(t, node.label, setLoading))

    try {
      // Resolve ID if not known yet
      let id = node.id
      if (!id) {
        id = await resolveLcshId(node.label)
        if (!id) throw new Error('Not found')
      }
      const children = await fetchLcshChildren(id)
      const childNodes = children.map(browsedNodeFromApi)

      const setLoaded = (n: LcshTreeNode) => ({
        ...n, id, loadState: 'loaded' as LoadState, children: childNodes,
      })
      setLcshTree((t) => {
        const t2 = node.id
          ? updateById(t, node.id, setLoaded)
          : updateTreeNode(t, node.label, setLoaded)
        return t2
      })
      // Register new ID as expanded key too
      if (!node.id && id) {
        setLcshExpanded((s) => { const n = new Set(s); n.add(id!); return n })
      }
    } catch {
      const setError = (n: LcshTreeNode) => ({ ...n, loadState: 'error' as LoadState })
      if (node.id) setLcshTree((t) => updateById(t, node.id!, setError))
      else setLcshTree((t) => updateTreeNode(t, node.label, setError))
    }
  }, [lcshExpanded])

  function renderLcshNode(node: LcshTreeNode, depth: number): React.ReactNode {
    const key = node.id ?? node.label
    const isOpen = lcshExpanded.has(key) || (!!node.id && lcshExpanded.has(node.id))
    const hasChildren = node.loadState === 'loaded' ? node.children.length > 0 : true

    return (
      <div key={key}>
        <div
          className="flex items-center gap-2 py-1.5 rounded-lg hover:bg-stone-800 cursor-pointer group transition-colors"
          style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: 8 }}
          onClick={() => expandLcsh(node)}
        >
          <span className="w-4 shrink-0 flex items-center justify-center">
            {node.loadState === 'loading'
              ? <Loader2 size={12} className="animate-spin text-amber-500" />
              : node.loadState === 'error'
              ? <span className="text-red-500 text-xs">!</span>
              : hasChildren
              ? isOpen
                ? <ChevronDown size={12} className="text-stone-400" />
                : <ChevronRight size={12} className="text-stone-500" />
              : <span className="w-2 h-2 rounded-full border border-stone-700 inline-block" />
            }
          </span>

          <span className={`text-sm font-body flex-1 leading-snug
            ${depth === 0 ? 'text-stone-200 font-medium' : depth === 1 ? 'text-stone-300' : 'text-stone-400'}`}>
            {node.label || node.id}
          </span>

          {node.loadState === 'loaded' && node.children.length > 0 && (
            <span className="text-xs font-mono text-stone-700 mr-1 shrink-0">{node.children.length}</span>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onSelect(node.label || node.id!) }}
            className="opacity-0 group-hover:opacity-100 text-xs font-mono text-amber-500 hover:text-amber-300 transition-all px-2 py-0.5 border border-amber-500/30 rounded hover:border-amber-400/60 shrink-0"
          >use →</button>
        </div>

        {isOpen && node.children.length > 0 && (
          <div>{node.children.map((c) => renderLcshNode(c, depth + 1))}</div>
        )}
        {isOpen && node.loadState === 'error' && (
          <div className="text-xs text-red-400 font-mono py-1" style={{ paddingLeft: `${28 + depth * 16}px` }}>
            Could not load children — LCSH API error
          </div>
        )}
        {isOpen && node.loadState === 'loaded' && node.children.length === 0 && (
          <div className="text-xs text-stone-600 font-mono py-1" style={{ paddingLeft: `${28 + depth * 16}px` }}>
            No narrower terms
          </div>
        )}
      </div>
    )
  }

  // ── PSH browse ────────────────────────────────────────────────────────────

  const togglePsh = useCallback((id: string) => {
    setPshExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  const pshTerm = pshSearch.toLowerCase().trim()
  const { matchIds, ancestorIds } = useMemo(() => {
    if (!pshTerm || !psh) return { matchIds: new Set<string>(), ancestorIds: new Set<string>() }
    const matches = new Set<string>(); const ancestors = new Set<string>()
    for (const [, e] of psh.byId) {
      if (e.l.toLowerCase().includes(pshTerm)) {
        matches.add(e.id)
        let cur = e.b
        while (cur) { ancestors.add(cur); cur = psh.byId.get(cur)?.b ?? '' }
      }
    }
    return { matchIds: matches, ancestorIds: ancestors }
  }, [pshTerm, psh])

  function renderPshNode(id: string, depth: number): React.ReactNode {
    if (!psh) return null
    const entry = psh.byId.get(id)
    if (!entry) return null
    if (pshTerm && !matchIds.has(id) && !ancestorIds.has(id)) return null
    const children = (psh.childrenOf.get(id) ?? []).sort((a, b) =>
      (psh.byId.get(a)?.l ?? '').localeCompare(psh.byId.get(b)?.l ?? ''))
    const open = pshTerm ? ancestorIds.has(id) : pshExpanded.has(id)
    return (
      <div key={id}>
        <div
          className={`flex items-center gap-2 py-1.5 rounded-lg cursor-pointer group transition-colors
            ${matchIds.has(id) && pshTerm ? 'bg-amber-500/8' : 'hover:bg-stone-800'}`}
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
            ${matchIds.has(id) && pshTerm ? 'text-amber-300' : ''}`}>
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

  const pshDisplayIds = psh
    ? pshTerm ? psh.TOP_IDS.filter((id) => matchIds.has(id) || ancestorIds.has(id)) : psh.TOP_IDS
    : []

  // ── Render ────────────────────────────────────────────────────────────────

  const tabLabel = {
    'lcsh-search': 'LCSH · ~350,000 headings · Library of Congress',
    'lcsh-browse': 'LCSH · hierarchical browse · Library of Congress',
    psh: `PSH · ${psh ? psh.byId.size.toLocaleString() : '14,143'} terms · National Technical Library`,
  }[tab]

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
            <div className="text-xs text-stone-500 font-mono truncate">{tabLabel}</div>
          </div>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors shrink-0"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-800 shrink-0 overflow-x-auto">
          {([
            ['lcsh-search', Search, 'LCSH Search'],
            ['lcsh-browse', Globe, 'LCSH Browse'],
            ['psh', List, 'PSH Browse'],
          ] as const).map(([t, Icon, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-mono whitespace-nowrap transition-colors border-b-2 ${tab === t ? 'border-amber-500 text-amber-400' : 'border-transparent text-stone-500 hover:text-stone-300'}`}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>

        {/* ── LCSH SEARCH ── */}
        {tab === 'lcsh-search' && (
          <>
            <div className="px-5 py-3 border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2 bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 focus-within:border-amber-500/60 transition-colors">
                {searching ? <Loader2 size={13} className="text-amber-500 animate-spin shrink-0" /> : <Search size={13} className="text-stone-500 shrink-0" />}
                <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search 350,000 Library of Congress headings..."
                  className="flex-1 bg-transparent text-sm text-stone-300 font-body placeholder-stone-600 focus:outline-none" />
                {query && <button onClick={() => { setQuery(''); setHits([]) }} className="text-stone-600 hover:text-stone-400 shrink-0"><X size={12} /></button>}
              </div>
              {searchError && <p className="mt-1.5 text-xs text-red-400 font-mono">{searchError}</p>}
              {!searchError && hits.length > 0 && <p className="mt-1.5 text-xs text-stone-600 font-mono">{hits.length} headings</p>}
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
                  <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2 py-16 text-stone-500 text-sm">
                    <Loader2 size={16} className="animate-spin text-amber-500" />Searching LCSH…
                  </motion.div>
                ) : hits.length === 0 ? (
                  <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center py-16 text-stone-600 text-sm">No headings found for "{query}"</motion.div>
                ) : (
                  <motion.div key="hits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-0.5">
                    {hits.map((hit) => (
                      <div key={hit.uri}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-800 cursor-pointer group transition-colors"
                        onClick={() => onSelect(hit.label)}>
                        <div className="flex-1 min-w-0">
                          {hit.hasSubdivision ? (
                            <span className="text-sm font-body leading-snug text-stone-400">
                              <span className="text-stone-300">{hit.label.split('--')[0]}</span>
                              <span className="text-stone-600"> — {hit.label.split('--').slice(1).join(' — ')}</span>
                            </span>
                          ) : (
                            <span className="text-sm font-body leading-snug text-stone-200">{hit.label}</span>
                          )}
                          {hit.uri && <div className="text-xs text-stone-700 font-mono mt-0.5 truncate">{hit.uri.replace('http://id.loc.gov/authorities/subjects/', 'lcsh:')}</div>}
                        </div>
                        <span className="opacity-0 group-hover:opacity-100 text-xs font-mono text-amber-500 px-2 py-0.5 border border-amber-500/30 rounded shrink-0 mt-0.5">use →</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-600 font-mono shrink-0">
              Library of Congress Linked Data · id.loc.gov · Public domain
            </div>
          </>
        )}

        {/* ── LCSH BROWSE ── */}
        {tab === 'lcsh-browse' && (
          <>
            <div className="px-5 py-3 border-b border-stone-800 shrink-0">
              <p className="text-xs text-stone-500 font-mono">25 broad domains · click to expand · children loaded live from id.loc.gov</p>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-3">
              {lcshTree.map((node) => renderLcshNode(node, 0))}
            </div>
            <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-600 font-mono shrink-0">
              Library of Congress Subject Headings · id.loc.gov · Public domain · hover → "use →" to select
            </div>
          </>
        )}

        {/* ── PSH BROWSE ── */}
        {tab === 'psh' && (
          <>
            <div className="px-5 py-3 border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2 bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 focus-within:border-amber-500/60 transition-colors">
                <Search size={13} className="text-stone-500 shrink-0" />
                <input autoFocus type="text" value={pshSearch} onChange={(e) => setPshSearch(e.target.value)}
                  placeholder="Filter 14,143 PSH terms..."
                  className="flex-1 bg-transparent text-sm text-stone-300 font-body placeholder-stone-600 focus:outline-none" />
                {pshSearch && <button onClick={() => setPshSearch('')} className="text-stone-600 hover:text-stone-400 shrink-0"><X size={12} /></button>}
              </div>
              {pshTerm && psh && <p className="mt-1.5 text-xs text-stone-600 font-mono">{matchIds.size} matches</p>}
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-3">
              <AnimatePresence mode="wait">
                {!psh ? (
                  <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2 py-16 text-stone-500 text-sm">
                    <Loader2 size={16} className="animate-spin text-amber-500" />Loading PSH taxonomy…
                  </motion.div>
                ) : pshDisplayIds.length === 0 ? (
                  <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center py-16 text-stone-600 text-sm">No terms match "{pshSearch}"</motion.div>
                ) : (
                  <motion.div key="tree" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {pshDisplayIds.map((id) => renderPshNode(id, 0))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-600 font-mono shrink-0">
              Polytematic Structured Thesaurus · National Technical Library · CC BY-SA 3.0
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
