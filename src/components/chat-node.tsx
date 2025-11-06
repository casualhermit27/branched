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
  existingBranchesCount?: number
  height?: number
  isHighlighted?: boolean
  multiModelMode?: boolean
  nodeId?: string
}

export default function ChatNode({ data, id }: { data: ChatNodeData; id: string }) {
  const handleSendMessage = (message: string) => {
    if (id === 'main') {
      // For main node, use the passed function directly (which is onSendMainMessage)
      data.onSendMessage?.(message)
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
        scale: data.isHighlighted ? 1.02 : 1,
        boxShadow: data.isHighlighted ? '0 4px 8px -2px rgba(0, 0, 0, 0.15)' : '0 2px 4px -1px rgba(0, 0, 0, 0.08)'
      }}
      transition={{ 
        duration: 0.3,
        ease: "easeInOut"
      }}
      // Allow node clicks to propagate so canvas can handle centering
      // Only stop propagation for content area clicks to avoid conflicts
      onMouseDown={(e) => {
        // Don't stop propagation here - let the canvas handle it
      }}
      className={`bg-white shadow-sm rounded-2xl border-2 border-gray-300 transition-all duration-200 ${
        data.isActive ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
      } ${data.isMinimized ? 'p-2' : 'p-6'} ${
        data.isHighlighted ? 'ring-2 ring-yellow-400 ring-opacity-75 border-yellow-400' : ''
      }`}
      style={{ 
        width: '1000px', 
        minWidth: '1000px',
        height: '750px',
        maxHeight: '750px',
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
        <button
          onClick={() => data.onToggleMinimize?.(id)}
          className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded transition-colors"
          title={data.isMinimized ? 'Restore' : 'Minimize'}
        >
          {data.isMinimized ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8 3v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V3m-8 18v-3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      )}
      
      {/* Minimized State */}
      {data.isMinimized ? (
        <div className="flex flex-col gap-3 h-full justify-center">
          {/* Header with title and message count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{data.label}</span>
              <span className="text-xs text-gray-500">({data.messages.length} messages)</span>
            </div>
            {data.showAIPill && data.selectedAIs.length > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 bg-gray-50">
                <span className="w-3 h-3 flex items-center justify-center">
                  {data.selectedAIs[0].logo}
                </span>
                <span className="text-xs font-medium text-gray-700">
                  {data.selectedAIs[0].name}
                </span>
              </div>
            )}
          </div>
          
          {/* Last message preview */}
          {data.messages.length > 0 && (
            <div className="text-xs text-gray-500 truncate">
              {data.messages[data.messages.length - 1].isUser ? 'You: ' : 'AI: '}
              {data.messages[data.messages.length - 1].text.substring(0, 80)}
              {data.messages[data.messages.length - 1].text.length > 80 ? '...' : ''}
            </div>
          )}
          
          {/* Branch indicator for non-main nodes */}
          {!data.isMain && (
            <div className="text-xs text-blue-600 font-medium">
              Branch from main conversation
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
            <span className="text-sm text-gray-600">Mode:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                className="px-3 py-1 rounded-md text-xs font-medium transition-all bg-white text-gray-900 shadow-sm"
              >
                Single
              </button>
              <button
                className="px-3 py-1 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-800"
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
