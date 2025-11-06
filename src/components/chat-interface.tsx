'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import TransformButton from './transform-button'
import AIPills from './ai-pills'

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
  onBranchFromMessage: (messageId: string) => void
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

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

  // Auto-scroll to bottom when new messages arrive (only if should auto-scroll)
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, shouldAutoScroll])

  // Reset auto-scroll when user starts typing
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    setShouldAutoScroll(true)
  }

  // Handle branch creation with warning
  const handleCreateBranches = () => {
    const MAX_BRANCHES = 4 // Maximum recommended branches for good visual layout (lowered for testing)
    const currentBranches = existingBranchesCount + selectedAIs.length
    
    console.log('🔍 Branch creation check:', {
      existingBranchesCount,
      selectedAIsLength: selectedAIs.length,
      currentBranches,
      MAX_BRANCHES,
      willShowWarning: currentBranches > MAX_BRANCHES
    })
    
    if (currentBranches > MAX_BRANCHES) {
      console.log('⚠️ Showing branch warning - too many branches')
      setShowBranchWarning(true)
      // Auto-hide warning after 4 seconds
      setTimeout(() => setShowBranchWarning(false), 4000)
      return
    }
    
    console.log('✅ Proceeding with multi-model branch creation')
    // Create branches for all selected AIs
    const userMessage = messages.find(msg => 
      msg.isUser && messages.some(m => m.parentId === msg.id)
    )
    if (userMessage) {
      // Call onBranchFromMessage for each selected AI
      selectedAIs.forEach((ai, index) => {
        setTimeout(() => {
          onBranchFromMessage(userMessage.id)
        }, index * 200) // Stagger the branch creation
      })
    }
  }

  const getAIColor = (aiId: string) => {
    const ai = selectedAIs.find(a => a.id === aiId)
    return ai?.color || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getAILogo = (aiId: string) => {
    const ai = selectedAIs.find(a => a.id === aiId)
    return ai?.logo || null
  }

  console.log('💬 ChatInterface rendering with messages:', messages.length, messages)
  
  // Group messages by groupId for multi-model responses
  const groupedMessages = messages.reduce((groups, msg) => {
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
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Multi-Model Controls - For both main and branch nodes */}
      {onAddAI && onRemoveAI && (
        <div className="mb-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{isMain ? 'AIs:' : 'Branch AIs:'}</span>
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
            
            {/* Mode Toggle and Export/Import */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Mode:</span>
                <div className="flex bg-gray-100 rounded-lg p-1" onClick={(e) => e.stopPropagation()}>
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
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
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
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Multi
                  </button>
                </div>
              </div>
              
              {/* Export/Import Button - Only for main conversation */}
              {isMain && onExportImport && (
                <button
                  onClick={onExportImport}
                  className="px-3 py-1 bg-white/80 backdrop-blur-sm hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  Export/Import
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Messages Area - Fixed height with scroll */}
      {messages.length > 0 && (
        <div 
          className="flex-1 overflow-y-auto space-y-4 mb-4 touch-pan-y" 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          style={{ 
            height: '550px', 
            maxHeight: '550px',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain'
          }}
        >
          {Object.entries(groupedMessages).map(([groupId, groupMessages]) => {
            const isMultiModel = groupMessages.length > 1
            const aiModels = getAIModelsFromGroup(groupMessages)
            
            return (
              <div key={groupId} className="space-y-2">
                {/* Multi-model group header */}
                {isMultiModel && (
                  <div className="text-center py-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                      <span>Responses from {groupMessages.length} AIs</span>
                    </div>
                  </div>
                )}
                
                {/* Group container */}
                <div className={`${isMultiModel ? 'bg-gray-50 rounded-lg p-3 space-y-3' : 'space-y-3'}`}>
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
              {/* Branch Button - Left side for user messages, right side for AI messages */}
              {msg.isUser ? (
                // User message - branch button on left
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('🌿 Branch clicked for message:', msg.id)
                    console.log('🌿 onBranchFromMessage function:', onBranchFromMessage)
                    // Blur any focused input to ensure proper event handling
                    if (document.activeElement && document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    onBranchFromMessage(msg.id)
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors duration-150 mt-1 z-10 relative"
                  title="Branch from this message"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 3V15M18 9V21M18 9C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6C15 7.65685 16.3431 9 18 9ZM6 15C4.34315 15 3 16.3431 3 18C3 19.6569 4.34315 21 6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15ZM6 15C6 12 6 10 12 10C18 10 18 8 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ) : (
                // AI message - branch button on right
                <div className="flex items-start gap-3">
                  {/* Simple message bubble */}
                  <div className="max-w-[90%] bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${
                        msg.isUser ? 'bg-blue-500' : 'bg-gray-400'
                      }`}></div>
                      <span className="text-xs font-medium text-gray-600">
                        {msg.isUser ? 'You' : 'AI'}
                      </span>
                      {/* Model pill for AI messages */}
                      {msg.aiModel && (
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getAIColor(msg.aiModel)}`}>
                          {getAILogo(msg.aiModel)}
                          <span>{selectedAIs.find(ai => ai.id === msg.aiModel)?.name || msg.aiModel}</span>
                        </div>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <div className="text-base text-gray-900 leading-relaxed prose prose-sm max-w-none">
                      {msg.isStreaming ? (
                        <div className="space-y-2">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                              em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-gray-800">{children}</li>,
                              h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mb-3">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-900 mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold text-gray-900 mb-2">{children}</h3>,
                              code: ({ children }) => <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">{children}</code>,
                              pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm font-mono text-gray-800 mb-3">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 mb-3">{children}</blockquote>,
                            }}
                          >
                            {msg.streamingText || msg.text}
                          </ReactMarkdown>
                          {/* Typing indicator */}
                          <div className="flex items-center gap-1 text-gray-400">
                            <div className="flex space-x-1">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                            em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-gray-800">{children}</li>,
                            h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mb-3">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-900 mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-semibold text-gray-900 mb-2">{children}</h3>,
                            code: ({ children }) => <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">{children}</code>,
                            pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm font-mono text-gray-800 mb-3">{children}</pre>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 mb-3">{children}</blockquote>,
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('🌿 Branch clicked for message:', msg.id)
                      console.log('🌿 onBranchFromMessage function:', onBranchFromMessage)
                      // Blur any focused input to ensure proper event handling
                      if (document.activeElement && document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur()
                      }
                      onBranchFromMessage(msg.id)
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors duration-150 mt-1 z-10 relative"
                    title="Branch from this message"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 3V15M18 9V21M18 9C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6C15 7.65685 16.3431 9 18 9ZM6 15C4.34315 15 3 16.3431 3 18C3 19.6569 4.34315 21 6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15ZM6 15C6 12 6 10 12 10C18 10 18 8 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              )}

               {/* Simple message bubble for user messages */}
               {msg.isUser && (
                 <div className="max-w-[90%] bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${
                      msg.isUser ? 'bg-blue-500' : 'bg-gray-400'
                    }`}></div>
                    <span className="text-xs font-medium text-gray-600">
                      {msg.isUser ? 'You' : 'AI'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <div className="text-base text-gray-900 leading-relaxed prose prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                        em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-gray-800">{children}</li>,
                        h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mb-3">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-900 mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-semibold text-gray-900 mb-2">{children}</h3>,
                        code: ({ children }) => <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">{children}</code>,
                        pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm font-mono text-gray-800 mb-3">{children}</pre>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700 mb-3">{children}</blockquote>,
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
                      <div className="flex gap-2 items-center justify-center py-3 px-4 bg-gray-100 rounded-lg">
                        <span className="text-xs text-gray-500 font-medium">Jump to:</span>
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
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors duration-200"
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
              </div>
            )
          })}
          {/* Scroll target for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>
      )}

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
                  You already have {existingBranchesCount} branches. Creating {selectedAIs.length} more will clutter the visual space. Consider organizing your conversation first.
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
          <div className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-100">
            {/* Animated dots */}
            <div className="flex space-x-1">
              <motion.div
                className="w-1.5 h-1.5 bg-gray-300 rounded-full"
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
                className="w-1.5 h-1.5 bg-gray-300 rounded-full"
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
                className="w-1.5 h-1.5 bg-gray-300 rounded-full"
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
              <span className="text-xs text-gray-400 font-medium">thinking</span>
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

      {/* Simple Input Area */}
      <div className="relative flex-shrink-0 w-full">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-blue-300 transition-all duration-200 p-2">
            <textarea
              value={message}
              onChange={handleInputChange}
              placeholder={
                multiModelMode 
                  ? `Ask ${selectedAIs.length} AIs...` 
                  : "Ask anything..."
              }
               className="flex-1 px-6 py-6 rounded-2xl focus:outline-none text-lg placeholder-gray-500 resize-none min-h-[80px] max-h-[300px] bg-transparent w-full"
              style={{ 
                height: 'auto',
                minHeight: '80px',
                maxHeight: '300px',
                fontSize: '18px',
                lineHeight: '1.5',
                letterSpacing: '-0.01em'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 300) + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
            />
            <div className="self-end m-2">
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
