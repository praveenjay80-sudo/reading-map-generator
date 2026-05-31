import { useMemo, useEffect } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState,
  type Node, type Edge as FlowEdge, type NodeProps,
  Handle, Position, BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ReadingMap, Book, UserProgress, Track } from '../types'
import { useStore } from '../stores/useStore'

const TIER_COLORS: Record<string, string> = {
  foundational: '#f97316', core: '#3b82f6', optional: '#22c55e',
  advanced: '#a855f7', paper: '#e879f9',
}

function getBookTrack(bookId: string, tracks: Track[]): Track | undefined {
  return tracks.find((t) => t.bookIds.includes(bookId))
}

// ── Track label node (left-side lane marker) ─────────────────────────────────
function TrackLabelNode({ data }: NodeProps) {
  const { name, trackType, color } = data as { name: string; trackType: string; color: string }
  return (
    <div style={{
      width: 148, padding: '8px 12px',
      background: color + '14', border: `1px solid ${color}40`,
      borderLeft: `3px solid ${color}`, borderRadius: 8,
      color, fontFamily: 'JetBrains Mono, monospace',
      fontSize: 10, letterSpacing: '0.06em',
      userSelect: 'none', pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 9, opacity: 0.6, textTransform: 'uppercase' }}>{trackType}</div>
    </div>
  )
}

