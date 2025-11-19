'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import FlowCanvas from '@/components/flow-canvas/index'
import AIPills from '@/components/ai-pills'
import ChatInterface from '@/components/chat-interface'
import ChatBranchesView from '@/components/chat-branches-view'
import Sidebar from '@/components/sidebar'
import ExportImportModal from '@/components/export-import-modal'
import { CommandPalette } from '@/components/command-palette'
import { useToast } from '@/components/toast'
import { ThemeToggle } from '@/components/theme-toggle'
import { BranchWarningModal } from '@/components/branch-warning-modal'
import { BranchNavigation } from '@/components/branch-navigation'
import { ArrowsIn, ArrowsOut, DotsThree } from '@phosphor-icons/react'
import { aiService, type ConversationContext } from '@/services/ai-api'
import { ConversationExport } from '@/services/conversation-export'
import { useMongoDB } from '@/hooks/use-mongodb'
import { mongoDBService } from '@/services/mongodb-service'

interface AI {
  id: string
  name: string
  color: string
  logo: React.JSX.Element
}

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: number
  parentId?: string
  children: string[]
  responses?: { [aiId: string]: string }
  aiModel?: string    // AI that generated this
  groupId?: string    // Link related multi-model responses
  isStreaming?: boolean  // Whether this message is currently streaming
  streamingText?: string // Current streaming text content
}

interface Branch {
  id: string
  title: string
  messages: Message[]
  timestamp: number
  parentBranchId?: string
}

