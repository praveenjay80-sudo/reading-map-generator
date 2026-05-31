import { Download, GitBranch, List, Save, Trash2, RotateCcw } from 'lucide-react'
import { useStore } from '../stores/useStore'
import { exportToMarkdown } from '../lib/generator'

export function MapToolbar() {
  const { currentMap, activeView, setActiveView, showCriticalPathOnly, toggleCriticalPath, saveMap, deleteMap, reset } = useStore()
  if (!currentMap) return null
  const dl = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }
  const slug = currentMap.topic.replace(/\s+/g, '-').toLowerCase()
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-800 bg-stone-950">
      <div className="flex-1 min-w-0">
        <span className="font-display font-semibold text-stone-200 text-sm">{currentMap.topic}</span>
        <span className="text-stone-600 text-xs ml-3 font-mono">{currentMap.books.length} books · ~{currentMap.estimatedTotalWeeks}w</span>
      </div>
      <div className="flex items-center border border-stone-800 rounded-lg overflow-hidden">
        <button onClick={() => setActiveView('graph')} className={`px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 transition-colors ${activeView === 'graph' ? 'bg-stone-800 text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}><GitBranch size={12} /> Graph</button>
        <button onClick={() => setActiveView('list')} className={`px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 border-l border-stone-800 transition-colors ${activeView === 'list' ? 'bg-stone-800 text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}><List size={12} /> List</button>
      </div>
      <button onClick={toggleCriticalPath} className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${showCriticalPathOnly ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-stone-700 text-stone-500 hover:text-stone-300'}`}>Critical Path</button>
      <button onClick={() => saveMap(currentMap)} className="p-1.5 text-stone-500 hover:text-green-400 transition-colors"><Save size={14} /></button>
      <div className="relative group">
        <button className="p-1.5 text-stone-500 hover:text-amber-400 transition-colors"><Download size={14} /></button>
        <div className="absolute right-0 top-full mt-1 bg-stone-900 border border-stone-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50 overflow-hidden">
          <button onClick={() => dl(exportToMarkdown(currentMap), `${slug}-reading-map.md`, 'text/markdown')} className="block w-full px-4 py-2 text-xs font-mono text-stone-300 hover:bg-stone-800 text-left whitespace-nowrap">Export as Markdown</button>
          <button onClick={() => dl(JSON.stringify(currentMap, null, 2), `${slug}-reading-map.json`, 'application/json')} className="block w-full px-4 py-2 text-xs font-mono text-stone-300 hover:bg-stone-800 text-left whitespace-nowrap">Export as JSON</button>
        </div>
      </div>
      <button onClick={() => { deleteMap(currentMap.id); reset() }} className="p-1.5 text-stone-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
      <button onClick={reset} className="p-1.5 text-stone-500 hover:text-stone-300 transition-colors"><RotateCcw size={14} /></button>
    </div>
  )
}
