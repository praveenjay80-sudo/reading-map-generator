export type KnowledgeLevel = 'novice' | 'intermediate' | 'advanced'
export type LearnerGoal = 'survey' | 'research' | 'applied' | 'teaching'
export type TimeHorizon = '1month' | '3months' | '6months' | '1year' | '2years'
export type PathMode = 'breadth' | 'depth' | 'speedrun' | 'dissertation'

export interface LearnerProfile {
  level: KnowledgeLevel
  goal: LearnerGoal
  timeHorizon: TimeHorizon
  pathMode: PathMode
  priorFields: string[]
  freeOnly: boolean
}

export type BookTier = 'foundational' | 'core' | 'optional' | 'advanced' | 'paper'
export type Availability = 'free' | 'paid' | 'open-access' | 'libgen'

export interface Book {
  id: string
  title: string
  author: string
  year: number
  tier: BookTier
  difficulty: 1 | 2 | 3 | 4 | 5
  mathIntensity: 1 | 2 | 3 | 4 | 5
  estimatedWeeks: number
  prerequisites: string[]
  unlocks: string[]
  availability: Availability
  url?: string
  description: string
  whyRead: string
  skipIf: string[]
  alternativeTo?: string
  tags: string[]
  controversyNote?: string
  editionNote?: string
}

export type TrackType = 'theory' | 'applied' | 'historical' | 'computational'

export interface Track {
  id: string
  name: string
  type: TrackType
  description: string
  bookIds: string[]
  color: string
}

export interface PathNode {
  bookId: string
  position: { x: number; y: number }
  isCriticalPath: boolean
  isBottleneck: boolean
  isUnlocked: boolean
}

export interface ReadingMap {
  id: string
  topic: string
  profile: LearnerProfile
  generatedAt: string
  books: Book[]
  tracks: Track[]
  nodes: PathNode[]
  edges: Edge[]
  criticalPath: string[]
  estimatedTotalWeeks: number
  summary: string
  fieldDependencies: FieldDependency[]
}

export interface Edge {
  id: string
  source: string
  target: string
  type: 'prerequisite' | 'recommended' | 'parallel'
}

export interface FieldDependency {
  field: string
  reason: string
  keyBooks: string[]
}

export type ReadStatus = 'unread' | 'reading' | 'completed' | 'skipped' | 'abandoned'

export interface BookProgress {
  bookId: string
  status: ReadStatus
  confidence: 1 | 2 | 3 | 4 | 5
  notes: string
  startedAt?: string
  completedAt?: string
}

export interface UserProgress {
  mapId: string
  bookProgress: Record<string, BookProgress>
  lastUpdated: string
}

export interface AppState {
  apiKey: string
  topic: string
  profile: LearnerProfile
  isGenerating: boolean
  generationStep: string
  error: string | null
  currentMap: ReadingMap | null
  savedMaps: ReadingMap[]
  progress: Record<string, UserProgress>
  selectedBookId: string | null
  activeView: 'graph' | 'list' | 'timeline' | 'compare'
  showCriticalPathOnly: boolean
  activeTrack: string | null
}
