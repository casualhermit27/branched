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
    color: 'bg-gradient-to-r from-purple-100 via-indigo-100 to-blue-100 text-purple-800 border-purple-300 dark:from-purple-900/30 dark:via-indigo-900/30 dark:to-blue-900/30 dark:text-purple-300 dark:border-purple-700',
    logo: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
        <defs>
          <linearGradient id="bestGradientPill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        {/* Star shape - represents "best" */}
        <path 
          d="M12 2L14.5 8.5L21 9.5L16 14L17.5 20.5L12 17L6.5 20.5L8 14L3 9.5L9.5 8.5L12 2Z" 
          fill="url(#bestGradientPill)" 
          opacity="0.9"
          className="drop-shadow-sm"
        />
        {/* Inner highlight */}
        <path 
          d="M12 5L13.5 9L17 9.5L14 12L14.5 15.5L12 13.5L9.5 15.5L10 12L7 9.5L10.5 9L12 5Z" 
          fill="white" 
          opacity="0.3"
        />
      </svg>
    )
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
          className="px-4 py-2 bg-card dark:bg-card border border-border dark:border-border/60 rounded-xl text-foreground hover:bg-muted dark:hover:bg-muted/80 transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
        >
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {currentAI?.logo}
          </span>
          <span className="text-sm font-medium">{currentAI?.name || 'Select AI'}</span>
          <motion.svg 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            className="ml-1 flex-shrink-0"
            animate={{ rotate: showDropdown ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </motion.svg>
        </motion.button>
        
        {/* Dropdown for single selection */}
        <AnimatePresence mode="wait">
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ 
                duration: 0.15,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="absolute top-full left-0 mt-2 bg-card dark:bg-card border border-border dark:border-border/60 shadow-lg z-50 min-w-[200px] max-h-[400px] overflow-y-auto rounded-xl backdrop-blur-sm"
            >
              {allAIOptions.map((ai) => (
                <button
                  key={ai.id}
                  onClick={() => selectAI(ai)}
                  disabled={!ai.functional}
                  className={`w-full px-4 py-3 text-left transition-colors duration-150 flex items-center gap-3 rounded-lg first:rounded-t-xl last:rounded-b-xl ${
                    !ai.functional 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-muted dark:hover:bg-muted/80 cursor-pointer active:scale-[0.98]'
                  } ${
                    currentAI?.id === ai.id ? 'bg-muted/50 dark:bg-muted/40 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {ai.logo}
                  </span>
                  <span className={`text-sm font-medium flex-1 ${
                    !ai.functional ? 'text-muted-foreground/50' : 'text-foreground'
                  }`}>
                    {getAIDisplayName(ai)}
                    {!ai.functional && ' (Coming Soon)'}
                  </span>
                  {currentAI?.id === ai.id && (
                    <span className="ml-auto text-primary flex-shrink-0">✓</span>
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
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 border transition-all duration-200 shadow-sm hover:shadow-md ${ai.color}`}
              style={{ borderRadius: '16px' }}
            >
              {ai.logo}
              <span className="font-medium">{getAIDisplayName(ai)}</span>
              <button
                onClick={() => onRemoveAI(ai.id)}
                className="hover:bg-black/10 rounded-full p-1 transition-all duration-150 active:scale-90 ml-1"
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
              className={`px-3 py-2 bg-card dark:bg-card border rounded-xl flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md ${
                selectedAIs.length >= MAX_AIS
                  ? 'border-border/40 dark:border-border/30 text-muted-foreground/50 cursor-not-allowed'
                  : 'border-border dark:border-border/60 text-foreground hover:bg-muted dark:hover:bg-muted/80 active:scale-95'
              }`}
            >
              <Plus size={14} />
              <span className="text-xs font-medium">Add AI</span>
              <motion.svg 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                className="ml-1"
                animate={{ rotate: showDropdown ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </motion.svg>
            </motion.button>
            {selectedAIs.length >= MAX_AIS && (
              <span className="text-xs text-gray-500">Max {MAX_AIS}</span>
            )}
          </div>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence mode="wait">
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ 
              duration: 0.15,
              ease: [0.4, 0, 0.2, 1]
            }}
            className="absolute top-full left-0 mt-2 bg-card dark:bg-card border border-border dark:border-border/60 shadow-lg z-50 min-w-[200px] rounded-xl backdrop-blur-sm"
          >
            <div className="p-2">
              {availableAIs
                .filter(ai => !selectedAIs.find(selected => selected.id === ai.id))
                .map((ai) => (
                  <button
                    key={ai.id}
                    onClick={() => addAI(ai)}
                    disabled={!ai.functional}
                    className={`w-full text-left px-3 py-2.5 transition-colors duration-150 flex items-center gap-3 rounded-lg ${
                      !ai.functional 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-muted dark:hover:bg-muted/80 cursor-pointer active:scale-[0.98]'
                    }`}
                  >
                    {ai.logo}
                    <span className={`text-xs font-medium ${
                      !ai.functional ? 'text-muted-foreground/50' : 'text-foreground'
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
