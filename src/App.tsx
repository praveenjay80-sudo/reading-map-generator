import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KeyRound } from 'lucide-react'
import { useStore } from './stores/useStore'
import { generateReadingMap } from './lib/generator'
import { ProfileForm } from './components/ProfileForm'
import { GraphView } from './components/GraphView'
import { ListView } from './components/ListView'
import { MapToolbar } from './components/MapToolbar'
import { Sidebar } from './components/Sidebar'
import { ApiKeySetup } from './components/ApiKeySetup'
import { BookDetailPanel } from './components/BookDetailPanel'
import './index.css'

function GeneratingOverlay({ step }: { step: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 bg-stone-950/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
      <div className="flex gap-1">
        {[0,1,2].map((i) => (
          <motion.div key={i} animate={{ y: [0,-8,0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} className="w-2 h-2 bg-amber-500 rounded-full" />
        ))}
      </div>
      <p className="text-stone-400 font-mono text-sm">{step}</p>
    </motion.div>
  )
}

export default function App() {
  const { apiKey, setApiKey, topic, profile, currentMap, isGenerating, generationStep, error, activeView, selectedBookId, setSelectedBook, getProgress, setGenerating, setError, setCurrentMap, saveMap } = useStore()
  const [showKeyEdit, setShowKeyEdit] = useState(false)

  const handleGenerate = async () => {
    if (!topic.trim() || isGenerating) return
    setError(null)
    setGenerating(true, 'Initialising...')
    try {
      const map = await generateReadingMap(apiKey, topic, profile, (step) => setGenerating(true, step))
      setCurrentMap(map)
      saveMap(map)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setGenerating(false)
    }
  }

  const progress = currentMap ? getProgress(currentMap.id) ?? undefined : undefined

  return (
    <div className="h-screen flex flex-col bg-stone-950 text-stone-100 overflow-hidden">
      <header className="flex items-center px-6 py-4 border-b border-stone-800 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <span className="text-stone-900 font-display font-bold text-sm">R</span>
          </div>
          <div>
            <h1 className="font-display font-semibold text-stone-100 text-base leading-none">ReadingMap</h1>
            <p className="text-xs text-stone-600 font-mono mt-0.5">Academic Knowledge Navigator</p>
          </div>
        </div>
        {apiKey && (
          <button
            onClick={() => setShowKeyEdit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-800 text-stone-500 hover:text-amber-400 hover:border-stone-600 transition-colors text-xs font-mono"
          >
            <KeyRound size={12} />
            API key
          </button>
        )}
      </header>

      {/* Inline key-edit panel */}
      <AnimatePresence>
        {showKeyEdit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-stone-800 bg-stone-900"
          >
            <div className="px-6 py-4 flex items-center gap-3 max-w-xl">
              <KeyRound size={14} className="text-amber-400 shrink-0" />
              <input
                type="password"
                defaultValue={apiKey}
                placeholder="sk-ant-api03-..."
                onBlur={(e) => { const v = e.target.value.trim(); if (v) setApiKey(v) }}
                className="flex-1 bg-stone-950 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-300 font-mono text-xs focus:outline-none focus:border-amber-500"
              />
              <button onClick={() => setShowKeyEdit(false)} className="text-xs font-mono text-stone-500 hover:text-stone-300 transition-colors">done</button>
              <button onClick={() => { setApiKey(''); setShowKeyEdit(false) }} className="text-xs font-mono text-red-500 hover:text-red-400 transition-colors">clear</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!apiKey ? (
        <ApiKeySetup />
      ) : (
        <div className="flex flex-1 overflow-hidden relative">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <AnimatePresence>{isGenerating && <GeneratingOverlay step={generationStep} />}</AnimatePresence>
            {!currentMap ? (
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-xl mx-auto px-6 py-10">
                  <div className="mb-10">
                    <h2 className="font-display text-3xl font-semibold text-stone-100 mb-2">Map your reading journey</h2>
                    <p className="text-stone-500 font-body">Enter any academic topic and your learning profile. Get a complete knowledge graph with sequential paths, parallel tracks, prerequisites, and time estimates.</p>
                  </div>
                  {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm font-mono">{error}</div>}
                  <ProfileForm onGenerate={handleGenerate} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <MapToolbar />
                <div className="flex-1 overflow-hidden relative">
                  {activeView === 'graph' && <GraphView map={currentMap} progress={progress} />}
                  {activeView === 'list' && <ListView map={currentMap} progress={progress} />}
                  <AnimatePresence>
                    {selectedBookId && (() => {
                      const book = currentMap.books.find((b) => b.id === selectedBookId)
                      return book ? (
                        <BookDetailPanel
                          key={selectedBookId}
                          book={book}
                          map={currentMap}
                          apiKey={apiKey}
                          progress={progress?.bookProgress[selectedBookId]}
                          onClose={() => setSelectedBook(null)}
                        />
                      ) : null
                    })()}
                  </AnimatePresence>
                </div>
                <div className="px-4 py-2 border-t border-stone-800 bg-stone-950 text-xs text-stone-600 font-body">{currentMap.summary}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
