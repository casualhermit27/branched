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
			userMessage?: Message | null, // User message that was branched from (if any)
			branchGroupId?: string // Group ID for visual grouping of related branches
  ): Node => {
			const branchId = generateBranchId()

			// 1. Get all parent messages FIRST to ensure we have the full context
			let parentMessages = parentNodeId === 'main'
				? mainMessages
				: contextManager.getContextForDisplay(parentNodeId)
			
			// If branching from a branch node, also check the node's own messages
			// This ensures we get ALL messages (inherited + branch messages) from the parent branch
			if (parentNodeId !== 'main') {
				const parentNode = nodesRef.current.find((n) => n.id === parentNodeId)
				if (parentNode?.data?.messages) {
					// Merge node messages with context messages, avoiding duplicates
					const nodeMessageIds = new Set(parentMessages.map(m => m.id))
					const additionalMessages = parentNode.data.messages.filter(
						m => !nodeMessageIds.has(m.id)
					)
					// Combine: inherited messages first, then branch messages
					// This maintains the correct order (inherited messages come before branch messages)
					parentMessages = [...parentMessages, ...additionalMessages]
					
					// Also ensure all node messages are in messageStore
					parentNode.data.messages.forEach((msg) => {
						if (msg && msg.id) {
							messageStore.set(msg)
						}
					})
				}
			}
			
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
			
			// 4. Build inherited message IDs: all messages up to and including branch point
			// When branching from a branch, we want to inherit ALL parent messages (inherited + branch) up to the branch point
			let inheritedMessageIds: string[] = []
			
			console.log('🔍 Building inheritedMessageIds for branch:', {
				parentNodeId,
				parentMessagesCount: parentMessages.length,
				parentMessageIds: parentMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) })),
				hasUserMessage: !!userMessage,
				userMessageId: userMessage?.id,
				hasAiResponse: !!aiResponse,
				branchPointMessageId
			})
			
			if (userMessage) {
				const userIndex = parentMessages.findIndex((m) => m.id === userMessage.id)
				if (userIndex >= 0) {
					inheritedMessageIds = parentMessages.slice(0, userIndex + 1).map((m) => m.id)

					if (aiResponse) {
						const aiResponseIndex = parentMessages.findIndex((m) => m.id === aiResponse.id)
						if (aiResponseIndex > userIndex) {
							inheritedMessageIds.push(aiResponse.id)
						} else if (aiResponseIndex === -1) {
							inheritedMessageIds.push(aiResponse.id)
						}
					}

					console.log('✅ Found user message at index', userIndex, '- inherited', inheritedMessageIds.length, 'messages')
				} else {
					inheritedMessageIds = [...parentMessages.map((m) => m.id), userMessage.id]
					if (aiResponse) {
						inheritedMessageIds.push(aiResponse.id)
					}
					console.log('⚠️ User message not in parent messages - including all parent messages + user message')
				}
			} else {
				// Branching from AI message - get all messages up to and including the AI response
				// The AI response should be in inheritedMessageIds so it appears in the branch
				const aiIndex = parentMessages.findIndex((m) => m.id === branchPointMessageId)
				if (aiIndex >= 0) {
					// Include all messages up to and including the AI response
					// This ensures the new branch inherits ALL context from parent branch (inherited + branch messages)
					inheritedMessageIds = parentMessages.slice(0, aiIndex + 1).map((m) => m.id)
					console.log('✅ Found AI message at index', aiIndex, '- inherited', inheritedMessageIds.length, 'messages (all parent context up to branch point)')
				} else {
					// AI response not found in parent, include all parent messages + AI response
					inheritedMessageIds = [...parentMessages.map((m) => m.id)]
					if (aiResponse) {
						inheritedMessageIds.push(aiResponse.id)
					}
					console.log('⚠️ AI message not in parent messages - including all parent messages + AI response')
				}
			}
			
			console.log('📦 Final inheritedMessageIds:', {
				count: inheritedMessageIds.length,
				ids: inheritedMessageIds,
				messageTexts: inheritedMessageIds.map(id => {
					const msg = messageStore.get(id) || parentMessages.find(m => m.id === id)
					return msg ? { id, isUser: msg.isUser, text: msg.text?.substring(0, 30) } : { id, found: false }
				})
			})
			
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
					selectedAIs: [selectedAIs[0] || selectedAIs[branchIndex % selectedAIs.length]]
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
					getBestAvailableModel,
					onDeleteBranch
				},
				{
					isMinimized: minimizedNodes.has(branchId),
					isActive: activeNodeId === branchId,
					isGenerating: false,
					onToggleMinimize: toggleNodeMinimize
				},
				branchId, // Pass branchId
				branchGroupId // Pass group ID for visual grouping
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
			let parentMessages =
				parentNodeId === 'main'
					? mainMessages
					: contextManager.getContextForDisplay(parentNodeId)

			// If branching from a branch node, also check the node's own messages
			// This ensures we can find messages that were just created in the branch
			if (parentNodeId !== 'main') {
				const parentNode = nodesRef.current.find((n) => n.id === parentNodeId)
				if (parentNode?.data?.messages) {
					// Merge node messages with context messages, avoiding duplicates
					const nodeMessageIds = new Set(parentMessages.map(m => m.id))
					const additionalMessages = parentNode.data.messages.filter(
						m => !nodeMessageIds.has(m.id)
					)
					parentMessages = [...parentMessages, ...additionalMessages]
					
					// Also ensure all node messages are in messageStore
					parentNode.data.messages.forEach((msg) => {
						if (msg && msg.id) {
							messageStore.set(msg)
						}
					})
				}
			}

			console.log('🔍 Looking for message in parent messages:', {
				messageId,
      parentNodeId,
				parentMessagesCount: parentMessages.length,
				parentMessageIds: parentMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) })),
				mainMessagesCount: mainMessages.length,
				mainMessageIds: parentNodeId === 'main' ? mainMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) })) : []
    })
    
			// Find target message
			let targetMessage = parentMessages.find((m) => m.id === messageId)
			
			// If still not found, try messageStore directly
			if (!targetMessage) {
				targetMessage = messageStore.get(messageId)
				if (targetMessage) {
					console.log('✅ Found message in messageStore, adding to parentMessages')
					parentMessages.push(targetMessage)
				}
			}
			
			if (!targetMessage) {
				console.error('❌ Target message not found for branching:', {
					messageId,
      parentNodeId,
					parentMessagesCount: parentMessages.length,
					parentMessageIds: parentMessages.map(m => m.id),
					mainMessagesCount: mainMessages.length,
					messageStoreHasMessage: messageStore.has(messageId),
					nodeMessages: parentNodeId !== 'main' ? nodesRef.current.find(n => n.id === parentNodeId)?.data?.messages?.map(m => m.id) : []
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
			let branchGroupId: string | undefined = undefined

			if (targetMessage.isUser && isMultiBranch) {
				// Multi-branch: create one branch per selected AI
				const userIndex = parentMessages.findIndex((m) => m.id === messageId)
				userMessageForContext = targetMessage
				
				// Find all AI responses (including streaming ones) after the user message
				const allAIResponses = parentMessages
					.slice(userIndex + 1)
					.filter((m) => {
						// Include AI messages that have either aiModel or ai property
						// Include both completed (has text) and streaming (has streamingText) messages
						return !m.isUser && (m.aiModel || m.ai) && (m.text || m.streamingText)
					})
				
				console.log('🔍 Multi-branch: Finding AI responses for selected AIs', {
					selectedAIs: selectedAIs.map(ai => ({ id: ai.id, name: ai.name })),
					allAIResponses: allAIResponses.map(r => ({ id: r.id, aiModel: r.aiModel || r.ai, hasText: !!r.text, hasStreamingText: !!r.streamingText }))
				})
				
				// Create one branch per selected AI - match each selected AI to its response
				// This ensures we create branches for ALL selected AIs, even if some responses are missing
				aiResponses = selectedAIs
					.map(ai => {
						// Try to find a response that matches this AI's ID
						const matchingResponse = allAIResponses.find(r => {
							const responseAIId = r.aiModel || r.ai
							return responseAIId === ai.id
						})
						
						if (matchingResponse) {
							return matchingResponse
						}
						
						// If no matching response found, try to use any available response
						// This handles cases where responses might not have the exact AI ID match
						return null
					})
					.filter((r): r is Message => r !== null)
				
				// If we still don't have enough responses, use all available responses
				// This ensures we create branches for all selected AIs if we have enough responses
				if (aiResponses.length < selectedAIs.length && allAIResponses.length >= selectedAIs.length) {
					// We have enough responses, just use them all (up to selectedAIs.length)
					aiResponses = allAIResponses.slice(0, selectedAIs.length)
					console.log('⚠️ Using all available responses (matching may have failed):', aiResponses.map(r => ({ id: r.id, aiModel: r.aiModel || r.ai })))
				} else if (aiResponses.length < selectedAIs.length && allAIResponses.length > 0) {
					// We don't have enough responses, but use what we have
					const additionalResponses = allAIResponses
						.filter(r => !aiResponses.some(ar => ar.id === r.id))
						.slice(0, selectedAIs.length - aiResponses.length)
					aiResponses = [...aiResponses, ...additionalResponses]
					console.log('⚠️ Using partial responses (not enough for all selected AIs):', aiResponses.map(r => ({ id: r.id, aiModel: r.aiModel || r.ai })))
				}
				
				console.log('🔍 Multi-branch AI responses determined:', {
					selectedAIsCount: selectedAIs.length,
					allAIResponsesCount: allAIResponses.length,
					matchedResponsesCount: aiResponses.length,
					matchedResponses: aiResponses.map(r => ({ id: r.id, aiModel: r.aiModel || r.ai }))
				})
				
				// Generate group ID for branches created from same user message
				branchGroupId = `group-${messageId}`
    } else if (targetMessage.isUser && !isMultiBranch) {
				// Single branch: find first AI response
				const userIndex = parentMessages.findIndex((m) => m.id === messageId)
				userMessageForContext = targetMessage
				const aiResponse = parentMessages
					.slice(userIndex + 1)
					.find((m) => !m.isUser && (m.aiModel || m.ai))
				if (aiResponse) aiResponses = [aiResponse]
				// No group ID for single branches
			} else if (!targetMessage.isUser) {
				// Branching from AI message - include it and all above
				aiResponses = [targetMessage]
				// No group ID for single AI message branches
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
					userMessageForContext, // Pass user message to include in context
					branchGroupId // Pass group ID for visual grouping
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
      
				// Create edge with dotted connector - color adapts to branch depth
				const newEdge = createEdge(
					parentNodeId,
					branchNode.id,
					{
        animated: false,
						type: 'bezier',
						nodes: nodesRef.current, // Pass nodes for level calculation
						style: {
							strokeWidth: 2,
							strokeDasharray: '6 4'
							// stroke color will be calculated based on level
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

						// Focus on LAST new branch (latest created) AFTER nodes are fully rendered and in DOM
						// This centers the viewport on the most recently created/active branch
        setTimeout(() => {
							if (newNodes.length > 0) {
								// Use the LAST branch created (most recent) - this is the latest active branch
								const lastBranchId = newNodes[newNodes.length - 1].id
								// Center viewport on the latest branch
								requestAnimationFrame(() => {
          setTimeout(() => {
										fitViewportToNodes([lastBranchId], 0.3)
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

