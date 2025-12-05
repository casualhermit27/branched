'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { ArrowsOut, ArrowsIn, GitBranch, PaperPlaneRight, Stop, Plus } from '@phosphor-icons/react'
import AIPills, { allAIOptions } from './ai-pills'
import { SideBySideComparison } from './side-by-side-comparison'

interface Message {
  id: string
  text: string
  isUser: boolean
  ai?: string
  parentId?: string
  children: string[]
  timestamp: number
  responses?: { [aiId: string]: string }
  aiModel?: string    // AI that generated this
  groupId?: string    // Link related multi-model responses
  isStreaming?: boolean  // Whether this message is currently streaming
  streamingText?: string // Current streaming text content
  role?: string // Added to satisfy linter, though we use isUser
}

interface AI {
  id: string
  name: string
  color: string
  logo: React.JSX.Element
}

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (message: string, parentId?: string) => void
  selectedAIs: AI[]
  onBranchFromMessage: (messageId: string, isMultiBranch?: boolean) => void
  currentBranch: string | null
  isGenerating?: boolean
  onStopGeneration?: () => void
  existingBranchesCount?: number
  // Branch-level multi-model props
  onAddAI?: (ai: AI) => void
  onRemoveAI?: (aiId: string) => void
  onSelectSingle?: (aiId: string) => void
  getBestAvailableModel?: () => string
  isMain?: boolean
  nodeId?: string
  onExportImport?: () => void
  readOnly?: boolean
  onMessageSelect?: (messageId: string, isMultiSelect: boolean) => void
  selectedMessageIds?: Set<string>
}

