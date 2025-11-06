'use client'

import { useState } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface AI {
  id: string
  name: string
  color: string
  logo: React.JSX.Element
  functional?: boolean
}

interface AIPillsProps {
  selectedAIs: AI[]
  onAddAI: (ai: AI) => void
  onRemoveAI: (aiId: string) => void
  getBestAvailableModel?: () => string
}

const availableAIs: AI[] = [
  // Functional AIs (with API integration)
  { 
    id: 'mistral-large', 
    name: 'Mistral Large', 
    color: 'bg-purple-100 text-purple-800 border-purple-200', 
    logo: <img src="/logos/mistral-ai_logo.svg" alt="Mistral" width="16" height="16" />,
    functional: true
  },
  { 
    id: 'gemini-2.5-pro', 
    name: 'Gemini 2.5 Pro', 
    color: 'bg-blue-100 text-blue-800 border-blue-200', 
    logo: <img src="/logos/gemini.svg" alt="Gemini" width="16" height="16" />,
    functional: true
  },
  
  // Non-functional AIs (greyed out but visible)
  { 
    id: 'gpt-4', 
    name: 'GPT-4', 
    color: 'bg-gray-100 text-gray-500 border-gray-200', 
    logo: <img src="/logos/openai.svg" alt="OpenAI" width="16" height="16" />,
    functional: false
  },
  { 
    id: 'gpt-4o', 
    name: 'GPT-4o', 
    color: 'bg-gray-100 text-gray-500 border-gray-200', 
    logo: <img src="/logos/openai.svg" alt="OpenAI" width="16" height="16" />,
    functional: false
  },
  { 
    id: 'claude-3-5-sonnet', 
    name: 'Claude 3.5 Sonnet', 
    color: 'bg-gray-100 text-gray-500 border-gray-200', 
    logo: <img src="/logos/claude-ai-icon.svg" alt="Claude" width="16" height="16" />,
    functional: false
  },
  { 
    id: 'claude-3-opus', 
    name: 'Claude 3 Opus', 
    color: 'bg-gray-100 text-gray-500 border-gray-200', 
    logo: <img src="/logos/claude-ai-icon.svg" alt="Claude" width="16" height="16" />,
    functional: false
  },
  { 
    id: 'grok-2', 
    name: 'Grok-2', 
    color: 'bg-gray-100 text-gray-500 border-gray-200', 
    logo: <img src="/logos/xai_light.svg" alt="Grok" width="16" height="16" />,
    functional: false
  },
  { 
    id: 'perplexity-pro', 
    name: 'Perplexity Pro', 
    color: 'bg-gray-100 text-gray-500 border-gray-200', 
    logo: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>,
    functional: false
  },
  { 
    id: 'llama-3-1', 
    name: 'LLaMA 3.1', 
    color: 'bg-gray-100 text-gray-500 border-gray-200', 
    logo: <img src="/logos/ollama_light.svg" alt="LLaMA" width="16" height="16" />,
    functional: false
  },
  { 
    id: 'cohere-command', 
    name: 'Cohere Command', 
    color: 'bg-gray-100 text-gray-500 border-gray-200', 
    logo: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>,
    functional: false
  },
  { 
    id: 'pi', 
    name: 'Pi', 
    color: 'bg-teal-100 text-teal-800 border-teal-200', 
    logo: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="bold">π</text></svg>
  },
  { 
    id: 'o1-preview', 
    name: 'o1 Preview', 
    color: 'bg-violet-100 text-violet-800 border-violet-200', 
    logo: <img src="/logos/openai.svg" alt="OpenAI" width="16" height="16" />
  },
  { 
    id: 'deepseek-v2', 
    name: 'DeepSeek V2', 
    color: 'bg-slate-100 text-slate-800 border-slate-200', 
    logo: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
  },
  { 
    id: 'qwen-max', 
    name: 'Qwen Max', 
    color: 'bg-rose-100 text-rose-800 border-rose-200', 
    logo: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
  },
]

// Add "Best" as the first option
const allAIOptions: AI[] = [
  {
    id: 'best',
    name: 'Best',
    color: 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border-purple-200',
    logo: <span className="text-purple-600">✨</span>
  },
  ...availableAIs
]

interface AIPillsProps {
  selectedAIs: AI[]
  onAddAI: (ai: AI) => void
  onRemoveAI: (aiId: string) => void
  onSelectSingle?: (ai: AI) => void
  showAddButton?: boolean
  singleMode?: boolean
  getBestAvailableModel?: () => string
}

