'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import TransformButton from './transform-button'
import AIPills from './ai-pills'
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
  multiModelMode: boolean
  isGenerating?: boolean
  onStopGeneration?: () => void
  existingBranchesCount?: number
  // Branch-level multi-model props
  onAddAI?: (ai: AI) => void
  onRemoveAI?: (aiId: string) => void
  onSelectSingle?: (aiId: string) => void
  onToggleMultiModel?: (nodeId: string) => void
  getBestAvailableModel?: () => string
  isMain?: boolean
  nodeId?: string
  onExportImport?: () => void
}

export default function ChatInterface({ 
  messages, 
  onSendMessage, 
  selectedAIs, 
  onBranchFromMessage,
  currentBranch,
  multiModelMode,
  isGenerating = false,
  onStopGeneration,
  existingBranchesCount = 0,
  // Branch-level multi-model props
  onAddAI,
  onRemoveAI,
  onSelectSingle,
  onToggleMultiModel,
  getBestAvailableModel,
  isMain = false,
  nodeId,
  onExportImport
}: ChatInterfaceProps) {
  const [message, setMessage] = useState('')
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [showBranchWarning, setShowBranchWarning] = useState(false)
  const [comparisonViewGroupId, setComparisonViewGroupId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const branchLockRef = useRef<Record<string, boolean>>({})
  const branchingInProgress = useRef<Record<string, boolean>>({})
  const branchCache = useRef<Record<string, string>>({}) // Cache of messageId -> branchId
  const lastBranchIdRef = useRef<string | null | undefined>(currentBranch)
  const hasScrolledRef = useRef<boolean>(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    onSendMessage(message, currentBranch || undefined)
    setMessage('')
    // Enable auto-scroll when user sends a message
    setShouldAutoScroll(true)
  }

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return
    
    const container = messagesContainerRef.current
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10
    
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
      
      // Don't auto-focus textarea on branch change - let user decide
      // Use scrollTop instead of scrollIntoView to avoid layout shifts
      setTimeout(() => {
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current
          container.scrollTop = container.scrollHeight
        }
      }, 100)
    }
  }, [currentBranch])

  // Auto-scroll to bottom when new messages arrive (only if should auto-scroll)
  useEffect(() => {
    // Only auto-scroll if:
    // 1. Should auto-scroll is enabled
    // 2. We haven't already scrolled for this branch
    // 3. There are messages to scroll to
    if (shouldAutoScroll && messagesContainerRef.current && messages.length > 0) {
      // Use scrollTop instead of scrollIntoView to avoid layout shifts
      const container = messagesContainerRef.current
      const isNewMessage = !hasScrolledRef.current
      
      if (isNewMessage) {
        // Smooth scroll for new messages
        requestAnimationFrame(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          })
        })
      } else {
        // Instant scroll for branch changes
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

  // ✅ NEW SIMPLIFIED: Handle multi-branch creation
  const handleCreateBranches = () => {
    // Find the last user message that has AI responses
    const lastUserMessage = [...messages].reverse().find(m => m.isUser)
    
    if (!lastUserMessage) {
      console.warn('⚠️ No user message found for branch creation')
      return
    }
    
    console.log('✅ Creating branches for all AI models from user message:', lastUserMessage.id)
    
    // Call onBranchFromMessage with isMultiBranch=true
    // The flow-canvas will handle creating one branch per AI model
    onBranchFromMessage(lastUserMessage.id, true)
  }

  const getAIColor = (aiId: string) => {
    const ai = selectedAIs.find(a => a.id === aiId)
    return ai?.color || 'bg-muted text-foreground border-border'
  }

  const getAILogo = (aiId: string) => {
    const ai = selectedAIs.find(a => a.id === aiId)
    return ai?.logo || null
  }

  console.log('💬 ChatInterface rendering with messages:', messages.length, messages)
  
  // CRITICAL: Validate and fix isUser flags before processing
  // This is the FINAL validation - ensure ALL messages have correct isUser flag
  const validatedMessages = messages.map((msg, index) => {
    // If message has aiModel OR ai property, it MUST be isUser: false
    const hasAIModel = !!(msg.aiModel || msg.ai)
    
    if (hasAIModel) {
      // This is an AI message - force isUser to false
      if (msg.isUser !== false) {
        console.error('❌ CRITICAL: AI message has isUser=true! Fixing:', {
          messageId: msg.id,
          aiModel: msg.aiModel || msg.ai,
          isUser: msg.isUser,
          text: msg.text?.substring(0, 50),
          index
        })
        return { ...msg, isUser: false }
      }
      return msg
    }
    
    // If message doesn't have aiModel or ai, it should be isUser: true
    if (!hasAIModel) {
      if (msg.isUser !== true && !msg.text?.startsWith('[Branched from:')) {
        console.warn('⚠️ User message has isUser=false! Fixing:', {
          messageId: msg.id,
          isUser: msg.isUser,
          text: msg.text?.substring(0, 50),
          index
        })
        return { ...msg, isUser: true }
      }
      return msg
    }
    
    return msg
  })
  
  // Normalize all messages before rendering to fix alignment issues
  // This ensures AI replies always appear on left, user messages on right
  // CRITICAL: Force isUser flag based on AI indicators - ignore existing isUser value
  const normalizedMessages = validatedMessages.map(msg => {
    // Determine if this is an AI message based on properties
    const isAI = Boolean(msg.aiModel || msg.ai || msg.role === 'assistant')
    
    // FORCE isUser to be the opposite of isAI - this is the source of truth
    const forcedIsUser = !isAI
    
    // Log if we're fixing a misaligned message
    if (msg.isUser !== forcedIsUser) {
      console.warn('🔧 FORCING isUser flag:', {
        messageId: msg.id,
        oldIsUser: msg.isUser,
        newIsUser: forcedIsUser,
        hasAiModel: !!msg.aiModel,
        hasAi: !!msg.ai,
        role: msg.role,
        text: msg.text?.substring(0, 30)
      })
    }
    
    return {
      ...msg,
      isUser: forcedIsUser, // FORCE the correct value
    }
  })
  
  // Group messages by groupId for multi-model responses
  const groupedMessages = normalizedMessages.reduce((groups, msg) => {
    if (msg.groupId) {
      if (!groups[msg.groupId]) {
        groups[msg.groupId] = []
      }
      groups[msg.groupId].push(msg)
    } else {
      groups[`single-${msg.id}`] = [msg]
    }
    return groups
  }, {} as Record<string, Message[]>)

  // Get unique AI models from a group
  const getAIModelsFromGroup = (groupMessages: Message[]) => {
    const aiModels = groupMessages
      .filter(msg => msg.aiModel)
      .map(msg => selectedAIs.find(ai => ai.id === msg.aiModel))
      .filter(Boolean) as AI[]
    return aiModels
  }

  // Handle model pill click
  const handlePillClick = (aiId: string, groupId?: string) => {
    if (groupId) {
      // Find the message with this AI model in the group
      const targetMessage = messages.find(msg => msg.groupId === groupId && msg.aiModel === aiId)
      if (targetMessage) {
        // Scroll to the message
        const element = document.getElementById(`message-${targetMessage.id}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Add highlight effect
          element.classList.add('ring-2', 'ring-blue-400', 'ring-opacity-50')
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-400', 'ring-opacity-50')
          }, 2000)
        }
      }
    }
  }
  
  return (
    <div 
      className="w-full h-full flex flex-col overflow-hidden min-h-0"
      data-scrollable
      onMouseDown={(e) => {
        // Prevent canvas panning when clicking inside chat interface
        e.stopPropagation()
      }}
      onWheel={(e) => {
        // Allow scrolling within chat interface, prevent canvas zoom
        e.stopPropagation()
      }}
    >
      {/* Multi-Model Controls - For both main and branch nodes */}
      {onAddAI && onRemoveAI && (
        <div className="mb-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{isMain ? 'AIs:' : 'Branch AIs:'}</span>
              <AIPills
                selectedAIs={selectedAIs}
                onAddAI={onAddAI}
                onRemoveAI={onRemoveAI}
                onSelectSingle={onSelectSingle ? (ai: AI) => onSelectSingle(ai.id) : undefined}
                showAddButton={multiModelMode}
                singleMode={!multiModelMode}
                getBestAvailableModel={getBestAvailableModel}
              />
            </div>
            
            {/* Mode Toggle and Export/Import - Only show for branches, not main (main has it in page.tsx header) */}
            {!isMain && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Mode:</span>
                  <div className="flex bg-muted rounded-lg p-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (multiModelMode) {
                          // Only toggle if currently in multi mode
                          onToggleMultiModel?.(nodeId || '')
                        }
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        !multiModelMode
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Single
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!multiModelMode) {
                          // Only toggle if currently in single mode
                          onToggleMultiModel?.(nodeId || '')
                        }
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        multiModelMode
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Multi
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Export/Import Button - Only for main conversation */}
            {isMain && onExportImport && (
              <button
                onClick={onExportImport}
                className="px-3 py-1 bg-card/80 backdrop-blur-sm hover:bg-accent text-foreground rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Export/Import
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Messages Area - Flexible height with scroll */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-auto space-y-4 touch-pan-y pr-2 min-h-0 messages-container" 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        data-scrollable
        onMouseDown={(e) => {
          // Prevent canvas panning when clicking in scrollable area
          e.stopPropagation()
        }}
        onWheel={(e) => {
          // Allow scrolling, prevent canvas zoom
          e.stopPropagation()
        }}
        style={{ 
          minHeight: 0, // Critical for flex children to scroll properly
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) hsl(var(--muted))',
          scrollBehavior: 'smooth'
        }}
      >
          {Object.entries(groupedMessages).map(([groupId, groupMessages]) => {
            const isMultiModel = groupMessages.length > 1
            const aiModels = getAIModelsFromGroup(groupMessages)
            const isComparisonView = comparisonViewGroupId === groupId
            
            return (
              <div key={groupId} className="space-y-2">
                {/* Multi-model group header */}
                {isMultiModel && (
                  <div className="flex items-center justify-center gap-3 py-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted/80 backdrop-blur-sm rounded-full text-xs text-muted-foreground font-medium border border-border/50">
                      <span>Responses from {groupMessages.length} AIs</span>
                    </div>
                    <button
                      onClick={() => setComparisonViewGroupId(isComparisonView ? null : groupId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-card dark:bg-card hover:bg-muted dark:hover:bg-muted/80 border border-border/60 dark:border-border/40 rounded-full text-xs font-medium text-foreground transition-all duration-200 shadow-sm hover:shadow"
                      title={isComparisonView ? "Switch to normal view" : "Compare side-by-side"}
                    >
                      {isComparisonView ? (
                        <>
                          <ArrowsIn className="w-3.5 h-3.5" />
                          <span>Normal View</span>
                        </>
                      ) : (
                        <>
                          <ArrowsOut className="w-3.5 h-3.5" />
                          <span>Compare</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {/* Side-by-Side Comparison View */}
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
                  /* Group container */
                  <div className={`${isMultiModel ? 'bg-muted/60 rounded-xl p-4 space-y-3 border border-border break-words' : 'space-y-3'}`}>
                  {groupMessages.map((msg, index) => (
            <motion.div
              key={msg.id}
              id={`message-${msg.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.3, 
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
              className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} items-start gap-3`}
            >
              {/* Branch Button - Only show on user messages in multi-mode (to create all branches), always show on AI messages */}
              {msg.isUser ? (
                // User message - branch button only in multi-mode (creates branches for all AI responses)
                multiModelMode && (
                <div className="flex items-center gap-2">
                  {/* Branch count indicator */}
                  {existingBranchesCount > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
                        <path d="M6 3V15M18 9V21M18 9C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6C15 7.65685 16.3431 9 18 9ZM6 15C4.34315 15 3 16.3431 3 18C3 19.6569 4.34315 21 6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15ZM6 15C6 12 6 10 12 10C18 10 18 8 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{existingBranchesCount}</span>
                    </div>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                        console.log('🌿 Branch clicked for user message (multi-mode):', msg.id)
                      console.log('🌿 onBranchFromMessage function:', onBranchFromMessage)
                      // Blur any focused input to ensure proper event handling
                      if (document.activeElement && document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur()
                      }
                      onBranchFromMessage(msg.id, true) // Multi-branch: create branches for all AI models
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 mt-1 z-10 relative shadow-sm hover:shadow"
                      title="Create branches for all AI responses"
                  >
                    {branchingInProgress.current[msg.id] ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 3V15M18 9V21M18 9C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6C15 7.65685 16.3431 9 18 9ZM6 15C4.34315 15 3 16.3431 3 18C3 19.6569 4.34315 21 6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15ZM6 15C6 12 6 10 12 10C18 10 18 8 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
                )
              ) : (
                // AI message - branch button on right
                <div className="flex items-start gap-3">
                  {/* Simple message bubble */}
                  <div className="max-w-[70%] bg-card rounded-2xl border border-border/80 shadow-sm hover:shadow-md transition-shadow duration-200 px-6 py-4 break-words overflow-wrap-anywhere">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {/* Model pill for AI messages */}
                      {msg.aiModel && (
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${getAIColor(msg.aiModel)}`}>
                          {getAILogo(msg.aiModel)}
                          <span>{selectedAIs.find(ai => ai.id === msg.aiModel)?.name || msg.aiModel}</span>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(msg.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <div className="text-base text-foreground leading-relaxed prose prose-sm max-w-none break-words overflow-wrap-anywhere">
                      {msg.isStreaming ? (
                        <div className="space-y-2">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                              em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-foreground/90">{children}</li>,
                              h1: ({ children }) => <h1 className="text-xl font-bold text-foreground mb-3">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold text-foreground mb-2">{children}</h3>,
                              code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground break-words">{children}</code>,
                              pre: ({ children }) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm font-mono text-foreground mb-3 break-words whitespace-pre-wrap">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground mb-3">{children}</blockquote>,
                            }}
                          >
                            {msg.streamingText || msg.text}
                          </ReactMarkdown>
                          {/* Typing indicator */}
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <div className="flex space-x-1">
                              <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span className="text-xs ml-2">
                              {msg.aiModel ? selectedAIs.find(ai => ai.id === msg.aiModel)?.name || msg.aiModel : 'AI'} is thinking...
                            </span>
                          </div>
                        </div>
                      ) : (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                            em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-foreground/90">{children}</li>,
                            h1: ({ children }) => <h1 className="text-xl font-bold text-foreground mb-3">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-semibold text-foreground mb-2">{children}</h3>,
                            code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">{children}</code>,
                            pre: ({ children }) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm font-mono text-foreground mb-3">{children}</pre>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground mb-3">{children}</blockquote>,
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Branch count indicator */}
                    {existingBranchesCount > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
                          <path d="M6 3V15M18 9V21M18 9C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6C15 7.65685 16.3431 9 18 9ZM6 15C4.34315 15 3 16.3431 3 18C3 19.6569 4.34315 21 6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15ZM6 15C6 12 6 10 12 10C18 10 18 8 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>{existingBranchesCount}</span>
                      </div>
                    )}
                    
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      
                      // Prevent duplicate clicks
                      if (branchingInProgress.current[msg.id]) {
                        console.log('⚠️ Branch creation already in progress for:', msg.id)
                        return
                      }
                      
                      // Check cache first
                      if (branchCache.current[msg.id]) {
                        console.log('📦 Branch already exists in cache:', branchCache.current[msg.id])
                        // Show warning modal instead of creating duplicate
                        return
                      }
                      
                      // Set branching in progress
                      branchingInProgress.current[msg.id] = true
                      
                      console.log('🌿 Branch clicked for message:', msg.id)
                      console.log('🌿 onBranchFromMessage function:', onBranchFromMessage)
                      
                      // Blur any focused input to ensure proper event handling
                      if (document.activeElement && document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur()
                      }
                      
                      // Call branch creation
                      onBranchFromMessage(msg.id, false) // Single branch: create branch from this AI message
                      
                      // Reset after delay
                      setTimeout(() => {
                        branchingInProgress.current[msg.id] = false
                      }, 2000)
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    disabled={branchingInProgress.current[msg.id]}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 mt-1 z-10 relative shadow-sm ${
                      branchingInProgress.current[msg.id]
                        ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                        : 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:shadow'
                    }`}
                    title={branchingInProgress.current[msg.id] ? 'Creating branch...' : 'Branch from this message'}
                  >
                    {branchingInProgress.current[msg.id] ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 3V15M18 9V21M18 9C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6C15 7.65685 16.3431 9 18 9ZM6 15C4.34315 15 3 16.3431 3 18C3 19.6569 4.34315 21 6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15ZM6 15C6 12 6 10 12 10C18 10 18 8 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                  </div>
                </div>
              )}

               {/* Simple message bubble for user messages */}
               {msg.isUser && (
                 <div className="max-w-[85%] bg-card rounded-2xl border border-border shadow-sm px-6 py-4 break-words overflow-wrap-anywhere">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <div className="text-base text-foreground leading-relaxed prose prose-sm max-w-none break-words overflow-wrap-anywhere">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                        em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-foreground/90">{children}</li>,
                        h1: ({ children }) => <h1 className="text-xl font-bold text-foreground mb-3">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-semibold text-foreground mb-2">{children}</h3>,
                        code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">{children}</code>,
                        pre: ({ children }) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm font-mono text-foreground mb-3">{children}</pre>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground mb-3">{children}</blockquote>,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
                  
                  {/* Navigation pills and Create Branches button for multi-model groups */}
                  {isMultiModel && aiModels.length > 1 && (
                    <div className="space-y-3">
                      {/* Navigation pills */}
                      <div className="flex gap-2 items-center justify-center py-3 px-4 bg-muted rounded-lg">
                        <span className="text-xs text-muted-foreground font-medium">Jump to:</span>
                        {aiModels.map(ai => (
                          <motion.button
                            key={ai.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handlePillClick(ai.id, groupId)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${ai.color}`}
                          >
                            {ai.logo}
                            <span>{ai.name}</span>
                          </motion.button>
                        ))}
                      </div>
                      
                      {/* Create Branches button */}
                      <div className="flex justify-center">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCreateBranches}
                          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 3V15M18 9V21M18 9C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6C15 7.65685 16.3431 9 18 9ZM6 15C4.34315 15 3 16.3431 3 18C3 19.6569 4.34315 21 6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15ZM6 15C6 12 6 10 12 10C18 10 18 8 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Create Branches for All Models
                        </motion.button>
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </div>
            )
          })}
          {/* Scroll target for auto-scroll */}
          <div ref={messagesEndRef} />
          {messages.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground/50">
              <div className="text-center">
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs mt-1">Start a conversation below</p>
              </div>
            </div>
          )}
        </div>

      {/* Branch Warning Message */}
      {showBranchWarning && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="fixed top-4 right-4 z-50 max-w-sm"
        >
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-amber-800">
                  Too Many Branches
                </h3>
                <p className="mt-1 text-sm text-amber-700">
                  {(() => {
                    const userMessage = messages.find(msg => 
                      msg.isUser && messages.some(m => m.parentId === msg.id)
                    )
                    const aiResponsesCount = userMessage 
                      ? messages.filter(m => !m.isUser && m.parentId === userMessage.id && m.aiModel).length
                      : 0
                    return `You already have ${existingBranchesCount} branches. Creating ${aiResponsesCount} more will clutter the visual space. Consider organizing your conversation first.`
                  })()}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setShowBranchWarning(false)}
                    className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-md transition-colors"
                  >
                    Got it
                  </button>
                  <button
                    onClick={() => {
                      setShowBranchWarning(false)
                      // Force create branches anyway
                      const userMessage = messages.find(msg => 
                        msg.isUser && messages.some(m => m.parentId === msg.id)
                      )
                      if (userMessage) {
                        onBranchFromMessage(userMessage.id)
                      }
                    }}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-md transition-colors"
                  >
                    Create Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Subtle Thinking Indicator with Shine */}
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="flex justify-start mb-4"
        >
          <div className="relative flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/80 border border-border/60 shadow-sm focus-within:shadow-md focus-within:border-primary transition-all duration-200">
            {/* Animated dots */}
            <div className="flex space-x-1">
              <motion.div
                className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div
                className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.2
                }}
              />
              <motion.div
                className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.4
                }}
              />
            </div>
            
            {/* Thinking text with subtle shine */}
            <div className="relative overflow-hidden">
              <span className="text-xs text-muted-foreground font-medium">thinking</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                animate={{
                  x: ['-100%', '200%']
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Current Branch Context - Simple */}
      {currentBranch && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-blue-700">
                Branching from: {messages.find(m => m.id === currentBranch)?.text.substring(0, 40)}...
              </span>
            </div>
            <button
              onClick={() => onBranchFromMessage('')}
              className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors duration-150"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </motion.div>
      )}

      {/* Adaptive Input Area - Minimal, Clean Design */}
      <div className="flex-shrink-0 w-full pt-4 border-t border-border/30">
        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex items-end gap-2 bg-card border border-border/40 rounded-lg shadow-sm hover:shadow focus-within:shadow focus-within:border-primary/40 transition-all duration-200 p-3">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              placeholder={
                multiModelMode 
                  ? `Ask ${selectedAIs.length} AIs...` 
                  : "Ask anything..."
              }
              className="flex-1 px-3 py-2.5 rounded-md focus:outline-none focus:ring-0 text-sm placeholder-muted-foreground/60 resize-none min-h-[44px] max-h-[160px] bg-transparent w-full transition-all duration-200"
              style={{ 
                height: 'auto',
                minHeight: '44px',
                maxHeight: '160px',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              onFocus={() => {
                setShouldAutoScroll(true)
                requestAnimationFrame(() => {
                  if (messagesContainerRef.current && messages.length > 0) {
                    const container = messagesContainerRef.current
                    container.scrollTo({
                      top: container.scrollHeight,
                      behavior: 'smooth'
                    })
                  }
                })
              }}
            />
            <div className="flex-shrink-0">
              <TransformButton 
                onSend={() => {
                  if (message.trim()) {
                    onSendMessage(message)
                    setMessage('')
                  }
                }}
                onStop={onStopGeneration}
                isDisabled={!message.trim()}
                isGenerating={isGenerating}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
