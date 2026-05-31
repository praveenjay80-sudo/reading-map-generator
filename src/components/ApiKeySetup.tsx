import { useState } from 'react'
import { motion } from 'framer-motion'
import { KeyRound, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { useStore } from '../stores/useStore'

export function ApiKeySetup() {
  const { setApiKey } = useStore()
  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  const handleSave = () => {
    const trimmed = input.trim()
    if (!trimmed.startsWith('sk-ant-')) {
      setError('Key should start with sk-ant-')
      return
    }
    setApiKey(trimmed)
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-stone-950">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto px-6"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
            <KeyRound size={22} className="text-amber-400" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-stone-100 mb-2">Add your Anthropic API key</h2>
          <p className="text-stone-500 font-body text-sm leading-relaxed">
            Your key is stored only in this browser — never sent anywhere except the Anthropic API.
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={input}
              onChange={(e) => { setInput(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="sk-ant-api03-..."
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-4 py-3 pr-10 text-stone-100 font-mono text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
            />
            <button
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-400 transition-colors"
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          )}

          <motion.button
            onClick={handleSave}
            disabled={!input.trim()}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-3 rounded-xl font-display font-semibold transition-all ${
              input.trim()
                ? 'bg-amber-500 text-stone-900 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-stone-800 text-stone-600 cursor-not-allowed'
            }`}
          >
            Save & continue →
          </motion.button>

          <p className="text-center text-xs text-stone-600 font-body">
            No key?{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-500 hover:text-amber-400 inline-flex items-center gap-1"
            >
              Get one at console.anthropic.com <ExternalLink size={10} />
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
