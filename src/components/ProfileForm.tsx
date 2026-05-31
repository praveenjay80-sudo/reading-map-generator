import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Target, Clock, Zap, Plus, X } from 'lucide-react'
import { useStore } from '../stores/useStore'
import type { LearnerProfile } from '../types'

const LEVEL_OPTIONS = [
  { value: 'novice', label: 'Novice', desc: 'Starting from zero' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Some background' },
  { value: 'advanced', label: 'Advanced', desc: 'Going deeper' },
] as const

const GOAL_OPTIONS = [
  { value: 'survey', label: 'Survey', desc: 'Broad understanding', icon: '🗺️' },
  { value: 'research', label: 'Research', desc: 'Reach the frontier', icon: '🔬' },
  { value: 'applied', label: 'Applied', desc: 'Practical use', icon: '⚙️' },
  { value: 'teaching', label: 'Teaching', desc: 'Explain to others', icon: '🎓' },
] as const

const TIME_OPTIONS = [
  { value: '1month', label: '1 month' },
  { value: '3months', label: '3 months' },
  { value: '6months', label: '6 months' },
  { value: '1year', label: '1 year' },
  { value: '2years', label: '2 years' },
] as const

const MODE_OPTIONS = [
  { value: 'breadth', label: 'Breadth-first', desc: 'One good book per subtopic' },
  { value: 'depth', label: 'Depth-first', desc: 'Go deep on one branch' },
  { value: 'speedrun', label: 'Speed run', desc: 'Minimum viable path' },
  { value: 'dissertation', label: 'Dissertation', desc: 'Research frontier' },
] as const

interface Props { onGenerate: () => void }

export function ProfileForm({ onGenerate }: Props) {
  const { topic, profile, setTopic, setProfile, isGenerating } = useStore()
  const [priorInput, setPriorInput] = useState('')
  const addPriorField = () => {
    if (!priorInput.trim()) return
    setProfile({ priorFields: [...profile.priorFields, priorInput.trim()] })
    setPriorInput('')
  }
  const removePriorField = (field: string) =>
    setProfile({ priorFields: profile.priorFields.filter((f) => f !== field) })
  const canGenerate = topic.trim().length > 2 && !isGenerating

  return (
    <div className="space-y-8">
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-amber-400 mb-3">Academic Topic</label>
        <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canGenerate && onGenerate()}
          placeholder="e.g. Measure Theory, Quantum Field Theory, Cognitive Science..."
          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-4 py-3 text-stone-100 font-body placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all text-lg" />
      </div>
      <div>
        <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-stone-400 mb-3">
          <BookOpen size={12} /> Knowledge Level
        </label>
        <div className="grid grid-cols-3 gap-2">
          {LEVEL_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setProfile({ level: opt.value })}
              className={`p-3 rounded-lg border text-left transition-all ${profile.level === opt.value ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-stone-700 text-stone-400 hover:border-stone-500'}`}>
              <div className="font-body font-semibold text-sm">{opt.label}</div>
              <div className="text-xs text-stone-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-stone-400 mb-3">
          <Target size={12} /> Learning Goal
        </label>
        <div className="grid grid-cols-2 gap-2">
          {GOAL_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setProfile({ goal: opt.value })}
              className={`p-3 rounded-lg border text-left transition-all ${profile.goal === opt.value ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-stone-700 text-stone-400 hover:border-stone-500'}`}>
              <div className="font-body font-semibold text-sm">{opt.icon} {opt.label}</div>
              <div className="text-xs text-stone-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-stone-400 mb-3">
            <Clock size={12} /> Time Horizon
          </label>
          <select value={profile.timeHorizon} onChange={(e) => setProfile({ timeHorizon: e.target.value as LearnerProfile['timeHorizon'] })}
            className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2.5 text-stone-300 font-body focus:outline-none focus:border-amber-500">
            {TIME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-stone-400 mb-3">
            <Zap size={12} /> Path Mode
          </label>
          <select value={profile.pathMode} onChange={(e) => setProfile({ pathMode: e.target.value as LearnerProfile['pathMode'] })}
            className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2.5 text-stone-300 font-body focus:outline-none focus:border-amber-500">
            {MODE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label} — {opt.desc}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-stone-400 mb-3">
          Fields You Already Know <span className="text-stone-600">(optional)</span>
        </label>
        <div className="flex gap-2 mb-2">
          <input type="text" value={priorInput} onChange={(e) => setPriorInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPriorField()}
            placeholder="e.g. Linear Algebra, Statistics..."
            className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 font-body placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500" />
          <button onClick={addPriorField} className="px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-400 hover:text-amber-400 transition-colors">
            <Plus size={16} />
          </button>
        </div>
        <AnimatePresence>
          <div className="flex flex-wrap gap-2">
            {profile.priorFields.map((field) => (
              <motion.span key={field} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1 px-2 py-1 bg-stone-800 border border-stone-600 rounded-md text-xs text-stone-300 font-mono">
                {field}
                <button onClick={() => removePriorField(field)} className="text-stone-500 hover:text-red-400"><X size={10} /></button>
              </motion.span>
            ))}
          </div>
        </AnimatePresence>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <div onClick={() => setProfile({ freeOnly: !profile.freeOnly })}
          className={`w-10 h-5 rounded-full transition-all relative ${profile.freeOnly ? 'bg-amber-500' : 'bg-stone-700'}`}>
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${profile.freeOnly ? 'left-5' : 'left-0.5'}`} />
        </div>
        <span className="text-sm text-stone-400 font-body">Free / open-access books only</span>
      </label>
      <motion.button onClick={onGenerate} disabled={!canGenerate} whileTap={{ scale: 0.98 }}
        className={`w-full py-4 rounded-xl font-display font-semibold text-lg tracking-wide transition-all ${canGenerate ? 'bg-amber-500 text-stone-900 hover:bg-amber-400 shadow-lg shadow-amber-500/20' : 'bg-stone-800 text-stone-600 cursor-not-allowed'}`}>
        {isGenerating ? 'Generating...' : 'Generate Reading Map →'}
      </motion.button>
    </div>
  )
}
