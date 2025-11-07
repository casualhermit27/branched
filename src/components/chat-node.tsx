'use client'

import { Handle, Position } from 'reactflow'
import { motion } from 'framer-motion'
import ChatInterface from './chat-interface'
import AIPills from './ai-pills'

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
  multiModelMode?: boolean
  nodeId?: string
}

export default function ChatNode({ data, id }: { data: ChatNodeData; id: string }) {
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: data.isHighlighted ? 1.01 : 1,
        y: 0
      }}
      transition={{ 
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1]
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
      className={`bg-card shadow-md rounded-2xl border border-border/80 transition-all duration-300 ${
        data.isActive ? 'ring-2 ring-blue-500/40 shadow-lg' : ''
      } ${data.isMinimized ? 'p-3' : 'p-6'} ${
        data.isHighlighted ? 'ring-2 ring-amber-400/60 border-amber-300 shadow-xl' : ''
      } hover:shadow-lg`}
      style={{ 
        width: data.isMinimized ? '280px' : '1200px', 
        minWidth: data.isMinimized ? '280px' : '1200px',
        maxWidth: data.isMinimized ? '280px' : '1200px',
        height: data.isMinimized ? 'auto' : '750px',
        maxHeight: data.isMinimized ? 'none' : '750px',
        overflow: 'hidden'
      }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: '#cbd5e1', width: 8, height: 8 }} 
      />
      
      {/* Minimize/Restore Button */}
      {data.onToggleMinimize && (
        <motion.button
          onClick={(e) => {
            e.stopPropagation()
            data.onToggleMinimize?.(id)
          }}
          className={`absolute top-3 right-3 p-2 rounded-lg transition-all duration-200 z-10 ${
            data.isMinimized 
              ? 'bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200/50' 
              : 'bg-muted hover:bg-muted/80 text-muted-foreground border border-border/50'
          } shadow-sm hover:shadow-md`}
          title={data.isMinimized ? 'Restore' : 'Minimize'}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {data.isMinimized ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V3m-8 18v-3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"/>
            </svg>
          )}
        </motion.button>
      )}
      
      {/* Minimized State */}
      {data.isMinimized ? (
        <div className="flex flex-col gap-2.5 h-full">
          {/* Header with title */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  data.isMain ? 'bg-blue-500' : 'bg-emerald-500'
                }`}></div>
                <span className="text-sm font-semibold text-foreground truncate">{data.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{data.messages.length} messages</span>
            </div>
            {data.showAIPill && data.selectedAIs.length > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-muted flex-shrink-0">
                <span className="w-3 h-3 flex items-center justify-center">
                  {data.selectedAIs[0].logo}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {data.selectedAIs[0].name}
                </span>
              </div>
            )}
          </div>
          
          {/* Last message preview */}
          {data.messages.length > 0 && (
            <div className="text-xs text-muted-foreground leading-relaxed overflow-hidden" style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}>
              <span className="font-medium">{data.messages[data.messages.length - 1].isUser ? 'You' : 'AI'}: </span>
              {data.messages[data.messages.length - 1].text.substring(0, 100)}
              {data.messages[data.messages.length - 1].text.length > 100 ? '...' : ''}
            </div>
          )}
          
          {/* Branch indicator for non-main nodes */}
          {!data.isMain && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium pt-1 border-t border-border">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 3v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V3m-8 18v-3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"/>
              </svg>
              Branch
            </div>
          )}
        </div>
      ) : (
        <>
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
            <span className="text-sm text-muted-foreground">Mode:</span>
            <div className="flex bg-muted rounded-lg p-1">
              <button
                className="px-3 py-1 rounded-md text-xs font-medium transition-all bg-background text-foreground shadow-sm"
              >
                Single
              </button>
              <button
                className="px-3 py-1 rounded-md text-xs font-medium transition-all text-muted-foreground hover:text-foreground"
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
            multiModelMode={data.multiModelMode || false}
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
        </>
      )}
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#cbd5e1', width: 8, height: 8 }} 
      />
    </motion.div>
  )
}
