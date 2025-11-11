'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, CaretRight, CaretDown } from '@phosphor-icons/react'
import { useState, useMemo } from 'react'

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: number
}

interface NodeData {
  id: string
  label: string
  messages: Message[]
  isMain: boolean
  isActive?: boolean
  isMinimized?: boolean
  selectedAIs?: any[]
  parentId?: string
}

interface NodeListPanelProps {
  nodes: NodeData[]
  activeNodeId: string | null
  minimizedNodeIds: Set<string>
  onSelectNode: (nodeId: string) => void
  onRestoreNode?: (nodeId: string) => void // Restore minimized node to canvas
  isOpen: boolean
  onClose: () => void
}

// Build tree structure from flat node list
function buildNodeTree(nodes: NodeData[]): Array<NodeData & { children: NodeData[] }> {
  const nodeMap = new Map<string, NodeData & { children: NodeData[] }>()
  const rootNodes: Array<NodeData & { children: NodeData[] }> = []
  
  // Create map with empty children arrays
  nodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] })
  })
  
  // Build tree structure
  nodes.forEach(node => {
    const treeNode = nodeMap.get(node.id)!
    const parentId = node.parentId || (node.isMain ? undefined : 'main')
    
    if (parentId && nodeMap.has(parentId)) {
      const parent = nodeMap.get(parentId)!
      parent.children.push(treeNode)
    } else {
      rootNodes.push(treeNode)
    }
  })
  
  // Sort children by timestamp (newest first)
  const sortChildren = (node: NodeData & { children: NodeData[] }) => {
    node.children.sort((a, b) => {
      const aLatest = a.messages[a.messages.length - 1]?.timestamp || 0
      const bLatest = b.messages[b.messages.length - 1]?.timestamp || 0
      return bLatest - aLatest
    })
    node.children.forEach(sortChildren)
  }
  
  rootNodes.forEach(sortChildren)
  return rootNodes
}

