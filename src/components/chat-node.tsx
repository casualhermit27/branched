'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, ArrowsOut, GitBranch, Trash, DotsThreeVertical, Link, ArrowsClockwise } from '@phosphor-icons/react'
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
  onBranch?: (
    nodeId: string,
    messageId?: string,
    isMultiBranch?: boolean,
    options?: { allowDuplicate?: boolean; branchGroupId?: string; overrideMessages?: Message[] }
  ) => void
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
  onLinkBranch?: (nodeId: string) => void
  onCompareBranch?: (nodeId: string) => void
  isSelected?: boolean
  onMessageSelect?: (messageId: string, isMultiSelect: boolean) => void
  selectedMessageIds?: Set<string>
  depth?: number
  onNavigateToMessage?: (messageId: string) => void
  isDragging?: boolean
}

function ChatNode({ data, id }: { data: ChatNodeData; id: string }) {
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
    console.log('📨 ChatNode handleSendMessage:', { nodeId: id, message, branchId })
    if (id === 'main') {
      // For main node, use the passed function directly (which is onSendMainMessage)
      data.onSendMessage?.(id, message)
    } else {
      // For branch nodes, pass the node id
      console.log('📨 Calling data.onSendMessage for branch:', id)
      data.onSendMessage?.(id, message)
    }
  }

  const handleBranch = (messageId: string, isMultiBranch: boolean = false) => {
    console.log('🔀 ChatNode handleBranch - nodeId:', id, 'messageId:', messageId, 'isMultiBranch:', isMultiBranch)
    if (data.onBranch) {
      console.log('🔀 Calling data.onBranch with overrideMessages')
      data.onBranch(id, messageId, isMultiBranch, { overrideMessages: data.messages })
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0
      }}
      transition={{
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 }
      }}
      // Handle mouse events to allow scrolling within node but prevent canvas panning
      // We now use 'nodrag' class in child components to prevent dragging while allowing selection
      className={`bg-card rounded-2xl border transition-[box-shadow,border-color,background-color] duration-300 relative ${data.isMinimized ? 'p-3' : 'p-3 md:p-0'} overflow-visible
        ${data.isSelected
          ? 'ring-2 ring-primary border-primary shadow-[0_0_0_2px_rgba(var(--primary),0.5)] z-20'
          : data.isActive
            ? 'border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/30 z-10'
            : 'border-border/40 shadow-sm hover:border-border/80 hover:shadow-md'
        }
        ${data.isHighlighted && !data.isSelected ? 'border-primary/30 shadow-2xl shadow-primary/10 ring-1 ring-primary/20' : ''}
        ${!data.isMinimized ? 'w-[calc(100vw-2rem)] md:w-[1300px] min-w-[300px] md:min-w-[1300px] max-w-full md:max-w-[1300px]' : ''}
        ${data.isDragging ? '!shadow-none' : ''} 
      `}
      style={{
        width: data.isMinimized ? '280px' : undefined,
        minWidth: data.isMinimized ? '280px' : undefined,
        maxWidth: data.isMinimized ? '280px' : undefined,
        height: data.isMinimized ? '200px' : 'auto',
        minHeight: data.isMinimized ? '200px' : '450px',
        maxHeight: data.isMinimized ? '200px' : '1200px',
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
          className="p-2 rounded-lg transition-all duration-200 bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 hover:border-border/80 shadow-md hover:shadow-lg"
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
                className="absolute top-full right-0 mt-2 w-48 bg-card border border-border/50 shadow-[0_4px_16px_rgba(0,0,0,0.12)] rounded-lg overflow-hidden z-50"
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

                  {/* Link Branch Option - Only for branch nodes */}
                  {!data.isMain && data.onLinkBranch && (
                    <>
                      <div className="h-px bg-border/50 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          data.onLinkBranch?.(id)
                          setShowMenu(false)
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted/60 transition-colors duration-150 flex items-center gap-3"
                      >
                        <Link className="w-4 h-4 flex-shrink-0" weight="regular" />
                        <span>Link Branch</span>
                      </button>
                    </>
                  )}

                  {/* Compare Branch Option - Only for branch nodes */}
                  {!data.isMain && data.onCompareBranch && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          data.onCompareBranch?.(id)
                          setShowMenu(false)
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted/60 transition-colors duration-150 flex items-center gap-3"
                      >
                        <ArrowsClockwise className="w-4 h-4 flex-shrink-0" weight="regular" />
                        <span>Compare Branch</span>
                      </button>
                    </>
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
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${data.isMain ? 'bg-primary' : 'bg-emerald-500'
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
            {/* Unified Node Header */}
            <div className="flex flex-col border-b border-border/40 bg-card rounded-t-2xl">
              {/* Top Row: AI Pills - Moved to ChatInterface Input Area */}

              {/* Bottom Row: Branch Context (if applicable) */}
              {!data.isMain && data.parentMessageId && data.inheritedMessages && (
                <div className="px-5 py-4 pr-12 bg-muted/30 border-b border-border/40 flex items-center gap-2 text-xs text-muted-foreground min-h-[56px]">
                  <GitBranch className="w-3.5 h-3.5 flex-shrink-0 opacity-70" weight="regular" />
                  <span className="font-medium opacity-70">Branched from:</span>
                  <div className="group relative flex-1 min-w-0">
                    <span
                      className="block truncate opacity-90 font-mono cursor-pointer hover:text-primary transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (data.onNavigateToMessage && data.parentMessageId) {
                          data.onNavigateToMessage(data.parentMessageId)
                        }
                      }}
                    >
                      {(() => {
                        const parentMsg = data.inheritedMessages.find(m => m.id === data.parentMessageId)
                        if (!parentMsg) return 'Message...'
                        const text = parentMsg.text || ''
                        return text.length > 60 ? `${text.substring(0, 60)}...` : text
                      })()}
                      <span className="inline-block ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                        <ArrowsOut className="w-3 h-3 inline" />
                      </span>
                    </span>

                    {/* Tooltip Popup */}
                    <div className="absolute bottom-full left-0 mb-2 w-[300px] p-3 bg-popover text-popover-foreground text-xs rounded-lg border border-border shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                      <div className="font-semibold mb-1 text-muted-foreground">Branched from:</div>
                      <div className="leading-relaxed">
                        {(() => {
                          const parentMsg = data.inheritedMessages.find(m => m.id === data.parentMessageId)
                          return parentMsg?.text || 'Message not found'
                        })()}
                      </div>
                      <div className="absolute bottom-[-5px] left-4 w-2.5 h-2.5 bg-popover border-b border-r border-border transform rotate-45"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Nested Branch Indicator - Sleek Badge */}
              {data.depth && data.depth > 1 && (
                <div className="absolute top-0 left-6 -translate-y-[calc(100%-1px)] px-3 py-1 bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 border-b-card rounded-t-lg flex items-center gap-1.5 text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold uppercase tracking-wide shadow-sm z-0">
                  <GitBranch className="w-3.5 h-3.5" weight="bold" />
                  <span>Level {data.depth}</span>
                </div>
              )}

              {/* Multi-Model Group Indicator */}
              {data.branchGroupId && (
                <div className="absolute top-0 right-12 -translate-y-[calc(100%-1px)] px-3 py-1 bg-fuchsia-100 dark:bg-fuchsia-500/20 border border-fuchsia-200 dark:border-fuchsia-500/30 border-b-card rounded-t-lg flex items-center gap-1.5 text-[11px] text-fuchsia-700 dark:text-fuchsia-300 font-semibold uppercase tracking-wide shadow-sm z-0">
                  <ArrowsOut className="w-3.5 h-3.5" weight="bold" />
                  <span>Multi-Model</span>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col min-h-0 p-5 pt-4">

              {/* Chat Interface */}
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
                getBestAvailableModel={data.getBestAvailableModel}
                onExportImport={data.onExportImport}
                isMain={data.isMain}
                nodeId={data.nodeId || id}
                onMessageSelect={data.onMessageSelect}
                selectedMessageIds={data.selectedMessageIds}
              />

            </div>
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

// Memoize the component to prevent unnecessary re-renders
export default React.memo(ChatNode)