function ChatInterface({
  messages,
  onSendMessage,
  selectedAIs,
  onBranchFromMessage,
  currentBranch,
  isGenerating = false,
  onStopGeneration,
  existingBranchesCount = 0,
  // Branch-level multi-model props
  onAddAI,
  onRemoveAI,
  onSelectSingle,
  getBestAvailableModel,
  isMain = false,
  nodeId,
  onExportImport,
  readOnly = false,
  onMessageSelect,
  selectedMessageIds
}: ChatInterfaceProps) {
  const [message, setMessage] = useState('')
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [showBranchWarning, setShowBranchWarning] = useState(false)
  const [comparisonViewGroupId, setComparisonViewGroupId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastBranchIdRef = useRef<string | null | undefined>(currentBranch)
  const hasScrolledRef = useRef<boolean>(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    onSendMessage(message, currentBranch || undefined)
    setMessage('')
    // Enable auto-scroll when user sends a message
    setShouldAutoScroll(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return

    const container = messagesContainerRef.current
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50

    if (isAtBottom) {
      setIsUserScrolling(false)
      setShouldAutoScroll(true)
    } else {
      setIsUserScrolling(true)
      setShouldAutoScroll(false)
    }
  }, [])

  // Handle branch change - reset scroll state and focus
  useEffect(() => {
    if (currentBranch !== lastBranchIdRef.current) {
      // Branch changed - reset scroll state
      setShouldAutoScroll(true)
      hasScrolledRef.current = false
      lastBranchIdRef.current = currentBranch

      // Auto-focus if it's a new empty branch (UX improvement)
      if (messages.length === 0) {
        setTimeout(() => {
          textareaRef.current?.focus()
        }, 100)
      }

      // Use scrollTop instead of scrollIntoView to avoid layout shifts
      setTimeout(() => {
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current
          container.scrollTop = container.scrollHeight
        }
      }, 100)
    }
  }, [currentBranch, messages.length])

  // Auto-scroll to bottom when new messages arrive (only if should auto-scroll)
  useEffect(() => {
    if (shouldAutoScroll && messagesContainerRef.current && messages.length > 0) {
      const container = messagesContainerRef.current
      const isNewMessage = !hasScrolledRef.current

      if (isNewMessage) {
        requestAnimationFrame(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          })
        })
      } else {
        container.scrollTop = container.scrollHeight
      }

      hasScrolledRef.current = true
    }
  }, [messages, shouldAutoScroll])

  // Reset auto-scroll when user starts typing
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    setShouldAutoScroll(true)
  }

  // Handle multi-branch creation
  const handleCreateBranches = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.isUser)
    if (!lastUserMessage) return
    onBranchFromMessage(lastUserMessage.id, true)
  }

  const getAIColor = (aiId: string) => {
    const freshAI = allAIOptions.find(a => a.id === aiId)
    if (freshAI) return freshAI.color

    const ai = selectedAIs.find(a => a.id === aiId)
    return ai?.color || 'bg-muted text-foreground border-border'
  }

  const getAILogo = (aiId: string) => {
    const freshAI = allAIOptions.find(a => a.id === aiId)
    if (freshAI) return freshAI.logo

    const ai = selectedAIs.find(a => a.id === aiId)
    return ai?.logo || null
  }

  // Normalize messages
  const validatedMessages = messages.map((msg) => {
    const hasAIModel = !!(msg.aiModel || msg.ai)
    if (hasAIModel && msg.isUser !== false) return { ...msg, isUser: false }
    if (!hasAIModel && msg.isUser !== true && !msg.text?.startsWith('[Branched from:')) return { ...msg, isUser: true }
    return msg
  })

  const normalizedMessages = validatedMessages.map(msg => {
    const isAI = Boolean(msg.aiModel || msg.ai || msg.role === 'assistant')
    const forcedIsUser = !isAI
    return { ...msg, isUser: forcedIsUser }
  })

  // Group messages
  const groupedMessages = normalizedMessages.reduce((groups, msg) => {
    if (msg.groupId) {
      if (!groups[msg.groupId]) groups[msg.groupId] = []
      // Prevent duplicates in the same group
      if (!groups[msg.groupId].some(m => m.id === msg.id)) {
        groups[msg.groupId].push(msg)
      }
    } else {
      groups[`single-${msg.id}`] = [msg]
    }
    return groups
  }, {} as Record<string, Message[]>)

  const getAIModelsFromGroup = (groupMessages: Message[]) => {
    return groupMessages
      .filter(msg => msg.aiModel)
      .map(msg => selectedAIs.find(ai => ai.id === msg.aiModel))
      .filter(Boolean) as AI[]
  }

  const handlePillClick = (aiId: string, groupId?: string) => {
    if (groupId) {
      const targetMessage = messages.find(msg => msg.groupId === groupId && msg.aiModel === aiId)
      if (targetMessage) {
        const element = document.getElementById(`message-${targetMessage.id}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('ring-2', 'ring-primary', 'ring-opacity-50')
          setTimeout(() => element.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50'), 2000)
        }
      }
    }
  }

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden nodrag"
      data-scrollable
      onWheel={(e) => e.stopPropagation()}
    >


      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden space-y-8 px-4 pb-4 pt-4 overscroll-contain"
        ref={messagesContainerRef}
        onScroll={handleScroll}
        data-scrollable
        style={{
          scrollBehavior: 'smooth',
        }}
      >
        {Object.entries(groupedMessages).map(([groupId, groupMessages], index, array) => {
          const isMultiModel = groupMessages.length > 1
          const aiModels = getAIModelsFromGroup(groupMessages)
          const isComparisonView = comparisonViewGroupId === groupId

          return (
            <div key={groupId} className="space-y-4">
              {/* Multi-model Group Header */}
              {isMultiModel && (
                <div className="flex items-center justify-center gap-3 py-2 opacity-80 hover:opacity-100 transition-opacity">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-[10px] text-muted-foreground font-medium border border-border/30">
                    <span>{groupMessages.length} Responses</span>
                  </div>
                  <button
                    onClick={() => setComparisonViewGroupId(isComparisonView ? null : groupId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-background/50 hover:bg-muted border border-border/30 rounded-full text-[10px] font-medium text-foreground transition-all shadow-sm"
                  >
                    {isComparisonView ? (
                      <>
                        <ArrowsIn className="w-3 h-3" />
                        <span>Stack View</span>
                      </>
                    ) : (
                      <>
                        <ArrowsOut className="w-3 h-3" />
                        <span>Compare View</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Comparison View */}
              {isMultiModel && isComparisonView ? (
                <SideBySideComparison
                  messages={normalizedMessages}
                  selectedAIs={selectedAIs}
                  groupId={groupId}
                  onClose={() => setComparisonViewGroupId(null)}
                  getAIColor={getAIColor}
                  getAILogo={getAILogo}
                />
              ) : (
                /* Standard Stack View */
                <div className={`${isMultiModel ? 'bg-muted/10 rounded-3xl p-4 space-y-8 border border-border/10' : 'space-y-8'}`}>
                  {groupMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      id={`message-${msg.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} relative`}
                    >
                      {/* User Message */}
                      {msg.isUser ? (
                        <div className="flex flex-col items-end max-w-[85%] relative group/message">
                          <div
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.altKey) {
                                e.preventDefault()
                                e.stopPropagation()
                                onMessageSelect?.(msg.id, true)
                              }
                            }}
                            className={`bg-primary text-primary-foreground px-5 py-3 rounded-[1.5rem] rounded-tr-sm transition-all cursor-pointer ${selectedMessageIds?.has(msg.id)
                              ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                              : 'hover:bg-primary/15'
                              }`}
                            title="Ctrl + Click to select"
                          >
                            <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
                              <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                          </div>
                          {/* Branch Button for User (Hover/Mobile) - Left side */}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 opacity-100 md:opacity-0 md:group-hover/message:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onBranchFromMessage(msg.id, true)
                              }}
                              className="p-1.5 rounded-full bg-background border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/50 shadow-sm transition-all"
                              title="Branch all models"
                            >
                              <GitBranch className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* AI Message */
                        <div className="flex gap-4 max-w-[95%] relative pr-10 group/message">
                          {/* AI Logo */}
                          <div className="flex-shrink-0 mt-1">
                            {msg.aiModel && (
                              <div className="w-8 h-8 flex items-center justify-center bg-background rounded-full border border-border/10 shadow-sm">
                                {getAILogo(msg.aiModel)}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-foreground">
                                {msg.aiModel ? selectedAIs.find(ai => ai.id === msg.aiModel)?.name || msg.aiModel : 'AI'}
                              </span>
                              <span className="text-[10px] text-muted-foreground/60">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div
                              onClick={(e) => {
                                if (e.ctrlKey || e.metaKey || e.altKey) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  onMessageSelect?.(msg.id, true)
                                }
                              }}
                              className={`text-foreground/90 leading-relaxed bg-muted/50 rounded-2xl p-4 border border-border/10 transition-all cursor-pointer ${selectedMessageIds?.has(msg.id)
                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                                : 'hover:bg-muted/80'
                                }`}
                              title="Ctrl + Click to select"
                            >
                              {msg.isStreaming ? (
                                <div className="space-y-2">
                                  <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown>{msg.streamingText || msg.text}</ReactMarkdown>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-muted-foreground/70 pt-1">
                                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-pulse" />
                                    <span className="text-xs font-medium">Generating...</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown
                                    components={{
                                      code: ({ children }) => <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono text-foreground/90 border border-border/30">{children}</code>,
                                      pre: ({ children }) => <pre className="bg-muted/50 p-4 rounded-xl overflow-x-auto text-sm font-mono text-foreground/90 border border-border/30 my-3">{children}</pre>,
                                    }}
                                  >
                                    {msg.text}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Branch Button (Hover/Mobile) - Right side */}
                          <div className="absolute right-0 top-2 opacity-100 md:opacity-0 md:group-hover/message:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onBranchFromMessage(msg.id, false)
                              }}
                              className="p-1.5 rounded-full bg-background border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/50 shadow-sm transition-all"
                              title="Branch from here"
                            >
                              <GitBranch className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Multi-model Actions */}
                  {/* Multi-model Actions - Only show for the last group */}
                  {isMultiModel && aiModels.length > 1 && index === array.length - 1 && (
                    <div className="flex justify-center pt-2 pb-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCreateBranches}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium rounded-full transition-colors"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        Create Branches for All
                      </motion.button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Footer Input Area */}
      {!readOnly && (
        <div className="flex-shrink-0 z-30 p-4 md:p-6">
          <div className="max-w-4xl mx-auto relative group">
            {/* Gradient Glow Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>

            <div className="relative bg-card border border-border/50 shadow-lg rounded-2xl overflow-hidden transition-all duration-300 focus-within:ring-1 focus-within:ring-ring/20 focus-within:border-primary/20">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col"
              >
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  onFocus={() => {
                    setShouldAutoScroll(true)
                    setTimeout(() => {
                      if (messagesContainerRef.current) {
                        messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: 'smooth' })
                      }
                    }, 100)
                  }}
                  placeholder={selectedAIs.length > 1 ? `Message ${selectedAIs.length} models...` : "Type a message..."}
                  className="w-full bg-transparent border-none outline-none p-4 text-base placeholder:text-muted-foreground/40 min-h-[60px] resize-none"
                  style={{ maxHeight: '200px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 200) + 'px'
                  }}
                />

                {/* Bottom Actions */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border/30">
                  <div className="flex items-center gap-4">
                    {/* AI Pills */}
                    {onAddAI && onRemoveAI && (
                      <AIPills
                        selectedAIs={selectedAIs}
                        onAddAI={onAddAI}
                        onRemoveAI={onRemoveAI}
                        onSelectSingle={onSelectSingle ? (ai) => onSelectSingle(ai.id) : undefined}
                        showAddButton={true}
                        getBestAvailableModel={getBestAvailableModel}
                      />
                    )}

                    <div className="h-6 w-px bg-border/50 mx-2"></div>

                    {/* Attachment Button */}
                    <button
                      type="button"
                      onClick={() => alert('Attachments coming soon!')}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Plus weight="bold" className="w-4 h-4" />
                      <span>Add Files</span>
                    </button>
                  </div>

                  <div className="flex-shrink-0">
                    {isGenerating ? (
                      <button
                        type="button"
                        onClick={onStopGeneration}
                        className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors"
                        title="Stop generation"
                      >
                        <Stop weight="fill" className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!message.trim()}
                        className={`p-2 rounded-full transition-all duration-200 ${message.trim()
                          ? 'bg-primary text-primary-foreground shadow-md hover:scale-105'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                          }`}
                      >
                        <PaperPlaneRight weight="fill" className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Branch Context Indicator (Floating above input) */}
            {currentBranch && (
              <div className="absolute -top-10 left-4 flex items-center gap-2 px-3 py-1.5 bg-background border border-border/50 rounded-full shadow-sm text-xs text-muted-foreground">
                <GitBranch className="w-3.5 h-3.5" />
                <span className="max-w-[200px] truncate">
                  Branch from: {messages.find(m => m.id === currentBranch)?.text || '...'}
                </span>
                <button
                  onClick={() => onBranchFromMessage('')}
                  className="ml-1 hover:text-foreground"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Memoize ChatInterface to prevent unnecessary re-renders
export default React.memo(ChatInterface)
