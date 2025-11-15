'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CaretDown, CaretRight, GitBranch, Sparkle, ChatCircle, Clock, Trash } from '@phosphor-icons/react'
import ChatInterface from './chat-interface'
import { DeleteConfirmModal } from './delete-confirm-modal'

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: number
  parentId?: string
  children: string[]
  aiModel?: string
  groupId?: string
  isStreaming?: boolean
  streamingText?: string
}

interface AI {
  id: string
  name: string
  color: string
  logo: React.JSX.Element
}

interface BranchNode {
  id: string
  title?: string
  label?: string
  messages: Message[]
  inheritedMessages?: Message[]
  branchMessages?: Message[]
  selectedAIs?: AI[]
  multiModelMode?: boolean
  isMain?: boolean
  parentId?: string
  parentMessageId?: string
}

interface ChatBranchesViewProps {
  mainMessages: Message[]
  branches: BranchNode[]
  selectedAIs: AI[]
  onAddAI: (ai: AI) => void
  onRemoveAI: (aiId: string) => void
  onSelectSingle: (ai: AI) => void
  getBestAvailableModel: () => AI
  multiModelMode: boolean
  onSendMessage: (text: string, branchId?: string) => void
  onBranchFromMessage: (messageId: string, isMultiBranch?: boolean) => void
  isGenerating: boolean
  onStopGeneration: () => void
  activeBranchId: string | null
  onSelectBranch: (branchId: string) => void
  onDeleteBranch?: (branchId: string) => void
}

interface BranchTreeNode extends BranchNode {
  children: BranchTreeNode[]
  depth: number
}

