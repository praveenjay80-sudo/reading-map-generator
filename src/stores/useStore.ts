import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState, ReadingMap, LearnerProfile, UserProgress, BookProgress, ReadStatus } from '../types'

const defaultProfile: LearnerProfile = {
  level: 'novice', goal: 'survey', timeHorizon: '6months',
  pathMode: 'breadth', priorFields: [], freeOnly: false,
}

interface Store extends AppState {
  setApiKey: (key: string) => void
  setTopic: (topic: string) => void
  setProfile: (profile: Partial<LearnerProfile>) => void
  setGenerating: (isGenerating: boolean, step?: string) => void
  setError: (error: string | null) => void
  setCurrentMap: (map: ReadingMap | null) => void
  saveMap: (map: ReadingMap) => void
  deleteMap: (mapId: string) => void
  loadMap: (mapId: string) => void
  updateBookStatus: (mapId: string, bookId: string, status: ReadStatus, confidence?: number) => void
  updateBookNotes: (mapId: string, bookId: string, notes: string) => void
  getProgress: (mapId: string) => UserProgress | null
  setSelectedBook: (bookId: string | null) => void
  setActiveView: (view: AppState['activeView']) => void
  toggleCriticalPath: () => void
  setActiveTrack: (trackId: string | null) => void
  reset: () => void
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      apiKey: '', topic: '', profile: defaultProfile, isGenerating: false, generationStep: '',
      error: null, currentMap: null, savedMaps: [], progress: {},
      selectedBookId: null, activeView: 'graph', showCriticalPathOnly: false, activeTrack: null,

      setApiKey: (apiKey) => set({ apiKey }),
      setTopic: (topic) => set({ topic }),
      setProfile: (partial) => set((s) => ({ profile: { ...s.profile, ...partial } })),
      setGenerating: (isGenerating, step = '') => set({ isGenerating, generationStep: step }),
      setError: (error) => set({ error }),
      setCurrentMap: (map) => set({ currentMap: map }),
      saveMap: (map) => set((s) => ({ savedMaps: [map, ...s.savedMaps.filter((m) => m.id !== map.id)] })),
      deleteMap: (mapId) => set((s) => ({
        savedMaps: s.savedMaps.filter((m) => m.id !== mapId),
        currentMap: s.currentMap?.id === mapId ? null : s.currentMap,
      })),
      loadMap: (mapId) => set((s) => ({ currentMap: s.savedMaps.find((m) => m.id === mapId) ?? null })),
      updateBookStatus: (mapId, bookId, status, confidence = 3) => set((s) => {
        const existing = s.progress[mapId] ?? { mapId, bookProgress: {}, lastUpdated: new Date().toISOString() }
        const bookP: BookProgress = {
          ...(existing.bookProgress[bookId] ?? { bookId, status: 'unread', confidence: 3, notes: '' }),
          status, confidence: confidence as BookProgress['confidence'],
          startedAt: status === 'reading' ? new Date().toISOString() : existing.bookProgress[bookId]?.startedAt,
          completedAt: status === 'completed' ? new Date().toISOString() : existing.bookProgress[bookId]?.completedAt,
        }
        return { progress: { ...s.progress, [mapId]: { ...existing, bookProgress: { ...existing.bookProgress, [bookId]: bookP }, lastUpdated: new Date().toISOString() } } }
      }),
      updateBookNotes: (mapId, bookId, notes) => set((s) => {
        const existing = s.progress[mapId]; if (!existing) return s
        return { progress: { ...s.progress, [mapId]: { ...existing, bookProgress: { ...existing.bookProgress, [bookId]: { ...existing.bookProgress[bookId], notes } } } } }
      }),
      getProgress: (mapId) => get().progress[mapId] ?? null,
      setSelectedBook: (bookId) => set({ selectedBookId: bookId }),
      setActiveView: (view) => set({ activeView: view }),
      toggleCriticalPath: () => set((s) => ({ showCriticalPathOnly: !s.showCriticalPathOnly })),
      setActiveTrack: (trackId) => set({ activeTrack: trackId }),
      reset: () => set({ topic: '', profile: defaultProfile, currentMap: null, error: null, selectedBookId: null, showCriticalPathOnly: false, activeTrack: null }),
    }),
    { name: 'readingmap-store', partialize: (s) => ({ apiKey: s.apiKey, savedMaps: s.savedMaps, progress: s.progress }) }
  )
)
