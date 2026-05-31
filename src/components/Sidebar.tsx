import { Clock, BookOpen, ChevronRight } from 'lucide-react'
import { useStore } from '../stores/useStore'

export function Sidebar() {
  const { savedMaps, currentMap, loadMap, progress } = useStore()
  const getCompletion = (mapId: string) => {
    const p = progress[mapId]; if (!p) return 0
    const map = savedMaps.find((m) => m.id === mapId); if (!map) return 0
    return Math.round((Object.values(p.bookProgress).filter((b) => b.status === 'completed').length / map.books.length) * 100)
  }
  const deps = currentMap?.fieldDependencies ?? []
  return (
    <div className="w-64 border-r border-stone-800 flex flex-col bg-stone-950 shrink-0">
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-stone-800">
          <span className="text-xs font-mono uppercase tracking-widest text-stone-500">Saved Maps</span>
        </div>
        {savedMaps.length === 0 && <div className="px-4 py-6 text-xs text-stone-600 font-body text-center">No saved maps yet.<br />Generate and save one.</div>}
        <div className="py-2">
          {savedMaps.map((map) => {
            const pct = getCompletion(map.id); const isCurrent = currentMap?.id === map.id
            return (
              <button key={map.id} onClick={() => loadMap(map.id)} className={`w-full px-4 py-3 text-left transition-colors border-l-2 ${isCurrent ? 'border-amber-500 bg-stone-900 text-stone-200' : 'border-transparent text-stone-400 hover:bg-stone-900 hover:text-stone-300'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-body font-medium truncate flex-1">{map.topic}</span>
                  <ChevronRight size={12} className="text-stone-700 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-600"><BookOpen size={10} /> {map.books.length} books <Clock size={10} className="ml-1" /> {map.estimatedTotalWeeks}w</div>
                {pct > 0 && <div className="mt-2 h-1 bg-stone-800 rounded-full overflow-hidden"><div className="h-full bg-amber-500/60 rounded-full" style={{ width: `${pct}%` }} /></div>}
              </button>
            )
          })}
        </div>
      </div>
      {deps.length > 0 && (
        <div className="border-t border-stone-800">
          <div className="px-4 py-3 border-b border-stone-800"><span className="text-xs font-mono uppercase tracking-widest text-stone-500">Field Dependencies</span></div>
          <div className="px-4 py-3 space-y-3 max-h-48 overflow-y-auto">
            {deps.map((dep) => (
              <div key={dep.field}>
                <div className="text-xs font-body font-medium text-stone-300 mb-0.5">{dep.field}</div>
                <div className="text-xs text-stone-600 font-body leading-snug">{dep.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
