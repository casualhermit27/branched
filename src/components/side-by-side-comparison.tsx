'use client'

import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { ArrowsOut, X } from '@phosphor-icons/react'

interface Message {
  id: string
  text: string
  isUser: boolean
  aiModel?: string
  groupId?: string
  isStreaming?: boolean
  streamingText?: string
  timestamp: number
}

interface AI {
  id: string
  name: string
  color: string
  logo: React.JSX.Element
}

interface SideBySideComparisonProps {
  messages: Message[]
  selectedAIs: AI[]
  groupId: string
  onClose: () => void
  getAIColor: (aiId: string) => string
  getAILogo: (aiId: string) => React.JSX.Element | null
}

export function SideBySideComparison({
  messages,
  selectedAIs,
  groupId,
  onClose,
  getAIColor,
  getAILogo
}: SideBySideComparisonProps) {
  const groupMessages = messages.filter(msg => msg.groupId === groupId && !msg.isUser)
  const userMessage = messages.find(msg => msg.groupId === groupId && msg.isUser)

  if (groupMessages.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full mb-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <ArrowsOut className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Side-by-Side Comparison</span>
            <span className="text-xs text-muted-foreground">({groupMessages.length} models)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted dark:hover:bg-muted/80 transition-colors"
            title="Close comparison view"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* User Message */}
        {userMessage && (
          <div className="mb-6 flex justify-center">
            <div className="inline-block max-w-3xl px-6 py-3 rounded-[1.5rem] bg-primary/10 text-foreground shadow-sm">
              <p className="text-sm font-medium whitespace-pre-wrap break-words leading-relaxed">
                {userMessage.text}
              </p>
            </div>
          </div>
        )}

        {/* Side-by-Side Comparison Grid */}
        <div className={`grid gap-4 ${groupMessages.length === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : groupMessages.length === 3
            ? 'grid-cols-1 md:grid-cols-3'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}>
          {groupMessages.map((msg, index) => {
            const ai = selectedAIs.find(a => a.id === msg.aiModel)
            const aiColor = getAIColor(msg.aiModel || '')
            const aiLogo = getAILogo(msg.aiModel || '')
            const displayText = msg.isStreaming ? (msg.streamingText || '') : (msg.text || '')
            const isComplete = !msg.isStreaming && msg.text

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col border border-border/30 hover:border-border/60 rounded-2xl bg-card/30 backdrop-blur-sm transition-all duration-300 overflow-hidden"
              >
                {/* AI Header */}
                <div className={`px-4 py-3 border-b border-border/10 ${aiColor.replace('border', '')} bg-opacity-5 flex items-center gap-2`}>
                  {aiLogo && (
                    <div className="flex-shrink-0 scale-90">
                      {aiLogo}
                    </div>
                  )}
                  <span className="font-semibold text-sm flex-1 truncate opacity-90">
                    {ai?.name || msg.aiModel || 'AI'}
                  </span>
                  {msg.isStreaming && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                      <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wide">Streaming</span>
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className="flex-1 p-5 min-h-[200px] max-h-[600px] overflow-y-auto">
                  {displayText ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-3 last:mb-0 text-foreground/90">{children}</p>,
                          ul: ({ children }) => <ul className="mb-3 last:mb-0 space-y-1 ml-4">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-3 last:mb-0 space-y-1 ml-4">{children}</ol>,
                          li: ({ children }) => <li className="text-foreground/90">{children}</li>,
                          code: ({ children }) => (
                            <code className="px-1.5 py-0.5 rounded bg-muted/50 text-foreground text-xs font-mono border border-border/30">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="p-3 rounded-xl bg-muted/50 overflow-x-auto mb-3 last:mb-0 border border-border/30">
                              {children}
                            </pre>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-primary/30 pl-4 italic text-muted-foreground mb-3 last:mb-0">
                              {children}
                            </blockquote>
                          ),
                          h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-foreground">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-semibold mb-2 text-foreground">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 text-foreground">{children}</h3>,
                        }}
                      >
                        {displayText}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm italic">
                      {msg.isStreaming ? 'Waiting for response...' : 'No response yet'}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-border/10 bg-muted/10 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/60 font-medium">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isComplete && (
                    <span className="text-[10px] text-muted-foreground/60 font-medium">
                      {displayText.length} chars
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
