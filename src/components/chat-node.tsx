'use client'

import { useState, useRef, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, ArrowsOut, GitBranch, Trash, DotsThreeVertical } from '@phosphor-icons/react'
import ChatInterface from './chat-interface'
import AIPills from './ai-pills'
import { DeleteConfirmModal } from './delete-confirm-modal'

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
  isStreaming?: boolean  // Whether this message is currently streaming
  streamingText?: string // Current streaming text content
}

interface AI {
  id: string
  name: string
  color: string
  logo: React.JSX.Element
}

interface ChatNodeData {
  label: string
  messages: Message[]
  selectedAIs: AI[]
  onBranch?: (nodeId: string, messageId?: string) => void
  onSendMessage?: (nodeId: string, message: string) => void
  onAddAI?: (ai: AI) => void
  onRemoveAI?: (aiId: string) => void
  onSelectSingle?: (aiId: string) => void
  onToggleMultiModel?: (nodeId: string) => void
  getBestAvailableModel?: () => string
  onExportImport?: () => void
  isMain?: boolean
  showAIPill?: boolean
  isMinimized?: boolean
  onToggleMinimize?: (nodeId: string) => void
  isActive?: boolean
  isGenerating?: boolean
  onStopGeneration?: (nodeId: string) => void
  existingBranchesCount?: number
  height?: number
  isHighlighted?: boolean
  nodeId?: string
  parentMessageId?: string
  branchGroupId?: string
  inheritedMessages?: Message[]
  onDeleteBranch?: (nodeId: string) => void
}

