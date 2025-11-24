'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { List, X, ArrowsOut, ArrowsIn, Clock, GitBranch, Trash, Gear, Sparkle as SparklesIcon } from '@phosphor-icons/react'
import ConversationHistory from './conversation-history'

interface Message {
  id: string
  text: string
  isUser: boolean
  ai?: string
  parentId?: string
  children: string[]
  timestamp: number
  responses?: { [aiId: string]: string }
}

interface Branch {
  id: string
  title: string
  messages: Message[]
  timestamp: number
  parentId?: string
  children: string[]
}

interface ConversationNode {
  id: string
  type: 'main' | 'branch'
  title: string
  messages: Message[]
  timestamp: number
  parentId?: string
  children: ConversationNode[]
  isActive?: boolean
}

interface Conversation {
  _id: string
  title: string
  updatedAt: string
  mainMessages: any[]
  branches: any[]
}

interface SidebarProps {
  branches: Branch[]
  currentBranchId: string | null
  onSelectBranch: (branchId: string) => void
  onDeleteBranch?: (branchId: string) => void
  onDeleteConversation?: (conversationId: string) => void
  conversationNodes?: ConversationNode[]
  conversations?: Conversation[]
  currentConversationId?: string | null
  onSelectConversation?: (conversationId: string) => void
  onCreateNewConversation?: () => void
  messageCount?: number
  onUpgrade?: () => void
}

