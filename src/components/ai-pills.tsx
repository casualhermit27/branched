import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Sparkle, Robot, CaretUp, CaretDown, Check, Lock } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { discoverModels, DiscoveredModel, getCachedModels, setCachedModels } from '../services/model-discovery'
import { aiService } from '../services/ai-api'
import { UpsellModal } from './upsell-modal'


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
    id: 'mistral-large-latest',
    name: 'Mistral Large 3',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    logo: <img src="/logos/mistral-ai_logo.svg" alt="Mistral" width="16" height="16" />,
    functional: true
  },
  {
    id: 'gemini-3.0-pro-preview',
    name: 'Gemini 3.0 Pro',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    logo: <img src="/logos/gemini.svg" alt="Gemini" width="16" height="16" />,
    functional: true
  },

  // Non-functional AIs (greyed out but visible)
  {
    id: 'gpt-5.1-thinking',
    name: 'GPT-5.1 Thinking',
    color: 'bg-gray-100 text-gray-500 border-gray-200',
    logo: <img src="/logos/openai.svg" alt="OpenAI" width="16" height="16" />,
    functional: false
  },
  {
    id: 'claude-4-5-opus-20251124',
    name: 'Claude 4.5 Opus',
    color: 'bg-gray-100 text-gray-500 border-gray-200',
    logo: <img src="/logos/claude-ai-icon.svg" alt="Claude" width="16" height="16" />,
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
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
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

// Helper functions for dynamic models
const getProviderLogo = (provider: string) => {
  switch (provider) {
    case 'gemini': return <img src="/logos/gemini.svg" alt="Gemini" width="16" height="16" />
    case 'mistral': return <img src="/logos/mistral-ai_logo.svg" alt="Mistral" width="16" height="16" />
    case 'openai': return <img src="/logos/openai.svg" alt="OpenAI" width="16" height="16" />
    case 'claude': return <img src="/logos/claude-ai-icon.svg" alt="Claude" width="16" height="16" />
    case 'grok': return <img src="/logos/xai_light.svg" alt="Grok" width="16" height="16" />
    default: return <Robot size={16} />
  }
}

const getProviderColor = (provider: string) => {
  switch (provider) {
    case 'gemini': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'mistral': return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'openai': return 'bg-green-100 text-green-800 border-green-200'
    case 'claude': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'grok': return 'bg-gray-100 text-gray-800 border-gray-200'
    default: return 'bg-slate-100 text-slate-800 border-slate-200'
  }
}


const getProviderForId = (id: string) => {
  if (id.includes('gpt')) return 'openai'
  if (id.includes('claude')) return 'anthropic'
  if (id.includes('gemini')) return 'google'
  return 'openai'
}

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
  tier?: 'free' | 'pro'
}

