import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronDown, Loader2, Search, BookOpen } from 'lucide-react'
import { PSH_TOP_LEVEL, fetchPshChildren, type PshNode } from '../lib/pshApi'

interface Props {
  onSelect: (label: string) => void
  onClose: () => void
}

type NodeState = 'idle' | 'loading' | 'loaded' | 'error'

interface TreeNode extends PshNode {
  state: NodeState
  children: TreeNode[]
  depth: number
}

function makeTree(nodes: PshNode[], depth = 0): TreeNode[] {
  return nodes.map((n) => ({ ...n, state: 'idle', children: [], depth }))
}

function updateNode(tree: TreeNode[], id: string, updater: (n: TreeNode) => TreeNode): TreeNode[] {
  return tree.map((n) => {
    if (n.id === id) return updater(n)
    if (n.children.length > 0) return { ...n, children: updateNode(n.children, id, updater) }
    return n
  })
}

export function PshBrowser({ onSelect, onClose }: Props) {
  const [tree, setTree] = useState<TreeNode[]>(() => makeTree(PSH_TOP_LEVEL, 0))
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [corsError, setCorsError] = useState(false)

  const toggle = useCallback(async (node: TreeNode) => {
    const id = node.id
    if (expanded.has(id)) {
      setExpanded((s) => { const n = new Set(s); n.delete(id); return n })
      return
    }
    setExpanded((s) => new Set(s).add(id))
    if (node.state !== 'idle') return

    setTree((t) => updateNode(t, id, (n) => ({ ...n, state: 'loading' })))
    try {
      const children = await fetchPshChildren(id)
      setTree((t) =>
        updateNode(t, id, (n) => ({
          ...n,
          state: 'loaded',
          narrower: children.map((c) => c.id),
          children: makeTree(children, n.depth + 1),
        }))
      )
    } catch {
      setCorsError(true)
      setTree((t) => updateNode(t, id, (n) => ({ ...n, state: 'error' })))
    }
  }, [expanded])

  const searchLower = search.toLowerCase().trim()

  const filteredTop = useMemo(() => {
    if (!searchLower) return tree
    return tree.filter((n) => n.label.toLowerCase().includes(searchLower))
  }, [tree, searchLower])

  const renderNode = (node: TreeNode) => {
    const hasChildren = node.narrower.length > 0 || node.state === 'idle'
    const isExpanded = expanded.has(node.id)
    const indent = node.depth * 16

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-stone-800 cursor-pointer group transition-colors"
          style={{ paddingLeft: `${12 + indent}px` }}
          onClick={() => {
            if (hasChildren) toggle(node)
          }}
        >
          {/* expand arrow */}
          <span className="w-4 shrink-0 text-stone-600">
            {node.state === 'loading'
              ? <Loader2 size={12} className="animate-spin text-amber-500" />
              : hasChildren
              ? isExpanded
                ? <ChevronDown size={12} className="text-stone-400" />
                : <ChevronRight size={12} className="text-stone-500" />
              : <span className="w-3 h-3 inline-block rounded-full border border-stone-700 bg-stone-800" />
            }
          </span>

          {/* label */}
          <span className={`text-sm font-body flex-1 ${node.depth === 0 ? 'text-stone-200 font-medium' : 'text-stone-400'}`}>
            {node.label}
          </span>

          {/* use button */}
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(node.label) }}
            className="opacity-0 group-hover:opacity-100 text-xs font-mono text-amber-500 hover:text-amber-300 transition-all px-2 py-0.5 border border-amber-500/30 rounded hover:border-amber-400/60"
          >
            use →
          </button>
        </div>

        {/* children */}
        {isExpanded && node.children.length > 0 && (
          <AnimatePresence>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              {node.children
                .filter((c) => !searchLower || c.label.toLowerCase().includes(searchLower))
                .map(renderNode)}
            </motion.div>
          </AnimatePresence>
        )}

        {node.state === 'error' && isExpanded && (
          <div className="text-xs text-red-400 font-mono px-10 py-1">failed to load</div>
        )}
      </div>
    )
  }

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
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-800">
          <BookOpen size={16} className="text-amber-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-stone-100 font-body">PSH Taxonomy Browser</div>
            <div className="text-xs text-stone-500 font-mono">14,000+ terms · 44 domains · CC BY-SA 3.0</div>
          </div>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-stone-800">
          <div className="flex items-center gap-2 bg-stone-950 border border-stone-700 rounded-lg px-3 py-2">
            <Search size={13} className="text-stone-500 shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name..."
              className="flex-1 bg-transparent text-sm text-stone-300 font-body placeholder-stone-600 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-stone-600 hover:text-stone-400">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {corsError && (
          <div className="mx-5 mt-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400 font-mono">
            ⚠ CORS blocked — PSH API only allows direct browser access. Children can't be loaded. Select any top-level category or type your topic manually.
          </div>
        )}

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {filteredTop.length === 0 ? (
            <div className="text-center py-12 text-stone-600 text-sm font-body">No categories match "{search}"</div>
          ) : (
            filteredTop.map(renderNode)
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-600 font-mono">
          Polytematic Structured Thesaurus · National Technical Library, Prague · Click any term → "use →" to select
        </div>
      </motion.div>
    </motion.div>
  )
}
