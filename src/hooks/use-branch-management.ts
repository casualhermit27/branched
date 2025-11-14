'use client'

import { useCallback, useRef } from 'react'
import { Node, Edge } from 'reactflow'

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
  ai?: string
  parentId?: string
  children: string[]
  timestamp: number
  responses?: { [aiId: string]: string }
  aiModel?: string
  groupId?: string
}

interface UseBranchManagementParams {
  // Node/Edge refs
  nodesRef: React.MutableRefObject<Node[]>
  edgesRef: React.MutableRefObject<Edge[]>
  
  // State setters
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  setNodeId: React.Dispatch<React.SetStateAction<number>>
  forceUpdate: () => void
  
  // Data
  selectedAIs: AI[]
  mainMessages: Message[]
  
  // Callbacks
  onNodesUpdate?: (nodes: any[]) => void
  onBranchWarning?: (data: { messageId: string; messageText?: string; existingBranchId: string; isMultiBranch: boolean }) => void
  onNodeDoubleClick?: (nodeId: string) => void
  
  // Branch multi-model handlers
  handleBranchAddAI: (nodeId: string, ai: AI) => void
  handleBranchRemoveAI: (nodeId: string, aiId: string) => void
  handleBranchSelectSingle: (nodeId: string, aiId: string) => void
  handleBranchToggleMultiModel: (nodeId: string) => void
  
  // Utilities
  getBestAvailableModel?: () => string
  validateNodePositions: (nodeList: any[]) => any[]
  getLayoutedElements: (nodes: any[], edges: Edge[], direction?: string) => { nodes: any[], edges: Edge[] }
  fitViewportToNodes: (nodeIds: string[], padding?: number) => void
  handleSendMessageRef: React.MutableRefObject<((parentId: string, message: string) => Promise<void>) | undefined>
  
  // State
  minimizedNodes: Set<string>
  activeNodeId: string | null
  toggleNodeMinimize: (nodeId: string) => void
  onDeleteBranch?: (branchId: string) => void
}