// ── Book / Paper node ─────────────────────────────────────────────────────────
function BookNode({ data }: NodeProps) {
  const book = data.book as Book
  const isCritical = data.isCriticalPath as boolean
  const isBottleneck = data.isBottleneck as boolean
  const isSelected = data.isSelected as boolean
  const status = data.status as string
  const trackColor = (data.trackColor as string | undefined) ?? TIER_COLORS[book.tier] ?? '#78716c'
  const onSelect = data.onSelect as (id: string) => void
  const isPaper = book.tier === 'paper'

  const statusIcon = ({ completed: '✓', reading: '▶', skipped: '—', abandoned: '✕', unread: '' } as Record<string, string>)[status] ?? ''

  return (
    <div
      onClick={() => onSelect(book.id)}
      className="cursor-pointer"
      style={{
        background: isSelected ? '#292524' : '#1c1917',
        border: `1.5px solid ${isSelected ? '#f59e0b' : isCritical ? '#f59e0b55' : '#44403c'}`,
        borderLeft: `3px solid ${trackColor}`,
        borderRadius: 10, padding: '10px 14px',
        minWidth: 164, maxWidth: 204,
        boxShadow: isBottleneck ? `0 0 0 2px #ef444444` : isSelected ? `0 0 18px ${trackColor}22` : 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: trackColor, border: 'none', width: 7, height: 7 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        {isPaper
          ? <span style={{ fontSize: 11, flexShrink: 0 }}>📄</span>
          : <div style={{ width: 7, height: 7, borderRadius: '50%', background: trackColor, flexShrink: 0 }} />
        }
        <span style={{ fontSize: 9, color: '#78716c', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
          {isPaper ? 'paper' : book.tier}
        </span>
        {statusIcon && (
          <span style={{ fontSize: 10, color: status === 'completed' ? '#22c55e' : '#f59e0b' }}>{statusIcon}</span>
        )}
        {isCritical && !statusIcon && (
          <span style={{ fontSize: 8, color: '#f59e0b88', fontFamily: 'monospace' }}>★</span>
        )}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: '#e7e5e4', fontFamily: 'Playfair Display, serif', lineHeight: 1.3, marginBottom: 3 }}>
        {book.title.length > 42 ? book.title.slice(0, 40) + '…' : book.title}
      </div>
      <div style={{ fontSize: 10, color: '#57534e', fontFamily: 'DM Sans, sans-serif' }}>
        {book.author.split(',')[0]} · {book.year}
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#78716c' }}>{'●'.repeat(book.difficulty)}{'○'.repeat(5 - book.difficulty)}</span>
        {!isPaper && (
          <span style={{ fontSize: 9, color: '#57534e', marginLeft: 'auto' }}>~{book.estimatedWeeks}w</span>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: trackColor, border: 'none', width: 7, height: 7 }} />
    </div>
  )
}

const nodeTypes = { bookNode: BookNode, trackLabel: TrackLabelNode }

interface Props { map: ReadingMap; progress?: UserProgress }

export function GraphView({ map, progress }: Props) {
  const { selectedBookId, setSelectedBook, showCriticalPathOnly } = useStore()

  const flowNodes: Node[] = useMemo(() => {
    const visibleBooks = showCriticalPathOnly
      ? map.books.filter((b) => map.criticalPath.includes(b.id))
      : map.books

    // Book nodes
    const bookNodes: Node[] = visibleBooks.map((book) => {
      const node = map.nodes.find((n) => n.bookId === book.id)
      const track = getBookTrack(book.id, map.tracks)
      return {
        id: book.id,
        type: 'bookNode',
        position: node?.position ?? { x: 0, y: 0 },
        data: {
          book,
          isCriticalPath: node?.isCriticalPath ?? false,
          isBottleneck: node?.isBottleneck ?? false,
          isSelected: selectedBookId === book.id,
          status: progress?.bookProgress[book.id]?.status ?? 'unread',
          trackColor: track?.color ?? TIER_COLORS[book.tier],
          onSelect: setSelectedBook,
        },
      }
    })

    // Track label nodes — one per track, positioned to the left of its books
    const visibleIds = new Set(visibleBooks.map((b) => b.id))
    const trackLabelNodes: Node[] = map.tracks
      .flatMap((track) => {
        const trackNodePositions = map.nodes.filter(
          (n) => track.bookIds.includes(n.bookId) && visibleIds.has(n.bookId)
        )
        if (trackNodePositions.length === 0) return []
        const avgY = trackNodePositions.reduce((s, n) => s + n.position.y, 0) / trackNodePositions.length
        const node: Node = {
          id: `__track_${track.id}`,
          type: 'trackLabel',
          position: { x: -210, y: avgY - 20 },
          data: { name: track.name, trackType: track.type, color: track.color },
          selectable: false,
          draggable: false,
        }
        return [node]
      })

    return [...trackLabelNodes, ...bookNodes]
  }, [map, selectedBookId, progress, showCriticalPathOnly, setSelectedBook])

  const flowEdges: FlowEdge[] = useMemo(() => {
    const visibleIds = new Set(
      flowNodes.filter((n) => n.type === 'bookNode').map((n) => n.id)
    )
    return map.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((edge) => {
        const srcTrack = getBookTrack(edge.source, map.tracks)
        const edgeColor = edge.type === 'prerequisite'
          ? (srcTrack?.color ?? '#f59e0b') + 'aa'
          : edge.type === 'parallel' ? '#3b82f666' : '#44403c'
        return {
          id: edge.id, source: edge.source, target: edge.target,
          type: 'smoothstep',
          animated: edge.type === 'prerequisite',
          style: {
            stroke: edgeColor,
            strokeWidth: edge.type === 'prerequisite' ? 2 : 1,
            strokeDasharray: edge.type === 'recommended' ? '5 5' : undefined,
          },
        }
      })
  }, [map.edges, map.tracks, flowNodes])

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

  useEffect(() => { setNodes(flowNodes) }, [flowNodes, setNodes])
  useEffect(() => { setEdges(flowEdges) }, [flowEdges, setEdges])

  return (
    <div style={{ width: '100%', height: '100%', background: '#0c0a09' }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2} maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1c1917" />
        <Controls style={{ background: '#1c1917', border: '1px solid #44403c', borderRadius: 8 }} />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'trackLabel') return 'transparent'
            const book = n.data?.book as Book | undefined
            if (!book) return '#78716c'
            const track = getBookTrack(book.id, map.tracks)
            return track?.color ?? TIER_COLORS[book.tier] ?? '#78716c'
          }}
          maskColor="#0c0a0988"
          style={{ background: '#1c1917', border: '1px solid #44403c', borderRadius: 8 }}
        />

        {/* Track legend */}
        <Panel position="top-left">
          <div style={{
            background: '#1c1917ee', border: '1px solid #292524', borderRadius: 8,
            padding: '10px 14px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: '#78716c', backdropFilter: 'blur(8px)', minWidth: 140,
          }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, color: '#57534e' }}>
              Specializations
            </div>
            {map.tracks.map((track) => (
              <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: track.color + '44', border: `1.5px solid ${track.color}`, flexShrink: 0 }} />
                <span style={{ color: track.color, fontSize: 10 }}>{track.name}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #292524' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, color: '#57534e' }}>Edges</div>
              {[['─── prerequisite', '#f59e0b'], ['╌╌╌ recommended', '#78716c'], ['─── parallel', '#3b82f6']].map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <div style={{ width: 16, height: 1.5, background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 9 }}>{label.split(' ')[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