export default function Home() {
  // Default "Best" AI model
  const defaultAI: AI = {
    id: 'best',
    name: 'Best',
    color: 'bg-gradient-to-r from-purple-100 via-indigo-100 to-blue-100 text-purple-800 border-purple-300 dark:from-purple-900/30 dark:via-indigo-900/30 dark:to-blue-900/30 dark:text-purple-300 dark:border-purple-700',
    logo: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
        <defs>
          <linearGradient id="bestGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        {/* Star shape - represents "best" */}
        <path 
          d="M12 2L14.5 8.5L21 9.5L16 14L17.5 20.5L12 17L6.5 20.5L8 14L3 9.5L9.5 8.5L12 2Z" 
          fill="url(#bestGradient)" 
          opacity="0.9"
          className="drop-shadow-sm"
        />
        {/* Inner highlight */}
        <path 
          d="M12 5L13.5 9L17 9.5L14 12L14.5 15.5L12 13.5L9.5 15.5L10 12L7 9.5L10.5 9L12 5Z" 
          fill="white" 
          opacity="0.3"
        />
      </svg>
    )
  }

  const [selectedAIs, setSelectedAIs] = useState<AI[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [currentBranch, setCurrentBranch] = useState<string>('')
  const [branches, setBranches] = useState<{ id: string }[]>([])
  const [conversationNodes, setConversationNodes] = useState<any[]>([])
  const [showExportImport, setShowExportImport] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [viewMode, setViewMode] = useState<'map' | 'chat'>('map') // 'map' for FlowCanvas, 'chat' for Chat view
  const [allNodesMinimized, setAllNodesMinimized] = useState(false) // Track if all nodes are minimized
  const minimizeAllRef = useRef<(() => void) | null>(null) // Ref to store minimize all function from FlowCanvas
  const [showMenu, setShowMenu] = useState(false) // Track menu visibility
  const menuRef = useRef<HTMLDivElement>(null) // Ref for menu container
  
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
  
  // Guard to avoid duplicate branch creation from StrictMode double effects
  const creatingBranchRef = useRef<Set<string>>(new Set())
  
  // Toast notifications
  const { addToast } = useToast()
  
  // MongoDB integration
  const {
    autoSaveConversation,
    saveConversation,
    loadConversations,
    loadConversation,
    isSaving,
    lastSaved,
    error: mongoError,
    currentConversationId
  } = useMongoDB({
    autoSave: true,
    autoSaveDelay: 2000,
    onSave: (success, error) => {
      if (success) {
        console.log('✅ Saved to MongoDB')
      } else if (error) {
        console.error('❌ MongoDB save error:', error)
        addToast({
          type: 'error',
          title: 'Save Failed',
          message: 'Could not save conversation to database.'
        })
      }
    }
  })
  
  // Track current conversation ID
  const currentConversationIdRef = useRef<string | null>(null)
  const isInitialLoadRef = useRef(true)
  
  // Sync ref with hook's conversation ID (for when a new conversation is created)
  useEffect(() => {
    if (currentConversationId && currentConversationId !== currentConversationIdRef.current) {
      console.log('🔄 Syncing conversation ID ref:', currentConversationIdRef.current, '->', currentConversationId)
      currentConversationIdRef.current = currentConversationId
    }
  }, [currentConversationId])
  

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Debug message state changes
  useEffect(() => {
    console.log('📊 Messages state changed:', messages.length, messages.map(m => ({ id: m.id, text: m.text.substring(0, 20) + '...', isUser: m.isUser })))
  }, [messages])
  
  // State for all conversations
  const [allConversations, setAllConversations] = useState<any[]>([])
  
  // Load all conversations on mount
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      
      console.log('🔍 Initial load - fetching conversations from MongoDB...')
      
      // Load conversations from MongoDB
      loadConversations().then((success) => {
        console.log('📡 Load conversations result:', success)
        if (success) {
          console.log('✅ Loaded conversations from MongoDB')
          
          // Get all conversations for history
          if (typeof window !== 'undefined') {
            console.log('🌐 Fetching conversations from API...')
            fetch('/api/conversations')
              .then(res => {
                console.log('📨 API response status:', res.status)
                return res.json()
              })
              .then(data => {
                console.log('📋 API response data:', { success: data.success, count: data.data?.length })
                
                // Store all conversations for history
                if (data.success && data.data) {
                  setAllConversations(data.data)
                  
                  // Restore most recent conversation if available AND it has content
                  if (data.data.length > 0) {
                    // Find the most recent conversation with actual content
                    const conversationWithContent = data.data.find((conv: any) => {
                      const hasMessages = (conv.mainMessages && conv.mainMessages.length > 0) || 
                                         (conv.messages && conv.messages.length > 0)
                      const hasBranches = conv.branches && conv.branches.length > 0
                      return hasMessages || hasBranches
                    })
                    
                    if (conversationWithContent) {
                      console.log('✅ Found conversation with content, restoring:', {
                        id: conversationWithContent._id,
                        messagesCount: conversationWithContent.mainMessages?.length || conversationWithContent.messages?.length || 0,
                        branchesCount: conversationWithContent.branches?.length || 0
                      })
                      restoreConversation(conversationWithContent)
                    } else {
                      console.log('⚠️ No conversations with content found, starting fresh')
                      // Don't restore empty conversations - start fresh
                    }
                  }
                } else {
                  console.log('⚠️ No conversations found in database')
                }
              })
              .catch(error => {
                console.error('❌ Error loading conversations:', error)
              })
          }
        }
      })
    }
  }, [loadConversations])
  
  // Function to restore a conversation
  const restoreConversation = (conversation: any) => {
    console.log('🔄 Restoring conversation:', conversation._id)
    console.log('📊 Conversation data:', {
      id: conversation._id,
      title: conversation.title,
      mainMessagesCount: conversation.mainMessages?.length || 0,
      branchesCount: conversation.branches?.length || 0,
      selectedAIsCount: conversation.selectedAIs?.length || 0
    })
    
    // Don't restore empty conversations
    const hasMessages = (conversation.mainMessages && conversation.mainMessages.length > 0) ||
                        (conversation.messages && conversation.messages.length > 0)
    const hasBranches = conversation.branches && conversation.branches.length > 0
    
    if (!hasMessages && !hasBranches) {
      console.log('⚠️ Skipping restore - conversation has no content')
      return
    }
    
    // Ensure conversation ID is set
    if (conversation._id) {
      currentConversationIdRef.current = conversation._id
      console.log('✅ Set conversation ID:', conversation._id)
    }
    
    // Restore ALL state immediately with complete isolation
    if (conversation.mainMessages && Array.isArray(conversation.mainMessages)) {
      console.log('📥 Raw mainMessages from API:', {
        count: conversation.mainMessages.length,
        messages: conversation.mainMessages.map((m: any) => ({
          id: m.id,
          isUser: m.isUser,
          hasText: !!m.text,
          textPreview: m.text?.substring(0, 50),
          aiModel: m.aiModel
        }))
      })
      
      // Filter out any invalid messages and ensure all have required fields
      // IMPORTANT: Don't filter by text content - AI messages might be empty but still valid
      const validMessages = conversation.mainMessages
        .filter((msg: any) => msg && msg.id) // Only require id, not text
        .map((msg: any) => ({
          ...msg,
          text: msg.text || msg.streamingText || '', // Ensure text exists
          isStreaming: false, // Clear streaming state on restore
          streamingText: undefined // Remove streaming text
        }))
      
      setMessages(validMessages)
      console.log('✅ Restored messages:', {
        total: validMessages.length,
        userMessages: validMessages.filter((m: any) => m.isUser).length,
        aiMessages: validMessages.filter((m: any) => !m.isUser).length,
        messageIds: validMessages.map((m: any) => ({ 
          id: m.id, 
          isUser: m.isUser, 
          hasText: !!m.text,
          textLength: m.text?.length || 0,
          aiModel: m.aiModel
        }))
      })
    } else {
      console.log('⚠️ No mainMessages in conversation, setting empty array')
      console.log('📊 Conversation structure:', {
        hasMainMessages: !!conversation.mainMessages,
        mainMessagesType: typeof conversation.mainMessages,
        hasMessages: !!conversation.messages,
        messagesType: typeof conversation.messages,
        keys: Object.keys(conversation)
      })
      setMessages([])
    }
    
    if (conversation.selectedAIs && conversation.selectedAIs.length > 0) {
      // Reconstruct AI objects with proper logos
      const restoredAIs = conversation.selectedAIs.map((ai: any) => {
        let logoElement: any
        
        // Restore logos based on AI ID
        if (ai.id === 'best') {
          logoElement = (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="1.5" fill="none"/>
              <path d="M8 12L10.5 9.5L15.5 14.5" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="6" cy="6" r="1" fill="#8B5CF6"/>
              <circle cx="18" cy="6" r="1" fill="#8B5CF6"/>
              <circle cx="6" cy="18" r="1" fill="#8B5CF6"/>
              <circle cx="18" cy="18" r="1" fill="#8B5CF6"/>
            </svg>
          )
        } else if (ai.id === 'gemini-2.5-pro') {
          logoElement = <img src="/logos/gemini.svg" alt="Gemini" className="w-5 h-5" />
        } else if (ai.id === 'mistral-large') {
          logoElement = <img src="/logos/mistral-ai_logo.svg" alt="Mistral" className="w-5 h-5" />
        } else {
          logoElement = <span className="text-xs font-medium">{ai.name.charAt(0)}</span>
        }
        
        return {
          id: ai.id,
          name: ai.name,
          color: ai.color,
          functional: ai.functional !== undefined ? ai.functional : true,
          logo: logoElement
        }
      })
      
      setSelectedAIs(restoredAIs)
      console.log('✅ Restored selected AIs:', restoredAIs.length)
    } else {
      console.log('⚠️ No selectedAIs in conversation')
      setSelectedAIs([defaultAI])
    }
    
    
    // Always ensure main node is included in restored nodes
    const mainNodeInBranches = conversation.branches?.find((b: any) => b.id === 'main' || b.isMain)
    
    if (conversation.branches && conversation.branches.length > 0) {
      console.log('📦 Restoring branches data:', conversation.branches.length)
      console.log('📦 Branch IDs from MongoDB:', conversation.branches.map((b: any) => ({ 
        id: b.id, 
        isMain: b.isMain || b.id === 'main',
        messagesCount: b.messages?.length || 0,
        inheritedCount: b.inheritedMessages?.length || 0,
        branchCount: b.branchMessages?.length || 0,
        hasMessages: !!(b.messages?.length),
        hasInherited: !!(b.inheritedMessages?.length),
        hasBranch: !!(b.branchMessages?.length)
      })))
      
      // Get non-main branches for UI control
      const nonMainBranches = conversation.branches.filter((b: any) => b.id !== 'main' && !b.isMain)
      console.log('📊 Non-main branches for UI:', nonMainBranches.length, 'IDs:', nonMainBranches.map((b: any) => b.id))
      
      // Always set branches for canvas view if there are any non-main branches
      if (nonMainBranches.length > 0) {
        setBranches(nonMainBranches.map((b: any) => ({ id: b.id })))
        console.log('✅ Set branches array for canvas view:', nonMainBranches.map((b: any) => b.id))
      } else {
        setBranches([])
        console.log('⚠️ No non-main branches found, branches array set to empty')
      }
      
      // Restore full conversation nodes with ALL data
      let restoredNodes = conversation.branches.map((b: any) => {
        const isMainNode = b.isMain || b.id === 'main'
        
        // Reconstruct AI objects with logos
        const restoredAIs = b.selectedAIs?.map((ai: any) => {
          // Skip if ai is a serialized React element
          if (ai.type && ai.props && ai._owner !== undefined) {
            // This is a serialized React element, skip it
            return null
          }
          
          // Reconstruct AI objects with logos
          let logoElement: any
          if (ai.id === 'best') {
            logoElement = (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                <defs>
                  <linearGradient id="bestGradientRestore" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="50%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
                {/* Star shape - represents "best" */}
                <path 
                  d="M12 2L14.5 8.5L21 9.5L16 14L17.5 20.5L12 17L6.5 20.5L8 14L3 9.5L9.5 8.5L12 2Z" 
                  fill="url(#bestGradientRestore)" 
                  opacity="0.9"
                  className="drop-shadow-sm"
                />
                {/* Inner highlight */}
                <path 
                  d="M12 5L13.5 9L17 9.5L14 12L14.5 15.5L12 13.5L9.5 15.5L10 12L7 9.5L10.5 9L12 5Z" 
                  fill="white" 
                  opacity="0.3"
                />
              </svg>
            )
          } else if (ai.id === 'gemini-2.5-pro') {
            logoElement = <img src="/logos/gemini.svg" alt="Gemini" className="w-5 h-5" />
          } else if (ai.id === 'mistral-large') {
            logoElement = <img src="/logos/mistral-ai_logo.svg" alt="Mistral" className="w-5 h-5" />
          } else {
            logoElement = <span className="text-xs font-medium">{ai.name.charAt(0)}</span>
          }
          
          return {
            id: ai.id,
            name: ai.name,
            color: ai.color,
            functional: ai.functional !== undefined ? ai.functional : true,
            logo: logoElement
          }
        }).filter((ai: any) => ai !== null) || []
        
        // CRITICAL: Ensure messages are properly restored
        // Messages can be in different places: b.messages, b.inheritedMessages + b.branchMessages
        let branchMessages: any[] = []
        let inheritedMessages: any[] = []
        
        if (isMainNode) {
          // Main node uses mainMessages
          branchMessages = (conversation.mainMessages || [])
            .filter((msg: any) => msg && msg.id && (msg.text || msg.streamingText))
            .map((msg: any) => ({
              ...msg,
              text: msg.text || msg.streamingText || '',
              isStreaming: false,
              streamingText: undefined
            }))
        } else {
          // For branches, try to get messages from multiple sources
          // IMPORTANT: Don't filter by text content - restore all messages even if empty
          if (b.messages && Array.isArray(b.messages) && b.messages.length > 0) {
            // If we have combined messages, use them
            branchMessages = b.messages
              .filter((msg: any) => msg && msg.id) // Only require id
              .map((msg: any) => ({
                ...msg,
                text: msg.text || msg.streamingText || '', // Ensure text exists
                isStreaming: false,
                streamingText: undefined
              }))
          } else if ((b.inheritedMessages && b.inheritedMessages.length > 0) || 
                     (b.branchMessages && b.branchMessages.length > 0)) {
            // Use separate inherited and branch messages
            inheritedMessages = (b.inheritedMessages || [])
              .filter((msg: any) => msg && msg.id) // Only require id
              .map((msg: any) => ({
                ...msg,
                text: msg.text || msg.streamingText || '',
                isStreaming: false,
                streamingText: undefined
              }))
            branchMessages = (b.branchMessages || [])
              .filter((msg: any) => msg && msg.id) // Only require id
              .map((msg: any) => ({
                ...msg,
                text: msg.text || msg.streamingText || '',
                isStreaming: false,
                streamingText: undefined
              }))
          }
          
          // Log branch message restoration (even if empty)
          console.log('📦 Branch messages restored:', {
            branchId: b.id,
            inheritedCount: inheritedMessages.length,
            branchCount: branchMessages.length,
            total: inheritedMessages.length + branchMessages.length,
            hasMessages: !!(b.messages?.length),
            hasInheritedMessages: !!(b.inheritedMessages?.length),
            hasBranchMessages: !!(b.branchMessages?.length)
          })
        }
        
        // Combine messages for display (inherited + branch)
        const allMessages = [...inheritedMessages, ...branchMessages]
        
        console.log('📦 Restoring branch node:', {
          id: b.id,
          isMain: isMainNode,
          inheritedCount: inheritedMessages.length,
          branchCount: branchMessages.length,
          totalMessages: allMessages.length,
          hasAIs: restoredAIs.length > 0
        })
        
        // Return proper React Flow node structure with data property
        return {
          id: b.id,
          type: 'chatNode', // React Flow requires 'chatNode' type
          position: b.position || { x: 0, y: 0 },
          data: {
            label: b.label || b.title || (isMainNode ? 'Main Conversation' : 'Branch'),
            messages: allMessages, // Combined for display
            inheritedMessages: inheritedMessages, // Separate for context
            branchMessages: branchMessages, // Separate for branch-specific messages
            selectedAIs: restoredAIs || [],
            isMain: b.isMain || b.id === 'main',
            isMinimized: b.isMinimized || false,
            showAIPill: b.showAIPill !== undefined ? b.showAIPill : !isMainNode,
            parentId: isMainNode ? undefined : (b.parentId || 'main'),
            parentMessageId: b.parentMessageId,
            contextSnapshot: b.contextSnapshot,
            nodeId: b.id,
            branchGroupId: b.branchGroupId || b.groupId // Support branch grouping
          }
        }
      })
    
    // If main node is not in branches, create it from mainMessages
    if (!mainNodeInBranches) {
      console.log('📝 Main node not in branches, creating from mainMessages')
      
      // Get main messages, ensuring they're valid
      const mainMessages = (conversation.mainMessages || [])
        .filter((msg: any) => msg && msg.id && (msg.text || msg.streamingText))
        .map((msg: any) => ({
          ...msg,
          text: msg.text || msg.streamingText || '',
          isStreaming: false,
          streamingText: undefined
        }))
      
      const mainNode = {
        id: 'main',
        type: 'chatNode', // React Flow requires 'chatNode' type
        position: { x: 400, y: 50 },
        data: {
          label: 'Main Conversation',
          messages: mainMessages,
          inheritedMessages: [],
          branchMessages: [],
          selectedAIs: conversation.selectedAIs || selectedAIs,
          isMain: true,
          isMinimized: false,
          showAIPill: false,
          parentId: undefined,
          parentMessageId: undefined,
          nodeId: 'main'
        }
      }
      restoredNodes = [mainNode, ...restoredNodes]
      console.log('✅ Added main node to restored nodes with', mainMessages.length, 'messages')
    } else {
      // Ensure main node messages are up to date
      const mainNodeIndex = restoredNodes.findIndex((n: any) => n.id === 'main' || n.data?.isMain)
      if (mainNodeIndex !== -1) {
        if (restoredNodes[mainNodeIndex].data) {
          const mainMessages = (conversation.mainMessages || [])
            .filter((msg: any) => msg && msg.id && (msg.text || msg.streamingText))
            .map((msg: any) => ({
              ...msg,
              text: msg.text || msg.streamingText || '',
              isStreaming: false,
              streamingText: undefined
            }))
          restoredNodes[mainNodeIndex].data.messages = mainMessages
          console.log('✅ Updated main node messages in restored nodes:', mainMessages.length)
        }
      }
    }
      
      setConversationNodes(restoredNodes)
      
      console.log('✅ Restored conversationNodes:', {
        totalNodes: restoredNodes.length,
        branches: restoredNodes.filter((n: any) => !n.isMain && n.id !== 'main').length,
        branchDetails: restoredNodes.filter((n: any) => !n.isMain && n.id !== 'main').map((n: any) => ({
          id: n.id,
          type: n.type,
          parentId: n.parentId,
          messagesCount: n.messages?.length || 0,
          title: n.title
        })),
        withMessages: restoredNodes.filter((n: any) => n.messages?.length > 0).length,
        withAIs: restoredNodes.filter((n: any) => n.selectedAIs?.length > 0).length
      })
    } else {
      console.log('⚠️ No branches in conversation')
      // Create main node even if no branches
      const mainMessages = (conversation.mainMessages || [])
        .filter((msg: any) => msg && msg.id && (msg.text || msg.streamingText))
        .map((msg: any) => ({
          ...msg,
          text: msg.text || msg.streamingText || '',
          isStreaming: false,
          streamingText: undefined
        }))
      
      const mainNode = {
        id: 'main',
        type: 'chatNode', // Use chatNode type for consistency
        position: { x: 400, y: 50 },
        data: {
          label: 'Main Conversation',
          messages: mainMessages,
          inheritedMessages: [],
          branchMessages: [],
          selectedAIs: conversation.selectedAIs || selectedAIs,
          isMain: true,
          isMinimized: false,
          showAIPill: false,
          parentId: undefined,
          parentMessageId: undefined,
          nodeId: 'main'
        }
      }
      setBranches([])
      setConversationNodes([mainNode])
      console.log('✅ Created main node for conversation without branches with', mainMessages.length, 'messages')
    }
    
    // Reset current branch when switching conversations
    setCurrentBranch(null)
    console.log('🔄 Reset current branch for new conversation')
    
    currentConversationIdRef.current = conversation._id
    console.log('✅ Restored conversation ID:', currentConversationIdRef.current)
  }
  
  // MongoDB: Auto-save conversation whenever state changes
  useEffect(() => {
    // Save whenever we have messages OR conversation nodes (for branch preservation)
    // But only save if we have actual content (not just empty arrays)
    const hasMessages = messages.length > 0 && messages.some((m: any) => m.text || m.streamingText)
    const hasNodes = conversationNodes.length > 0 && conversationNodes.some((n: any) => {
      const nodeMessages = n.data?.messages || n.messages || []
      return nodeMessages.length > 0
    })
    const hasBranches = branches.length > 0
    
    const shouldSave = !isInitialLoadRef.current && (hasMessages || hasNodes || hasBranches)
    
    if (shouldSave) {
      // Use a small delay to ensure React has finished batching state updates
      // This is especially important when branches are just created
      const timeoutId = setTimeout(() => {
      console.log('💾 Preparing to save conversation:', {
        messages: messages.length,
        selectedAIs: selectedAIs.length,
        conversationNodes: conversationNodes.length,
        branches: branches.length,
        currentBranchId: currentConversationIdRef.current
      })
      
      // Always include the main branch in conversationNodes
      let allNodes = [...conversationNodes]
      
      console.log('🔍 Current conversationNodes:', {
        count: allNodes.length,
        nodes: allNodes.map(n => ({ 
          id: n.id, 
          type: n.type,
          parentId: n.parentId,
          isMain: n.isMain,
          messages: n.messages?.length || 0 
        }))
      })
      console.log('🔍 Current branches array:', {
        count: branches.length,
        ids: branches.map(b => b.id)
      })
      
      // Log branches in conversationNodes
      const branchesInConversationNodes = allNodes.filter(n => !n.isMain && n.id !== 'main')
      console.log('🔍 Branches in conversationNodes:', {
        count: branchesInConversationNodes.length,
        branchIds: branchesInConversationNodes.map(n => n.id),
        branchTypes: branchesInConversationNodes.map(n => ({ id: n.id, type: n.type, parentId: n.parentId }))
      })
      
      // FlowCanvas is the single source of truth - no placeholder nodes
      
      const hasMainNode = allNodes.some(node => node.id === 'main')
      
      if (!hasMainNode) {
        allNodes.push({
          id: 'main',
          type: 'main',
          title: 'Main Conversation',
          messages: messages,
          timestamp: Date.now(),
          parentId: undefined,
          children: [],
          isActive: !currentBranch,
          selectedAIs: selectedAIs,
          isMain: true,
          position: { x: 0, y: 0 }
        })
      }
      
      // Helper function to ensure messages have required fields
      const sanitizeMessages = (msgs: any[]) => {
        if (!msgs || !Array.isArray(msgs)) return []
        
        return msgs
          .filter(msg => msg && typeof msg === 'object' && msg.id) // Only require id - don't filter by text
          .map(msg => {
            // Use streamingText if text is empty (for messages still streaming)
            const finalText = msg.text || msg.streamingText || ''
            
            const sanitized = {
              ...msg,
              text: finalText, // Always ensure text field exists
              isStreaming: false, // Mark as not streaming when saving
              streamingText: undefined // Remove streaming text
            }
            
            // Clean up: remove undefined values and ensure required fields
            Object.keys(sanitized).forEach(key => {
              if (sanitized[key] === undefined) {
                delete sanitized[key]
              }
            })
            
            return sanitized
          })
      }
      
      // Convert conversationNodes to proper branch format for MongoDB
      const branchesForSave = allNodes.map(node => {
        const isMainNode = node.id === 'main' || node.isMain
        // CRITICAL FIX: Nodes can have messages in different places:
        // 1. node.data.messages (React Flow format - combined for display)
        // 2. node.messages (flattened format from updateConversationNodes)
        // 3. node.data.inheritedMessages + node.data.branchMessages (separate context)
        // For branches, we need to combine inherited + branch messages for saving
        let nodeMessages: any[] = []
        if (isMainNode) {
          nodeMessages = messages
        } else {
          // For branches, combine inheritedMessages + branchMessages
          const inheritedMessages = node.data?.inheritedMessages || node.inheritedMessages || []
          const branchMessages = node.data?.branchMessages || node.branchMessages || []
          
          // If we have separate inherited and branch messages, combine them
          if (inheritedMessages.length > 0 || branchMessages.length > 0) {
            nodeMessages = [...inheritedMessages, ...branchMessages]
          } else {
            // Fallback to combined messages if separate ones don't exist
            nodeMessages = node.data?.messages || node.messages || []
          }
        }
        
        console.log('🔍 Processing node for save:', {
          id: node.id,
          isMain: isMainNode,
          hasData: !!node.data,
          hasDataMessages: !!(node.data?.messages),
          hasNodeMessages: !!(node.messages),
          messagesCount: nodeMessages.length,
          hasInheritedMessages: !!(node.data?.inheritedMessages || node.inheritedMessages),
          hasBranchMessages: !!(node.data?.branchMessages || node.branchMessages),
          messageIds: nodeMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 20) }))
        })
        
        // Try to find parentMessageId from various sources
        let parentMessageId = node.data?.parentMessageId || node.parentMessageId || node.nodeData?.parentMessageId
        
        // If no parentMessageId, try to infer it from the node's first message
        if (!parentMessageId && !isMainNode && nodeMessages.length > 0) {
          // Find the first user message in the branch to get its parent
          const firstUserMessage = nodeMessages.find((m: any) => m.isUser)
          if (firstUserMessage?.parentId) {
            parentMessageId = firstUserMessage.parentId
          }
        }
        
        // If still no parentMessageId, try to find it from inheritedMessages
        if (!parentMessageId && !isMainNode) {
          const inherited = node.data?.inheritedMessages || node.inheritedMessages || []
          if (inherited.length > 0) {
            // The last message in inheritedMessages is likely the parent
            const lastInherited = inherited[inherited.length - 1]
            parentMessageId = lastInherited.id
            console.log('🔍 Inferred parentMessageId from inheritedMessages:', parentMessageId)
          }
        }
        
        // Validate parentId - it should never be the node's own ID
        let finalParentId = node.parentId || node.data?.parentId
        if (!isMainNode && finalParentId === node.id) {
          console.error('❌ Invalid parentId - equals node id:', node.id, 'Setting to main as fallback')
          finalParentId = 'main'
        }
        if (!isMainNode && !finalParentId) {
          finalParentId = 'main' // Fallback for branches without parentId
        }
        
        // For branches, preserve both combined messages AND separate inherited/branch messages
        // This ensures we can restore correctly regardless of how the data is structured
        const inheritedMessages = isMainNode ? undefined : sanitizeMessages(node.data?.inheritedMessages || node.inheritedMessages || [])
        const branchMessages = isMainNode ? undefined : sanitizeMessages(node.data?.branchMessages || node.branchMessages || [])
        const combinedMessages = sanitizeMessages(nodeMessages)
        
        return {
          id: node.id,
          label: node.title || node.data?.label || 'Untitled',
          parentId: isMainNode ? undefined : finalParentId,
          parentMessageId: isMainNode ? undefined : parentMessageId, // ONLY trust FlowCanvas
          inheritedMessages: inheritedMessages, // Separate inherited messages for branches
          branchMessages: branchMessages, // Separate branch-specific messages
          messages: combinedMessages, // Combined messages for compatibility
          selectedAIs: isMainNode ? selectedAIs : (node.selectedAIs || node.data?.selectedAIs || []),
          isMinimized: node.isMinimized || node.data?.isMinimized || false,
          isActive: node.id === currentBranch,
          isGenerating: node.data?.isGenerating || false,
          isHighlighted: node.data?.isHighlighted || false,
          position: node.position || node.data?.position || { x: 0, y: 0 },
          isMain: isMainNode,
          branchGroupId: node.data?.branchGroupId || node.branchGroupId // Preserve branch grouping
        }
      })
      
      console.log('📦 Branches to save (after conversion):', branchesForSave.map(b => ({
        id: b.id,
        isMain: b.isMain,
        type: b.isMain ? 'main' : 'branch',
        parentId: b.parentId,
        parentMessageId: b.parentMessageId,
        messagesCount: b.messages?.length || 0,
        label: b.label,
        hasInheritedMessages: !!(b.inheritedMessages?.length),
        hasBranchMessages: !!(b.branchMessages?.length)
      })))
      
      // Filter out main node from branches - main should not be in branches array
      const branchesOnly = branchesForSave.filter(b => {
        const isNotMain = !b.isMain && b.id !== 'main'
        if (!isNotMain) {
          console.log('🔍 Filtering out main node:', { id: b.id, isMain: b.isMain })
        }
        return isNotMain
      })
      
      console.log('🔍 After filtering main nodes:', {
        beforeFilter: branchesForSave.length,
        afterFilter: branchesOnly.length,
        filteredOut: branchesForSave.length - branchesOnly.length
      })
      
      // Log branches that might have issues, but don't filter them out - let MongoDB handle validation
      const branchesWithIssues = branchesOnly.filter(b => !b.parentMessageId || b.parentMessageId === 'unknown')
      if (branchesWithIssues.length > 0) {
        console.warn('⚠️ Branches with missing or inferred parentMessageId:', branchesWithIssues.map(b => ({ 
          id: b.id, 
          label: b.label,
          parentMessageId: b.parentMessageId,
          hasInheritedMessages: !!(b.inheritedMessages?.length),
          hasMessages: !!(b.messages?.length)
        })))
      }
      
      console.log('📦 Non-main branches to save:', {
        count: branchesOnly.length,
        branches: branchesOnly.map(b => ({
          id: b.id,
          type: 'branch',
          parentId: b.parentId,
          parentMessageId: b.parentMessageId,
          messagesCount: b.messages?.length || 0,
          label: b.label
        }))
      })
      
      console.log('📦 Saving branches to MongoDB:', {
        count: branchesOnly.length,
        ids: branchesOnly.map(b => b.id),
        hasMain: branchesForSave.some(b => b.id === 'main'),
        nonMainCount: branchesOnly.length
      })
      
      // CRITICAL: Save main messages separately from branch messages
      // mainMessages should ONLY contain the main conversation messages (including AI responses)
      // Save ALL messages (user and AI) - don't filter by content as AI responses might be empty during streaming
      const mainMessagesToSave = sanitizeMessages(messages).filter((msg: any) => 
        msg && msg.id && (msg.text || msg.streamingText)
      )
      
      console.log('📦 Messages to save:', {
        totalInState: messages.length,
        rawMessages: messages.map((m: any) => ({
          id: m.id,
          isUser: m.isUser,
          hasText: !!m.text,
          textLength: m.text?.length || 0,
          hasStreamingText: !!m.streamingText,
          textPreview: m.text?.substring(0, 50)
        })),
        afterSanitize: sanitizeMessages(messages).length,
        afterFilter: mainMessagesToSave.length,
        userMessages: mainMessagesToSave.filter((m: any) => m.isUser).length,
        aiMessages: mainMessagesToSave.filter((m: any) => !m.isUser).length,
        messageDetails: mainMessagesToSave.map((m: any) => ({
          id: m.id,
          isUser: m.isUser,
          hasText: !!m.text,
          textLength: m.text?.length || 0,
          hasStreamingText: !!m.streamingText,
          textPreview: m.text?.substring(0, 50)
        }))
      })
      
      // Don't save if we have no valid messages and no branches
      if (mainMessagesToSave.length === 0 && branchesOnly.length === 0) {
        console.log('⚠️ Skipping save - no valid messages or branches to save')
        return
      }
      
      console.log('📦 Preparing to save:', {
        mainMessagesCount: mainMessagesToSave.length,
        mainMessages: mainMessagesToSave.map((m: any) => ({ 
          id: m.id, 
          isUser: m.isUser, 
          hasText: !!m.text,
          textLength: m.text?.length || 0,
          textPreview: m.text?.substring(0, 50),
          aiModel: m.aiModel
        })),
        branchesCount: branchesOnly.length,
        branchesWithMessages: branchesOnly.filter(b => (b.messages?.length || 0) > 0).length,
        allBranchIds: branchesOnly.map(b => b.id)
      })
      
      // Ensure branches have their messages properly structured
      const branchesWithMessages = branchesOnly.map((branch: any) => {
        // Ensure messages array exists and is properly formatted
        const branchMessages = branch.messages || []
        const inheritedMessages = branch.inheritedMessages || []
        const branchOnlyMessages = branch.branchMessages || []
        
        // If we have separate inherited and branch messages, use them
        // Otherwise use the combined messages array
        const finalMessages = (inheritedMessages.length > 0 || branchOnlyMessages.length > 0)
          ? [...inheritedMessages, ...branchOnlyMessages]
          : branchMessages
        
        return {
          ...branch,
          messages: sanitizeMessages(finalMessages), // Ensure messages are sanitized
          inheritedMessages: sanitizeMessages(inheritedMessages),
          branchMessages: sanitizeMessages(branchOnlyMessages)
        }
      })
      
      console.log('📦 Branches with messages:', branchesWithMessages.map((b: any) => ({
        id: b.id,
        messagesCount: b.messages?.length || 0,
        inheritedCount: b.inheritedMessages?.length || 0,
        branchCount: b.branchMessages?.length || 0
      })))
      
      console.log('🔄 Before convertAppStateToMongoDB:', {
        mainMessagesToSaveCount: mainMessagesToSave.length,
        mainMessagesToSave: mainMessagesToSave.map((m: any) => ({
          id: m.id,
          isUser: m.isUser,
          textLength: m.text?.length || 0,
          textPreview: m.text?.substring(0, 50),
          aiModel: m.aiModel
        })),
        branchesWithMessagesCount: branchesWithMessages.length,
        branchIds: branchesWithMessages.map((b: any) => b.id),
        branchDetails: branchesWithMessages.map((b: any) => ({
          id: b.id,
          messagesCount: b.messages?.length || 0,
          inheritedCount: b.inheritedMessages?.length || 0,
          branchCount: b.branchMessages?.length || 0
        }))
      })
      
      const conversationData = mongoDBService.convertAppStateToMongoDB({
        title: 'Conversation',
        messages: mainMessagesToSave, // ONLY main conversation messages
        selectedAIs,
        branches: branchesWithMessages, // Branches with their own messages
        contextLinks: [],
        collapsedNodes: [],
        minimizedNodes: [],
        activeNodeId: currentBranch || undefined,
        viewport: { x: 0, y: 0, zoom: 1 }
      })
      
      console.log('🔄 After convertAppStateToMongoDB:', {
        mainMessagesCount: conversationData.mainMessages?.length || 0,
        mainMessages: conversationData.mainMessages?.map((m: any) => ({
          id: m.id,
          isUser: m.isUser,
          textLength: m.text?.length || 0,
          textPreview: m.text?.substring(0, 50),
          aiModel: m.aiModel
        })) || [],
        branchesCount: conversationData.branches?.length || 0,
        branchIds: conversationData.branches?.map((b: any) => b.id) || [],
        branchDetails: conversationData.branches?.map((b: any) => ({
          id: b.id,
          messagesCount: b.messages?.length || 0,
          inheritedCount: b.inheritedMessages?.length || 0,
          branchCount: b.branchMessages?.length || 0
        })) || []
      })
      
      console.log('📤 Calling autoSaveConversation with:', {
        messages: conversationData.mainMessages?.length || 0,
        selectedAIs: conversationData.selectedAIs?.length || 0,
        branches: conversationData.branches?.length || 0
      })
      
      // Detailed logging of branches being saved
      if (conversationData.branches && conversationData.branches.length > 0) {
        console.log('📦 Branch details being saved:', conversationData.branches.map(b => ({
          id: b.id,
          label: b.label,
          messagesCount: b.messages?.length || 0,
          selectedAIsCount: b.selectedAIs?.length || 0,
          isMain: b.isMain
        })))
        
        // Safe logging: sanitize branches before stringifying to avoid circular reference errors
        try {
          const sanitizedBranches = conversationData.branches.map(b => ({
            id: b.id,
            label: b.label,
            parentId: b.parentId,
            messages: b.messages?.map((m: any) => ({
              id: m.id,
              text: m.text?.substring(0, 100),
              isUser: m.isUser,
              aiModel: m.aiModel,
              timestamp: m.timestamp
            })) || [],
            selectedAIs: b.selectedAIs?.map((ai: any) => ({
              id: ai.id,
              name: ai.name,
              color: ai.color,
              functional: ai.functional
              // Exclude logo and other React components
            })) || [],
            isMain: b.isMain,
            position: b.position
          }))
          console.log('📦 Full branch data being saved:', JSON.stringify(sanitizedBranches, null, 2))
        } catch (error) {
          console.log('📦 Full branch data being saved (sanitized):', conversationData.branches.map(b => ({
            id: b.id,
            label: b.label,
            messagesCount: b.messages?.length || 0,
            selectedAIsCount: b.selectedAIs?.length || 0
          })))
        }
      } else {
        console.warn('⚠️ No branches in conversationData!')
      }
      
      // Save to MongoDB only
      // Save conversation - if ID doesn't exist, it will create a new one
      // Note: autoSaveConversation doesn't return a promise, but saveConversation does
      // We'll handle ID updates in the onSave callback
      const conversationIdToSave = currentConversationIdRef.current
      
      console.log('💾 Calling autoSaveConversation with conversationData:', {
        branchesCount: conversationData.branches?.length || 0,
        branchIds: conversationData.branches?.map((b: any) => b.id) || [],
        messagesCount: conversationData.mainMessages?.length || 0,
        messageDetails: conversationData.mainMessages?.map((m: any) => ({
          id: m.id,
          isUser: m.isUser,
          textLength: m.text?.length || 0
        })) || [],
        conversationId: conversationIdToSave,
        isNewConversation: !conversationIdToSave
      })
      
      // Ensure each conversation saves to its own document
      // If no conversation ID exists, it will create a new one
      // If conversation ID exists, it will update that specific conversation
      autoSaveConversation(conversationData, conversationIdToSave || undefined)
      }, 100) // Small delay to ensure React state updates are complete
      
      return () => clearTimeout(timeoutId)
    }
  }, [messages, selectedAIs, conversationNodes, currentBranch, branches, autoSaveConversation])

  // Auto-select "Best" AI if no AIs are selected
  useEffect(() => {
    if (selectedAIs.length === 0) {
      setSelectedAIs([defaultAI])
    }
  }, [selectedAIs.length])

  // Function to get the best available model for "Best" AI
  const getBestAvailableModel = (): string => {
    // Priority order: fastest and most reliable models first
    if (aiService.isModelAvailable('gemini')) {
      return 'gemini' // Gemini 2.0 Flash is very fast
    }
    if (aiService.isModelAvailable('mistral')) {
      return 'mistral' // Mistral is also fast
    }
    // If no models are available, return a fallback
    return 'gpt-4'
  }

  const [activeBranchId, setActiveBranchId] = useState<string | null>('main')

  const addAI = (ai: AI) => {
    if (!selectedAIs.find(selected => selected.id === ai.id)) {
      setSelectedAIs([...selectedAIs, ai])
    }
  }

  const removeAI = (aiId: string) => {
    // Prevent removing all AIs - keep at least one
    if (selectedAIs.length > 1) {
      setSelectedAIs(selectedAIs.filter(ai => ai.id !== aiId))
    }
  }

  // Handle conversation import
  const handleImportConversation = (importData: ConversationExport) => {
    try {
      // Import messages
      if (importData.conversation.messages) {
        setMessages(importData.conversation.messages)
      }
      
      // Import branches
      if (importData.conversation.branches) {
        setBranches(importData.conversation.branches)
      }
      
      // Import conversation nodes
      if (importData.conversation.nodes) {
        setConversationNodes(importData.conversation.nodes)
      }
      
      console.log('✅ Conversation imported successfully:', importData.metadata)
    } catch (error) {
      console.error('❌ Failed to import conversation:', error)
    }
  }
  
  const selectSingleAI = (ai: AI) => {
    setSelectedAIs([ai])
  }
  
  // Generate a smart title for a branch based on first user message
  const generateBranchTitle = (messages: Message[]) => {
    const firstUserMessage = messages.find(m => m.isUser)
    if (firstUserMessage) {
      // Truncate to reasonable length
      return firstUserMessage.text.length > 40 
        ? firstUserMessage.text.substring(0, 40) + '...' 
        : firstUserMessage.text
    }
    return 'New conversation'
  }
  
  // Save current conversation as a branch
  const saveCurrentBranch = () => {
    if (messages.length === 0) return
    
    const branchId = `branch-${Date.now()}`
    const newBranch: Branch = {
      id: branchId,
      title: generateBranchTitle(messages),
      messages: [...messages],
      timestamp: Date.now(),
      parentBranchId: activeBranchId
    }
    
    setSavedBranches(prev => [...prev, newBranch])
    setActiveBranchId(branchId)
  }
  
  // Handle selecting a branch from sidebar
  const handleSelectBranch = (branchId: string) => {
    console.log('📍 handleSelectBranch called with branchId:', branchId)
    console.log('📍 Available conversationNodes:', conversationNodes.map(n => ({ id: n.id, type: n.type })))
    
    // Find the branch in conversationNodes (these are the actual FlowCanvas nodes)
    const branchNode = conversationNodes.find(n => n.id === branchId)
    
    if (branchNode) {
      console.log('📍 Found branch node:', branchNode.id)
      // Just set the active branch ID - FlowCanvas will handle navigation
      setActiveBranchId(branchId)
    } else {
      // Fallback: try to find in savedBranches
      const branch = savedBranches.find(b => b.id === branchId)
      if (branch) {
        console.log('📍 Found branch in savedBranches:', branch.id)
        setMessages(branch.messages)
        setActiveBranchId(branchId)
      } else {
        console.warn('⚠️ Branch not found:', branchId)
      }
    }
  }
  
  // Handle deleting a branch
  const handleDeleteBranch = async (branchId: string) => {
    try {
      // Don't allow deleting main branch
      if (branchId === 'main') {
        addToast({
          type: 'error',
          title: 'Cannot Delete',
          message: 'Cannot delete the main conversation.'
        })
        return
      }

      // Remove from conversationNodes
      setConversationNodes(prev => {
        const updated = prev.filter(n => n.id !== branchId)
        
        // Also delete from MongoDB if it's a saved conversation
        if (currentConversationIdRef.current) {
          // Use setTimeout to ensure state update happens first
          setTimeout(async () => {
            try {
              const response = await fetch(`/api/conversations/${currentConversationIdRef.current}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  branches: updated
                    .filter(n => n.id !== 'main' && !n.isMain)
                    .map(n => ({
                      id: n.id,
                      label: n.title || 'Branch',
                      messages: n.messages || [],
                      inheritedMessages: n.inheritedMessages || [],
                      branchMessages: n.branchMessages || [],
                      parentId: n.parentId,
                      parentMessageId: n.parentMessageId,
                      selectedAIs: n.selectedAIs || [],
                      isMain: n.isMain || false,
                      position: n.position || { x: 0, y: 0 }
                    }))
                })
              })
              
              if (!response.ok) {
                console.error('Failed to update conversation in MongoDB')
              }
            } catch (error) {
              console.error('Error updating MongoDB:', error)
            }
          }, 100)
        }
        
        return updated
      })
      
      // Remove from local state
      setSavedBranches(prev => prev.filter(b => b.id !== branchId))
      
      // If this was the active branch, switch to main
      if (activeBranchId === branchId) {
        setActiveBranchId('main')
        setCurrentBranch(null)
      }
      
      addToast({
        type: 'success',
        title: 'Deleted',
        message: 'Branch deleted successfully.'
      })
    } catch (error) {
      console.error('Error deleting branch:', error)
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Could not delete branch.'
      })
    }
  }
  
  // Create new conversation
  const handleCreateNewConversation = async () => {
    console.log('🆕 Creating completely new conversation...')
    
    // COMPLETE STATE RESET - Ensure everything is cleared
    setMessages([])
    setSelectedAIs([defaultAI])
    setBranches([])
    setConversationNodes([])
    setCurrentBranch(null)
    setActiveBranchId(null)
    setViewMode('map')
    
    // Clear all refs and caches
    currentConversationIdRef.current = null
    branchCacheRef.current.clear()
    creatingBranchRef.current.clear()
    
    console.log('🧹 Cleared all state and refs for new conversation')
    
    // Create new conversation in MongoDB with unique ID
    try {
      const uniqueTitle = `New Conversation ${new Date().toLocaleString()}`
      
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uniqueTitle,
          mainMessages: [],
          selectedAIs: [{ 
            id: defaultAI.id, 
            name: defaultAI.name, 
            color: defaultAI.color,
            functional: true
          }],
          branches: [{
            id: 'main',
            label: 'Main Conversation',
            messages: [],
            selectedAIs: [{ 
              id: defaultAI.id, 
              name: defaultAI.name, 
              color: defaultAI.color,
              functional: true
            }],
            isMain: true,
            position: { x: 0, y: 0 }
          }],
          viewport: { x: 0, y: 0, zoom: 1 }
        })
      })
      
      const data = await response.json()
      
      if (data.success && data.data?._id) {
        // Set the new conversation ID immediately
        const newConversationId = data.data._id
        currentConversationIdRef.current = newConversationId
        
        console.log('✅ Created new conversation with unique ID:', newConversationId)
        console.log('📊 Conversation details:', {
          id: newConversationId,
          title: data.data.title,
          createdAt: data.data.createdAt,
          branchesCount: data.data.branches?.length || 0
        })
        
        // Initialize with main node only
        const mainNode = {
          id: 'main',
          type: 'main',
          title: 'Main Conversation',
          messages: [],
          timestamp: Date.now(),
          parentId: undefined,
          children: [],
          isActive: false,
          selectedAIs: [defaultAI],
          isMain: true,
          isMinimized: false,
          showAIPill: false,
          position: { x: 400, y: 50 },
          nodeData: {},
          parentMessageId: undefined,
          inheritedMessages: [],
          branchMessages: []
        }
        
        setConversationNodes([mainNode])
        
        // Refresh conversation list
        const conversationsResponse = await fetch('/api/conversations')
        const conversationsData = await conversationsResponse.json()
        
        if (conversationsData.success) {
          setAllConversations(conversationsData.data)
        }
        
        // Show success toast
        addToast({
          type: 'success',
          title: 'New Conversation',
          message: `Created a new conversation (${newConversationId.slice(-8)})`
        })
      } else {
        console.error('❌ Error creating conversation:', data.error)
        addToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to create new conversation'
        })
      }
    } catch (error) {
      console.error('❌ Error creating conversation:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to create new conversation'
      })
    }
  }
  
  // Select conversation from history
  const handleSelectConversation = async (conversationId: string) => {
    try {
      console.log('🔄 Switching to conversation:', conversationId)
      
      // Clear all state first to ensure isolation
      setMessages([])
      setBranches([])
      setConversationNodes([])
      setCurrentBranch(null)
      setActiveBranchId(null)
      
      // Clear all refs and caches for complete isolation
      branchCacheRef.current.clear()
      creatingBranchRef.current.clear()
      
      console.log('🧹 Cleared all state for conversation switch')
      
      // Get conversation by ID
      const response = await fetch(`/api/conversations/${conversationId}`)
      const data = await response.json()
      
      if (data.success && data.data) {
        // Set conversation ID immediately
        currentConversationIdRef.current = conversationId
        
        console.log('✅ Loaded conversation from API:', {
          id: conversationId,
          title: data.data.title,
          messagesCount: data.data.mainMessages?.length || 0,
          branchesCount: data.data.branches?.length || 0,
          hasMainMessages: !!data.data.mainMessages,
          mainMessagesType: typeof data.data.mainMessages,
          mainMessagesIsArray: Array.isArray(data.data.mainMessages),
          firstMessage: data.data.mainMessages?.[0],
          allMessageTypes: data.data.mainMessages?.map((m: any) => ({ 
            id: m.id, 
            isUser: m.isUser, 
            hasText: !!m.text,
            textLength: m.text?.length || 0
          }))
        })
        
        // Log full conversation structure for debugging
        console.log('📊 Full conversation data structure:', {
          keys: Object.keys(data.data),
          mainMessagesCount: data.data.mainMessages?.length || 0,
          mainMessages: data.data.mainMessages?.map((m: any) => ({
            id: m.id,
            isUser: m.isUser,
            textLength: m.text?.length || 0,
            textPreview: m.text?.substring(0, 50)
          })) || [],
          branchesCount: data.data.branches?.length || 0,
          branches: data.data.branches?.map((b: any) => ({
            id: b.id,
            isMain: b.isMain || b.id === 'main',
            messagesCount: b.messages?.length || 0,
            inheritedCount: b.inheritedMessages?.length || 0,
            branchCount: b.branchMessages?.length || 0,
            hasMessages: !!(b.messages?.length),
            hasInherited: !!(b.inheritedMessages?.length),
            hasBranch: !!(b.branchMessages?.length)
          })) || []
        })
        
        // Restore conversation with complete isolation
        restoreConversation(data.data)
        
        // Show success toast
        addToast({
          type: 'success',
          title: 'Conversation Loaded',
          message: `Loaded: ${data.data.title || 'Conversation'}`
        })
        
        // Canvas will automatically show if branches exist
        // The UI condition is: branches.length === 0 ? Simple Layout : Flow Canvas
      } else {
        console.error('❌ Error loading conversation:', data.error)
        addToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to load conversation'
        })
      }
    } catch (error) {
      console.error('❌ Error loading conversation:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load conversation'
      })
    }
  }
  
  // Delete conversation
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      console.log('🗑️ Deleting conversation:', conversationId)
      
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Conversation deleted from MongoDB')
        
        // Remove from local state immediately for instant UI update
        setAllConversations(prev => prev.filter(conv => conv._id !== conversationId))
        
        // If deleted the current conversation, reset to blank state
        if (currentConversationIdRef.current === conversationId) {
          console.log('🔄 Current conversation deleted, resetting to blank state')
          
          // Reset all state to blank
          setMessages([])
          setSelectedAIs([defaultAI])
          setBranches([])
          setConversationNodes([])
          setCurrentBranch(null)
          currentConversationIdRef.current = null
          
          // Get the updated conversation list
          const conversationsResponse = await fetch('/api/conversations')
          const conversationsData = await conversationsResponse.json()
          
          if (conversationsData.success) {
            setAllConversations(conversationsData.data)
          }
          
          return // Exit early to avoid duplicate API calls
        }
        
        // Refresh conversation list from API as well to ensure consistency
        const conversationsResponse = await fetch('/api/conversations')
        const conversationsData = await conversationsResponse.json()
        
        if (conversationsData.success) {
          console.log('✅ Refreshed conversation list from API')
          setAllConversations(conversationsData.data)
        }
        
        // Show success toast
        addToast({
          type: 'success',
          title: 'Conversation Deleted',
          message: 'Successfully deleted conversation'
        })
      } else {
        console.error('❌ Error deleting conversation:', data.error)
        addToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete conversation'
        })
      }
    } catch (error) {
      console.error('❌ Error deleting conversation:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete conversation'
      })
    }
  }

  // Branch cache to prevent duplicates
  const branchCacheRef = useRef<Map<string, string>>(new Map()) // messageId -> branchId
  
  // Function to update conversation nodes from flow canvas (with memoization)
  const updateConversationNodes = useCallback((nodes: any[]) => {
    console.log('🔄 updateConversationNodes called with', nodes.length, 'nodes')
    
    if (!nodes || nodes.length === 0) {
      console.warn('⚠️ updateConversationNodes called with empty or invalid nodes array!', nodes)
      return
    }
    
    console.log('🔄 Node IDs from FlowCanvas:', nodes.map(n => ({ 
      id: n.id, 
      type: n.type,
      parentId: n.data?.parentId,
      parentMessageId: n.data?.parentMessageId,
      hasMessages: !!(n.data?.messages?.length),
      messagesCount: n.data?.messages?.length || 0
    })))
    
    // Update branch cache when nodes are updated
    nodes.forEach(node => {
      if (node.data?.parentMessageId && node.id !== 'main' && !node.data?.isMain) {
        const oldBranchId = branchCacheRef.current.get(node.data.parentMessageId)
        if (oldBranchId !== node.id) {
          branchCacheRef.current.set(node.data.parentMessageId, node.id)
          console.log('📦 Updated branch cache:', node.data.parentMessageId, '->', node.id)
          
          // Show toast notification for new branch
          if (!oldBranchId) {
            addToast({
              type: 'success',
              title: 'Branch Created',
              message: `Branch created successfully`
            })
          }
        }
      }
    })
    
    // Only update if nodes have actually changed
    const newConversationNodes = nodes.map(node => {
      // Do NOT infer or guess missing parents — trust ReactFlow (FlowCanvas) node data exactly.
      const isMainNode = node.id === 'main' || node.data?.isMain
      const parentId = node.data?.parentId // may be undefined for main
      const parentMessageId = node.data?.parentMessageId // may be undefined; do not guess
      
      return {
        id: node.id,
        type: node.type || (isMainNode ? 'main' : 'branch'),
        title: node.data?.messages?.[0]?.text?.substring(0, 30) + '...' || node.data?.label || 'Untitled',
        messages: node.data?.messages || [],
        timestamp: node.data?.messages?.[0]?.timestamp || Date.now(),
        parentId: isMainNode ? undefined : parentId,
        parentMessageId: isMainNode ? undefined : parentMessageId,
        inheritedMessages: isMainNode ? undefined : (node.data?.inheritedMessages || []),
        branchMessages: isMainNode ? undefined : (node.data?.branchMessages || []),
        children: [],
        isActive: node.id === activeBranchId,
        selectedAIs: node.data?.selectedAIs || [],
        isMain: isMainNode,
        isMinimized: node.data?.isMinimized || false,
        showAIPill: node.data?.showAIPill || false,
        position: node.position || { x: 0, y: 0 },
        nodeData: {
          label: node.data?.label,
          onAddAI: node.data?.onAddAI,
          onRemoveAI: node.data?.onRemoveAI,
          onBranch: node.data?.onBranch,
          onSendMessage: node.data?.onSendMessage,
          onToggleMinimize: node.data?.onToggleMinimize,
          isGenerating: node.data?.isGenerating,
          existingBranchesCount: node.data?.existingBranchesCount,
          height: node.data?.height,
          isHighlighted: node.data?.isHighlighted
        }
      }
    })
    
    // FlowCanvas is the single source of truth for nodes — do not preserve legacy/placeholder nodes from prev
    setConversationNodes(() => {
      // Ensure main node always exists with proper messages
      const hasMain = newConversationNodes.some(n => n.id === 'main' || n.isMain)
      if (!hasMain) {
        // If FlowCanvas hasn't provided main, create minimal main placeholder (will be replaced by FlowCanvas soon)
        const mainNode = {
          id: 'main',
          type: 'main',
          title: 'Main Conversation',
          messages: messages || [], // Use current messages state
          timestamp: Date.now(),
          parentId: undefined,
          children: [],
          isActive: !currentBranch,
          selectedAIs: selectedAIs || [],
          isMain: true,
          position: { x: 400, y: 50 }
        }
        return [mainNode, ...newConversationNodes]
      } else {
        // Update main node messages if they're missing or outdated
        return newConversationNodes.map(node => {
          if (node.id === 'main' || node.isMain) {
            return {
              ...node,
              messages: node.messages && node.messages.length > 0 ? node.messages : (messages || [])
            }
          }
          return node
        })
      }
    })
  }, [activeBranchId])
  
  // Ensure conversationNodes is populated when switching to chat view
  useEffect(() => {
    if (viewMode === 'chat' && conversationNodes.length === 0) {
      // If switching to chat view and conversationNodes is empty, create main node
      const mainNode = {
        id: 'main',
        type: 'main',
        title: 'Main Conversation',
        messages: messages || [],
        timestamp: Date.now(),
        parentId: undefined,
        children: [],
        isActive: !currentBranch,
        selectedAIs: selectedAIs || [],
        isMain: true,
        position: { x: 400, y: 50 }
      }
      setConversationNodes([mainNode])
    } else if (viewMode === 'chat' && conversationNodes.length > 0) {
      // Ensure main node has messages when switching to chat view
      const hasMain = conversationNodes.some(n => n.id === 'main' || n.isMain)
      if (hasMain) {
        setConversationNodes(prev => prev.map(node => {
          if (node.id === 'main' || node.isMain) {
            return {
              ...node,
              messages: node.messages && node.messages.length > 0 ? node.messages : (messages || [])
            }
          }
          return node
        }))
      }
    }
  }, [viewMode, messages, selectedAIs, currentBranch])
  
  // Stop AI generation
  const stopGeneration = () => {
    console.log('🛑 Stop generation requested for main node')
    setIsGenerating(false)
    
    // Abort ongoing API requests
    if (mainAbortControllerRef.current) {
      mainAbortControllerRef.current.abort()
      mainAbortControllerRef.current = null
      console.log('🛑 Aborted main node generation')
    }
    
    // Finalize any streaming messages
    setMessages(prev => prev.map(msg => {
      if (msg.isStreaming && msg.streamingText) {
        return {
          ...msg,
          text: msg.streamingText || '[Generation stopped]',
          isStreaming: false,
          streamingText: undefined
        }
      }
      return msg
    }).filter(msg => {
      // Remove streaming messages that have no text
      if (msg.isStreaming && !msg.streamingText) {
        return false
      }
      return true
    }))
  }

  const sendMessage = async (text: string, branchId?: string) => {
    console.log(`🏠 Main conversation sending message:`, text)
    
    // Edge case: No text provided
    if (!text.trim()) {
      console.warn('⚠️ Empty message, ignoring')
      return
    }
    
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      text,
      isUser: true,
      timestamp: Date.now(),
      parentId: branchId || undefined,
      children: []
    }

    // Add message to main conversation
    console.log('📝 Adding message to main conversation:', newMessage)
    setMessages(prev => {
      const updated = [...prev, newMessage]
      console.log('📝 Updated messages array:', updated)
      return updated
    })
    
    // Create conversation context
    // 🧠 Get memory context for this branch
    let memoryContext = ''
    try {
      const memoryResponse = await fetch(`/api/memory/context?branchId=${activeBranchId || 'main'}&depth=3&maxMemories=50`)
      if (memoryResponse.ok) {
        const memoryData = await memoryResponse.json()
        if (memoryData.success) {
          memoryContext = memoryData.data.aggregatedContext
        }
      }
    } catch (error) {
      console.error('❌ Error fetching memory context:', error)
    }
    
    const context: ConversationContext = {
      messages: [...messages, newMessage],
      currentBranch: activeBranchId || 'main',
      parentMessages: messages,
      memoryContext
    }
    
    // Start generating response
    setIsGenerating(true)
    
    // CRITICAL: Create abort controller for this generation
    const abortController = new AbortController()
    mainAbortControllerRef.current = abortController
    
    // If we're in an active branch, save it
    if (activeBranchId) {
      setSavedBranches(prev => 
        prev.map(b => b.id === activeBranchId 
          ? { ...b, messages: [...b.messages, newMessage] } 
          : b
        )
      )
    } else if (messages.length === 0) {
      // If this is a new conversation, save it as a branch
      const branchId = `branch-${Date.now()}`
      const newBranch: Branch = {
        id: branchId,
        title: text.length > 40 ? text.substring(0, 40) + '...' : text,
        messages: [newMessage],
        timestamp: Date.now()
      }
      
      setSavedBranches(prev => [...prev, newBranch])
      setActiveBranchId(branchId)
    }

    // If multiple AIs selected, generate responses for each
    if (selectedAIs.length > 1) {
      console.log(`📍 Multi-model mode: Creating ${selectedAIs.length} AI responses`)
      console.log('📍 Selected AIs:', selectedAIs.map(ai => ai.name))
      
      // Don't auto-trigger canvas mode - let user decide when to branch
      // Canvas mode only triggers when user explicitly clicks branch button
      
      // Generate a unique group ID for this multi-model response
      const groupId = `group-${Date.now()}`
      
      // Generate response for each AI
      const aiPromises = selectedAIs.map(async (ai, index) => {
        try {
          // Map AI ID to model name
          let modelName: string
          if (ai.id === 'best') {
            // For "Best" AI, automatically select the fastest available model
            modelName = getBestAvailableModel()
            console.log(`🎯 Multi-mode Best AI selected: using ${modelName} (fastest available)`)
          } else {
            // For specific AI models, use their direct mapping
            modelName = ai.id === 'gemini-2.5-pro' ? 'gemini' : 
                       ai.id === 'mistral-large' ? 'mistral' : 
                       'gpt-4' // fallback
          }
          
          console.log(`🔍 [MOCK MODE] Generating mock response for ${ai.name}...`)
          
          // 🔥 MOCK MODE: Generate mock response instead of calling API
          const mockResponse = `This is a mock response from ${ai.name} to: "${text}". In a real scenario, this would be generated by the ${modelName} API. This response simulates what the AI would say based on the conversation context.`
          
          // Create streaming message placeholder for multi-model
          // Use a more unique ID to prevent collisions when multiple messages are created simultaneously
          const streamingMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${ai.id}-${index}`
          const streamingMessage: Message = {
            id: streamingMessageId,
            text: '',
            isUser: false,
            timestamp: Date.now(),
            parentId: newMessage.id,
            children: [],
            aiModel: ai.id,
            groupId: groupId,
            isStreaming: true,
            streamingText: ''
          }
          
          // Add streaming message to UI immediately
          setMessages(prev => [...prev, streamingMessage])
          
          // Check if aborted before starting
          if (abortController.signal.aborted) {
            throw new Error('Generation aborted')
          }
          
          // 🔥 MOCK STREAMING: Simulate streaming by chunking the mock response
          const words = mockResponse.split(' ')
          const chunkDelay = 50 // ms between chunks
          
          for (let i = 0; i < words.length; i++) {
            if (abortController.signal.aborted) {
              throw new Error('Generation aborted')
            }
            
            const chunk = (i === 0 ? '' : ' ') + words[i]
            
            // Handle streaming response - update the streaming message
            console.log(`[MOCK] Streaming from ${ai.name}:`, chunk)
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? { ...msg, streamingText: (msg.streamingText || '') + chunk }
                : msg
            ))
            
            // 🔥 NEW: Also update branch nodes that have matching streaming messages
            setConversationNodes((prevNodes: any[]) => {
              return prevNodes.map(node => {
                if (node.id === 'main') return node
                
                const branchMessages = node.data?.messages || []
                const matchingStreamingMessage = branchMessages.find((msg: any) => 
                  msg.isStreaming && 
                  msg.aiModel === ai.id &&
                  msg.id?.startsWith(`branch-${streamingMessageId}`)
                )
                
                if (matchingStreamingMessage) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      messages: branchMessages.map((msg: any) =>
                        msg.id === matchingStreamingMessage.id
                          ? { ...msg, streamingText: (msg.streamingText || '') + chunk }
                          : msg
                      )
                    }
                  }
                }
                
                return node
              })
            })
            
            // Wait before next chunk
            await new Promise(resolve => setTimeout(resolve, chunkDelay))
          }
          
          console.log(`✅ [MOCK] Got response from ${ai.name}:`, mockResponse.substring(0, 50) + '...')

          // Finalize the streaming message
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId 
              ? { 
                  ...msg, 
                  text: mockResponse, 
                  isStreaming: false, 
                  streamingText: undefined,
                  timestamp: Date.now()
                }
              : msg
          ))
          
          // 🔥 NEW: Also finalize streaming messages in branches
          setConversationNodes((prevNodes: any[]) => {
            return prevNodes.map(node => {
              if (node.id === 'main') return node
              
              const branchMessages = node.data?.messages || []
              const matchingStreamingMessage = branchMessages.find((msg: any) => 
                msg.isStreaming && 
                msg.aiModel === ai.id &&
                msg.id?.startsWith(`branch-${streamingMessageId}`)
              )
              
              if (matchingStreamingMessage) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    messages: branchMessages.map((msg: any) =>
                      msg.id === matchingStreamingMessage.id
                        ? { 
                            ...msg, 
                            text: mockResponse, 
                            isStreaming: false, 
                            streamingText: undefined,
                            timestamp: Date.now()
                          }
                        : msg
                    )
                  }
                }
              }
              
              return node
            })
          })
          
          // 🧠 Extract memories from AI response (mock)
          try {
            await fetch('/api/memory/extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                responseText: mockResponse,
                branchId: activeBranchId || 'main',
                messageId: streamingMessageId,
                userId: undefined,
                topic: ai.name
              })
            })
            console.log('🧠 Memories extracted from AI response')
          } catch (error) {
            console.error('❌ Error extracting memories:', error)
          }

          return {
            id: streamingMessageId,
            text: mockResponse,
            isUser: false,
            timestamp: Date.now(),
            parentId: newMessage.id,
            children: [],
            aiModel: ai.id,
            groupId: groupId
          }
        } catch (error) {
          console.error(`Error generating response for ${ai.name}:`, error)
          
          // Check if it was aborted
          const wasAborted = error instanceof Error && (error.message.includes('aborted') || error.message.includes('AbortError'))
          
          if (wasAborted) {
            // Finalize streaming message with current text
            setMessages(prev => prev.map(msg => {
              if (msg.id === streamingMessageId && msg.isStreaming) {
                return {
                  ...msg,
                  text: msg.streamingText || '[Generation stopped]',
                  isStreaming: false,
                  streamingText: undefined
                }
              }
              return msg
            }).filter(msg => {
              // Remove streaming messages that have no text
              if (msg.isStreaming && !msg.streamingText && msg.id === streamingMessageId) {
                return false
              }
              return true
            }))
            
            return {
              id: streamingMessageId,
              text: '[Generation stopped]',
              isUser: false,
              timestamp: Date.now(),
              parentId: newMessage.id,
              children: [],
              aiModel: ai.id,
              groupId: groupId
            }
          }
          
          return {
            id: `msg-${Date.now()}-${ai.id}-${index}`,
            text: `${ai.name} error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isUser: false,
            timestamp: Date.now(),
            parentId: newMessage.id,
            children: [],
            aiModel: ai.id,
            groupId: groupId
          }
        }
      })

      // Wait for all AI responses with error handling
      try {
        const aiResponses = await Promise.all(aiPromises)
        console.log('✅ All AI responses completed:', aiResponses.length)
      } catch (error) {
        console.error('❌ Error in multi-AI response generation:', error)
      } finally {
        // Always clear generating state, even if some responses failed
        setIsGenerating(false)
        mainAbortControllerRef.current = null // Clean up abort controller
        console.log('✅ Generation state cleared')
      }
    } else {
      // Single AI response (or multi-mode OFF)
      const selectedAI = selectedAIs[0]
      
      try {
        // Map AI ID to model name
        let modelName: string
        if (selectedAI?.id === 'best') {
          // For "Best" AI, automatically select the fastest available model
          modelName = getBestAvailableModel()
          console.log(`🎯 Best AI selected: using ${modelName} (fastest available)`)
        } else {
          // For specific AI models, use their direct mapping
          modelName = selectedAI?.id === 'gemini-2.5-pro' ? 'gemini' : 
                     selectedAI?.id === 'mistral-large' ? 'mistral' : 
                     'gpt-4' // fallback
        }
        
        let aiResponse: Message
        
        console.log(`🔍 [MOCK MODE] Single mode: Generating mock response for ${selectedAI?.name}`)
        // 🔥 MOCK MODE: Always use mock responses (no API calls)
        if (selectedAI) {
          console.log(`🚀 [MOCK MODE] Generating mock response for ${selectedAI.name}`)
          
          // Create streaming message placeholder
          const streamingMessageId = `msg-${Date.now()}`
          const streamingMessage: Message = {
            id: streamingMessageId,
            text: '',
            isUser: false,
            timestamp: Date.now(),
            parentId: newMessage.id,
            children: [],
            aiModel: selectedAI.id,
            isStreaming: true,
            streamingText: ''
          }
          
          // Add streaming message to UI immediately
          setMessages(prev => [...prev, streamingMessage])
          
          // Check if aborted before starting
          if (abortController.signal.aborted) {
            throw new Error('Generation aborted')
          }
          
          // 🔥 MOCK MODE: Generate mock response instead of calling API
          const mockResponse = `This is a mock response from ${selectedAI.name} to: "${text}". In a real scenario, this would be generated by the ${modelName} API. This response simulates what the AI would say based on the conversation context.`
          
          // 🔥 MOCK STREAMING: Simulate streaming by chunking the mock response
          const words = mockResponse.split(' ')
          const chunkDelay = 50 // ms between chunks
          
          for (let i = 0; i < words.length; i++) {
            if (abortController.signal.aborted) {
              throw new Error('Generation aborted')
            }
            
            const chunk = (i === 0 ? '' : ' ') + words[i]
            
            // Handle streaming response - update the streaming message
            console.log(`[MOCK] Streaming from ${selectedAI?.name}:`, chunk)
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? { ...msg, streamingText: (msg.streamingText || '') + chunk }
                : msg
            ))
            
            // Wait before next chunk
            await new Promise(resolve => setTimeout(resolve, chunkDelay))
          }
          
          console.log(`✅ [MOCK] Single mode: Got response from ${selectedAI?.name}:`, mockResponse.substring(0, 50) + '...')
          
          // Finalize the streaming message
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId 
              ? { 
                  ...msg, 
                  text: mockResponse, 
                  isStreaming: false, 
                  streamingText: undefined,
                  timestamp: Date.now()
                }
              : msg
          ))
          
          aiResponse = {
            id: streamingMessageId,
            text: mockResponse,
            isUser: false,
            timestamp: Date.now(),
            parentId: newMessage.id,
            children: [],
            aiModel: selectedAI?.id
          }
        } else {
          // Fallback response
          aiResponse = {
            id: `msg-${Date.now()}`,
            text: `${selectedAI?.name || 'AI'} response to: "${text}" (API not configured)`,
            isUser: false,
            timestamp: Date.now(),
            parentId: newMessage.id,
            children: [],
            aiModel: selectedAI?.id
          }
        }
        
        // Only add the response if it's not already added (for streaming messages)
        if (!aiResponse.isStreaming) {
          setMessages(prev => [...prev, aiResponse])
        }
        
        // Update branch if needed
        if (activeBranchId) {
          setSavedBranches(prev => 
            prev.map(b => b.id === activeBranchId 
              ? { ...b, messages: [...b.messages, aiResponse] } 
              : b
            )
          )
        }
        
        setIsGenerating(false)
        mainAbortControllerRef.current = null // Clean up abort controller
      } catch (error) {
        console.error('Error generating AI response:', error)
        
        // Check if it was aborted
        const wasAborted = error instanceof Error && (error.message.includes('aborted') || error.message.includes('AbortError'))
        
        // Clean up abort controller
        mainAbortControllerRef.current = null
        
        // If aborted, finalize with current streaming text
        if (wasAborted) {
          console.log('🛑 Main node generation aborted by user')
          setMessages(prev => prev.map(msg => {
            if (msg.isStreaming && msg.streamingText) {
              return {
                ...msg,
                text: msg.streamingText || '[Generation stopped]',
                isStreaming: false,
                streamingText: undefined
              }
            }
            return msg
          }).filter(msg => {
            // Remove streaming messages that have no text
            if (msg.isStreaming && !msg.streamingText) {
              return false
            }
            return true
          }))
        } else {
          const errorResponse: Message = {
            id: `msg-${Date.now()}`,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isUser: false,
            timestamp: Date.now(),
            parentId: newMessage.id,
            children: [],
            aiModel: selectedAI?.id
          }
          
          setMessages(prev => [...prev, errorResponse])
        }
        
        setIsGenerating(false)
      }
    }
  }

  const sendMultiModelMessage = (text: string) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      text,
      isUser: true,
      timestamp: Date.now(),
      children: []
    }

    setMessages(prev => [...prev, newMessage])

    // Simulate multi-model responses
    selectedAIs.forEach((ai, index) => {
      setTimeout(() => {
        const aiResponse: Message = {
          id: `msg-${Date.now()}-${ai.id}`,
          text: `${ai.name} response to: "${text}"`,
          isUser: false,
          timestamp: Date.now(),
          parentId: newMessage.id,
          children: [],
          responses: { [ai.id]: `${ai.name} response` }
        }
        setMessages(prev => [...prev, aiResponse])
      }, (index + 1) * 500)
    })
  }

  const [pendingBranchMessageId, setPendingBranchMessageId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const mainAbortControllerRef = useRef<AbortController | null>(null) // Track abort controller for main node
  const [savedBranches, setSavedBranches] = useState<Branch[]>([])
  const [lastBranchTime, setLastBranchTime] = useState<number>(0)
  
  // Branch warning modal state
  const [showBranchWarning, setShowBranchWarning] = useState(false)
  const [pendingBranchData, setPendingBranchData] = useState<{
    messageId: string
    isMultiBranch: boolean
    messageText?: string
    parentNodeId?: string
    allowDuplicate?: boolean
    existingBranchesCount?: number
    limitReached?: boolean
  } | null>(null)
  const MAX_DUPLICATE_BRANCHES = 6

  const getBranchCountForMessage = (messageId: string): number =>
    conversationNodes.filter(node => 
      node.parentMessageId === messageId && node.id !== 'main' && !node.isMain
    ).length

  const branchFromMessage = (messageId: string, isMultiBranch: boolean = false) => {
    console.log('📍 branchFromMessage called with:', { messageId, isMultiBranch })
    if (!messageId) return
    
    // Check cache first
    const cachedBranchId = branchCacheRef.current.get(messageId)
    if (cachedBranchId) {
      console.log('📦 Branch exists in cache:', cachedBranchId)
      // Navigate to existing branch instead of creating new one
      setActiveBranchId(cachedBranchId)
      addToast({
        type: 'info',
        title: 'Branch Exists',
        message: 'Navigating to existing branch'
      })
      return
    }
    
    // Find the message to get its text
    const targetMessage = messages.find(m => m.id === messageId) || 
                         conversationNodes.flatMap(n => n.messages || []).find(m => m.id === messageId)
    
    const existingBranchCount = getBranchCountForMessage(messageId)
    
    if (!isMultiBranch) {
      if (existingBranchCount >= MAX_DUPLICATE_BRANCHES) {
        addToast({
          type: 'warning',
          title: 'Branch limit reached',
          message: `You can create up to ${MAX_DUPLICATE_BRANCHES} branches from the same message. Delete or merge one to continue.`
        })
        return
      }
      
      if (existingBranchCount > 0) {
        setPendingBranchData({
          messageId,
          isMultiBranch: false,
          messageText: targetMessage?.text?.substring(0, 100),
          parentNodeId: 'main',
          existingBranchesCount: existingBranchCount
        })
        setShowBranchWarning(true)
        return
      }
    }
    
    // When in chat mode, switch to canvas mode first
    // Check if we're in simple chat view (no branches and no conversation nodes except main)
    const hasBranches = branches.length > 0 || conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length > 0
    
    // Store isMultiBranch in pendingBranchData so it can be passed to FlowCanvas
    setPendingBranchData({
      messageId,
      isMultiBranch,
      messageText: targetMessage?.text?.substring(0, 100),
      parentNodeId: 'main'
    })
    
    if (!hasBranches) {
      console.log('📍 Switching to canvas mode for first branch', { isMultiBranch })
      // Set pendingBranchMessageId immediately - FlowCanvas will create branch when it mounts
      setPendingBranchMessageId(messageId)
    } else {
      console.log('📍 Already in canvas mode - creating new branch', { isMultiBranch })
      // When already in canvas mode, create the branch directly
      setPendingBranchMessageId(messageId)
    }
  }

  // Handle branch warning confirmation
  const handleBranchWarningConfirm = () => {
    if (pendingBranchData) {
      setShowBranchWarning(false)
      const { messageId } = pendingBranchData
      setPendingBranchData(prev => prev ? { ...prev, allowDuplicate: true } : prev)
      
      if (branches.length === 0) {
        setTimeout(() => {
          setPendingBranchMessageId(messageId)
        }, 50)
      } else {
        setPendingBranchMessageId(messageId)
      }
    }
  }

  // Handle branch warning cancel
  const handleBranchWarningCancel = () => {
    setShowBranchWarning(false)
    setPendingBranchData(null)
  }

  // Handle branch warning from FlowCanvas
  const handleBranchWarning = useCallback((data: { messageId: string; messageText?: string; existingBranchId?: string; isMultiBranch: boolean; existingBranchesCount?: number; parentNodeId: string; limitReached?: boolean }) => {
    setPendingBranchData({
      messageId: data.messageId,
      isMultiBranch: data.isMultiBranch,
      messageText: data.messageText,
      parentNodeId: data.parentNodeId,
      existingBranchesCount: data.existingBranchesCount,
      limitReached: data.limitReached
    })
    setShowBranchWarning(true)
  }, [])


  // Effect to auto-save conversation as branch when it changes
  useEffect(() => {
    if (messages.length > 0 && !activeBranchId && savedBranches.length === 0) {
      saveCurrentBranch()
    }
  }, [messages.length === 1]) // Only run when first message is added
  
  // Command palette commands
  const commandPaletteCommands = [
    {
      id: 'export-conversation',
      title: 'Export Conversation',
      description: 'Export current conversation to file',
      action: () => setShowExportImport(true)
    },
    {
      id: 'clear-conversation',
      title: 'Clear Conversation',
      description: 'Start a new conversation',
      action: () => {
        setMessages([])
        setBranches([])
        setConversationNodes([])
        addToast({
          type: 'success',
          title: 'Conversation cleared',
          message: 'Started a new conversation'
        })
      }
    },
    {
      id: 'focus-mode',
      title: 'Focus Mode',
      description: 'Enter focus mode for detailed work',
      action: () => {
        addToast({
          type: 'info',
          title: 'Focus Mode',
          message: 'Click on any branch to enter focus mode'
        })
      }
    }
  ]
  
  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* Top Bar - Fixed with proper spacing */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left side - Space for sidebar toggle (handled by Sidebar component) */}
          <div className="w-10"></div>
          
          {/* Center - Title (only in chat mode) */}
          {viewMode === 'chat' && conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length > 0 && (
            <h1 className="text-lg font-semibold text-foreground">Conversation Branches</h1>
          )}
          
          {/* Right side - Controls */}
          <div className="flex items-center gap-2">
            {/* 3 Dots Menu - Only in map view */}
            {viewMode === 'map' && conversationNodes.length > 0 && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/80"
                  title="More options"
                >
                  <DotsThree className="w-5 h-5" weight="bold" />
                </button>
                
                {/* Dropdown Menu */}
                {showMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-card dark:bg-card border border-border dark:border-border/60 shadow-lg z-50 min-w-[180px] rounded-xl backdrop-blur-sm overflow-hidden">
                    <button
                      onClick={() => {
                        if (minimizeAllRef.current) {
                          minimizeAllRef.current()
                        }
                        setShowMenu(false)
                      }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                        allNodesMinimized
                          ? 'bg-primary/10 hover:bg-primary/20 text-primary dark:bg-primary/20 dark:hover:bg-primary/30'
                          : 'hover:bg-muted dark:hover:bg-muted/80 text-foreground'
                      }`}
                    >
                      {allNodesMinimized ? (
                        <>
                          <ArrowsOut className="w-4 h-4" weight="bold" />
                          <span>Maximize All</span>
                        </>
                      ) : (
                        <>
                          <ArrowsIn className="w-4 h-4" weight="bold" />
                          <span>Minimize All</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Map/Chat View Toggle - Icon only */}
            {conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length > 0 && (
              <div className="bg-card border border-border/60 dark:border-border/40 rounded-xl shadow-lg p-1 flex items-center gap-1">
                <button
                  onClick={() => setViewMode('map')}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    viewMode === 'map'
                      ? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80'
                  }`}
                  title="Map View - Visual graph of all branches"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h18v18H3zM3 9h18M9 3v18"/>
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('chat')}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    viewMode === 'chat'
                      ? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80'
                  }`}
                  title="Chat View - Focused conversation threads"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Branch Warning Modal */}
      <BranchWarningModal
        isOpen={showBranchWarning}
        onClose={handleBranchWarningCancel}
        onConfirm={handleBranchWarningConfirm}
        onCancel={handleBranchWarningCancel}
        messageText={pendingBranchData?.messageText}
        existingBranchesCount={pendingBranchData?.existingBranchesCount}
        isMultiBranch={pendingBranchData?.isMultiBranch || false}
        limitReached={pendingBranchData?.limitReached}
        maxBranches={MAX_DUPLICATE_BRANCHES}
      />
      
      {/* Sidebar */}
      <Sidebar 
        branches={savedBranches}
        currentBranchId={activeBranchId}
        onSelectBranch={handleSelectBranch}
        onDeleteBranch={handleDeleteBranch}
        conversationNodes={conversationNodes}
        conversations={allConversations}
        currentConversationId={currentConversationIdRef.current}
        onSelectConversation={handleSelectConversation}
        onCreateNewConversation={handleCreateNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />
      
      {/* Simple Layout - No Canvas Initially */}
      {branches.length === 0 && conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length === 0 && !pendingBranchMessageId ? (
        <div className="flex items-center justify-center h-screen p-4">
          <div className="w-full max-w-4xl border border-border rounded-2xl bg-card shadow-lg p-6">
            {/* Branch Navigation - if we have branches */}
            {conversationNodes.length > 0 && (
              <BranchNavigation
                branches={conversationNodes.filter(n => n.id !== 'main' && !n.isMain).map(n => ({
                  id: n.id,
                  label: n.title || 'Branch',
                  parentId: n.parentId,
                  parentMessageId: n.parentMessageId
                }))}
                currentBranchId={activeBranchId}
                onNavigateToBranch={handleSelectBranch}
                onNavigateToMain={() => {
                  setActiveBranchId('main')
                  setCurrentBranch(null)
                }}
              />
            )}

            {/* Header with AI Pills and Mode Toggle */}
            <div className="flex items-center justify-between mb-6">
              {/* AI Selector */}
              <AIPills
                selectedAIs={selectedAIs}
                onAddAI={addAI}
                onRemoveAI={removeAI}
                onSelectSingle={selectSingleAI}
                showAddButton={true}
                getBestAvailableModel={getBestAvailableModel}
              />

              {/* Export/Import Button */}
              <button
                onClick={() => setShowExportImport(true)}
                className="px-4 py-2 bg-muted hover:bg-accent text-foreground rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Export/Import
              </button>
            </div>
            
            {/* Chat Interface */}
            <ChatInterface
              messages={messages}
              onSendMessage={sendMessage}
              selectedAIs={selectedAIs}
              onBranchFromMessage={branchFromMessage}
              currentBranch={currentBranch}
              isGenerating={isGenerating}
              onStopGeneration={stopGeneration}
              existingBranchesCount={conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length}
              isMain={true}
              onExportImport={() => setShowExportImport(true)}
            />
          </div>
        </div>
      ) : (
        /* Flow Canvas or Chat View Layout - Based on viewMode */
        conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length > 0 && viewMode === 'chat' ? (
          <ChatBranchesView
            mainMessages={messages}
            branches={conversationNodes}
            selectedAIs={selectedAIs}
            onAddAI={addAI}
            onRemoveAI={removeAI}
            onSelectSingle={selectSingleAI}
            getBestAvailableModel={getBestAvailableModel}
            onSendMessage={sendMessage}
            onBranchFromMessage={branchFromMessage}
            isGenerating={isGenerating}
            onStopGeneration={stopGeneration}
            activeBranchId={activeBranchId}
            onSelectBranch={handleSelectBranch}
            onDeleteBranch={handleDeleteBranch}
          />
        ) : (
          <FlowCanvas
            selectedAIs={selectedAIs}
            onAddAI={addAI}
            onRemoveAI={removeAI}
            mainMessages={messages}
            onSendMainMessage={sendMessage}
            onBranchFromMain={branchFromMessage}
            initialBranchMessageId={currentBranch}
            pendingBranchMessageId={pendingBranchMessageId}
            pendingBranchData={pendingBranchData}
            onPendingBranchProcessed={() => {
              setPendingBranchMessageId(null)
              setPendingBranchData(null)
            }}
            onNodesUpdate={updateConversationNodes}
            onNodeDoubleClick={(nodeId) => {
              console.log('Node double-clicked:', nodeId)
            }}
            onPillClick={(aiId) => {
              console.log('Pill clicked:', aiId)
            }}
            getBestAvailableModel={getBestAvailableModel}
            onSelectSingle={selectSingleAI}
            onExportImport={() => setShowExportImport(true)}
            restoredConversationNodes={conversationNodes}
            selectedBranchId={activeBranchId}
            onBranchWarning={handleBranchWarning}
            onMinimizeAllRef={(fn) => { minimizeAllRef.current = fn }}
            onAllNodesMinimizedChange={(minimized) => setAllNodesMinimized(minimized)}
            conversationId={currentConversationIdRef.current}
          />
        )
      )}

      {/* Export/Import Modal */}
      <ExportImportModal
        isOpen={showExportImport}
        onClose={() => setShowExportImport(false)}
        messages={messages}
        branches={branches}
        nodes={conversationNodes}
        edges={[]} // TODO: Get edges from FlowCanvas
        onImport={handleImportConversation}
      />
      
      {/* Command Palette */}
      <CommandPalette
        commands={commandPaletteCommands}
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />
      
    </div>
  )
}