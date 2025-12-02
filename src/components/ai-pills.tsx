import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Sparkle, Robot } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

export interface AI {
  id: string
  name: string
  color: string
  logo: React.JSX.Element
  functional?: boolean
}

export const availableAIs: AI[] = [
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
    logo: <Robot size={16} />,
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
    logo: <Robot size={16} />,
    functional: false
  },
  {
    id: 'pi',
    name: 'Pi',
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    logo: <Robot size={16} />
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
    logo: <Robot size={16} />
  },
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    logo: <Robot size={16} />
  }
]

// Add "Best" as the first option
export const allAIOptions: AI[] = [
  {
    id: 'best',
    name: 'Best',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    logo: <Sparkle weight="fill" className="w-4 h-4" />
  },
  ...availableAIs
]

interface AIPillsProps {
  selectedAIs: AI[]
  onAddAI: (ai: AI) => void
  onRemoveAI: (aiId: string) => void
  onSelectSingle?: (ai: AI) => void
  showAddButton?: boolean
  getBestAvailableModel?: () => string
}

export default function AIPills({ selectedAIs, onAddAI, onRemoveAI, onSelectSingle, showAddButton = true, getBestAvailableModel }: AIPillsProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)
  const MAX_AIS = 6 // Maximum number of AIs to prevent UI overflow

  useEffect(() => {
    setMounted(true)
  }, [])

  // Update position when scrolling or resizing
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const updatePos = () => {
        const rect = buttonRef.current?.getBoundingClientRect()
        if (rect) {
          setDropdownPos({
            top: rect.bottom + 6,
            left: rect.left
          })
        }
      }

      window.addEventListener('scroll', updatePos, true)
      window.addEventListener('resize', updatePos)

      return () => {
        window.removeEventListener('scroll', updatePos, true)
        window.removeEventListener('resize', updatePos)
      }
    }
  }, [showDropdown])

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

  const toggleDropdown = () => {
    if (!showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 6,
        left: rect.left
      })
    }
    setShowDropdown(!showDropdown)
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

  // Show pills with add button
  return (
    <div className="relative">
      {/* Selected AI Pills - Top Left */}
      <div className="flex flex-wrap gap-2 justify-start">
        <AnimatePresence>
          {selectedAIs.map((ai) => {
            const freshAI = allAIOptions.find(option => option.id === ai.id) || ai
            return (
              <motion.div
                key={ai.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 border transition-all duration-200 shadow-sm hover:shadow-md ${freshAI.color}`}
              >
                {freshAI.logo}
                <span className="font-medium">{getAIDisplayName(ai)}</span>
                <button
                  onClick={() => onRemoveAI(ai.id)}
                  className="hover:bg-black/10 rounded-full p-1 transition-all duration-150 active:scale-90 ml-1"
                >
                  <X size={12} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Add AI Button - Inline with pills (only show if showAddButton is true) */}
        {showAddButton && (
          <div className="flex items-center gap-2">
            <motion.button
              ref={buttonRef}
              whileHover={{ scale: selectedAIs.length < MAX_AIS ? 1.02 : 1 }}
              whileTap={{ scale: selectedAIs.length < MAX_AIS ? 0.98 : 1 }}
              onClick={() => selectedAIs.length < MAX_AIS && toggleDropdown()}
              disabled={selectedAIs.length >= MAX_AIS}
              className={`nodrag px-3 py-1.5 bg-card border rounded-full flex items-center gap-2 transition-all duration-200 ${selectedAIs.length >= MAX_AIS
                ? 'border-border/30 text-muted-foreground/40 cursor-not-allowed'
                : 'border-border/40 text-foreground hover:bg-muted/50 hover:border-border/60 active:scale-95 shadow-sm hover:shadow'
                }`}
            >
              <Plus size={13} />
              <span className="text-xs font-medium">Add AI</span>
              <motion.svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                className="ml-0.5 text-muted-foreground"
                animate={{ rotate: showDropdown ? 180 : 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </motion.button>
            {selectedAIs.length >= MAX_AIS && (
              <span className="text-xs text-gray-500">Max {MAX_AIS}</span>
            )}
          </div>
        )}
      </div>

      {/* Dropdown - Rendered via Portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {showDropdown && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[9998] bg-black/5"
                onClick={() => setShowDropdown(false)}
              />
              {/* Dropdown Menu */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{
                  duration: 0.2,
                  ease: [0.4, 0, 0.2, 1]
                }}
                className="fixed z-[9999] bg-popover text-popover-foreground border border-border shadow-xl min-w-[220px] max-h-[360px] overflow-y-auto rounded-lg"
                style={{
                  top: dropdownPos.top,
                  left: dropdownPos.left,
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) hsl(var(--muted))'
                }}
              >
                <div className="p-1.5">
                  {availableAIs
                    .filter(ai => !selectedAIs.find(selected => selected.id === ai.id))
                    .map((ai, index) => (
                      <motion.button
                        key={ai.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02, duration: 0.15 }}
                        onClick={() => addAI(ai)}
                        disabled={!ai.functional}
                        className={`w-full text-left px-3 py-2.5 transition-all duration-150 flex items-center gap-3 rounded-md ${!ai.functional
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-muted/60 cursor-pointer active:scale-[0.98]'
                          }`}
                      >
                        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-90">
                          {ai.logo}
                        </span>
                        <span className={`text-sm font-medium ${!ai.functional
                          ? 'text-muted-foreground/50'
                          : 'text-foreground/90'
                          }`}>
                          {getAIDisplayName(ai)}
                          {!ai.functional && (
                            <span className="ml-1.5 text-xs text-muted-foreground/60">(Coming Soon)</span>
                          )}
                        </span>
                      </motion.button>
                    ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