export default function AIPills({ selectedAIs, onAddAI, onRemoveAI, onSelectSingle, showAddButton = true, getBestAvailableModel, tier = 'free' }: AIPillsProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom')
  const [discoveredAIs, setDiscoveredAIs] = useState<AI[]>([])
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)
  const MAX_AIS = 6 // Maximum number of AIs to prevent UI overflow

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      // Check for keys
      const providers = ['gemini', 'mistral', 'openai', 'claude', 'grok']
      let newAIs: AI[] = []

      for (const provider of providers) {
        const hasKey = aiService.getKey(provider).length > 0
        if (hasKey) {
          try {
            let models = getCachedModels(provider)

            // If not in cache, discover and cache them
            if (!models || models.length === 0) {
              models = await discoverModels(provider, aiService.getKey(provider))
              if (models.length > 0) {
                setCachedModels(provider, models)
              }
            }

            const mappedAIs = models.map(m => {
              const staticDef = availableAIs.find(s => s.id === m.id)
              return {
                id: m.id,
                name: m.name,
                color: staticDef ? staticDef.color : getProviderColor(m.provider),
                logo: staticDef ? staticDef.logo : getProviderLogo(m.provider),
                functional: true
              }
            })
            newAIs = [...newAIs, ...mappedAIs]
          } catch (e) {
            console.error(`Failed to fetch models for ${provider}`, e)
          }
        }
      }

      setDiscoveredAIs(newAIs)
    }

    if (showDropdown) {
      fetchModels()
    }
  }, [showDropdown])

  // Update position when scrolling or resizing
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const updatePos = () => {
        const rect = buttonRef.current?.getBoundingClientRect()
        if (rect) {
          const spaceBelow = window.innerHeight - rect.bottom
          const spaceAbove = rect.top
          const dropdownHeight = 320 // Max height estimate

          let newStyle: React.CSSProperties = {
            left: rect.left,
            position: 'fixed',
            zIndex: 9999
          }

          if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
            // Open upwards
            setPlacement('top')
            newStyle.bottom = window.innerHeight - rect.top + 8
            newStyle.top = 'auto'
            newStyle.transformOrigin = 'bottom left'
          } else {
            // Open downwards
            setPlacement('bottom')
            newStyle.top = rect.bottom + 8
            newStyle.bottom = 'auto'
            newStyle.transformOrigin = 'top left'
          }

          setDropdownStyle(newStyle)
        }
      }

      updatePos() // precise initial position
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
    setShowDropdown(!showDropdown)
  }

  const addAI = (ai: AI) => {
    if (!ai.functional) return

    // Edge case: Maximum AI limit reached
    if (selectedAIs.length >= MAX_AIS) {
      console.warn(`⚠️ Maximum ${MAX_AIS} AI models allowed`)
      return
    }
    onAddAI(ai)
    setShowDropdown(false)
  }

  const selectAI = (ai: AI) => {
    if (!ai.functional) return
    if (onSelectSingle) {
      onSelectSingle(ai)
    }
    setShowDropdown(false)
  }

  // Premium models that need locking
  const premiumModels = ['gpt-4', 'gpt-4o', 'claude-3-5-sonnet', 'claude-3-opus', 'gemini-1.5-pro']

  // STRICT MODE: Only show discovered AIs + Best
  const combinedAIs: AI[] = []

  const bestOption = allAIOptions.find(a => a.id === 'best')
  if (bestOption) {
    combinedAIs.push(bestOption)
  }

  // 1. Add all discovered models (these are definitely usable)
  discoveredAIs.forEach(discovered => {
    if (!combinedAIs.find(a => a.id === discovered.id)) {
      combinedAIs.push(discovered)
    }
  })

  // 2. Add hardcoded models ONLY if:
  //    a) We haven't discovered models for their provider yet (e.g. no key entered)
  //    b) AND they are marked as functional OR they are premium upsell targets
  //    c) AND they aren't already in the list
  availableAIs.forEach(ai => {
    const provider = getProviderForId(ai.id)
    const hasKey = aiService.getKey(provider).length > 0

    // If we have a key, we trust the discovered list for this provider. 
    // Don't add hardcoded ones (unless they were somehow discovered, which is handled above).
    if (hasKey) return

    // If no key, we show "functional" ones (free tier) or specific Premium ones for upsell
    const isPremium = premiumModels.includes(ai.id)
    if (ai.functional || isPremium) {
      if (!combinedAIs.find(a => a.id === ai.id)) {
        combinedAIs.push(ai)
      }
    }
  })

  combinedAIs.sort((a, b) => {
    if (a.id === 'best') return -1
    if (b.id === 'best') return 1
    return a.name.localeCompare(b.name)
  })

  const [upsellModel, setUpsellModel] = useState<{ isOpen: boolean; model: string; provider: string }>({
    isOpen: false,
    model: '',
    provider: ''
  })




  const handleAISelection = (ai: AI) => {
    // Check if model is premium and needs unlocking
    const isPremium = premiumModels.includes(ai.id)
    const provider = getProviderForId(ai.id)
    const hasKey = aiService.getKey(provider)

    // If Premium AND Free Tier AND No Key -> UPSELL
    if (isPremium && tier === 'free' && !hasKey) {
      setUpsellModel({
        isOpen: true,
        model: ai.name,
        provider: provider
      })
      setShowDropdown(false)
      return
    }

    if (!ai.functional && !isPremium) return

    addAI(ai)
  }

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
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 border transition-all duration-200 ${freshAI.color}`}
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
        {
          showAddButton && (
            <div className="flex items-center gap-2">
              <motion.button
                ref={buttonRef}
                whileHover={{ scale: selectedAIs.length < MAX_AIS ? 1.02 : 1 }}
                whileTap={{ scale: selectedAIs.length < MAX_AIS ? 0.98 : 1 }}
                onClick={() => selectedAIs.length < MAX_AIS && toggleDropdown()}
                disabled={selectedAIs.length >= MAX_AIS}
                className={`nodrag px-3 py-1.5 bg-card border rounded-full flex items-center gap-2 transition-colors duration-200 ${selectedAIs.length >= MAX_AIS
                  ? 'border-border/30 text-muted-foreground/40 cursor-not-allowed'
                  : 'border-border text-foreground hover:bg-muted/50'
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
          )
        }
      </div >

      {/* Dropdown - Rendered via Portal */}
      {
        mounted && createPortal(
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
                  initial={{ opacity: 0, scale: 0.96, y: placement === 'top' ? 4 : -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: placement === 'top' ? 4 : -4 }}
                  transition={{
                    duration: 0.2,
                    ease: [0.4, 0, 0.2, 1]
                  }}
                  className="fixed bg-popover text-popover-foreground border border-border shadow-2xl min-w-[240px] max-h-[300px] overflow-y-auto rounded-xl ring-1 ring-border/50"
                  style={{
                    ...dropdownStyle,
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) hsl(var(--muted))'
                  }}
                >
                  <div className="p-1.5 space-y-0.5">
                    {combinedAIs
                      .filter(ai => !selectedAIs.find(selected => selected.id === ai.id))
                      .map((ai, index) => {
                        const isPremium = premiumModels.includes(ai.id)
                        const provider = getProviderForId(ai.id)
                        const hasKey = aiService.getKey(provider)
                        const isLocked = isPremium && tier === 'free' && !hasKey
                        const isAvailable = ai.functional || isPremium // Premium models are "available" (either functional or locked)

                        return (
                          <motion.button
                            key={ai.id}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.02, duration: 0.15 }}
                            onClick={() => handleAISelection(ai)}
                            disabled={!isAvailable}
                            className={`w-full text-left px-3 py-2.5 transition-all duration-150 flex items-center gap-3 rounded-lg group ${!isAvailable
                              ? 'opacity-50 cursor-not-allowed grayscale'
                              : 'hover:bg-muted/80 cursor-pointer active:scale-[0.98]'
                              }`}
                          >
                            <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 rounded-md transition-colors ${!isAvailable ? 'opacity-70' : 'group-hover:bg-white/10'}`}>
                              {ai.logo}
                            </span>
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium leading-none truncate ${!isAvailable
                                  ? 'text-muted-foreground'
                                  : 'text-foreground'
                                  }`}>
                                  {getAIDisplayName(ai)}
                                </span>
                                {isLocked && <Lock weight="fill" className="text-amber-500 w-3 h-3" />}
                              </div>
                              {ai.functional && !isLocked && (
                                <span className="text-[10px] text-muted-foreground/70 truncate">
                                  {ai.id}
                                </span>
                              )}
                              {isLocked && (
                                <span className="text-[10px] text-amber-600/80 font-medium">Pro / BYOK</span>
                              )}
                              {!isAvailable && !isLocked && (
                                <span className="text-[10px] text-muted-foreground/60 font-medium">Coming Soon</span>
                              )}
                            </div>
                          </motion.button>
                        )
                      })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )
      }

      {/* Upsell Modal */}
      <UpsellModal
        isOpen={upsellModel.isOpen}
        onClose={() => setUpsellModel({ ...upsellModel, isOpen: false })}
        modelName={upsellModel.model}
        provider={upsellModel.provider}
      />
    </div >
  )
}
