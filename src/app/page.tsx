'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import FlowCanvas from '@/components/flow-canvas'
import AIPills from '@/components/ai-pills'
import ChatInterface from '@/components/chat-interface'
import Sidebar from '@/components/sidebar'
import ExportImportModal from '@/components/export-import-modal'
import { CommandPalette } from '@/components/command-palette'
import { useToast } from '@/components/toast'
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
    color: 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border-purple-200',
    logo: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="1.5" fill="none"/>
        <path d="M8 12L10.5 9.5L15.5 14.5" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="6" cy="6" r="1" fill="#8B5CF6"/>
        <circle cx="18" cy="6" r="1" fill="#8B5CF6"/>
        <circle cx="6" cy="18" r="1" fill="#8B5CF6"/>
        <circle cx="18" cy="18" r="1" fill="#8B5CF6"/>
      </svg>
    )
  }

  const [selectedAIs, setSelectedAIs] = useState<AI[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [currentBranch, setCurrentBranch] = useState<string>('')
  const [multiModelMode, setMultiModelMode] = useState(false)
  const [branches, setBranches] = useState<{ id: string }[]>([])
  const [conversationNodes, setConversationNodes] = useState<any[]>([])
  const [showExportImport, setShowExportImport] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  
  // Guard to avoid duplicate branch creation from StrictMode double effects
  const creatingBranchRef = useRef<Set<string>>(new Set())
  // Store branch data when created to ensure it's available for saving
  const branchDataRef = useRef<Map<string, any>>(new Map())
  
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
    error: mongoError
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
                  
                  // Restore most recent conversation if available
                  if (data.data.length > 0) {
                    const mostRecent = data.data[0]
                    restoreConversation(mostRecent)
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
    
    // Restore ALL state immediately
    if (conversation.mainMessages) {
      setMessages(conversation.mainMessages)
      console.log('✅ Restored messages:', conversation.mainMessages.length)
    } else {
      console.log('⚠️ No mainMessages in conversation')
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
    
    if (conversation.multiModelMode !== undefined) {
      setMultiModelMode(conversation.multiModelMode)
      console.log('✅ Restored multiModelMode:', conversation.multiModelMode)
    } else {
      setMultiModelMode(false)
    }
    
    if (conversation.branches && conversation.branches.length > 0) {
      console.log('📦 Restoring branches data:', conversation.branches.length)
      console.log('📦 Branch IDs from MongoDB:', conversation.branches.map((b: any) => ({ id: b.id, isMain: b.isMain || b.id === 'main' })))
      
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
      const restoredNodes = conversation.branches.map((b: any) => {
        const isMainNode = b.isMain || b.id === 'main'
        return {
          id: b.id,
          type: b.type || (isMainNode ? 'main' : 'branch'), // Ensure type is set
          title: b.label || b.title || (isMainNode ? 'Main Conversation' : 'Branch'),
          messages: b.messages || [],
          timestamp: b.timestamp || Date.now(),
          parentId: isMainNode ? undefined : (b.parentId || 'main'), // Ensure parentId is 'main' for branches
          children: b.children || [],
          isActive: b.isActive || false,
        // Restore AI and mode state
        selectedAIs: b.selectedAIs?.map((ai: any) => {
          // Skip if ai is a serialized React element
          if (ai.type && ai.props && ai._owner !== undefined) {
            // This is a serialized React element, skip it
            return null
          }
          
          // Reconstruct AI objects with logos
          let logoElement: any
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
        }).filter((ai: any) => ai !== null) || [],
        multiModelMode: b.multiModelMode || false,
        isMain: b.isMain || b.id === 'main',
        isMinimized: b.isMinimized || false,
        showAIPill: b.showAIPill || false,
        position: b.position || { x: 0, y: 0 },
        nodeData: b.nodeData || {}
      }
    })
      
      setConversationNodes(restoredNodes)
      
      console.log('✅ Restored conversationNodes:', {
        totalNodes: restoredNodes.length,
        branches: restoredNodes.filter(n => !n.isMain && n.id !== 'main').length,
        branchDetails: restoredNodes.filter(n => !n.isMain && n.id !== 'main').map(n => ({
          id: n.id,
          type: n.type,
          parentId: n.parentId,
          messagesCount: n.messages?.length || 0,
          title: n.title
        })),
        withMessages: restoredNodes.filter(n => n.messages?.length > 0).length,
        withAIs: restoredNodes.filter(n => n.selectedAIs?.length > 0).length
      })
    } else {
      console.log('⚠️ No branches in conversation')
      // Initialize empty arrays if no branches
      setBranches([])
      setConversationNodes([])
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
    const shouldSave = !isInitialLoadRef.current && (messages.length > 0 || conversationNodes.length > 0 || branches.length > 0)
    
    if (shouldSave) {
      // Use a small delay to ensure React has finished batching state updates
      // This is especially important when branches are just created
      const timeoutId = setTimeout(() => {
      console.log('💾 Preparing to save conversation:', {
        messages: messages.length,
        selectedAIs: selectedAIs.length,
        conversationNodes: conversationNodes.length,
        branches: branches.length,
        multiModelMode,
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
      
      // If there are branches in the branches array that aren't in conversationNodes yet,
      // create placeholder nodes for them so they get saved
      const branchIdsInNodes = new Set(allNodes.map(n => n.id))
      const missingBranches = branches.filter(b => b.id !== 'main' && !branchIdsInNodes.has(b.id))
      
      if (missingBranches.length > 0) {
        console.warn('⚠️ Branches exist in branches array but not in conversationNodes yet:', missingBranches.map(b => b.id))
        console.warn('⚠️ Creating placeholder nodes for these branches to ensure they are saved')
        
        // Create placeholder nodes for missing branches
        // Try to find the branch data from conversationNodes that was just added
        missingBranches.forEach(branch => {
          // Try to find this branch in conversationNodes that was just added (before state update)
          const branchFromState = conversationNodes.find(n => n.id === branch.id)
          // Also check branchDataRef for branch data stored when created
          const branchFromRef = branchDataRef.current.get(branch.id)
          
          const placeholderNode = branchFromState ? {
            // Use the data from conversationNodes if available
            ...branchFromState,
            type: branchFromState.type || 'branch',
            parentId: branchFromState.parentId || 'main',
            isMain: false
          } : branchFromRef ? {
            // Use the data from branchDataRef if available
            ...branchFromRef,
            type: branchFromRef.type || 'branch',
            parentId: branchFromRef.parentId || 'main',
            isMain: false
          } : {
            // Otherwise create a basic placeholder
            id: branch.id,
            type: 'branch',
            title: 'Branch',
            messages: messages.filter(m => m.isUser), // At least include user messages
            timestamp: Date.now(),
            parentId: 'main',
            children: [],
            isActive: branch.id === currentBranch,
            selectedAIs: selectedAIs.map(ai => ({
              id: ai.id,
              name: ai.name,
              color: ai.color,
              functional: ai.functional !== undefined ? ai.functional : true
            })),
            multiModelMode: multiModelMode,
            isMain: false,
            isMinimized: false,
            showAIPill: false,
            position: { x: 0, y: 0 },
            nodeData: {}
          }
          allNodes.push(placeholderNode)
          console.log('✅ Created placeholder node for branch:', {
            branchId: branch.id,
            fromState: !!branchFromState,
            fromRef: !!branchFromRef,
            hasMessages: !!placeholderNode.messages?.length,
            type: placeholderNode.type,
            parentId: placeholderNode.parentId
          })
        })
        
        console.log('📦 All nodes after adding placeholders:', {
          count: allNodes.length,
          ids: allNodes.map(n => n.id)
        })
      }
      
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
          multiModelMode: multiModelMode,
          isMain: true,
          position: { x: 0, y: 0 }
        })
      }
      
      // Helper function to ensure messages have required fields
      const sanitizeMessages = (msgs: any[]) => {
        if (!msgs || !Array.isArray(msgs)) return []
        
        return msgs
          .filter(msg => msg && typeof msg === 'object' && (msg.text || msg.streamingText)) // Only include valid messages with text
          .map(msg => {
            const sanitized = {
              ...msg,
              text: msg.text || msg.streamingText || '', // Ensure text field exists, use streamingText as fallback
            }
            
            // Clean up: remove undefined values and ensure required fields
            Object.keys(sanitized).forEach(key => {
              if (sanitized[key] === undefined) {
                delete sanitized[key]
              }
            })
            
            // If message has text (not just streamingText), mark as complete
            if (msg.text && !msg.isStreaming) {
              sanitized.isStreaming = false
              if (sanitized.streamingText && sanitized.text === sanitized.streamingText) {
                delete sanitized.streamingText
              }
            }
            
            return sanitized
          })
      }
      
      // Convert conversationNodes to proper branch format for MongoDB
      const branchesForSave = allNodes.map(node => {
        const isMainNode = node.id === 'main' || node.isMain
        const nodeMessages = isMainNode ? messages : (node.messages || [])
        
        return {
          id: node.id,
          label: node.title || node.data?.label || 'Untitled',
          parentId: node.parentId || (isMainNode ? undefined : 'main'),
          messages: sanitizeMessages(nodeMessages), // Sanitize messages before saving
          selectedAIs: isMainNode ? selectedAIs : (node.selectedAIs || node.data?.selectedAIs || []),
          multiModelMode: isMainNode ? multiModelMode : (node.multiModelMode || false),
          isMinimized: node.isMinimized || node.data?.isMinimized || false,
          isActive: node.id === currentBranch,
          isGenerating: node.data?.isGenerating || false,
          isHighlighted: node.data?.isHighlighted || false,
          position: node.position || node.data?.position || { x: 0, y: 0 },
          isMain: isMainNode
        }
      })
      
      console.log('📦 Branches to save (after conversion):', branchesForSave.map(b => ({
        id: b.id,
        isMain: b.isMain,
        type: b.isMain ? 'main' : 'branch',
        parentId: b.parentId,
        messagesCount: b.messages?.length || 0,
        label: b.label
      })))
      
      // Log non-main branches specifically
      const nonMainBranches = branchesForSave.filter(b => !b.isMain && b.id !== 'main')
      console.log('📦 Non-main branches to save:', {
        count: nonMainBranches.length,
        branches: nonMainBranches.map(b => ({
          id: b.id,
          type: 'branch',
          parentId: b.parentId,
          messagesCount: b.messages?.length || 0,
          label: b.label
        }))
      })
      
      console.log('📦 Saving branches to MongoDB:', {
        count: branchesForSave.length,
        ids: branchesForSave.map(b => b.id),
        hasMain: branchesForSave.some(b => b.id === 'main'),
        nonMainCount: nonMainBranches.length
      })
      
      const conversationData = mongoDBService.convertAppStateToMongoDB({
        title: 'Conversation',
        messages: sanitizeMessages(messages), // Sanitize main messages too
        selectedAIs,
        multiModelMode,
        branches: branchesForSave,
        contextLinks: [],
        collapsedNodes: [],
        minimizedNodes: [],
        activeNodeId: currentBranch || undefined,
        viewport: { x: 0, y: 0, zoom: 1 }
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
            multiModelMode: b.multiModelMode,
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
      autoSaveConversation(conversationData, currentConversationIdRef.current || undefined)
      }, 100) // Small delay to ensure React state updates are complete
      
      return () => clearTimeout(timeoutId)
    }
  }, [messages, selectedAIs, multiModelMode, conversationNodes, currentBranch, branches, autoSaveConversation])

  // Auto-select "Best" AI in single mode, clear selection in multi-mode
  useEffect(() => {
    if (!multiModelMode && selectedAIs.length === 0) {
      setSelectedAIs([defaultAI])
    } else if (multiModelMode && selectedAIs.length === 1 && selectedAIs[0].id === 'best') {
      setSelectedAIs([])
    }
  }, [multiModelMode, selectedAIs.length])

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
      // Remove from local state
      setSavedBranches(prev => prev.filter(b => b.id !== branchId))
      
      // Also delete from MongoDB if it's a saved conversation
      if (currentConversationIdRef.current === branchId) {
        currentConversationIdRef.current = null
      }
      
      addToast({
        type: 'success',
        title: 'Deleted',
        message: 'Conversation deleted successfully.'
      })
    } catch (error) {
      console.error('Error deleting branch:', error)
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Could not delete conversation.'
      })
    }
  }
  
  // Create new conversation
  const handleCreateNewConversation = async () => {
    // Reset all state
    setMessages([])
    setSelectedAIs([defaultAI])
    setMultiModelMode(false)
    setBranches([])
    setConversationNodes([])
    setCurrentBranch(null)
    
    // Clear current conversation ID to trigger creation of a new one
    currentConversationIdRef.current = null
    
    // Create new conversation in MongoDB
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Conversation',
          mainMessages: [],
          selectedAIs: [{ 
            id: defaultAI.id, 
            name: defaultAI.name, 
            color: defaultAI.color,
            functional: true
          }],
          multiModelMode: false,
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
            multiModelMode: false,
            isMain: true,
            position: { x: 0, y: 0 }
          }],
          viewport: { x: 0, y: 0, zoom: 1 }
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Set the new conversation ID
        currentConversationIdRef.current = data.data._id
        console.log('✅ Created new conversation:', currentConversationIdRef.current)
        
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
          message: 'Created a new conversation'
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
      // Get conversation by ID
      const response = await fetch(`/api/conversations/${conversationId}`)
      const data = await response.json()
      
      if (data.success) {
        // Restore conversation
        restoreConversation(data.data)
        
        // Show success toast
        addToast({
          type: 'success',
          title: 'Conversation Loaded',
          message: 'Loaded conversation from history'
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
          setMultiModelMode(false)
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

  // Function to update conversation nodes from flow canvas (with memoization)
  const updateConversationNodes = useCallback((nodes: any[]) => {
    console.log('🔄 updateConversationNodes called with', nodes.length, 'nodes')
    console.log('🔄 Node IDs from FlowCanvas:', nodes.map(n => n.id))
    
    // Only update if nodes have actually changed
    const newConversationNodes = nodes.map(node => {
      // Find parent node by looking at edges or node data
      let parentId = node.data.parentId
      
      // If no direct parentId, try to infer from node position or data
      if (!parentId && node.id !== 'main') {
        // For branch nodes, the parent is usually 'main' unless specified otherwise
        parentId = 'main'
      }
      
      const isMainNode = node.id === 'main' || node.data.isMain
      
      return {
        id: node.id,
        type: node.type || (isMainNode ? 'main' : 'branch'),
        title: node.data.messages?.[0]?.text?.substring(0, 30) + '...' || node.data.label || 'Untitled',
        messages: node.data.messages || [],
        timestamp: node.data.messages?.[0]?.timestamp || Date.now(),
        parentId: isMainNode ? undefined : (parentId || 'main'), // Ensure branches have parentId='main'
        children: [],
        isActive: node.id === activeBranchId,
        // Store ALL node data for complete restoration
        selectedAIs: node.data.selectedAIs || [],
        multiModelMode: node.data.multiModelMode || false,
        isMain: isMainNode,
        isMinimized: node.data.isMinimized || false,
        showAIPill: node.data.showAIPill || false,
        position: node.position || { x: 0, y: 0 },
        // Store all additional data
        nodeData: {
          label: node.data.label,
          onAddAI: node.data.onAddAI,
          onRemoveAI: node.data.onRemoveAI,
          onBranch: node.data.onBranch,
          onSendMessage: node.data.onSendMessage,
          onToggleMinimize: node.data.onToggleMinimize,
          isGenerating: node.data.isGenerating,
          existingBranchesCount: node.data.existingBranchesCount,
          height: node.data.height,
          isHighlighted: node.data.isHighlighted
        }
      }
    })
    
    // Merge FlowCanvas nodes with existing conversationNodes instead of replacing
    // This ensures manually added branches (before FlowCanvas creates them) are preserved
    setConversationNodes(prev => {
      // Create a map of FlowCanvas nodes by ID for quick lookup
      const flowCanvasNodesMap = new Map(newConversationNodes.map(n => [n.id, n]))
      
      // Start with FlowCanvas nodes (they're the source of truth once created)
      const merged: any[] = [...newConversationNodes]
      
      // Ensure main node is always included
      const hasMainNode = merged.some(n => n.id === 'main' || n.isMain)
      if (!hasMainNode && prev.some(n => n.id === 'main' || n.isMain)) {
        const mainNode = prev.find(n => n.id === 'main' || n.isMain)
        if (mainNode) {
          console.log('🔀 Adding main node to merged nodes')
          merged.unshift(mainNode) // Add main node at the beginning
        }
      }
      
      // Add any nodes from prev that don't exist in FlowCanvas yet
      // These are branches that were manually added but FlowCanvas hasn't created yet
      prev.forEach(prevNode => {
        if (!flowCanvasNodesMap.has(prevNode.id)) {
          console.log('🔀 Preserving manually added node not yet in FlowCanvas:', {
            id: prevNode.id,
            type: prevNode.type,
            parentId: prevNode.parentId,
            isMain: prevNode.isMain
          })
          // Ensure preserved branches have correct structure
          const preservedNode = {
            ...prevNode,
            type: prevNode.type || (prevNode.isMain ? 'main' : 'branch'),
            parentId: prevNode.isMain ? undefined : (prevNode.parentId || 'main')
          }
          merged.push(preservedNode)
        }
      })
      
      // Log all branches in merged nodes
      const branchesInMerged = merged.filter(n => !n.isMain && n.id !== 'main')
      console.log('📊 Branches in merged conversationNodes:', {
        totalNodes: merged.length,
        branches: branchesInMerged.length,
        branchIds: branchesInMerged.map(n => ({ id: n.id, type: n.type, parentId: n.parentId }))
      })
      
      // Check if anything actually changed using a stable comparison
      const prevIds = new Set(prev.map(n => n.id))
      const mergedIds = new Set(merged.map(n => n.id))
      
      // Check if IDs changed
      const idsChanged = prevIds.size !== mergedIds.size || 
        [...mergedIds].some(id => !prevIds.has(id))
      
      // Check if node data changed (only check essential fields)
      const dataChanged = idsChanged || merged.some((newNode) => {
        const prevNode = prev.find(p => p.id === newNode.id)
        if (!prevNode) return true
        
        return prevNode.messages?.length !== newNode.messages?.length ||
               prevNode.isActive !== newNode.isActive ||
               prevNode.isMain !== newNode.isMain
      })
      
      if (dataChanged) {
        console.log('🔄 Merged conversationNodes:', {
          prevCount: prev.length,
          newCount: merged.length,
          ids: merged.map(n => n.id)
        })
        return merged
      }
      
      return prev
    })
  }, [activeBranchId])
  
  // Stop AI generation
  const stopGeneration = () => {
    setIsGenerating(false)
    // In a real app, you would cancel any ongoing API requests here
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
    const context: ConversationContext = {
      messages: [...messages, newMessage],
      currentBranch: activeBranchId || 'main',
      parentMessages: messages
    }
    
    // Start generating response
    setIsGenerating(true)
    
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
      console.log('📍 Multi-model mode enabled:', multiModelMode)
      
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
          
          console.log(`🔍 Checking if ${modelName} is available...`)
          if (!aiService.isModelAvailable(modelName)) {
            console.warn(`❌ Model ${modelName} not available, using fallback`)
            console.warn(`❌ Environment variables:`, {
              MISTRAL_API_KEY: !!process.env.NEXT_PUBLIC_MISTRAL_API_KEY,
              GEMINI_API_KEY: !!process.env.NEXT_PUBLIC_GEMINI_API_KEY
            })
            return {
              id: `msg-${Date.now()}-${ai.id}-${index}`,
              text: `${ai.name} response to: "${text}" (API not configured)`,
              isUser: false,
              timestamp: Date.now(),
              parentId: newMessage.id,
              children: [],
              aiModel: ai.id,
              groupId: groupId
            }
          }
          console.log(`✅ Model ${modelName} is available`)

          console.log(`🚀 Calling ${modelName} API for ${ai.name}`)
          
          // Create streaming message placeholder for multi-model
          const streamingMessageId = `msg-${Date.now()}-${ai.id}-${index}`
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
          
          const response = await aiService.generateResponse(
            modelName,
            text,
            context,
            (chunk: string) => {
              // Handle streaming response - update the streaming message
              console.log(`Streaming from ${ai.name}:`, chunk)
              setMessages(prev => prev.map(msg => 
                msg.id === streamingMessageId 
                  ? { ...msg, streamingText: (msg.streamingText || '') + chunk }
                  : msg
              ))
            }
          )
          console.log(`✅ Got response from ${ai.name}:`, response.text.substring(0, 50) + '...')

          // Finalize the streaming message
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId 
              ? { 
                  ...msg, 
                  text: response.text, 
                  isStreaming: false, 
                  streamingText: undefined,
                  timestamp: response.timestamp
                }
              : msg
          ))

          return {
            id: streamingMessageId,
            text: response.text,
            isUser: false,
            timestamp: response.timestamp,
            parentId: newMessage.id,
            children: [],
            aiModel: ai.id,
            groupId: groupId
          }
        } catch (error) {
          console.error(`Error generating response for ${ai.name}:`, error)
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

      // Wait for all AI responses
      const aiResponses = await Promise.all(aiPromises)
      
      // Responses are already added as streaming messages, just update branches
      aiResponses.forEach((response, index) => {
        setTimeout(() => {
          // Update branch if needed
          if (activeBranchId) {
            setSavedBranches(prev => 
              prev.map(b => b.id === activeBranchId 
                ? { ...b, messages: [...b.messages, response] } 
                : b
              )
            )
          }
          
          // If this is the last AI, stop generating
          if (index === aiResponses.length - 1) {
            setIsGenerating(false)
          }
        }, (index + 1) * 500)
      })
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
        
        console.log(`🔍 Single mode: Checking if ${modelName} is available...`)
        if (aiService.isModelAvailable(modelName)) {
          console.log(`✅ Single mode: Model ${modelName} is available`)
          console.log(`🚀 Single mode: Calling ${modelName} API for ${selectedAI?.name}`)
          
          // Create streaming message placeholder
          const streamingMessageId = `msg-${Date.now()}`
          const streamingMessage: Message = {
            id: streamingMessageId,
            text: '',
            isUser: false,
            timestamp: Date.now(),
            parentId: newMessage.id,
            children: [],
            aiModel: selectedAI?.id,
            isStreaming: true,
            streamingText: ''
          }
          
          // Add streaming message to UI immediately
          setMessages(prev => [...prev, streamingMessage])
          
          const response = await aiService.generateResponse(
            modelName,
            text,
            context,
            (chunk: string) => {
              // Handle streaming response - update the streaming message
              console.log(`Streaming from ${selectedAI?.name}:`, chunk)
              setMessages(prev => prev.map(msg => 
                msg.id === streamingMessageId 
                  ? { ...msg, streamingText: (msg.streamingText || '') + chunk }
                  : msg
              ))
            }
          )
          console.log(`✅ Single mode: Got response from ${selectedAI?.name}:`, response.text.substring(0, 50) + '...')
          
          // Finalize the streaming message
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId 
              ? { 
                  ...msg, 
                  text: response.text, 
                  isStreaming: false, 
                  streamingText: undefined,
                  timestamp: response.timestamp
                }
              : msg
          ))
          
          aiResponse = {
            id: streamingMessageId,
            text: response.text,
            isUser: false,
            timestamp: response.timestamp,
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
      } catch (error) {
        console.error('Error generating AI response:', error)
        
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
  const [savedBranches, setSavedBranches] = useState<Branch[]>([])
  const [lastBranchTime, setLastBranchTime] = useState<number>(0)

  const branchFromMessage = (messageId: string) => {
    console.log('📍 branchFromMessage called with:', messageId)
    console.log('📍 Current branches length:', branches.length)
    console.log('📍 Current messages:', messages.map(m => ({ id: m.id, text: m.text.substring(0, 20) + '...' })))
    
    if (!messageId) return
    
    // Prevent duplicates when effect runs twice in StrictMode
    if (creatingBranchRef.current.has(messageId)) {
      console.log('📍 Branch already being created for this message, skipping')
      return
    }
    
    // Debounce rapid branch creation (prevent multiple clicks within 500ms)
    const now = Date.now()
    if (now - lastBranchTime < 500) {
      console.log('📍 Branch creation debounced - too soon after last branch')
      return
    }
    setLastBranchTime(now)
    
    // Mark this message as being branched
    creatingBranchRef.current.add(messageId)
    
    // Set the current branch
    setCurrentBranch(messageId)
    
    // Create branch data for MongoDB
    const branchId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newBranch = {
      id: branchId,
      title: generateBranchTitle(messages),
      messages: [...messages],
      timestamp: Date.now(),
      parentId: 'main',
      selectedAIs: selectedAIs.map(ai => ({
        id: ai.id,
        name: ai.name,
        color: ai.color,
        functional: ai.functional
      })),
      multiModelMode: multiModelMode,
      position: { x: 0, y: 0 },
      isActive: true,
      isMain: false
    }
    
    // Store branch data in ref for saving
    const branchNode = {
      id: branchId,
      type: 'branch',
      title: newBranch.title,
      messages: newBranch.messages,
      timestamp: newBranch.timestamp,
      parentId: newBranch.parentId,
      children: [],
      isActive: true,
      selectedAIs: newBranch.selectedAIs,
      multiModelMode: newBranch.multiModelMode,
      isMain: false,
      isMinimized: false,
      showAIPill: true,
      position: newBranch.position,
      nodeData: {}
    }
    branchDataRef.current.set(branchId, branchNode)
    
    // Add to conversationNodes immediately so it gets saved
    // FlowCanvas will update it via onNodesUpdate with full data later
    setConversationNodes(prev => {
      const updated = [...prev, branchNode]
      console.log('📦 Added branch to conversationNodes:', {
        branchId,
        totalNodes: updated.length,
        nodeIds: updated.map(n => n.id),
        branchData: {
          type: branchNode.type,
          parentId: branchNode.parentId,
          messagesCount: branchNode.messages.length
        }
      })
      return updated
    })
    
    // Add to branches array for saving (this triggers canvas mode)
    setBranches(prev => {
      if (prev.length === 0) {
        console.log('📍 Switching to canvas mode for first branch')
        return [{ id: branchId }]
      } else {
        console.log('📍 Adding branch to existing branches')
        return [...prev, { id: branchId }]
      }
    })
    
    // Only set pending branch message ID if this is the first branch
    if (branches.length === 0) {
      
      // Set the initial branch message after canvas is mounted
      setTimeout(() => {
        setPendingBranchMessageId(messageId)
      }, 50)
    } else {
      console.log('📍 Already in canvas mode - creating new branch')
      // When already in canvas mode, create the branch directly
      setPendingBranchMessageId(messageId)
    }
  }

  const toggleMultiModel = () => {
    setMultiModelMode(!multiModelMode)
  }

  // Effect to auto-save conversation as branch when it changes
  useEffect(() => {
    if (messages.length > 0 && !activeBranchId && savedBranches.length === 0) {
      saveCurrentBranch()
    }
  }, [messages.length === 1]) // Only run when first message is added
  
  // Command palette commands
  const commandPaletteCommands = [
    {
      id: 'toggle-multi-model',
      title: 'Toggle Multi-Model Mode',
      description: 'Switch between single and multi-AI mode',
      action: () => setMultiModelMode(!multiModelMode)
    },
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
    <div className="h-screen bg-gray-50 overflow-hidden">
      {/* MongoDB Save Status Indicator */}
      {(isSaving || lastSaved) && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 text-sm">
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-600">Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-green-500">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-gray-600">Saved {lastSaved.toLocaleTimeString()}</span>
              </>
            ) : null}
          </div>
        </div>
      )}
      
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
      {branches.length === 0 && conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length === 0 ? (
        <div className="flex items-center justify-center h-screen p-4">
          <div className="w-full max-w-4xl border border-gray-200 rounded-2xl bg-white shadow-lg p-6">
            {/* Header with AI Pills and Mode Toggle */}
            <div className="flex items-center justify-between mb-6">
              {/* AI Selector */}
              <AIPills
                selectedAIs={selectedAIs}
                onAddAI={addAI}
                onRemoveAI={removeAI}
                onSelectSingle={selectSingleAI}
                showAddButton={multiModelMode}
                singleMode={!multiModelMode}
                getBestAvailableModel={getBestAvailableModel}
              />
              
              {/* Multi-Model Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Mode:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setMultiModelMode(false)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      !multiModelMode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Single
                  </button>
                  <button
                    onClick={() => setMultiModelMode(true)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      multiModelMode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Multi
                  </button>
                </div>
              </div>

              {/* Export/Import Button */}
              <button
                onClick={() => setShowExportImport(true)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
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
              multiModelMode={multiModelMode}
              isGenerating={isGenerating}
              onStopGeneration={stopGeneration}
              existingBranchesCount={branches.length}
            />
          </div>
        </div>
      ) : (
        /* Flow Canvas Layout - Only when branches exist */
        <FlowCanvas
          selectedAIs={selectedAIs}
          onAddAI={addAI}
          onRemoveAI={removeAI}
          mainMessages={messages}
          onSendMainMessage={sendMessage}
          onBranchFromMain={branchFromMessage}
          initialBranchMessageId={currentBranch}
          pendingBranchMessageId={pendingBranchMessageId}
          onPendingBranchProcessed={() => setPendingBranchMessageId(null)}
          onNodesUpdate={updateConversationNodes}
          onNodeDoubleClick={(nodeId) => {
            console.log('Node double-clicked:', nodeId)
            // TODO: Implement focus mode in Phase 4
          }}
          onPillClick={(aiId) => {
            console.log('Pill clicked:', aiId)
            // TODO: Implement pill navigation in Phase 1
          }}
          getBestAvailableModel={getBestAvailableModel}
          onSelectSingle={selectSingleAI}
          multiModelMode={multiModelMode}
          onExportImport={() => setShowExportImport(true)}
          restoredConversationNodes={conversationNodes}
          selectedBranchId={activeBranchId}
        />
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