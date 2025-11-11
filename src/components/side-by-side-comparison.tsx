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
            className="p-1.5 rounded-lg hover:bg-muted dark:hover:bg-muted/80 transition-colors"
            title="Close comparison view"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* User Message */}
        {userMessage && (
          <div className="mb-4 px-2">
            <div className="inline-block max-w-3xl px-4 py-3 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30">
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                {userMessage.text}
              </p>
            </div>
          </div>
        )}

        {/* Side-by-Side Comparison Grid */}
        <div className={`grid gap-4 ${
          groupMessages.length === 2 
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
                className="flex flex-col border rounded-xl bg-card dark:bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* AI Header */}
                <div className={`px-4 py-3 border-b ${aiColor} flex items-center gap-2`}>
                  {aiLogo && (
                    <div className="flex-shrink-0">
                      {aiLogo}
                    </div>
                  )}
                  <span className="font-semibold text-sm flex-1 truncate">
                    {ai?.name || msg.aiModel || 'AI'}
                  </span>
                  {msg.isStreaming && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <span className="text-xs text-muted-foreground">Streaming...</span>
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className="flex-1 p-4 min-h-[200px] max-h-[600px] overflow-y-auto">
                  {displayText ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-3 last:mb-0 text-foreground leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="mb-3 last:mb-0 space-y-1 ml-4">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-3 last:mb-0 space-y-1 ml-4">{children}</ol>,
                          li: ({ children }) => <li className="text-foreground">{children}</li>,
                          code: ({ children }) => (
                            <code className="px-1.5 py-0.5 rounded bg-muted dark:bg-muted/80 text-foreground text-xs font-mono">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="p-3 rounded-lg bg-muted dark:bg-muted/80 overflow-x-auto mb-3 last:mb-0">
                              {children}
                            </pre>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground mb-3 last:mb-0">
                              {children}
                            </blockquote>
                          ),
                          h1: ({ children }) => <h1 className="text-xl font-bold mb-2 text-foreground">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 text-foreground">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-semibold mb-2 text-foreground">{children}</h3>,
                        }}
                      >
                        {displayText}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      {msg.isStreaming ? 'Waiting for response...' : 'No response yet'}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t bg-muted/30 dark:bg-muted/20 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  {isComplete && (
                    <span className="text-xs text-muted-foreground">
                      {displayText.length} characters
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