export default function Sidebar({
  branches,
  currentBranchId,
  onSelectBranch,
  onDeleteBranch,
  onDeleteConversation,
  conversationNodes = [],
  conversations = [],
  currentConversationId = null,
  onSelectConversation = () => { },
  onCreateNewConversation = () => { },
  messageCount = 0,
  onUpgrade = () => { }
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'history' | 'settings'>('history')
  // Always use fixed width, no expand/collapse functionality
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['main']))

  // Build conversation tree from nodes with proper hierarchy
  const buildConversationTree = (nodes: ConversationNode[]): ConversationNode[] => {
    if (nodes.length === 0) return []

    const nodeMap = new Map<string, ConversationNode>()
    const rootNodes: ConversationNode[] = []

    // Create a map of all nodes with empty children arrays
    nodes.forEach(node => {
      nodeMap.set(node.id, {
        ...node,
        children: [],
        isActive: node.id === currentBranchId
      })
    })

    // Build the tree structure based on parent-child relationships
    nodes.forEach(node => {
      const treeNode = nodeMap.get(node.id)!

      // Find parent based on edges or parentId
      let parentId = node.parentId

      // If no direct parentId, try to find parent through message relationships
      if (!parentId && node.type === 'branch') {
        // Look for a parent node that this branch was created from
        const parentNode = nodes.find(n =>
          n.id !== node.id &&
          n.type === 'main' &&
          n.messages.some(m => m.children.includes(node.messages[0]?.id || ''))
        )
        parentId = parentNode?.id
      }

      if (parentId && nodeMap.has(parentId)) {
        const parent = nodeMap.get(parentId)!
        parent.children.push(treeNode)
      } else {
        // This is a root node (main conversation or orphaned branch)
        rootNodes.push(treeNode)
      }
    })

    // Sort children by timestamp (newest first)
    const sortChildren = (node: ConversationNode) => {
      node.children.sort((a, b) => b.timestamp - a.timestamp)
      node.children.forEach(sortChildren)
    }

    rootNodes.forEach(sortChildren)
    rootNodes.sort((a, b) => b.timestamp - a.timestamp)

    return rootNodes
  }

  // Get conversation tree
  const conversationTree = buildConversationTree(conversationNodes)

  // Sort branches by timestamp (newest first) for history tab
  const sortedBranches = [...branches].sort((a, b) => b.timestamp - a.timestamp)

  // Group branches by date
  const groupedBranches = sortedBranches.reduce((groups: Record<string, Branch[]>, branch) => {
    const date = new Date(branch.timestamp)
    const dateKey = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })

    if (!groups[dateKey]) {
      groups[dateKey] = []
    }

    groups[dateKey].push(branch)
    return groups
  }, {})

  // Get first user message from branch (for title display)
  const getBranchTitle = (branch: Branch) => {
    const userMessage = branch.messages.find(m => m.isUser)
    if (userMessage) {
      // Truncate to reasonable length
      return userMessage.text.length > 40
        ? userMessage.text.substring(0, 40) + '...'
        : userMessage.text
    }
    return 'Untitled branch'
  }

  // Get title for conversation node
  const getNodeTitle = (node: ConversationNode) => {
    const userMessage = node.messages.find(m => m.isUser)
    if (userMessage) {
      return userMessage.text.length > 30
        ? userMessage.text.substring(0, 30) + '...'
        : userMessage.text
    }
    return node.type === 'main' ? 'Main Conversation' : 'Branch'
  }

  // Toggle node expansion
  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  // Render conversation tree node with better hierarchy
  const renderTreeNode = (node: ConversationNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children.length > 0
    const isActive = currentBranchId === node.id

    return (
      <div key={node.id} className="mb-2">
        <div className="flex items-center min-w-0 gap-1.5">
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleNodeExpansion(node.id)
              }}
              className="p-1 text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80 rounded transition-colors flex-shrink-0"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <div className="w-7 flex-shrink-0"></div>
          )}

          {/* Node Content */}
          <motion.button
            onClick={() => onSelectBranch(node.id)}
            className={`flex-1 text-left p-3 rounded-lg text-sm transition-all duration-200 min-w-0 ${isActive
              ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/50 shadow-sm dark:shadow-purple-500/10'
              : 'hover:bg-muted dark:hover:bg-muted/80 text-foreground border border-transparent hover:border-border/60 dark:hover:border-border/40'
              }`}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="flex items-center min-w-0 gap-2.5">
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${node.type === 'main' ? 'bg-blue-500 dark:bg-blue-400' : 'bg-emerald-500 dark:bg-emerald-400'
                  }`}
              />
              <span className="font-medium truncate min-w-0 flex-1 text-sm leading-snug" title={getNodeTitle(node)}>
                {getNodeTitle(node)}
              </span>
              {isActive && (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 flex-shrink-0"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500 }}
                />
              )}
            </div>
            <div className="text-xs text-muted-foreground dark:text-muted-foreground/80 mt-1.5 flex items-center justify-between min-w-0 gap-2">
              <span className="truncate min-w-0">{node.messages.length} {node.messages.length === 1 ? 'message' : 'messages'}</span>
              {node.type === 'branch' && (
                <span className="text-xs text-muted-foreground dark:text-muted-foreground/70 flex-shrink-0 px-1.5 py-0.5 bg-muted dark:bg-muted/60 rounded">Branch</span>
              )}
            </div>
          </motion.button>
        </div>

        {/* Children with proper indentation */}
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="ml-7 border-l border-border/50 dark:border-border/30 pl-3 mt-2 space-y-2"
            >
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <>
      {/* Toggle Button - Positioned in top bar area */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsOpen(!isOpen)}
            className="fixed top-3 left-4 z-50 p-2.5 bg-card dark:bg-card border border-border/80 dark:border-border/60 rounded-xl shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl transition-all duration-200 hover:bg-muted dark:hover:bg-muted/80"
            aria-label="Open sidebar"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <List size={18} className="text-foreground dark:text-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/5 dark:bg-black/40 backdrop-blur-sm z-30"
              onClick={() => setIsOpen(false)}
            />

            {/* Sidebar Panel */}
            <motion.div
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed top-0 left-0 z-40 h-full bg-card dark:bg-card border-r border-border/60 dark:border-border/40 shadow-2xl w-80 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/80 dark:border-border/60 bg-card dark:bg-card">
                <h2 className="text-lg font-semibold text-foreground dark:text-foreground tracking-tight">Conversations</h2>
                <motion.button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80 transition-all duration-200 flex-shrink-0"
                  aria-label="Close sidebar"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={18} weight="bold" />
                </motion.button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border/80 dark:border-border/60 bg-card">
                <motion.button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-3.5 text-sm font-medium relative transition-colors duration-200 ${activeTab === 'history'
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground'
                    }`}
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex items-center justify-center gap-2 relative z-10">
                    <Clock size={16} weight={activeTab === 'history' ? 'fill' : 'regular'} />
                    History
                  </span>
                  {activeTab === 'history' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
                <motion.button
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 py-3.5 text-sm font-medium relative transition-colors duration-200 ${activeTab === 'settings'
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground'
                    }`}
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex items-center justify-center gap-2 relative z-10">
                    <Gear size={16} weight={activeTab === 'settings' ? 'fill' : 'regular'} />
                    Settings
                  </span>
                  {activeTab === 'settings' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'history' ? (
                  <ConversationHistory
                    conversations={conversations}
                    currentConversationId={currentConversationId}
                    onSelectConversation={onSelectConversation}
                    onCreateNewConversation={onCreateNewConversation}
                    onDeleteConversation={(id) => onDeleteConversation?.(id)}
                  />
                ) : (
                  <div className="p-6 space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground dark:text-foreground mb-4">General</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 dark:border-border/40 bg-card dark:bg-card">
                          <div>
                            <p className="text-sm font-medium text-foreground dark:text-foreground">Auto-save</p>
                            <p className="text-xs text-muted-foreground dark:text-muted-foreground/70 mt-0.5">Automatically save conversations</p>
                          </div>
                          <div className="w-10 h-6 bg-purple-500 dark:bg-purple-500 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 dark:border-border/40 bg-card dark:bg-card">
                          <div>
                            <p className="text-sm font-medium text-foreground dark:text-foreground">Notifications</p>
                            <p className="text-xs text-muted-foreground dark:text-muted-foreground/70 mt-0.5">Show notifications for new messages</p>
                          </div>
                          <div className="w-10 h-6 bg-muted dark:bg-muted rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-foreground dark:text-foreground mb-4">Appearance</h3>
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border border-border/60 dark:border-border/40 bg-card dark:bg-card">
                          <p className="text-sm font-medium text-foreground dark:text-foreground mb-1">Theme</p>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground/70">Use the theme toggle in the top bar</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-foreground dark:text-foreground mb-4">Data</h3>
                      <div className="space-y-3">
                        <button className="w-full p-3 rounded-lg border border-border/60 dark:border-border/40 bg-card dark:bg-card hover:bg-muted dark:hover:bg-muted/80 transition-colors text-left">
                          <p className="text-sm font-medium text-foreground dark:text-foreground">Export all conversations</p>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground/70 mt-0.5">Download your data as JSON</p>
                        </button>
                        <button className="w-full p-3 rounded-lg border border-destructive/30 dark:border-destructive/30 bg-card dark:bg-card hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-colors text-left">
                          <p className="text-sm font-medium text-destructive">Clear all data</p>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground/70 mt-0.5">Permanently delete all conversations</p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {activeTab !== 'settings' && (
                <div className="px-6 py-4 border-t border-border/80 dark:border-border/60 bg-muted/30 dark:bg-muted/20">
                  {/* Usage Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-foreground dark:text-foreground">Free Plan</span>
                      <span className="text-muted-foreground dark:text-muted-foreground/70">{messageCount}/50 msgs</span>
                    </div>
                    <div className="h-2 bg-muted dark:bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${messageCount >= 50 ? 'bg-destructive' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                          }`}
                        style={{ width: `${Math.min((messageCount / 50) * 100, 100)}%` }}
                      />
                    </div>
                    {messageCount >= 40 && (
                      <p className="text-[10px] text-destructive mt-1 font-medium">
                        {messageCount >= 50 ? 'Limit reached' : 'Approaching limit'}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={onUpgrade}
                    className="w-full py-2 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold uppercase tracking-wide rounded-lg shadow-md hover:shadow-lg transition-all duration-200 mb-3 flex items-center justify-center gap-2"
                  >
                    <SparklesIcon className="w-3.5 h-3.5" />
                    Upgrade to Pro
                  </button>

                  <div className="text-xs text-muted-foreground dark:text-muted-foreground/70 flex justify-between items-center">
                    <span className="font-medium text-foreground dark:text-foreground">
                      {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
