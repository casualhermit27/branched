'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { List, X, ArrowsOut, ArrowsIn, Clock, GitBranch, Trash } from '@phosphor-icons/react'
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
  onSelectConversation = () => {},
  onCreateNewConversation = () => {}
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'history' | 'branches'>('branches')
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
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors flex-shrink-0"
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
            className={`flex-1 text-left p-3 rounded-lg text-sm transition-all duration-200 min-w-0 ${
              isActive
                ? 'bg-purple-50 text-purple-700 border border-purple-200/60 shadow-sm'
                : 'hover:bg-muted text-foreground border border-transparent hover:border-border/60'
            }`}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="flex items-center min-w-0 gap-2.5">
              <div 
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  node.type === 'main' ? 'bg-blue-500' : 'bg-emerald-500'
                }`}
              />
              <span className="font-medium truncate min-w-0 flex-1 text-sm leading-snug" title={getNodeTitle(node)}>
                {getNodeTitle(node)}
              </span>
              {isActive && (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500 }}
                />
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 flex items-center justify-between min-w-0 gap-2">
              <span className="truncate min-w-0">{node.messages.length} {node.messages.length === 1 ? 'message' : 'messages'}</span>
              {node.type === 'branch' && (
                <span className="text-xs text-muted-foreground flex-shrink-0 px-1.5 py-0.5 bg-muted rounded">Branch</span>
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
              className="ml-7 border-l border-border/50 pl-3 mt-2 space-y-2"
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
      {/* Toggle Button - Only visible when sidebar is closed */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsOpen(!isOpen)}
            className="fixed top-4 left-4 z-40 p-2.5 bg-card border border-border/80 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:bg-muted"
            aria-label="Open sidebar"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <List size={18} className="text-foreground" />
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
              className="fixed inset-0 bg-black/5 backdrop-blur-sm z-30"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Sidebar Panel */}
            <motion.div
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed top-0 left-0 z-40 h-full bg-card border-r border-border/60 shadow-2xl w-80 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/80 bg-card">
                <h2 className="text-lg font-semibold text-foreground tracking-tight">Conversations</h2>
                <motion.button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 flex-shrink-0"
                  aria-label="Close sidebar"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={18} weight="bold" />
                </motion.button>
              </div>
              
              {/* Tabs */}
              <div className="flex border-b border-border/80 bg-card">
                <motion.button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-3.5 text-sm font-medium relative transition-colors duration-200 ${
                    activeTab === 'history' 
                      ? 'text-purple-600' 
                      : 'text-muted-foreground hover:text-foreground'
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
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
                <motion.button
                  onClick={() => setActiveTab('branches')}
                  className={`flex-1 py-3.5 text-sm font-medium relative transition-colors duration-200 ${
                    activeTab === 'branches' 
                      ? 'text-purple-600' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex items-center justify-center gap-2 relative z-10">
                    <GitBranch size={16} weight={activeTab === 'branches' ? 'fill' : 'regular'} />
                    Branches
                  </span>
                  {activeTab === 'branches' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
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
                  <div className="p-4 space-y-2">
                    {conversationTree.length > 0 ? (
                      conversationTree.map(node => renderTreeNode(node))
                    ) : (
                      <div className="text-center text-muted-foreground py-12">
                        <GitBranch size={36} className="mx-auto mb-3 text-muted-foreground/50" weight="light" />
                        <p className="text-sm font-medium text-foreground">No conversation branches yet</p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Create branches by clicking the branch button on messages
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="px-6 py-4 border-t border-border/80 bg-muted/30 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {activeTab === 'history' 
                    ? `${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'}`
                    : `${conversationTree.length} ${conversationTree.length === 1 ? 'branch' : 'branches'}`
                  }
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