export default function ChatBranchesView({
  mainMessages,
  branches,
  selectedAIs,
  onAddAI,
  onRemoveAI,
  onSelectSingle,
  getBestAvailableModel,
  multiModelMode,
  onSendMessage,
  onBranchFromMessage,
  isGenerating,
  onStopGeneration,
  activeBranchId,
  onSelectBranch,
  onDeleteBranch
}: ChatBranchesViewProps) {
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set(['main']))
  const lastActiveBranchRef = useRef<string | null>(activeBranchId)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; branchId: string | null; branchName?: string }>({
    isOpen: false,
    branchId: null
  })
  
  // Auto-expand branch when it becomes active
  useEffect(() => {
    if (activeBranchId && activeBranchId !== lastActiveBranchRef.current) {
      setExpandedBranches(prev => {
        const next = new Set(prev)
        next.add(activeBranchId)
        return next
      })
      lastActiveBranchRef.current = activeBranchId
    }
  }, [activeBranchId])
  
  const toggleBranch = (branchId: string) => {
    setExpandedBranches(prev => {
      const next = new Set(prev)
      if (next.has(branchId)) {
        next.delete(branchId)
      } else {
        next.add(branchId)
      }
      return next
    })
  }

  // Build tree structure from flat branch list
  const buildBranchTree = useMemo(() => {
    const mainNode = branches.find(b => b.id === 'main' || b.isMain)
    const branchNodes = branches.filter(b => b.id !== 'main' && !b.isMain)
    
    // Create a map for quick lookup
    const branchMap = new Map<string, BranchTreeNode>()
    
    // Initialize all branches as tree nodes
    branchNodes.forEach(branch => {
      branchMap.set(branch.id, {
        ...branch,
        children: [],
        depth: 0
      })
    })
    
    // Build parent-child relationships
    const rootBranches: BranchTreeNode[] = []
    branchNodes.forEach(branch => {
      const treeNode = branchMap.get(branch.id)!
      const parentId = branch.parentId || 'main'
      
      if (parentId === 'main') {
        // Root level branch (child of main)
        rootBranches.push(treeNode)
      } else {
        // Nested branch (child of another branch)
        const parent = branchMap.get(parentId)
        if (parent) {
          treeNode.depth = parent.depth + 1
          parent.children.push(treeNode)
        } else {
          // Parent not found, treat as root
          rootBranches.push(treeNode)
        }
      }
    })
    
    return { mainNode, rootBranches, branchMap }
  }, [branches])

  const { mainNode, rootBranches } = buildBranchTree
  
  // Ensure mainNode has messages - use mainMessages prop if mainNode.messages is missing
  const mainNodeWithMessages = mainNode ? {
    ...mainNode,
    messages: mainNode.messages || mainMessages || []
  } : null

  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  // Recursive component to render nested branches
  const renderBranchTree = (branch: BranchTreeNode) => {
    const allMessages = [
      ...(branch.inheritedMessages || []),
      ...(branch.branchMessages || branch.messages || [])
    ]
    const isExpanded = expandedBranches.has(branch.id)
    const isActive = activeBranchId === branch.id
    
    // Get last message timestamp
    const lastMessage = allMessages[allMessages.length - 1]
    const lastMessageTime = lastMessage ? formatTime(lastMessage.timestamp) : null

    return (
      <div key={branch.id} className="relative">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className={`border rounded-xl backdrop-blur-sm transition-all duration-200 relative overflow-visible group ${
            isActive 
              ? 'border-border dark:border-border/60 bg-card dark:bg-card shadow-md' 
              : 'border-border/60 dark:border-border/40 bg-card/95 dark:bg-card/98 shadow-sm hover:shadow-md hover:border-border dark:hover:border-border/50'
          }`}
          style={{ marginLeft: `${branch.depth * 40}px` }}
        >
          {/* Subtle top border accent */}
          <div className={`absolute top-0 left-0 right-0 h-px transition-colors ${
            isActive 
              ? 'bg-border dark:bg-border/60' 
              : 'bg-border/40 dark:bg-border/30'
          }`} />
          
          {/* Tree connector lines - only for nested branches */}
          {branch.depth > 0 && (
            <>
              {/* Vertical line from parent's vertical line down to this branch */}
              <div 
                className="absolute top-0 w-0.5 border-l border-dashed border-border/40 dark:border-border/30 transition-opacity group-hover:opacity-60"
                style={{ 
                  left: `${-40}px`,
                  height: '32px'
                }}
              />
              {/* Horizontal line connecting to the branch */}
              <div 
                className="absolute top-8 w-5 h-0.5 border-t border-dashed border-border/40 dark:border-border/30 transition-opacity group-hover:opacity-60"
                style={{ left: `${-40}px` }}
              />
            </>
          )}
          
          <div
            onClick={() => {
              toggleBranch(branch.id)
              onSelectBranch(branch.id)
            }}
            className={`w-full flex items-center justify-between p-5 hover:bg-muted/30 dark:hover:bg-muted/20 transition-all duration-200 rounded-t-xl cursor-pointer ${
              isActive ? 'bg-muted/40 dark:bg-muted/30' : ''
            }`}
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {branch.children.length > 0 ? (
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0"
                >
                  <CaretRight className={`w-4 h-4 transition-colors ${
                    isActive 
                      ? 'text-foreground dark:text-foreground' 
                      : 'text-muted-foreground/50 dark:text-muted-foreground/40'
                  }`} weight="bold" />
                </motion.div>
              ) : (
                <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    isActive 
                      ? 'bg-foreground/40 dark:bg-foreground/50' 
                      : 'bg-muted-foreground/30 dark:bg-muted-foreground/40'
                  }`} />
                </div>
              )}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`p-1.5 rounded-lg flex-shrink-0 border transition-colors ${
                  isActive 
                    ? 'bg-muted/50 dark:bg-muted/40 border-border/40 dark:border-border/30' 
                    : 'bg-muted/30 dark:bg-muted/20 border-border/30 dark:border-border/20'
                }`}>
                  <GitBranch className={`w-3.5 h-3.5 transition-colors ${
                    isActive 
                      ? 'text-foreground/70 dark:text-foreground/80' 
                      : 'text-muted-foreground/60 dark:text-muted-foreground/50'
                  }`} weight="duotone" />
                </div>
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <div className="flex items-center gap-2 w-full">
                    <span className={`font-medium truncate text-sm transition-colors ${
                      isActive 
                        ? 'text-foreground dark:text-foreground' 
                        : 'text-foreground/90 dark:text-foreground/90'
                    }`}>
                      {branch.label || branch.title || `Branch ${branch.id.slice(-6)}`}
                    </span>
                    {branch.depth > 0 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 transition-colors ${
                        isActive 
                          ? 'text-muted-foreground/70 dark:text-muted-foreground/60 bg-muted/40 dark:bg-muted/30 border-border/40 dark:border-border/30' 
                          : 'text-muted-foreground/50 bg-muted/30 dark:bg-muted/20 border-border/30 dark:border-border/20'
                      }">
                        Level {branch.depth + 1}
                      </span>
                    )}
                  </div>
                  {lastMessageTime && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="w-3 h-3 text-muted-foreground/40" weight="fill" />
                      <span className="text-[10px] text-muted-foreground/50 font-medium">
                        {lastMessageTime}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all duration-200 ${
                  isActive 
                    ? 'bg-muted/40 dark:bg-muted/30 border-border/40 dark:border-border/30' 
                    : 'bg-muted/20 dark:bg-muted/10 border-border/20 dark:border-border/10 hover:bg-muted/30 dark:hover:bg-muted/20'
                }`}>
                  <ChatCircle className={`w-3 h-3 ${
                    isActive 
                      ? 'text-foreground/60 dark:text-foreground/70' 
                      : 'text-muted-foreground/50 dark:text-muted-foreground/40'
                  }`} weight="fill" />
                  <span className={`text-xs font-medium ${
                    isActive 
                      ? 'text-foreground/70 dark:text-foreground/80' 
                      : 'text-muted-foreground/60 dark:text-muted-foreground/50'
                  }`}>
                    {allMessages.length}
                  </span>
                </div>
                {onDeleteBranch && branch.id !== 'main' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirm({
                        isOpen: true,
                        branchId: branch.id,
                        branchName: branch.label || branch.title || `Branch ${branch.id.slice(-6)}`
                      })
                    }}
                    className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive dark:hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-all duration-200"
                    title="Delete branch"
                  >
                    <Trash className="w-3.5 h-3.5" weight="regular" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className={`p-6 border-t transition-colors duration-200 ${
                  isActive 
                    ? 'border-border/40 dark:border-border/30 bg-muted/20 dark:bg-muted/10' 
                    : 'border-border/30 dark:border-border/20 bg-muted/10 dark:bg-muted/5'
                }`}>
                  <ChatInterface
                    messages={allMessages}
                    onSendMessage={(text) => onSendMessage(text, branch.id)}
                    selectedAIs={branch.selectedAIs || selectedAIs}
                    onBranchFromMessage={onBranchFromMessage}
                    currentBranch={branch.id}
                    multiModelMode={branch.multiModelMode || multiModelMode}
                    isGenerating={isGenerating && isActive}
                    onStopGeneration={onStopGeneration}
                    existingBranchesCount={branch.children.length}
                    onAddAI={onAddAI}
                    onRemoveAI={onRemoveAI}
                    onSelectSingle={onSelectSingle}
                    getBestAvailableModel={getBestAvailableModel}
                    isMain={false}
                    nodeId={branch.id}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Render child branches */}
          {branch.children.length > 0 && isExpanded && (
            <div className={`border-t relative overflow-visible transition-colors duration-200 ${
              isActive 
                ? 'border-border/30 dark:border-border/20 bg-muted/15 dark:bg-muted/8' 
                : 'border-border/25 dark:border-border/15 bg-muted/8 dark:bg-muted/5'
            }`}>
              {/* Vertical line extending down from this branch for its children */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 border-l border-dashed border-border/40 dark:border-border/30 transition-opacity group-hover:opacity-60"
                style={{ left: `${branch.depth * 40 - 40}px` }}
              />
              <div className="pl-5 pt-4 pb-4 space-y-4">
                {branch.children.map(child => renderBranchTree(child))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background pt-16">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
        {/* Main Conversation */}
        {mainNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className={`border rounded-xl backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden relative ${
              activeBranchId === 'main' 
                ? 'border-border dark:border-border/60 bg-card dark:bg-card ring-1 ring-border/50 dark:ring-border/40' 
                : 'border-border/60 dark:border-border/40 bg-card dark:bg-card'
            }`}
          >
            {/* Subtle top border accent */}
            <div className={`absolute top-0 left-0 right-0 h-px transition-colors ${
              activeBranchId === 'main' 
                ? 'bg-border dark:bg-border/60' 
                : 'bg-border/50 dark:bg-border/40'
            }`} />
            
            <button
              onClick={() => toggleBranch('main')}
              className={`w-full flex items-center justify-between p-7 hover:bg-muted/30 dark:hover:bg-muted/20 transition-all duration-200 ${
                activeBranchId === 'main' ? 'bg-muted/40 dark:bg-muted/30' : ''
              }`}
            >
              <div className="flex items-center gap-5">
                <motion.div
                  animate={{ rotate: expandedBranches.has('main') ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0"
                >
                  <CaretRight className="w-5 h-5 text-foreground/70 dark:text-foreground/80" weight="bold" />
                </motion.div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-3.5 h-3.5 rounded-full bg-foreground/20 dark:bg-foreground/30" />
                    <div className="absolute inset-0 w-3.5 h-3.5 rounded-full bg-foreground/10 animate-pulse opacity-75" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold text-foreground text-base">Main Conversation</span>
                    <div className="flex items-center gap-2 mt-1">
                      <ChatCircle className="w-3 h-3 text-muted-foreground/50" weight="fill" />
                      <span className="text-xs text-muted-foreground/60 font-medium">
                        {mainNodeWithMessages?.messages?.length || mainMessages.length || 0} {(mainNodeWithMessages?.messages?.length || mainMessages.length || 0) === 1 ? 'message' : 'messages'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>

            <AnimatePresence>
              {expandedBranches.has('main') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className={`p-7 border-t transition-colors duration-200 ${
                    activeBranchId === 'main' 
                      ? 'border-border/40 dark:border-border/30 bg-muted/20 dark:bg-muted/10' 
                      : 'border-border/30 dark:border-border/20 bg-muted/10 dark:bg-muted/5'
                  }`}>
                    <ChatInterface
                      messages={mainNodeWithMessages?.messages || mainMessages || []}
                      onSendMessage={(text) => onSendMessage(text, 'main')}
                      selectedAIs={selectedAIs}
                      onBranchFromMessage={onBranchFromMessage}
                      currentBranch={null}
                      multiModelMode={multiModelMode}
                      isGenerating={isGenerating && activeBranchId === 'main'}
                      onStopGeneration={onStopGeneration}
                      existingBranchesCount={rootBranches.length}
                      onAddAI={onAddAI}
                      onRemoveAI={onRemoveAI}
                      onSelectSingle={onSelectSingle}
                      getBestAvailableModel={getBestAvailableModel}
                      isMain={true}
                      nodeId="main"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Branches Section - Indented with dotted line separator */}
        {rootBranches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative mt-10"
          >
            {/* Clean dotted line separator with "Branches" label */}
            <div className="flex items-center gap-5 mb-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-border/50 dark:via-border/30 dark:to-border/30 border-t border-dashed"></div>
              <div className="flex items-center gap-2.5 px-4 py-2 bg-muted/40 dark:bg-muted/30 rounded-full border border-border/40 dark:border-border/30 shadow-sm">
                <GitBranch className="w-3.5 h-3.5 text-muted-foreground/60 dark:text-muted-foreground/50" weight="duotone" />
                <span className="text-xs font-semibold text-foreground/70 tracking-wider">
                  BRANCHES
                </span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-border/50 via-border/50 to-transparent dark:from-border/30 dark:via-border/30 border-t border-dashed"></div>
            </div>

            {/* Branches container - Indented with vertical guide */}
            <div className="ml-12 space-y-5 relative">
              {/* Vertical dotted guide line connecting from main - extends from separator */}
              <div className="absolute left-0 top-0 bottom-0 w-0.5 border-l border-dashed border-border/40 dark:border-border/30"></div>
              
              {/* Render all root branches */}
              {rootBranches.map((branch, idx) => (
                <motion.div
                  key={branch.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.06, ease: [0.4, 0, 0.2, 1] }}
                  className="relative"
                >
                  {/* Horizontal connector line from vertical guide to branch */}
                  <div 
                    className="absolute left-0 top-8 w-12 h-0.5 border-t border-dashed border-border/40 dark:border-border/30"
                    style={{ zIndex: 1 }}
                  />
                  {renderBranchTree(branch)}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {rootBranches.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center py-24 text-muted-foreground/70"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/40 dark:bg-muted/30 mb-6 ring-1 ring-border/30">
              <GitBranch className="w-10 h-10 opacity-40" weight="duotone" />
            </div>
            <p className="text-base font-semibold text-foreground/80 mb-2">No branches yet</p>
            <p className="text-sm text-muted-foreground/60">Create a branch from any message to explore alternatives</p>
          </motion.div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, branchId: null })}
        onConfirm={() => {
          if (deleteConfirm.branchId && onDeleteBranch) {
            onDeleteBranch(deleteConfirm.branchId)
          }
          setDeleteConfirm({ isOpen: false, branchId: null })
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, branchId: null })}
        itemType="branch"
        itemName={deleteConfirm.branchName}
        title="Delete Branch?"
        message="Are you sure you want to delete this branch? All messages in this branch will be permanently deleted. This action cannot be undone."
      />
    </div>
  )
}