export function useBranchManagement({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  setNodeId,
  forceUpdate,
  selectedAIs,
  mainMessages,
  onNodesUpdate,
  onBranchWarning,
  onNodeDoubleClick,
  handleBranchAddAI,
  handleBranchRemoveAI,
  handleBranchSelectSingle,
  handleBranchToggleMultiModel,
  getBestAvailableModel,
  validateNodePositions,
  getLayoutedElements,
  fitViewportToNodes,
  handleSendMessageRef,
  minimizedNodes,
  activeNodeId,
  toggleNodeMinimize,
  onDeleteBranch
}: UseBranchManagementParams) {
  
  // Clean duplicate prevention: Single source of truth
  const branchCreationLockRef = useRef<Map<string, boolean>>(new Map()) // Maps messageId -> isLocked
  const branchIdCounterRef = useRef<number>(0) // Counter for unique branch IDs
  const handleBranchRef = useRef<(parentNodeId: string, messageId?: string, isMultiBranch?: boolean) => void | undefined>(undefined)
  
  // Helper function to check if branch exists for a messageId from a parent
  const branchExistsForMessage = useCallback((parentNodeId: string, messageId: string): boolean => {
    const currentNodes = nodesRef.current
    return currentNodes.some(node => {
      // Skip main node and parent node itself
      if (node.id === 'main' || node.id === parentNodeId) return false
      
      // Check if this is a branch from the parent
      if (node.data?.parentId !== parentNodeId) return false
      
      // Check if this branch's parentMessageId matches
      return node.data?.parentMessageId === messageId
    })
  }, [nodesRef])
  
  // Helper function to generate unique branch ID
  const generateBranchId = useCallback((): string => {
    branchIdCounterRef.current += 1
    return `branch-${Date.now()}-${branchIdCounterRef.current}-${Math.random().toString(36).substr(2, 9)}`
  }, [])
  
  // ✅ NEW: Deduplicate messages helper
  // Only deduplicate by message ID, not by other fields
  // This prevents false positives when messages legitimately share properties
  // Silently deduplicate without warnings (React StrictMode causes double-invocation)
  const deduplicateMessages = useCallback((msgs: any[]): any[] => {
    const seen = new Set<string>()
    return msgs.filter(m => {
      // Only deduplicate by actual message ID, not by composite keys
      // This ensures we don't remove legitimate messages
      const key = m.id
      if (!key) {
        // If no ID, include it (might be a new message)
        return true
      }
      if (seen.has(key)) {
        // Silently remove duplicates - don't warn (React StrictMode causes this)
        return false
      }
      seen.add(key)
      return true
    })
  }, [])
  
  // ✅ NEW: Deduplicate by AI model helper
  const deduplicateByModel = useCallback((msgs: any[]): any[] => {
    const seen = new Set<string>()
    return msgs.filter(m => {
      if (!m.aiModel) return false
      if (seen.has(m.aiModel)) {        return false
      }
      seen.add(m.aiModel)
      return true
    })
  }, [])
  
  // ✅ Enhanced: Get messages till a specific message ID (for inherited context)
  // This includes all messages up to and including the target message
  // If branching from a user message, also includes the paired AI reply if it exists
  const getMessagesTill = useCallback((messageId: string, allMsgs: any[], includePairedAI: boolean = false): any[] => {
    const result: any[] = []
    const targetIndex = allMsgs.findIndex(msg => msg.id === messageId)
    
    if (targetIndex === -1) {      // If message not found, return all messages up to the end
      return [...allMsgs]
    }
    
    // Include all messages up to and including the target message
    for (let i = 0; i <= targetIndex; i++) {
      result.push(allMsgs[i])
    }
    
    // If branching from a user message and includePairedAI is true,
    // check if there's an AI reply right after it
    if (includePairedAI && targetIndex >= 0) {
      const targetMessage = allMsgs[targetIndex]
      if (targetMessage.isUser && targetIndex + 1 < allMsgs.length) {
        const nextMessage = allMsgs[targetIndex + 1]
        // If next message is an AI reply (not a user message), include it
        if (!nextMessage.isUser && (nextMessage.aiModel || nextMessage.ai || nextMessage.role === 'assistant')) {
          // Check if it's a direct child or part of the same group
          const isPairedReply = nextMessage.parentId === messageId || 
                                (targetMessage.groupId && nextMessage.groupId === targetMessage.groupId)
          
          if (isPairedReply || targetIndex + 1 === targetIndex + 1) {
            result.push(nextMessage)            })
          }
        }
      }
    }
    
      targetMessageId: messageId,
      targetIndex,
      includePairedAI,
      totalMessages: allMsgs.length,
      inheritedCount: result.length,
      inheritedIds: result.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
    })
    
    return result
  }, [])
  
  // ✅ NEW: Calculate branch position
  const getBranchPosition = useCallback((parentNodeId: string, branchIndex: number, totalBranches: number): { x: number, y: number } => {
    const parentNode = nodesRef.current.find(n => n.id === parentNodeId)
    if (!parentNode) return { x: 0, y: 0 }
    
    const baseX = parentNode.position.x + 400 // Offset to the right
    const baseY = parentNode.position.y
    
    if (totalBranches === 1) {
      return { x: baseX, y: baseY }
    }
    
    // Spread branches vertically
    const spacing = 200
    const startY = baseY - ((totalBranches - 1) * spacing) / 2
    return {
      x: baseX,
      y: startY + (branchIndex * spacing)
    }
  }, [nodesRef])
  
  // ✅ Enhanced: Create branch node helper with improved context preservation
  const createBranchNode = useCallback((
    parentNodeId: string,
    inheritedMessages: any[],
    aiResponse: any,
    branchIndex: number,
    totalBranches: number,
    targetMessageId?: string, // The message ID that triggered this branch creation
    streamingMessage?: any // Optional: streaming message to duplicate if branching during generation
  ): Node => {
    const ai = selectedAIs.find(a => a.id === aiResponse.aiModel || a.id === aiResponse.ai) || selectedAIs[0]
    const newId = generateBranchId()
    const position = getBranchPosition(parentNodeId, branchIndex, totalBranches)
    
    // parentMessageId should be the message that triggered branch creation
    // If targetMessageId is provided, use it; otherwise use aiResponse.id (the AI message itself)
    const parentMessageId = targetMessageId || aiResponse.id
    
    // Generate auto-name for branch based on messages
    const generateBranchName = (): string => {
      if (targetMessageId) {
        const targetMsg = inheritedMessages.find((m: any) => m.id === targetMessageId)
        if (targetMsg) {
          const previewText = targetMsg.text?.substring(0, 40) || 'message'
          if (targetMsg.isUser) {
            return `Branch from "${previewText}..."`
          } else {
            return `Branch from AI response`
          }
        }
      }
      return ai?.name ? `Branch: ${ai.name}` : 'New Branch'
    }
    
    // CRITICAL FIX: Always include the AI response in branchMessages
    // The AI response should ALWAYS be the first message in the branch
    // This ensures branches always start with the AI response that triggered them
    // Only skip if it's a placeholder (empty response)
    const isPlaceholder = aiResponse.id?.startsWith('placeholder-') || !aiResponse.text || aiResponse.text === ''
    
    // Check if AI response is already in inheritedMessages (from paired AI reply logic)
    const aiResponseInInherited = inheritedMessages.some((m: any) => m.id === aiResponse.id)
    
    // CRITICAL FIX: When branching from an AI message, we explicitly excluded it from inheritedMessages
    // So we MUST include it in branchMessages, regardless of aiResponseInInherited check
    // The aiResponseInInherited check is only relevant when branching from user messages
    // When branching from AI message, aiResponseInInherited will be false (because we excluded it),
    // so branchMessagesArray will contain the AI response - this is correct behavior
    
    // CRITICAL: When branching from an AI message (parentMessageId === aiResponse.id),
    // we MUST include the AI response even if aiResponseInInherited is true (shouldn't happen, but safety check)
    // Also check if targetMessageId matches aiResponse.id (another way to detect branching from AI)
    const isBranchingFromAI = parentMessageId === aiResponse.id || targetMessageId === aiResponse.id    })
    
    // CRITICAL: Ensure aiResponse has required properties
    if (!aiResponse || !aiResponse.id) {      // Return empty branch messages if aiResponse is invalid
      return {
        id: newId,
        type: 'chatNode',
        position,
        data: {
          label: 'Invalid Branch',
          messages: inheritedMessages,
          inheritedMessages: inheritedMessages,
          branchMessages: [],
          parentMessageId: parentMessageId,
          selectedAIs: [ai],
          onBranch: (nodeId: string, msgId?: string) => handleBranchRef.current?.(nodeId, msgId, false),
          onSendMessage: (nodeId: string, msg: string) => handleSendMessageRef.current?.(nodeId, msg),
          isMain: false,
          showAIPill: true,
          parentId: parentNodeId,
          onAddAI: (ai: AI) => handleBranchAddAI(newId, ai),
          onRemoveAI: (aiId: string) => handleBranchRemoveAI(newId, aiId),
          onSelectSingle: (aiId: string) => handleBranchSelectSingle(newId, aiId),
          onToggleMultiModel: (nodeId: string) => handleBranchToggleMultiModel(nodeId),
          getBestAvailableModel: getBestAvailableModel,
          multiModelMode: false,
          nodeId: newId,
          isMinimized: minimizedNodes.has(newId),
          isActive: activeNodeId === newId,
          onToggleMinimize: toggleNodeMinimize,
          onDeleteBranch: onDeleteBranch
        }
      }
    }
    
    // CRITICAL FIX: When branching from an AI message, ALWAYS include it in branchMessages
    // Even if aiResponseInInherited is somehow true, we still want it in branchMessages
    // because we explicitly excluded it from inheritedMessages
    const shouldIncludeAIResponse = !isPlaceholder && (!aiResponseInInherited || isBranchingFromAI)
    
    // 🔥 NEW: If branching during generation, include the streaming message in branchMessages
    // This allows generation to continue in the branch
    let branchMessagesArray: any[] = []
    
    if (shouldIncludeAIResponse) {
      branchMessagesArray = [{ 
        ...aiResponse, 
        isUser: false,
        parentId: parentMessageId,
        branchId: newId
      }]
    }
    
    // 🔥 NEW: If streaming message is provided (branching during generation), add it to branchMessages
    if (streamingMessage) {
      // Create a duplicate streaming message for the branch with a new ID
      const branchStreamingMessage = {
        ...streamingMessage,
        id: `branch-${streamingMessage.id}-${newId}`, // Unique ID for branch
        parentId: parentMessageId,
        branchId: newId,
        isStreaming: true,
        streamingText: streamingMessage.streamingText || ''
      }
      branchMessagesArray.push(branchStreamingMessage)      })
    }
    
      aiResponseId: aiResponse.id,
      aiResponseText: aiResponse.text?.substring(0, 50),
      isPlaceholder,
      aiResponseInInherited,
      isBranchingFromAI,
      shouldIncludeAIResponse,
      branchMessagesCount: branchMessagesArray.length,
      inheritedCount: inheritedMessages.length,
      willIncludeAIResponse: shouldIncludeAIResponse,
      parentMessageId,
      inheritedMessageIds: inheritedMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 20) }))
    })
    
    // DEBUG: Log what will be in the branch
      branchId: newId,
      inheritedMessages: inheritedMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) })),
      branchMessagesArray: branchMessagesArray.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) })),
      willHaveMessages: inheritedMessages.length > 0 || branchMessagesArray.length > 0,
      aiResponseId: aiResponse.id,
      aiResponseWillBeIncluded: branchMessagesArray.length > 0
    })
    
    // Combine inheritedMessages and branchMessages into a single messages array
    // This is what ChatNode expects in node.data.messages
    // Inherited messages already include all messages up to and including the branch point
    // Ensure all messages have correct isUser flag before combining
    // CRITICAL: Force isUser flags - be very strict
    const validatedInherited = inheritedMessages.map((m: any) => {
      const hasAIModel = !!(m.aiModel || m.ai)
      // If message has aiModel or ai, it MUST be isUser: false
      if (hasAIModel) {
        return { ...m, isUser: false }
      }
      // If message doesn't have aiModel or ai, it MUST be isUser: true
      return { ...m, isUser: true }
    })
    
    const validatedBranch = branchMessagesArray.map((m: any) => {
      const hasAIModel = !!(m.aiModel || m.ai)
      // If message has aiModel or ai, it MUST be isUser: false
      if (hasAIModel) {
        return { ...m, isUser: false }
      }
      // If message doesn't have aiModel or ai, it MUST be isUser: true
      return { ...m, isUser: true }
    })
    
      branchId: newId,
      branchMessagesArrayCount: branchMessagesArray.length,
      validatedBranchCount: validatedBranch.length,
      validatedBranchIds: validatedBranch.map((m: any) => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
    })
    
    // CRITICAL FIX: When AI response is already in inheritedMessages (from paired AI logic),
    // we should NOT filter it out, because it's part of the context we want to preserve
    // Only filter if we're adding it separately to branchMessages
    const shouldFilterAIResponse = !aiResponseInInherited && !isPlaceholder
    const filteredInherited = shouldFilterAIResponse 
      ? validatedInherited.filter((m: any) => m.id !== aiResponse.id)
      : validatedInherited // Keep all inherited messages if AI response is already there    const combinedMessages = [...filteredInherited, ...validatedBranch].map(msg => {
      const isAI = Boolean(msg.aiModel || msg.ai || msg.role === 'assistant')
      const forcedIsUser = !isAI
      
      // Log if we're fixing a misaligned message
            return {
        ...msg,
        isUser: forcedIsUser, // FORCE the correct value
      }
    })
    
    // CRITICAL FIX: Ensure AI response is always in combinedMessages when branching from AI message
    // Double-check that the AI response is included - if it's missing, add it explicitly
    const aiResponseInCombined = combinedMessages.some(m => m.id === aiResponse.id)
    if (!aiResponseInCombined && !isPlaceholder) {
      // AI response should be in validatedBranch, but if it's not in combinedMessages, add it
        aiResponseId: aiResponse.id,
        aiResponseText: aiResponse.text?.substring(0, 50),
        combinedCount: combinedMessages.length,
        validatedBranchCount: validatedBranch.length,
        branchMessagesArrayCount: branchMessagesArray.length
      })
      // Add AI response at the end of inherited messages (before branch messages)
      combinedMessages.splice(filteredInherited.length, 0, {
        ...aiResponse,
        isUser: false,
        parentId: parentMessageId,
        branchId: newId
      })
    }
    
      branchId: newId,
      inheritedCount: filteredInherited.length,
      branchMessagesCount: branchMessagesArray.length,
      validatedBranchCount: validatedBranch.length,
      totalCount: combinedMessages.length,
      aiResponseId: aiResponse.id,
      aiResponseInBranch: combinedMessages.some(m => m.id === aiResponse.id),
      firstMessage: combinedMessages[0]?.id,
      lastMessage: combinedMessages[combinedMessages.length - 1]?.id,
      allMessageIds: combinedMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 20) }))
    })
    
    return {
      id: newId,
      type: 'chatNode',
      position,
      data: {
        label: generateBranchName(), // Use auto-generated name
        messages: combinedMessages, // Combined messages for ChatNode
        inheritedMessages: filteredInherited, // Keep separate for MongoDB - use filtered version (no AI response duplicate)
        branchMessages: validatedBranch, // Keep separate for MongoDB - use validated version (includes AI response)
        parentMessageId: parentMessageId, // Use the target message ID that triggered branch creation
        selectedAIs: [ai],
        onBranch: (nodeId: string, msgId?: string) => handleBranchRef.current?.(nodeId, msgId, false),
        onSendMessage: (nodeId: string, msg: string) => { /* Will be set by handleSendMessageRef */ },
        isMain: false,
        showAIPill: true,
        parentId: parentNodeId,
        onAddAI: (ai: AI) => handleBranchAddAI(newId, ai),
        onRemoveAI: (aiId: string) => handleBranchRemoveAI(newId, aiId),
        onSelectSingle: (aiId: string) => handleBranchSelectSingle(newId, aiId),
        onToggleMultiModel: (nodeId: string) => handleBranchToggleMultiModel(nodeId),
        getBestAvailableModel: getBestAvailableModel,
        multiModelMode: false,
        nodeId: newId,
        isMinimized: minimizedNodes.has(newId),
        isActive: activeNodeId === newId,
        // Store lightweight message ID references for context
        messageIds: combinedMessages.map(m => m.id), // Lightweight reference
        contextSnapshot: {
          messageIds: filteredInherited.map(m => m.id), // Only IDs for lightweight storage
          branchMessageIds: validatedBranch.map(m => m.id),
          timestamp: Date.now()
        },
        onToggleMinimize: toggleNodeMinimize,
        onDeleteBranch: onDeleteBranch
      }
    }
  }, [selectedAIs, generateBranchId, getBranchPosition, handleBranchAddAI, handleBranchRemoveAI, handleBranchSelectSingle, handleBranchToggleMultiModel, getBestAvailableModel, minimizedNodes, activeNodeId, toggleNodeMinimize, onDeleteBranch])
  
  // ✅ NEW SIMPLIFIED handleBranch - Single entry point
  handleBranchRef.current = (parentNodeId: string, messageId?: string, isMultiBranch: boolean = false) => {
    if (!messageId) {      return
    }    // ✅ Lock check - prevent double execution
    if (branchCreationLockRef.current.get(messageId)) {      return
    }
    
    // ✅ Check if branch already exists - show warning modal
    const existingBranch = nodesRef.current.find(node => 
      node.id !== 'main' && 
      node.id !== parentNodeId &&
      node.data?.parentId === parentNodeId &&
      node.data?.parentMessageId === messageId
    )
    
    if (existingBranch) {      // Find the message text for the warning modal
      const targetMessage = (parentNodeId === 'main' ? mainMessages : (nodesRef.current.find(n => n.id === parentNodeId)?.data?.messages || []))
        .find((m: any) => m.id === messageId)
      
      // Call the warning handler if provided
      if (onBranchWarning) {
        onBranchWarning({
          messageId,
          messageText: targetMessage?.text?.substring(0, 100),
          existingBranchId: existingBranch.id,
          isMultiBranch
        })
      } else {
        // Fallback: navigate to existing branch        if (onNodeDoubleClick) {
          onNodeDoubleClick(existingBranch.id)
        }
      }
      return
    }
    
    // ✅ Set lock
    branchCreationLockRef.current.set(messageId, true)
    
    // ✅ Get all messages from parent node
    const parentNode = nodesRef.current.find(n => n.id === parentNodeId)
    if (!parentNode) {      branchCreationLockRef.current.delete(messageId)
      return
    }
    
    // Get messages from parent (main or branch)
    // CRITICAL FIX: When branching from a branch, we need to get ALL messages including inherited context
    // This ensures new branches get full context without needing a reload
    let allMessages: any[] = []
    if (parentNodeId === 'main') {
      // From main: use mainMessages directly
      allMessages = mainMessages
    } else {
      // From branch: combine inheritedMessages + branchMessages to get full context
      const parentInherited = parentNode.data.inheritedMessages || []
      const parentBranch = parentNode.data.branchMessages || []
      const parentCombined = parentNode.data.messages || []
      
      // Use combined messages if available, otherwise reconstruct from inherited + branch
      if (parentCombined.length > 0) {
        allMessages = parentCombined
      } else {
        // Reconstruct from inherited + branch messages
        allMessages = [...parentInherited, ...parentBranch]
      }
      
        parentNodeId,
        inheritedCount: parentInherited.length,
        branchCount: parentBranch.length,
        combinedCount: parentCombined.length,
        finalCount: allMessages.length,
        messageIds: allMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
      })
    }
    
    // 🔥 NEW: Check if main node is currently generating (has streaming messages)
    // This allows branching during generation
    const isMainGenerating = parentNodeId === 'main' && allMessages.some((m: any) => m.isStreaming || m.streamingText)
    const streamingMessages = isMainGenerating 
      ? allMessages.filter((m: any) => m.isStreaming || m.streamingText)
      : []
    
      parentNodeId,
      allMessagesCount: allMessages.length,
      isMain: parentNodeId === 'main',
      isMainGenerating,
      streamingMessagesCount: streamingMessages.length,
      messageIds: allMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, isStreaming: m.isStreaming, text: m.text?.substring(0, 30) }))
    })
    
    // ✅ Deduplicate messages FIRST
    const deduplicatedMessages = deduplicateMessages(allMessages)
    
      originalCount: allMessages.length,
      deduplicatedCount: deduplicatedMessages.length,
      messageIds: deduplicatedMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
    })
    
    // ✅ Find target message
    const targetMessage = deduplicatedMessages.find(m => m.id === messageId)
    if (!targetMessage) {      branchCreationLockRef.current.delete(messageId)
      return
    }    })
    
    // ✅ Determine AI responses to create branches for
    let aiResponses: any[] = []
    
    // Get the branch node's selectedAIs if branching from a branch (not main)
    const branchNodeSelectedAIs = parentNodeId !== 'main' 
      ? (parentNode.data?.selectedAIs || [])
      : []
    const effectiveSelectedAIs = branchNodeSelectedAIs.length > 0 ? branchNodeSelectedAIs : selectedAIs
    
      parentNodeId,
      isMain: parentNodeId === 'main',
      branchNodeSelectedAIs: branchNodeSelectedAIs.map((a: AI) => a.id),
      effectiveSelectedAIs: effectiveSelectedAIs.map((a: AI) => a.id),
      mainSelectedAIs: selectedAIs.map((a: AI) => a.id)
    })
    
    if (targetMessage.isUser && isMultiBranch) {
      // USER message + isMultiBranch → create one branch per AI model
      // Find AI responses that come after this user message
      const userMessageIndex = deduplicatedMessages.findIndex(m => m.id === messageId)
      
      if (userMessageIndex === -1) {        branchCreationLockRef.current.delete(messageId)
        return
      }
      
      // Get the user message's groupId if it exists
      const userGroupId = targetMessage.groupId
      
      // Find all AI responses that come after this user message
      // They should either:
      // 1. Have parentId === messageId (direct child)
      // 2. Have the same groupId (multi-model responses)
      // 3. Be the next non-user messages after the user message
      // 4. Match one of the branch's selectedAIs (if branching from a branch)
      const allAIResponses = deduplicatedMessages
        .slice(userMessageIndex + 1) // Get messages after the user message
        .filter(m => {
          // Stop at the next user message (we only want responses to THIS user message)
          if (m.isUser) return false
          
          // Must be an AI response
          if (!m.aiModel && !m.ai && m.role !== 'assistant') return false
          
          // Check if it's a response to this user message
          const isDirectChild = m.parentId === messageId
          const isSameGroup = userGroupId && m.groupId === userGroupId
          const isNextResponse = deduplicatedMessages.indexOf(m) === userMessageIndex + 1
          
          // CRITICAL FIX: When branching from a branch node, also check if the AI model matches the branch's selectedAIs
          const aiModelId = m.aiModel || m.ai
          const matchesBranchAIs = branchNodeSelectedAIs.length > 0
            ? branchNodeSelectedAIs.some((ai: AI) => ai.id === aiModelId)
            : true // If no branch selectedAIs, accept all
          
          return (isDirectChild || isSameGroup || isNextResponse) && matchesBranchAIs
        })
      
        userMessageId: messageId,
        userMessageIndex,
        userGroupId,
        totalMessages: deduplicatedMessages.length,
        branchNodeSelectedAIs: branchNodeSelectedAIs.map((a: AI) => a.id),
        messagesAfterUser: deduplicatedMessages.slice(userMessageIndex + 1, userMessageIndex + 5).map(m => ({
          id: m.id,
          isUser: m.isUser,
          aiModel: m.aiModel,
          parentId: m.parentId,
          groupId: m.groupId,
          text: m.text?.substring(0, 30)
        })),
        foundAIResponses: allAIResponses.map(m => ({
          id: m.id,
          aiModel: m.aiModel,
          parentId: m.parentId,
          groupId: m.groupId
        }))
      })
      
      aiResponses = deduplicateByModel(allAIResponses)
    } else if (targetMessage.isUser && !isMultiBranch) {
      // USER message + single mode → find the AI response and create one branch
      const userMessageIndex = deduplicatedMessages.findIndex(m => m.id === messageId)
      
      if (userMessageIndex === -1) {        branchCreationLockRef.current.delete(messageId)
        return
      }
      
      // Find the first AI response after this user message
      const aiResponse = deduplicatedMessages
        .slice(userMessageIndex + 1)
        .find(m => {
          if (m.isUser) return false // Stop at next user message
          return !!(m.aiModel || m.ai || m.role === 'assistant')
        })
      
      if (aiResponse) {
        aiResponses = [aiResponse]        })
      } else {        branchCreationLockRef.current.delete(messageId)
        return
      }
    } else if (!targetMessage.isUser) {
      // AI message → single branch
      aiResponses = [targetMessage]    }
    
    // If no AI responses found but we're in multi-mode with a user message,
    // and we didn't create placeholders above, create them now
    if (aiResponses.length === 0 && targetMessage.isUser && isMultiBranch) {      // Create placeholder branches for each selected AI model (use branch's selectedAIs if available)
      aiResponses = effectiveSelectedAIs.map((ai: any) => ({
        id: `placeholder-${messageId}-${ai.id}`,
        text: '',
        isUser: false,
        aiModel: ai.id,
        parentId: messageId,
        timestamp: Date.now(),
        children: [],
        responses: {}
      }))
    } else if (aiResponses.length === 0) {      branchCreationLockRef.current.delete(messageId)
      return
    }
    
    // ✅ Get inherited messages (all messages till the target message)
    // CRITICAL FIX: When branching from main, we want ALL messages from main up to and including the branch point
    // This ensures full context preservation (both user and AI messages)
    // 🔥 NEW: When branching during generation, include streaming messages up to the branch point
    // CRITICAL FIX: When branching from a user message in multi-mode, DON'T include AI responses in inheritedMessages
    // Each branch will get its own AI response separately
    const includePairedAI = targetMessage.isUser && !isMultiBranch // Only include paired AI for single-mode
    const inheritedMessages = getMessagesTill(messageId, deduplicatedMessages, includePairedAI)
    
      messageId,
      targetMessageIsUser: targetMessage.isUser,
      isMultiBranch,
      includePairedAI,
      allMessagesCount: deduplicatedMessages.length,
      inheritedCount: inheritedMessages.length,
      inheritedMessageIds: inheritedMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
    })
    
    // 🔥 NEW: If branching during generation, include streaming messages that come after the branch point
    // These will be duplicated to the branch so generation continues there too
    let streamingMessagesForBranch: any[] = []
    if (isMainGenerating && streamingMessages.length > 0) {
      const targetMessageIndex = deduplicatedMessages.findIndex(m => m.id === messageId)
      if (targetMessageIndex !== -1) {
        // Get streaming messages that come after the branch point
        streamingMessagesForBranch = streamingMessages.filter((streamMsg: any) => {
          const streamIndex = deduplicatedMessages.findIndex(m => m.id === streamMsg.id)
          return streamIndex > targetMessageIndex
        })
          streamingCount: streamingMessagesForBranch.length,
          streamingMessageIds: streamingMessagesForBranch.map(m => ({ id: m.id, aiModel: m.aiModel, streamingText: m.streamingText?.substring(0, 30) }))
        })
      }
    }      }))
    })
    
    // CRITICAL FIX: When branching from an AI message, we want to:
    // 1. Include all messages UP TO the AI message in inheritedMessages
    // 2. Start the branch WITH the AI message (so it appears in the branch)
    // So if the target message is an AI response, exclude it from inheritedMessages
    // and ensure it's the first message in branchMessages
    const targetMessageIndex = inheritedMessages.findIndex((m: any) => m.id === messageId)
    let finalInheritedMessages = inheritedMessages
    
    // If we're branching from an AI message (not a user message)
    if (targetMessage && !targetMessage.isUser && targetMessageIndex !== -1) {
      // Exclude the AI message from inheritedMessages (it will be the first branch message)
      finalInheritedMessages = inheritedMessages.slice(0, targetMessageIndex)      })
    }
    
    // CRITICAL FIX: When branching from a user message in multi-mode, we should NOT use aiResponseForBranch
    // Each branch should use its own AI response from aiResponses array
    // aiResponseForBranch is only used for single-mode branching
    
      count: finalInheritedMessages.length,
      targetMessageId: messageId,
      messages: finalInheritedMessages.map((m: any) => ({
        id: m.id,
        isUser: m.isUser,
        text: m.text?.substring(0, 50),
        aiModel: m.aiModel
      }))
    })
    
    // ✅ Create branch nodes
    const newNodes: Node[] = []
    const newEdges: Edge[] = []
    
    aiResponses.forEach((response, idx) => {
      // Check if branch already exists for this specific response
      if (branchExistsForMessage(parentNodeId, response.id)) {        return
      }
      
      // CRITICAL FIX: For multi-mode branching from user message, each branch should use its own AI response
      // For single-mode or branching from AI message, use the appropriate response
      let branchAiResponse = response // Default: use the response from aiResponses array
      
      if (!targetMessage.isUser && idx === 0) {
        // Branching from AI message - use the target message itself
        branchAiResponse = targetMessage
      } else if (targetMessage.isUser && !isMultiBranch && idx === 0) {
        // Single-mode branching from user message - find the paired AI response
        const pairedAIResponse = inheritedMessages.find((m: any, msgIdx: number) => 
          msgIdx > targetMessageIndex && 
          !m.isUser && 
          (m.aiModel || m.ai || m.role === 'assistant') &&
          (m.parentId === messageId || (targetMessage.groupId && m.groupId === targetMessage.groupId))
        )
        if (pairedAIResponse) {
          branchAiResponse = pairedAIResponse
        }
      }
      // For multi-mode branching from user message, branchAiResponse is already set to response (correct!)
      
        idx,
        responseId: response.id,
        responseAiModel: response.aiModel || response.ai,
        branchAiResponseId: branchAiResponse.id,
        branchAiResponseAiModel: branchAiResponse.aiModel || branchAiResponse.ai,
        branchAiResponseText: branchAiResponse.text?.substring(0, 50),
        branchAiResponseHasText: !!branchAiResponse.text,
        branchAiResponseIsPlaceholder: branchAiResponse.id?.startsWith('placeholder-'),
        targetMessageIsUser: targetMessage?.isUser,
        isMultiBranch,
        finalInheritedCount: finalInheritedMessages.length,
        inheritedMessageIds: finalInheritedMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 20) }))
      })
      
      const branchNode = createBranchNode(
        parentNodeId,
        finalInheritedMessages, // Use finalInheritedMessages (excludes AI responses for multi-mode)
        branchAiResponse, // Each branch gets its own AI response
        idx,
        aiResponses.length,
        messageId, // Pass the target messageId that triggered branch creation
        isMainGenerating && streamingMessagesForBranch.length > 0 
          ? streamingMessagesForBranch.find((s: any) => s.aiModel === response.aiModel || s.aiModel === response.ai)
          : undefined // Pass streaming message if branching during generation
      )
      
      newNodes.push(branchNode)
      
      // Create edge with default curved type from Dagre
      const newEdge: Edge = {
        id: `edge-${parentNodeId}-${branchNode.id}-${Date.now()}`,
        source: parentNodeId,
        target: branchNode.id,
        type: 'default', // Use default curved edges from Dagre
        animated: false,
        style: { stroke: '#cbd5e1', strokeWidth: 2 }
      }
      newEdges.push(newEdge)
    })
    
    if (newNodes.length === 0) {
      branchCreationLockRef.current.delete(messageId)
      return
    }
    
      count: newNodes.length,
      branchIds: newNodes.map(n => n.id),
      aiModels: aiResponses.map(r => r.aiModel)
    })
    
    // ✅ Update state
    try {
      setNodeId(prev => {
        const currentNodesInState = nodesRef.current
        const currentEdges = edgesRef.current
        
        // Merge new nodes with existing
        const updatedNodes = [...currentNodesInState, ...newNodes]
        const updatedEdges = [...currentEdges, ...newEdges]
        
        // Preserve main node messages and branch node data
        const nodesWithMainMessages = updatedNodes.map(node => {
          if (node.id === 'main') {
            return {
              ...node,
              data: {
                ...node.data,
                messages: mainMessages
              }
            }
          }
          return node
        })
        
        // Update React Flow immediately with nodes (layout will apply async)
        setNodes(nodesWithMainMessages)
        setEdges(updatedEdges)
        
        // Apply layout asynchronously to avoid blocking UI
        queueMicrotask(() => {
          try {
            const layoutResult = getLayoutedElements(nodesWithMainMessages, updatedEdges)
            const validatedNodes = validateNodePositions(layoutResult.nodes)
            
            // Preserve data when applying layout
            const layoutedNodesWithData = validatedNodes.map(node => {
              const originalNode = nodesWithMainMessages.find(n => n.id === node.id)
              if (originalNode) {
                return {
                  ...node,
                  data: {
                    ...originalNode.data,
                    ...node.data,
                    messages: originalNode.data.messages || node.data.messages || [],
                    inheritedMessages: originalNode.data.inheritedMessages || node.data.inheritedMessages || [],
                    branchMessages: originalNode.data.branchMessages || node.data.branchMessages || [],
                    parentMessageId: originalNode.data.parentMessageId || node.data.parentMessageId
                  }
                }
              }
              return node
            })
            
            setNodes(layoutedNodesWithData)
            setEdges(layoutResult.edges)
          } catch (layoutError) {            // Layout failed, but nodes are already set, so continue
          }
        })
        
        // Use nodesWithMainMessages for immediate updates (layout will apply async)
        const finalLayoutedNodes = nodesWithMainMessages
        
        // ✅ CRITICAL: Ensure nodes are immediately updated with messages
        // This prevents the useEffect from clearing messages before they're displayed
        requestAnimationFrame(() => {
          setNodes((currentNodes) => {
            return currentNodes.map((node) => {
              const newBranchNode = finalLayoutedNodes.find(n => n.id === node.id)
              if (newBranchNode && newBranchNode.data.messages) {
                // Ensure the branch node has its messages set
                return {
                  ...node,
                  data: {
                    ...node.data,
                    ...newBranchNode.data,
                    messages: newBranchNode.data.messages, // Ensure messages are set
                    inheritedMessages: newBranchNode.data.inheritedMessages,
                    branchMessages: newBranchNode.data.branchMessages
                  }
                }
              }
              return node
            })
          })
        })
        
        // ✅ CRITICAL: Force a re-render to ensure branches get their messages immediately
        // This ensures branches are properly displayed without needing a refresh
        setTimeout(() => {
          forceUpdate()
        }, 0)
        
        // ✅ Clear lock immediately after successful node creation
        branchCreationLockRef.current.delete(messageId)        // ✅ CRITICAL: Manually trigger onNodesUpdate immediately after setting nodes
        // This ensures conversationNodes is updated before the save effect runs
        // The useEffect will also trigger, but this ensures immediate update
        if (onNodesUpdate) {
          // Use a short delay to ensure React Flow has processed the setNodes call
          setTimeout(() => {
              id: n.id,
              type: n.type,
              parentId: n.data?.parentId,
              parentMessageId: n.data?.parentMessageId,
              hasMessages: !!(n.data?.messages?.length),
              messagesCount: n.data?.messages?.length || 0
            })))
            try {
              onNodesUpdate(finalLayoutedNodes)              // 🧠 Inherit memory for new branches
              const parentBranchId = parentNodeId === 'main' ? 'main' : parentNodeId
              newNodes.forEach(async (node) => {
                if (node.id !== 'main') {
                  try {
                    await fetch('/api/memory/inherit', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        newBranchId: node.id,
                        parentBranchId,
                        userId: undefined // TODO: Get from auth context
                      })
                    })                  } catch (error) {                  }
                }
              })
            } catch (error) {            }
          }, 50)
        } else {        }
        
        // Fit view to show new branches
        requestAnimationFrame(() => {
          setTimeout(() => {
            const nodeIds = [parentNodeId, ...newNodes.map(n => n.id)]
            fitViewportToNodes(nodeIds, 0.15)
          }, 100)
        })
        
        return prev + newNodes.length
      })
    } catch (error) {      // Clear lock on error
      branchCreationLockRef.current.delete(messageId)
    }
  }
  
  // ✅ Wrapper for handleBranch
  const handleBranch = useCallback((parentNodeId: string, messageId?: string, isMultiBranch?: boolean) => {
    if (handleBranchRef.current) {
      handleBranchRef.current(parentNodeId, messageId, isMultiBranch)
    }
  }, [])
  
  return {
    handleBranch,
    handleBranchRef,
    branchExistsForMessage,
    generateBranchId,
    deduplicateMessages,
    deduplicateByModel,
    getMessagesTill,
    getBranchPosition,
    createBranchNode
  }
}

