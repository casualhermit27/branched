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
      <div key={node.id} className="mb-2.5">
        <div className="flex items-center min-w-0">
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleNodeExpansion(node.id)
              }}
              className="p-1 mr-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          
          {/* Spacer for nodes without children */}
          {!hasChildren && <div className="w-6 flex-shrink-0"></div>}
          
          {/* Node Content */}
          <button
            onClick={() => onSelectBranch(node.id)}
            className={`flex-1 text-left p-3 rounded-lg text-sm transition-colors min-w-0 ${
              isActive
                ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-sm'
                : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <div className="flex items-center min-w-0">
              <div className={`w-3 h-3 rounded-full mr-2.5 flex-shrink-0 ${
                node.type === 'main' ? 'bg-blue-500' : 'bg-green-500'
              }`}></div>
              <span className="font-medium truncate min-w-0 flex-1" title={getNodeTitle(node)}>{getNodeTitle(node)}</span>
              {isActive && (
                <span className="ml-2 text-xs text-purple-600 flex-shrink-0">●</span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-2 flex items-center justify-between min-w-0">
              <span className="truncate min-w-0">{node.messages.length} messages</span>
              {node.type === 'branch' && (
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">Branch</span>
              )}
            </div>
          </button>
        </div>
        
        {/* Children with proper indentation */}
        {hasChildren && isExpanded && (
          <div className="ml-6 border-l border-gray-200 pl-3 mt-2 space-y-2">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Toggle Button - Positioned to not overlap with sidebar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-40 p-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-shadow"
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        style={{ 
          left: isOpen ? '320px' : '16px', // Move right when sidebar is open (fixed width)
          transition: 'left 0.3s ease-in-out'
        }}
      >
        {isOpen ? <X size={18} /> : <List size={18} />}
      </button>
      
      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 z-40 h-full bg-white border-r border-gray-200 shadow-lg w-80 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-medium">Conversations</h2>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-4 text-sm font-medium ${
                  activeTab === 'history' 
                    ? 'text-purple-600 border-b-2 border-purple-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center gap-2.5">
                  <Clock size={17} />
                  History
                </span>
              </button>
              <button
                onClick={() => setActiveTab('branches')}
                className={`flex-1 py-4 text-sm font-medium ${
                  activeTab === 'branches' 
                    ? 'text-purple-600 border-b-2 border-purple-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center gap-2.5">
                  <GitBranch size={17} />
                  Branches
                </span>
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'history' ? (
                <ConversationHistory
                  conversations={conversations}
                  currentConversationId={currentConversationId}
                  onSelectConversation={onSelectConversation}
                  onCreateNewConversation={onCreateNewConversation}
                  onDeleteConversation={(id) => onDeleteConversation?.(id)}
                />
              ) : (
                <div className="space-y-1">
                  {conversationTree.length > 0 ? (
                    conversationTree.map(node => renderTreeNode(node))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <GitBranch size={32} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No conversation branches yet</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Create branches by clicking the branch button on messages
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
              <span>{branches.length} conversations</span>
              <span className="text-purple-500 font-medium">AI Canvas</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
