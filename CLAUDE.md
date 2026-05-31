# ReadingMap - Claude Code Instructions

## What this is
AI-powered academic reading map generator. Topic + learner profile gives a complete knowledge DAG
with prerequisite chains, parallel tracks, difficulty ratings, time estimates.
Powered by Claude claude-opus-4-5 via Anthropic SDK.

## Stack
Vite + React 18 + TypeScript + Zustand + @xyflow/react + Framer Motion + Tailwind + Anthropic SDK

## File map
src/types/index.ts          All types: Book, ReadingMap, LearnerProfile, UserProgress
src/stores/useStore.ts      Zustand store + localStorage persistence
src/lib/generator.ts        Claude API call, prompt, JSON parse, Markdown export
src/components/
  ProfileForm.tsx           Level/Goal/Time/Mode/PriorFields/FreeOnly form
  BookCard.tsx              Book with tier badge, difficulty, status, confidence stars
  GraphView.tsx             React Flow DAG with custom book nodes
  ListView.tsx              Tier-grouped list with filters + progress bar
  MapToolbar.tsx            View switcher, critical path toggle, export, delete
  Sidebar.tsx               Saved maps + field dependencies panel
src/App.tsx                 Root layout + generation orchestration

## Running
npm install && npm run dev  gives http://localhost:5173

## How to extend

### Add Timeline view
1. Add timeline to AppState activeView in types/index.ts
2. Create src/components/TimelineView.tsx - horizontal swimlanes by week
3. Add button in MapToolbar.tsx

### Add Notion export
Use Notion MCP already connected in Claude.ai.
Parent page ID for PJ Hobby Dashboard: 3165d8c710f280ce8696fe3e135eceab
Call notion-create-pages with exportToMarkdown output.

### Add What to read next
Find books where all prerequisites are completed but book is unread.
Surface as a recommendation panel.

### Add progress analytics
Use startedAt and completedAt to compute velocity and project completion date.
