'use client'

import { useCallback, useRef } from 'react'
import { Node, Edge } from 'reactflow'
import { ContextManager, BranchContext } from '@/components/flow-canvas/context-manager'
import { messageStore } from '@/components/flow-canvas/message-store'
import { branchStore } from '@/components/flow-canvas/branch-store'
import type { AI, Message } from '@/components/flow-canvas/types'
import { createBranchNode } from '@/components/flow-canvas/node-management'
import {
	calculateSingleBranchPosition,
	calculateMultiBranchPositions,
	calculateNodeDimensions
} from '@/components/flow-canvas/layout-engine'
import { createEdge } from '@/components/flow-canvas/edge-management'

interface UseBranchManagementParams {
  nodesRef: React.MutableRefObject<Node[]>
  edgesRef: React.MutableRefObject<Edge[]>
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  selectedAIs: AI[]
  mainMessages: Message[]
  onNodesUpdate?: (nodes: any[]) => void
	onBranchWarning?: (data: {
		messageId: string
		messageText?: string
		existingBranchId: string
		isMultiBranch: boolean
	}) => void
  onNodeDoubleClick?: (nodeId: string) => void
  handleBranchAddAI: (nodeId: string, ai: AI) => void
  handleBranchRemoveAI: (nodeId: string, aiId: string) => void
  handleBranchSelectSingle: (nodeId: string, aiId: string) => void
  handleBranchToggleMultiModel: (nodeId: string) => void
  getBestAvailableModel?: () => string
  validateNodePositions: (nodeList: any[]) => any[]
	getLayoutedElements: (nodes: any[], edges: Edge[], direction?: string) => {
		nodes: any[]
		edges: Edge[]
	}
  fitViewportToNodes: (nodeIds: string[], padding?: number) => void
	handleSendMessageRef: React.MutableRefObject<
		((nodeId: string, message: string) => Promise<void>) | undefined
	>
  minimizedNodes: Set<string>
  activeNodeId: string | null
  toggleNodeMinimize: (nodeId: string) => void
	onDeleteBranch?: (nodeId: string) => void
}

/**
 * Branch management hook using ContextManager
 * Uses lightweight snapshots instead of duplicating messages
 * All context operations handled through ContextManager
 */