export default function ChatNode({ data, id }: { data: ChatNodeData; id: string }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleSendMessage = (message: string, branchId?: string) => {
    if (id === 'main') {
      // For main node, use the passed function directly (which is onSendMainMessage)
      data.onSendMessage?.(id, message)
    } else {
      // For branch nodes, pass the node id
      data.onSendMessage?.(id, message)
    }
  }

  const handleBranch = (messageId: string) => {
    console.log('🔀 ChatNode handleBranch - nodeId:', id, 'messageId:', messageId)
    console.log('🔀 data.onBranch function exists:', !!data.onBranch)
    if (data.onBranch) {
      console.log('🔀 Calling data.onBranch with:', id, messageId)
      data.onBranch(id, messageId)
    } else {
      console.log('❌ data.onBranch is not defined')
    }
  }

  const handleDelete = () => {
    console.log('🗑️ Delete button clicked:', { nodeId: id, hasHandler: !!data.onDeleteBranch })
    if (data.onDeleteBranch) {
      console.log('🗑️ Calling onDeleteBranch for node:', id)
      data.onDeleteBranch(id)
      setShowDeleteConfirm(false)
    } else {
      console.warn('⚠️ onDeleteBranch handler not available for node:', id)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        y: 0
      }}
      transition={{ 
        layout: {
          duration: 0.25,
          ease: [0.4, 0, 0.2, 1]
        },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 }
      }}
      // Handle mouse events to allow scrolling within node but prevent canvas panning
      onMouseDown={(e) => {
        // Check if clicking on scrollable content or interactive elements
        const target = e.target as HTMLElement
        const isScrollableContent = target.closest('[data-scrollable]') || 
                                   target.closest('button') ||
                                   target.closest('input') ||
                                   target.closest('textarea') ||
                                   target.closest('a') ||
                                   target.closest('svg') ||
                                   target.closest('[role="button"]')
        
        // Only prevent canvas panning when clicking on interactive/scrollable content
        // Allow panning when clicking on node background
        if (isScrollableContent) {
          e.stopPropagation()
        }
        // Otherwise, let the event propagate so canvas can handle panning
      }}
      onWheel={(e) => {
        // Check if scrolling within scrollable content
        const target = e.target as HTMLElement
        const isScrollableContent = target.closest('[data-scrollable]')
        
        if (isScrollableContent) {
          // Allow scrolling within node, prevent canvas zoom
          e.stopPropagation()
        }
      }}
      className={`bg-card rounded-xl border transition-all duration-200 relative ${
        data.isActive 
          ? 'border-primary/30 shadow-[0_0_0_1px_rgba(var(--primary),0.1)]' 
          : 'border-border/20'
      } ${data.isMinimized ? 'p-3' : 'p-5'} ${
        data.isHighlighted 
          ? 'border-primary/40 shadow-[0_0_0_2px_rgba(var(--primary),0.1)]' 
          : ''
      } hover:border-border/40 hover:shadow-sm overflow-visible`}
      style={{ 
        width: data.isMinimized ? '280px' : '1200px', 
        minWidth: data.isMinimized ? '280px' : '1200px',
        maxWidth: data.isMinimized ? '280px' : '1200px',
        height: data.isMinimized ? '200px' : 'auto',
        minHeight: data.isMinimized ? '200px' : '400px',
        maxHeight: data.isMinimized ? '200px' : '850px',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
      }}
      data-minimized={data.isMinimized ? 'true' : undefined}
      data-active={data.isActive ? 'true' : undefined}
      data-grouped={data.branchGroupId ? 'true' : undefined}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          background: 'hsl(var(--border))', 
          width: 5, 
          height: 5, 
          border: '1.5px solid hsl(var(--background))',
          opacity: 0.6
        }} 
      />
      
      {/* 3-Dot Menu Button - Aligned with header bar (matches header's px-5 pt-5) */}
      <div className="absolute z-30" ref={menuRef} style={{ top: '12px', right: '12px' }}>
        <motion.button
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setShowMenu(!showMenu)
          }}
          className="p-2 rounded-lg transition-all duration-200 bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 hover:border-border/80 shadow-md hover:shadow-lg backdrop-blur-sm"
          title="More options"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <DotsThreeVertical className="w-4 h-4" weight="regular" />
        </motion.button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {showMenu && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              {/* Menu */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="absolute top-full right-0 mt-2 w-48 bg-card border border-border/50 shadow-[0_4px_16px_rgba(0,0,0,0.12)] rounded-lg overflow-hidden backdrop-blur-xl z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="py-1.5">
                  {/* Minimize/Maximize Option */}
                  {data.onToggleMinimize && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        data.onToggleMinimize?.(id)
                        setShowMenu(false)
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted/60 transition-colors duration-150 flex items-center gap-3"
                    >
                      {data.isMinimized ? (
                        <>
                          <ArrowsOut className="w-4 h-4 flex-shrink-0" weight="regular" />
                          <span>Maximize</span>
                        </>
                      ) : (
                        <>
                          <Minus className="w-4 h-4 flex-shrink-0" weight="regular" />
                          <span>Minimize</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Delete Option - Only for branch nodes */}
                  {!data.isMain && (
                    <>
                      <div className="h-px bg-border/50 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (data.onDeleteBranch) {
                            setShowDeleteConfirm(true)
                            setShowMenu(false)
                          }
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 flex items-center gap-3"
                        disabled={!data.onDeleteBranch}
                      >
                        <Trash className="w-4 h-4 flex-shrink-0 text-red-500 dark:text-red-400" weight="regular" />
                        <span className="font-medium">Delete Branch</span>
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        itemType="branch"
        itemName={data.label || `Branch ${id.slice(-6)}`}
        title="Delete Branch?"
        message="Are you sure you want to delete this branch? All messages in this branch will be permanently deleted. This action cannot be undone."
      />
      
      {/* Minimized State */}
      <AnimatePresence mode="wait">
        {data.isMinimized ? (
          <motion.div
            key="minimized"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col gap-3 h-full overflow-hidden"
          >
          {/* Header with title */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  data.isMain ? 'bg-primary' : 'bg-emerald-500'
                }`}></div>
                <span className="text-sm font-semibold text-foreground truncate">{data.label}</span>
              </div>
              <span className="text-xs text-muted-foreground/60">{data.messages.length} messages</span>
            </div>
            {data.showAIPill && data.selectedAIs.length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/30 flex-shrink-0">
                <span className="w-3 h-3 flex items-center justify-center opacity-80">
                  {data.selectedAIs[0].logo}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {data.selectedAIs[0].name}
                </span>
              </div>
            )}
          </div>
          
          {/* Last message preview */}
          {data.messages.length > 0 && (
            <div className="text-xs text-muted-foreground/70 leading-relaxed overflow-hidden mt-2" style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}>
              {data.messages[data.messages.length - 1].isUser ? 'You' : 'AI'}: {data.messages[data.messages.length - 1].text.substring(0, 75)}
              {data.messages[data.messages.length - 1].text.length > 75 ? '...' : ''}
            </div>
          )}
        </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full min-h-0"
          >
          {/* Context Brief Header - Show branch context for non-main nodes */}
          {!data.isMain && data.parentMessageId && data.inheritedMessages && (
            <div className="mb-4 -mx-5 -mt-5 px-5 pt-5 pb-4 bg-muted/40 border-b border-border/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitBranch className="w-4 h-4 flex-shrink-0" weight="regular" />
                <span className="font-medium">Branching from:</span>
                <span 
                  className="flex-1 truncate"
                  title={(() => {
                    const parentMsg = data.inheritedMessages.find(m => m.id === data.parentMessageId)
                    return parentMsg?.text || ''
                  })()}
                >
                  {(() => {
                    const parentMsg = data.inheritedMessages.find(m => m.id === data.parentMessageId)
                    if (!parentMsg) return 'Message...'
                    const text = parentMsg.text || ''
                    return text.length > 60 ? `${text.substring(0, 60)}...` : text
                  })()}
                </span>
              </div>
            </div>
          )}
          
          {/* Header with AI Pills - Only for main node */}
          {data.isMain && data.onAddAI && data.onRemoveAI && (
        <div className="flex items-center justify-between mb-6">
          <AIPills
            selectedAIs={data.selectedAIs}
            onAddAI={data.onAddAI}
            onRemoveAI={data.onRemoveAI}
          />
          
          {/* Multi-Model Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-muted/40 border border-border/30 rounded-lg p-0.5">
              <button
                className="px-3 py-1 rounded-md text-xs font-medium transition-all bg-background text-foreground shadow-sm"
              >
                Single
              </button>
              <button
                className="px-3 py-1 rounded-md text-xs font-medium transition-all text-muted-foreground/70 hover:text-foreground"
              >
                Multi
              </button>
            </div>
          </div>
        </div>
      )}
      
      
          {/* Chat Interface - Exactly like initial */}
          <ChatInterface
            messages={data.messages}
            onSendMessage={handleSendMessage}
            selectedAIs={data.selectedAIs}
            onBranchFromMessage={handleBranch}
            currentBranch={null}
            isGenerating={data.isGenerating}
            onStopGeneration={() => {
              // Call the stop handler if available
              if (data.onStopGeneration) {
                data.onStopGeneration(data.nodeId || id)
              }
            }}
            existingBranchesCount={data.existingBranchesCount || 0}
            // Branch-level multi-model props
            onAddAI={data.onAddAI}
            onRemoveAI={data.onRemoveAI}
            onSelectSingle={data.onSelectSingle}
            onToggleMultiModel={data.onToggleMultiModel}
            getBestAvailableModel={data.getBestAvailableModel}
            onExportImport={data.onExportImport}
            isMain={data.isMain}
            nodeId={data.nodeId || id}
          />
          </motion.div>
        )}
      </AnimatePresence>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: 'hsl(var(--border))', 
          width: 5, 
          height: 5, 
          border: '1.5px solid hsl(var(--background))',
          opacity: 0.6
        }} 
      />
    </motion.div>
  )
}