// Recursive tree node component
function TreeNode({ 
  node, 
  level = 0, 
  activeNodeId, 
  minimizedNodeIds,
  onSelectNode, 
  onRestoreNode,
  expandedNodes,
  toggleExpanded
}: { 
  node: NodeData & { children: NodeData[] }
  level?: number
  activeNodeId: string | null
  minimizedNodeIds: Set<string>
  onSelectNode: (nodeId: string) => void
  onRestoreNode?: (nodeId: string) => void
  expandedNodes: Set<string>
  toggleExpanded: (nodeId: string) => void
}) {
  const isActive = node.id === activeNodeId
  const isMinimized = minimizedNodeIds.has(node.id)
  const isExpanded = expandedNodes.has(node.id)
  const hasChildren = node.children.length > 0
  const latestMessage = node.messages[node.messages.length - 1]
  const preview = latestMessage?.text?.substring(0, 60) || 'No messages'
  
  return (
    <div className="select-none">
      {/* Node Card */}
      <motion.div
        onClick={(e) => {
          e.stopPropagation()
          if (isMinimized && onRestoreNode) {
            // Restore minimized node to canvas
            onRestoreNode(node.id)
          } else {
            // Select/center node on canvas
            onSelectNode(node.id)
          }
        }}
        className={`group relative p-3 rounded-lg border transition-all duration-200 cursor-pointer mb-1 ${
          isActive
            ? 'bg-primary/10 dark:bg-primary/20 border-primary/30 dark:border-primary/40 shadow-sm'
            : isMinimized
            ? 'bg-muted/20 dark:bg-muted/10 border-border/30 dark:border-border/20 opacity-75'
            : 'bg-muted/30 dark:bg-muted/20 border-border/40 dark:border-border/30 hover:bg-muted/50 dark:hover:bg-muted/30'
        }`}
        style={{ marginLeft: `${level * 16}px` }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {/* Node Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Expand/Collapse Button */}
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpanded(node.id)
                }}
                className="p-0.5 rounded hover:bg-muted/50 transition-colors flex-shrink-0"
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CaretRight className="w-3 h-3 text-muted-foreground" weight="bold" />
                </motion.div>
              </button>
            )}
            {!hasChildren && <div className="w-4" />}
            
            {/* Node Indicator */}
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              node.isMain ? 'bg-blue-500' : 'bg-emerald-500'
            }`} />
            
            {/* Node Label */}
            <span className={`text-xs font-semibold truncate ${
              isActive ? 'text-primary dark:text-primary' : 'text-foreground'
            }`}>
              {node.label || (node.isMain ? 'Main' : 'Branch')}
            </span>
            
            {/* Minimized Badge */}
            {isMinimized && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 dark:bg-muted/30 text-muted-foreground border border-border/30">
                Hidden
              </span>
            )}
          </div>
          
          {isActive && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"
            />
          )}
        </div>
        
        {/* Message Preview */}
        {latestMessage && (
          <p className="text-[10px] text-muted-foreground/70 line-clamp-1 mt-1 ml-6 leading-relaxed">
            {latestMessage.isUser ? 'You: ' : 'AI: '}
            {preview}
            {latestMessage.text.length > 60 ? '...' : ''}
          </p>
        )}
        
        {/* Message Count */}
        <div className="flex items-center justify-between mt-1 ml-6">
          <span className="text-[10px] text-muted-foreground/60">
            {node.messages.length} {node.messages.length === 1 ? 'msg' : 'msgs'}
          </span>
          
          {/* Hover Action Indicator */}
          <motion.div
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            initial={{ x: -4 }}
            animate={{ x: 0 }}
          >
            {isMinimized ? (
              <span className="text-[10px] text-primary">Click to restore</span>
            ) : (
              <CaretRight className="w-3 h-3 text-muted-foreground" weight="bold" />
            )}
          </motion.div>
        </div>
      </motion.div>
      
      {/* Children */}
      {hasChildren && isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              activeNodeId={activeNodeId}
              minimizedNodeIds={minimizedNodeIds}
              onSelectNode={onSelectNode}
              onRestoreNode={onRestoreNode}
              expandedNodes={expandedNodes}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}

export default function NodeListPanel({ 
  nodes, 
  activeNodeId, 
  minimizedNodeIds,
  onSelectNode, 
  onRestoreNode,
  isOpen, 
  onClose 
}: NodeListPanelProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['main']))
  
  const toggleExpanded = (nodeId: string) => {
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
  
  // Build tree structure
  const treeNodes = useMemo(() => buildNodeTree(nodes), [nodes])
  
  // Count stats
  const totalNodes = nodes.length
  const minimizedCount = minimizedNodeIds.size
  const visibleCount = totalNodes - minimizedCount

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/5 dark:bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-0 right-0 z-50 h-full bg-card dark:bg-card border-l border-border/60 dark:border-border/40 shadow-2xl w-80 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/80 dark:border-border/60 bg-card dark:bg-card">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground dark:text-foreground tracking-tight">
                  Node Minimap
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-[10px] text-muted-foreground">
                    {totalNodes} total
                  </p>
                  <span className="text-[10px] text-muted-foreground/60">•</span>
                  <p className="text-[10px] text-muted-foreground">
                    {visibleCount} on canvas
                  </p>
                  {minimizedCount > 0 && (
                    <>
                      <span className="text-[10px] text-muted-foreground/60">•</span>
                      <p className="text-[10px] text-primary">
                        {minimizedCount} hidden
                      </p>
                    </>
                  )}
                </div>
              </div>
              <motion.button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80 transition-all duration-200 flex-shrink-0"
                aria-label="Close panel"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={16} weight="bold" />
              </motion.button>
            </div>
            
            {/* Tree View */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {treeNodes.length > 0 ? (
                <div className="space-y-1">
                  {treeNodes.map((node) => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      level={0}
                      activeNodeId={activeNodeId}
                      minimizedNodeIds={minimizedNodeIds}
                      onSelectNode={onSelectNode}
                      onRestoreNode={onRestoreNode}
                      expandedNodes={expandedNodes}
                      toggleExpanded={toggleExpanded}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted/30 dark:bg-muted/20 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                      <path d="M3 3h18v18H3zM3 9h18M9 3v18"/>
                    </svg>
                  </div>
                  <p className="text-xs text-muted-foreground">No nodes yet</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1">Create branches to see them here</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