export function useBranchManagement({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
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
	// Initialize ContextManager with stores
	const contextManager = new ContextManager(
		messageStore as any,
		branchStore as any
	)

	// Branch creation lock
	const branchCreationLockRef = useRef<Map<string, boolean>>(new Map())
	const branchIdCounterRef = useRef<number>(0)
	const handleBranchRef = useRef<
		(parentNodeId: string, messageId?: string, isMultiBranch?: boolean) => void
	>(() => {})

	/**
	 * Generate unique branch ID
	 */
  const generateBranchId = useCallback((): string => {
    branchIdCounterRef.current += 1
		return `branch-${Date.now()}-${branchIdCounterRef.current}-${Math.random()
			.toString(36)
			.substr(2, 9)}`
  }, [])
  
	/**
	 * Check if branch exists for a message
	 */
	const branchExistsForMessage = useCallback(
		(parentNodeId: string, messageId: string): boolean => {
			const currentNodes = nodesRef.current
			return currentNodes.some((node) => {
				if (node.id === 'main' || node.id === parentNodeId) return false
				if (node.data?.parentId !== parentNodeId) return false
				return node.data?.parentMessageId === messageId
			})
		},
		[nodesRef]
	)

	/**
	 * Create branch node using ContextManager
	 */
	const createBranchNodeWithContext = useCallback(
		(
    parentNodeId: string,
			branchPointMessageId: string, // This should be the AI response ID
    branchIndex: number,
    totalBranches: number,
			parentNode: Node,
			aiResponse?: Message,
			userMessage?: Message | null // User message that was branched from (if any)
  ): Node => {
			const branchId = generateBranchId()

			// 1. Get all parent messages FIRST to ensure we have the full context
			const parentMessages = parentNodeId === 'main'
				? mainMessages
				: contextManager.getContextForDisplay(parentNodeId)
			
			// 2. Store ALL parent messages in messageStore FIRST before creating snapshot
			// This ensures ContextManager can find them when resolving inheritedMessageIds
			parentMessages.forEach((msg) => {
				if (msg && msg.id) {
					messageStore.set(msg)
				}
			})
			
			// 3. Store the user message and AI response if they exist
			if (userMessage) {
				messageStore.set(userMessage)
			}
			if (aiResponse) {
				messageStore.set(aiResponse)
			}
			
			// 4. Build inherited message IDs: all messages up to and including user message
			let inheritedMessageIds: string[] = []
			if (userMessage) {
				// Find user message index in parent messages
				const userIndex = parentMessages.findIndex((m) => m.id === userMessage.id)
				if (userIndex >= 0) {
					// Get all messages up to and including user message
					inheritedMessageIds = parentMessages.slice(0, userIndex + 1).map((m) => m.id)
				} else {
					// User message not in parent, add it
					inheritedMessageIds = [...parentMessages.map((m) => m.id), userMessage.id]
				}
			} else {
				// Branching from AI message - get all messages up to and including the AI response
				// The AI response should be in inheritedMessageIds so it appears in the branch
				const aiIndex = parentMessages.findIndex((m) => m.id === branchPointMessageId)
				if (aiIndex >= 0) {
					// Include all messages up to and including the AI response
					inheritedMessageIds = parentMessages.slice(0, aiIndex + 1).map((m) => m.id)
				} else {
					// AI response not found in parent, include all parent messages + AI response
					inheritedMessageIds = [...parentMessages.map((m) => m.id)]
					if (aiResponse) {
						inheritedMessageIds.push(aiResponse.id)
					}
				}
			}
			
			// 4. Create context snapshot with proper inherited messages
			const snapshot = {
				branchPointMessageId: userMessage ? userMessage.id : branchPointMessageId,
				inheritedMessageIds,
				timestamp: Date.now()
			}

			// 6. Create branch context with proper snapshot
			// When branching from AI message, the AI response is in inheritedMessageIds, not branchMessageIds
			// branchMessageIds should be empty initially (will be populated when user sends messages in branch)
			const branchContext: BranchContext = {
				branchId,
				parentBranchId: parentNodeId,
				contextSnapshot: snapshot,
				branchMessageIds: [], // Empty initially - messages created in this branch will be added here
				metadata: {
					selectedAIs: [selectedAIs[0] || selectedAIs[branchIndex % selectedAIs.length]],
					multiModelMode: false
				}
			}

			// 7. Store branch context
			branchStore.set(branchContext)

			// 8. Create React Flow node with lightweight snapshot
			// Use the branch point message ID (AI response) for parentMessageId
			const branchNode = createBranchNode(
				parentNodeId,
				snapshot, // Pass lightweight snapshot
				branchContext.metadata?.selectedAIs || selectedAIs,
				branchPointMessageId, // Use AI response ID as parent message
				branchIndex,
				totalBranches,
				parentNode,
				{
					onBranch: (nodeId: string, msgId?: string) =>
						handleBranchRef.current?.(nodeId, msgId, false),
					onSendMessage: handleSendMessageRef.current,
					onAddAI: (nodeId: string, ai: AI) => handleBranchAddAI(nodeId, ai),
					onRemoveAI: (nodeId: string, aiId: string) =>
						handleBranchRemoveAI(nodeId, aiId),
					onSelectSingle: (nodeId: string, aiId: string) =>
						handleBranchSelectSingle(nodeId, aiId),
					onToggleMultiModel: (nodeId: string) =>
						handleBranchToggleMultiModel(nodeId),
					getBestAvailableModel,
					onDeleteBranch
				},
				{
					isMinimized: minimizedNodes.has(branchId),
					isActive: activeNodeId === branchId,
					isGenerating: false,
					multiModelMode: branchContext.metadata?.multiModelMode || false,
					onToggleMinimize: toggleNodeMinimize
				},
				branchId // Pass branchId
			)

			return branchNode
		},
		[
			generateBranchId,
			selectedAIs,
			minimizedNodes,
			activeNodeId,
			toggleNodeMinimize,
			handleBranchAddAI,
			handleBranchRemoveAI,
			handleBranchSelectSingle,
			handleBranchToggleMultiModel,
			getBestAvailableModel,
			onDeleteBranch
		]
	)

	/**
	 * Main branch creation handler - simplified using ContextManager
	 */
	handleBranchRef.current = useCallback(
		(parentNodeId: string, messageId?: string, isMultiBranch: boolean = false) => {
			if (!messageId) return

			// Check if branch already exists FIRST (before lock)
			const existingBranch = nodesRef.current.find(
				(node) =>
      node.id !== 'main' && 
      node.id !== parentNodeId &&
      node.data?.parentId === parentNodeId &&
      node.data?.parentMessageId === messageId
    )
    
			if (existingBranch) {
				const targetMessage =
					parentNodeId === 'main'
						? mainMessages.find((m) => m.id === messageId)
						: contextManager
								.getContextForDisplay(parentNodeId)
								.find((m) => m.id === messageId)

      if (onBranchWarning) {
        onBranchWarning({
          messageId,
          messageText: targetMessage?.text?.substring(0, 100),
          existingBranchId: existingBranch.id,
          isMultiBranch
        })
				} else if (onNodeDoubleClick) {
          onNodeDoubleClick(existingBranch.id)
      }
      return
    }
    
			// Lock check - prevent duplicate branch creation (after checking if exists)
			// Check if this specific messageId is already locked (prevents rapid double-clicks)
			if (branchCreationLockRef.current.has(messageId)) {
				console.log('⚠️ Branch creation already in progress for message:', messageId)
				return
			}
    
			// Set lock for messageId to prevent rapid double-clicks
			// This will be checked in the forEach loop for AI responses
    branchCreationLockRef.current.set(messageId, true)
    
    // Hard safety to avoid double branch creation from UI quirks
    setTimeout(() => branchCreationLockRef.current.delete(messageId), 2000)
    
			// Get parent node
			const parentNode = nodesRef.current.find((n) => n.id === parentNodeId)
			if (!parentNode) {
				branchCreationLockRef.current.delete(messageId)
      return
    }
    
			// Get parent messages
			const parentMessages =
				parentNodeId === 'main'
					? mainMessages
					: contextManager.getContextForDisplay(parentNodeId)

			console.log('🔍 Looking for message in parent messages:', {
				messageId,
      parentNodeId,
				parentMessagesCount: parentMessages.length,
				parentMessageIds: parentMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) })),
				mainMessagesCount: mainMessages.length,
				mainMessageIds: parentNodeId === 'main' ? mainMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) })) : []
			})

			// Find target message
			const targetMessage = parentMessages.find((m) => m.id === messageId)
			if (!targetMessage) {
				console.error('❌ Target message not found for branching:', {
					messageId,
      parentNodeId,
					parentMessagesCount: parentMessages.length,
					parentMessageIds: parentMessages.map(m => m.id),
					mainMessagesCount: mainMessages.length
				})
				branchCreationLockRef.current.delete(messageId)
        return
      }
      
      console.log('✅ Target message found for branching:', {
        messageId,
        isUser: targetMessage.isUser,
        text: targetMessage.text?.substring(0, 50),
        parentMessagesCount: parentMessages.length
      })
      
			// Determine AI responses to create branches for
			let aiResponses: Message[] = []
			let userMessageForContext: Message | null = null

			if (targetMessage.isUser && isMultiBranch) {
				// Multi-branch: find all AI responses after user message
				const userIndex = parentMessages.findIndex((m) => m.id === messageId)
				userMessageForContext = targetMessage
				aiResponses = parentMessages
					.slice(userIndex + 1)
					.filter((m) => !m.isUser && (m.aiModel || m.ai))
					.slice(0, selectedAIs.length)
    } else if (targetMessage.isUser && !isMultiBranch) {
				// Single branch: find first AI response
				const userIndex = parentMessages.findIndex((m) => m.id === messageId)
				userMessageForContext = targetMessage
				const aiResponse = parentMessages
					.slice(userIndex + 1)
					.find((m) => !m.isUser && (m.aiModel || m.ai))
				if (aiResponse) aiResponses = [aiResponse]
			} else if (!targetMessage.isUser) {
				// Branching from AI message - include it and all above
				aiResponses = [targetMessage]
			}

			console.log('🔍 AI responses determined:', {
				aiResponsesCount: aiResponses.length,
				aiResponseIds: aiResponses.map(r => r.id),
				targetMessageIsUser: targetMessage.isUser,
				isMultiBranch
			})

			if (aiResponses.length === 0) {
				console.error('❌ No AI responses found for branching')
				branchCreationLockRef.current.delete(messageId)
      return
    }
    
			// Create branch nodes
    const newNodes: Node[] = []
    const newEdges: Edge[] = []
    
			aiResponses.forEach((aiResponse, idx) => {
				// Check if branch already exists for this AI response
				const branchExists = branchExistsForMessage(parentNodeId, aiResponse.id)
				
				// Lock check: 
				// - The messageId lock was set at the start to prevent double-clicks
				// - If messageId === aiResponse.id, the lock exists but we should proceed (this is the intended call)
				// - If messageId !== aiResponse.id, check if aiResponse.id is locked separately
				// We only skip if aiResponse.id is locked AND it's different from messageId
				const isLocked = aiResponse.id !== messageId && branchCreationLockRef.current.has(aiResponse.id)
				
				console.log('🔍 Checking branch creation for AI response:', {
					aiResponseId: aiResponse.id,
					messageId,
					branchExists,
					isLocked,
					messageIdMatches: aiResponse.id === messageId,
					lockKey: aiResponse.id === messageId ? messageId : aiResponse.id,
					allLocks: Array.from(branchCreationLockRef.current.keys())
				})
				
				// Prevent double-create if branch exists
				if (branchExists) {
					console.warn('⚠️ Skipping branch creation - branch already exists')
					return
				}
				
				// Prevent double-create if locked (this handles both same-message and different-message cases)
				if (isLocked) {
					console.warn('⚠️ Skipping branch creation - locked to prevent duplicates')
					return
				}

				// Lock this AI response to prevent duplicates
				// Use aiResponse.id as the lock key (not messageId) to prevent duplicate branches for the same AI response
				branchCreationLockRef.current.set(aiResponse.id, true)
				// Auto-unlock in case React double-renders
				setTimeout(() => branchCreationLockRef.current.delete(aiResponse.id), 500)

				// Use the AI response ID as the branch point
				// But we need to ensure the user message (if any) is included in context
				const branchPointMessageId = aiResponse.id

				const branchNode = createBranchNodeWithContext(
        parentNodeId,
					branchPointMessageId, // Use AI response ID as branch point
        idx,
        aiResponses.length,
					parentNode,
					aiResponse,
					userMessageForContext // Pass user message to include in context
      )
      
      // Validate branch node before adding
      if (!branchNode || !branchNode.id) {
        console.error('❌ Invalid branch node created - missing id')
        branchCreationLockRef.current.delete(aiResponse.id)
        return
      }
      
      // Ensure parentId is correct (should never be the branch's own ID)
      if (branchNode.data?.parentId === branchNode.id) {
        console.error('❌ Invalid branch node - parentId equals branch id:', branchNode.id)
        branchCreationLockRef.current.delete(aiResponse.id)
        return
      }
      
      // Ensure branch has messages or context
      const hasMessages = branchNode.data?.messages && branchNode.data.messages.length > 0
      const hasContext = branchNode.data?.inheritedMessages && branchNode.data.inheritedMessages.length > 0
      if (!hasMessages && !hasContext) {
        console.error('❌ Invalid branch node - no messages or context:', branchNode.id)
        branchCreationLockRef.current.delete(aiResponse.id)
        return
      }
      
      console.log('✅ Validated branch node:', {
        id: branchNode.id,
        parentId: branchNode.data?.parentId,
        parentMessageId: branchNode.data?.parentMessageId,
        messagesCount: branchNode.data?.messages?.length || 0,
        inheritedCount: branchNode.data?.inheritedMessages?.length || 0,
        branchCount: branchNode.data?.branchMessages?.length || 0
      })
      
      newNodes.push(branchNode)
      
				// Create edge with dotted connector
				const newEdge = createEdge(
					parentNodeId,
					branchNode.id,
					{
        animated: false,
						type: 'smoothstep',
						style: {
							stroke: parentNodeId === 'main' ? '#8b5cf6' : '#cbd5e1',
							strokeWidth: 2,
							strokeDasharray: '6 4'
						}
					}
				)
      newEdges.push(newEdge)
    })
    
    if (newNodes.length === 0) {
      console.error('❌ No branch nodes created - all were skipped or failed')
      branchCreationLockRef.current.delete(messageId)
      return
    }
    
    console.log('✅ Created branch nodes:', {
      count: newNodes.length,
      nodeIds: newNodes.map(n => n.id),
      edgeCount: newEdges.length
    })
    
			// Update state
			try {
				const currentNodes = nodesRef.current
        const currentEdges = edgesRef.current
        
				const updatedNodes = [...currentNodes, ...newNodes]
        const updatedEdges = [...currentEdges, ...newEdges]
        
				// Apply layout
        queueMicrotask(() => {
          try {
						const layoutResult = getLayoutedElements(updatedNodes, updatedEdges)
            const validatedNodes = validateNodePositions(layoutResult.nodes)
            
						// Ensure edges are included (layout might not preserve all edges)
						const allEdges = layoutResult.edges.length > 0 
							? layoutResult.edges 
							: updatedEdges
						
						setNodes(validatedNodes)
            setEdges(allEdges)

						// Update parent
        if (onNodesUpdate) {
							onNodesUpdate(validatedNodes)
						}

						// Focus on first new branch AFTER nodes are fully rendered and in DOM
						// Focus on the branch node specifically, not both parent and branch
        setTimeout(() => {
							if (newNodes.length > 0) {
								const firstBranchId = newNodes[0].id
								// Focus only on the new branch node
								requestAnimationFrame(() => {
          setTimeout(() => {
										fitViewportToNodes([firstBranchId], 0.3)
									}, 200)
								})
							}
						}, 400) // Delay to ensure branch is fully created and rendered
					} catch (error) {
						console.error('Layout error:', error)
					}
				})

				// Clear lock after a delay to prevent rapid double-clicks
          setTimeout(() => {
					branchCreationLockRef.current.delete(messageId)
				}, 500)
			} catch (error) {
				console.error('Branch creation error:', error)
				// Clear lock immediately on error
      branchCreationLockRef.current.delete(messageId)
    }
		},
		[
			nodesRef,
			mainMessages,
			contextManager,
			onBranchWarning,
			onNodeDoubleClick,
			selectedAIs,
			branchExistsForMessage,
			createBranchNodeWithContext,
			getLayoutedElements,
			validateNodePositions,
			setNodes,
			setEdges,
			onNodesUpdate,
			fitViewportToNodes
		]
	)

	const handleBranch = useCallback(
		(parentNodeId: string, messageId?: string, isMultiBranch?: boolean) => {
      handleBranchRef.current(parentNodeId, messageId, isMultiBranch)
		},
		[]
	)
  
  return {
    handleBranch,
    handleBranchRef,
    branchExistsForMessage,
    generateBranchId,
		contextManager
  }
}

