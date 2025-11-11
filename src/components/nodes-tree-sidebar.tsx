'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, GitBranch, ChatCircle } from '@phosphor-icons/react'

interface NodeData {
  id: string
  label?: string
  title?: string
  messages: any[]
  parentId?: string
  isMain?: boolean
  timestamp?: number
}

interface NodesTreeSidebarProps {
  isOpen: boolean
  onClose: () => void
  nodes: NodeData[]
  activeNodeId?: string | null
  onSelectNode?: (nodeId: string) => void
}

// Build tree structure from flat node list
function buildNodeTree(nodes: NodeData[]): Array<NodeData & { children: Array<NodeData & { children: any[] }> }> {
  const nodeMap = new Map<string, NodeData & { children: any[] }>()
  const rootNodes: Array<NodeData & { children: any[] }> = []
  
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
  const sortChildren = (node: NodeData & { children: any[] }) => {
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
  onSelectNode
}: { 
  node: NodeData & { children: any[] }
  level?: number
  activeNodeId?: string | null
  onSelectNode?: (nodeId: string) => void
}) {
  const isActive = activeNodeId === node.id
  const hasChildren = node.children.length > 0
  const indent = level * 20
  
  return (
    <div className="relative">
      {/* Tree connector line */}
      {level > 0 && (
        <>
          {/* Vertical line */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-0.5 border-l border-dashed border-border/40 dark:border-border/30"
            style={{ left: `${indent - 20}px`, height: '100%' }}
          />
          {/* Horizontal connector */}
          <div 
            className="absolute top-4 w-4 h-0.5 border-t border-dashed border-border/40 dark:border-border/30"
            style={{ left: `${indent - 20}px` }}
          />
        </>
      )}
      
      <div
        onClick={() => onSelectNode?.(node.id)}
        className={`relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 group ${
          isActive
            ? 'bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30'
            : 'hover:bg-muted/50 dark:hover:bg-muted/30'
        }`}
        style={{ marginLeft: `${indent}px` }}
      >
        <div className={`flex-shrink-0 w-2 h-2 rounded-full transition-colors ${
          isActive
            ? 'bg-primary'
            : node.isMain
            ? 'bg-blue-500'
            : 'bg-emerald-500'
        }`} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {node.isMain ? (
              <span className="text-sm font-semibold text-foreground truncate">
                Main Conversation
              </span>
            ) : (
              <span className={`text-sm font-medium truncate ${
                isActive ? 'text-foreground' : 'text-foreground/80'
              }`}>
                {node.label || node.title || `Branch ${node.id.slice(-6)}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <ChatCircle className="w-3 h-3 text-muted-foreground/50" weight="fill" />
            <span className="text-xs text-muted-foreground/60">
              {node.messages.length} {node.messages.length === 1 ? 'message' : 'messages'}
            </span>
          </div>
        </div>
        
        {hasChildren && (
          <GitBranch className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" weight="duotone" />
        )}
      </div>
      
      {/* Render children */}
      {hasChildren && (
        <div className="mt-1 ml-4 space-y-1">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              activeNodeId={activeNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function NodesTreeSidebar({
  isOpen,
  onClose,
  nodes,
  activeNodeId,
  onSelectNode
}: NodesTreeSidebarProps) {
  const nodeTree = buildNodeTree(nodes)
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[45]"
          />
          
          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-80 bg-card dark:bg-card border-l border-border dark:border-border/60 shadow-2xl z-[50] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border dark:border-border/60">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-foreground" weight="duotone" />
                <h2 className="text-lg font-semibold text-foreground">Conversation Tree</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted dark:hover:bg-muted/80 transition-colors"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {nodeTree.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground/70">
                  <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-40" weight="duotone" />
                  <p className="text-sm font-medium text-foreground/80 mb-1">No nodes yet</p>
                  <p className="text-xs text-muted-foreground/60">Create branches to see the tree structure</p>
                </div>
              ) : (
                nodeTree.map(node => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    level={0}
                    activeNodeId={activeNodeId}
                    onSelectNode={onSelectNode}
                  />
                ))
              )}
            </div>
            
            {/* Footer */}
            <div className="px-4 py-3 border-t border-border dark:border-border/60 bg-muted/30 dark:bg-muted/20">
              <div className="text-xs text-muted-foreground/70 text-center">
                {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'} total
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