export default function AIPills({ selectedAIs, onAddAI, onRemoveAI, onSelectSingle, showAddButton = true, singleMode = false, getBestAvailableModel }: AIPillsProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const MAX_AIS = 6 // Maximum number of AIs to prevent UI overflow

  // Get display name for AI, showing actual model for "Best"
  const getAIDisplayName = (ai: AI): string => {
    if (ai.id === 'best' && getBestAvailableModel) {
      const actualModel = getBestAvailableModel()
      const modelNames: { [key: string]: string } = {
        'gemini': 'Gemini 2.0 Flash',
        'mistral': 'Mistral Large',
        'gpt-4': 'GPT-4'
      }
      return `${ai.name} (${modelNames[actualModel] || actualModel})`
    }
    return ai.name
  }

  const addAI = (ai: AI) => {
    // Only allow adding functional AIs
    if (!ai.functional) {
      return
    }
    
    // Edge case: Maximum AI limit reached
    if (selectedAIs.length >= MAX_AIS) {
      console.warn(`⚠️ Maximum ${MAX_AIS} AI models allowed`)
      return
    }
    onAddAI(ai)
    setShowDropdown(false)
  }
  
  const selectAI = (ai: AI) => {
    // Only allow selection of functional AIs
    if (!ai.functional) {
      return
    }
    
    if (onSelectSingle) {
      onSelectSingle(ai)
    }
    setShowDropdown(false)
  }

  // Single mode: Show dropdown selector
  if (singleMode) {
    const currentAI = selectedAIs[0]
    
    return (
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowDropdown(!showDropdown)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-2xl text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          style={{ borderRadius: '16px' }}
        >
          <span className="w-4 h-4 flex items-center justify-center">
            {currentAI?.logo}
          </span>
          <span className="text-sm font-medium">{currentAI?.name || 'Select AI'}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="ml-1">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.button>
        
        {/* Dropdown for single selection */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 bg-white border border-gray-200 shadow-lg z-10 min-w-[200px] max-h-[400px] overflow-y-auto"
              style={{ borderRadius: '16px' }}
            >
              {allAIOptions.map((ai) => (
                <button
                  key={ai.id}
                  onClick={() => selectAI(ai)}
                  disabled={!ai.functional}
                  className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                    !ai.functional 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-gray-50 cursor-pointer'
                  } ${
                    currentAI?.id === ai.id ? 'bg-gray-100' : ''
                  }`}
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    {ai.logo}
                  </span>
                  <span className={`text-sm font-medium ${
                    !ai.functional ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                    {getAIDisplayName(ai)}
                    {!ai.functional && ' (Coming Soon)'}
                  </span>
                  {currentAI?.id === ai.id && (
                    <span className="ml-auto text-purple-600">✓</span>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Multi mode: Show pills with add button
  return (
    <div className="relative">
      {/* Selected AI Pills - Top Left */}
      <div className="flex flex-wrap gap-2 justify-start">
        <AnimatePresence>
          {selectedAIs.map((ai) => (
            <motion.div
              key={ai.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`px-3 py-2 rounded-2xl text-xs font-medium flex items-center gap-2 border ${ai.color}`}
              style={{ borderRadius: '16px' }}
            >
              {ai.logo}
              <span className="font-medium">{getAIDisplayName(ai)}</span>
              <button
                onClick={() => onRemoveAI(ai.id)}
                className="hover:bg-black/10 rounded-full p-0.5 transition-colors ml-1"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Add AI Button - Inline with pills (only show if showAddButton is true) */}
        {showAddButton && (
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: selectedAIs.length < MAX_AIS ? 1.05 : 1 }}
              whileTap={{ scale: selectedAIs.length < MAX_AIS ? 0.95 : 1 }}
              onClick={() => selectedAIs.length < MAX_AIS && setShowDropdown(!showDropdown)}
              disabled={selectedAIs.length >= MAX_AIS}
              className={`px-3 py-2 bg-white border rounded-2xl flex items-center gap-2 transition-colors ${
                selectedAIs.length >= MAX_AIS
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              style={{ borderRadius: '16px' }}
            >
              <Plus size={14} />
              <span className="text-xs font-medium">Add AI</span>
            </motion.button>
            {selectedAIs.length >= MAX_AIS && (
              <span className="text-xs text-gray-500">Max {MAX_AIS}</span>
            )}
          </div>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 bg-white border border-gray-200 shadow-lg z-10 min-w-[200px]"
            style={{ borderRadius: '16px' }}
          >
            <div className="p-2">
              {availableAIs
                .filter(ai => !selectedAIs.find(selected => selected.id === ai.id))
                .map((ai) => (
                  <button
                    key={ai.id}
                    onClick={() => addAI(ai)}
                    disabled={!ai.functional}
                    className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-3 rounded-xl ${
                      !ai.functional 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-gray-50 cursor-pointer'
                    }`}
                    style={{ borderRadius: '12px' }}
                  >
                    {ai.logo}
                    <span className={`text-xs font-medium ${
                      !ai.functional ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      {getAIDisplayName(ai)}
                      {!ai.functional && ' (Coming Soon)'}
                    </span>
                  </button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
