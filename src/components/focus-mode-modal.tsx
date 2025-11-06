'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ArrowRight, GitBranch, Clock, Link, Users, ChatCircle } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import ChatInterface from './chat-interface'

interface Message {
  id: string
  text: string
  isUser: boolean
  ai?: string
  parentId?: string
  children: string[]
  timestamp: number
  responses?: { [aiId: string]: string }
  aiModel?: string
  groupId?: string
}

interface AI {
  id: string
  name: string
  color: string
  logo: React.JSX.Element
}

interface FocusModeModalProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string
  nodeTitle: string
  messages: Message[]
  selectedAIs: AI[]
  onSendMessage?: (nodeId: string, message: string) => void
  onBranchFromMessage?: (messageId: string) => void
  parentMessages?: Message[]
  childBranches?: Array<{
    id: string
    title: string
    messages: Message[]
    timestamp: number
  }>
  onNavigateToBranch?: (branchId: string) => void
}

// Context Timeline Component
const ContextTimeline = ({ messages, parentMessages }: { messages: Message[], parentMessages: Message[] }) => {
  const allMessages = [...parentMessages, ...messages]
  const sortedMessages = allMessages.sort((a, b) => a.timestamp - b.timestamp)
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Clock size={20} className="text-blue-500" />
        Conversation Timeline
      </h3>
      <div className="space-y-3">
        {sortedMessages.map((msg, index) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`flex items-start gap-3 p-3 rounded-lg ${
              msg.isUser 
                ? 'bg-blue-50 border-l-4 border-blue-400' 
                : 'bg-gray-50 border-l-4 border-gray-300'
            }`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
              {msg.isUser ? (
                <Users size={16} className="text-blue-600" />
              ) : (
                <ChatCircle size={16} className="text-gray-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {msg.isUser ? 'You' : (msg.aiModel || 'AI')}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-sm text-gray-700 line-clamp-2">
                {msg.text.length > 100 ? `${msg.text.substring(0, 100)}...` : msg.text}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default function FocusModeModal({
  isOpen,
  onClose,
  nodeId,
  nodeTitle,
  messages,
  selectedAIs,
  onSendMessage,
  onBranchFromMessage,
  parentMessages = [],
  childBranches = [],
  onNavigateToBranch
}: FocusModeModalProps) {
  const [activeTab, setActiveTab] = useState<'conversation' | 'context' | 'branches'>('conversation')

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getContextSummary = () => {
    if (parentMessages.length === 0) return 'This is the main conversation thread.'
    
    const recentParents = parentMessages.slice(-3) // Last 3 parent messages
    return recentParents.map(msg => 
      `${msg.isUser ? 'You' : 'AI'}: ${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}`
    ).join('\n\n')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-4 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <GitBranch size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{nodeTitle}</h2>
                  <p className="text-sm text-gray-500">
                    {messages.length} messages • {formatTimestamp(messages[0]?.timestamp || Date.now())}
                  </p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 bg-white">
              {[
                { id: 'conversation', label: 'Conversation', icon: GitBranch },
                { id: 'context', label: 'Context', icon: ArrowLeft },
                { id: 'branches', label: 'Branches', icon: ArrowRight }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'conversation' && (
                <div className="h-full">
                  <ChatInterface
                    messages={messages}
                    onSendMessage={(message, branchId) => {
                      if (onSendMessage) {
                        onSendMessage(nodeId, message)
                      }
                    }}
                    selectedAIs={selectedAIs}
                    onBranchFromMessage={onBranchFromMessage}
                    currentBranch={nodeId}
                    multiModelMode={selectedAIs.length > 1}
                    isGenerating={false}
                  />
                </div>
              )}

              {activeTab === 'context' && (
                <div className="p-6 h-full overflow-y-auto">
                  <div className="max-w-4xl mx-auto space-y-6">
                    <ContextTimeline messages={messages} parentMessages={parentMessages} />
                    
                    {/* Context Links */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Link size={20} className="text-green-500" />
                        Context Links
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-blue-900 mb-2">Inherited Context</h4>
                          <p className="text-sm text-blue-700">
                            This conversation inherits context from {parentMessages.length} parent messages
                          </p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <h4 className="font-medium text-green-900 mb-2">Current Thread</h4>
                          <p className="text-sm text-green-700">
                            {messages.length} messages in this focused conversation
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'branches' && (
                <div className="p-6 h-full overflow-y-auto">
                  <div className="max-w-4xl mx-auto">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Child Branches</h3>
                    {childBranches.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {childBranches.map((branch) => (
                          <div
                            key={branch.id}
                            className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                            onClick={() => {
                              if (onNavigateToBranch) {
                                onNavigateToBranch(branch.id)
                                onClose()
                              }
                            }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <GitBranch size={16} className="text-blue-600" />
                              <span className="text-sm font-medium text-gray-900">
                                {branch.title}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {branch.messages.length} messages
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatTimestamp(branch.timestamp)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <ArrowRight size={48} className="mx-auto mb-4 text-gray-300" />
                        <p>No child branches yet</p>
                        <p className="text-sm">Create branches from messages in this conversation</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
