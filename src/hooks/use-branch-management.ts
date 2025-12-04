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
import { useSyncStore } from '@/stores/sync-store'

const MAX_DUPLICATE_BRANCHES = 6

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
		existingBranchId?: string
		isMultiBranch: boolean
		existingBranchesCount?: number
		parentNodeId: string
		limitReached?: boolean
		limitMessage?: string
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
	fitViewportToNodes: (nodeIds: string[], padding?: number, useZoomAnimation?: boolean, overrideNodes?: any[], parentNodeId?: string) => void
	handleSendMessageRef: React.MutableRefObject<
		((nodeId: string, message: string) => Promise<void>) | undefined
	>
	minimizedNodes: Set<string>
	activeNodeId: string | null
	toggleNodeMinimize: (nodeId: string) => void
	onDeleteBranch?: (nodeId: string) => void
	setNodeActive?: (nodeId: string) => void
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
	onDeleteBranch,
	setNodeActive
}: UseBranchManagementParams) {
	// Initialize ContextManager with stores
	const contextManager = new ContextManager(
		messageStore as any,
		branchStore as any
	)

	const addDirtyNode = useSyncStore((state) => state.addDirtyNode)

	// Branch creation lock
	const branchCreationLockRef = useRef<Map<string, boolean>>(new Map())
	const branchIdCounterRef = useRef<number>(0)
	const handleBranchRef = useRef<
		(
			parentNodeId: string,
			messageId?: string,
			isMultiBranch?: boolean,
			options?: { allowDuplicate?: boolean; branchGroupId?: string; overrideMessages?: Message[] }
		) => void
	>(() => { })

	const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
					const nodeMessageIds = new Set(parentMessages.map((m: Message) => m.id))
					const additionalMessages = parentNode.data.messages.filter(
						(m: Message) => !nodeMessageIds.has(m.id)
					)
					// Combine: inherited messages first, then branch messages
					// This maintains the correct order (inherited messages come before branch messages)
					parentMessages = [...parentMessages, ...additionalMessages]

					// Also ensure all node messages are in messageStore
					parentNode.data.messages.forEach((msg: Message) => {
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

					if (aiResponse) {
						const aiResponseIndex = parentMessages.findIndex((m) => m.id === aiResponse.id)
						if (aiResponseIndex > userIndex) {
							inheritedMessageIds.push(aiResponse.id)
						} else if (aiResponseIndex === -1) {
							inheritedMessageIds.push(aiResponse.id)
						}
					}
				} else {
					inheritedMessageIds = [...parentMessages.map((m) => m.id), userMessage.id]
					if (aiResponse) {
						inheritedMessageIds.push(aiResponse.id)
					}
					if (aiResponse) {
						inheritedMessageIds.push(aiResponse.id)
					}
				}
			} else {
				// Branching from AI message - get all messages up to and including the AI response
				// The AI response should be in inheritedMessageIds so it appears in the branch
				const aiIndex = parentMessages.findIndex((m) => m.id === branchPointMessageId)
				if (aiIndex >= 0) {
					// Include all messages up to and including the AI response
					// This ensures the new branch inherits ALL context from parent branch (inherited + branch messages)
					inheritedMessageIds = parentMessages.slice(0, aiIndex + 1).map((m) => m.id)
					// Include all messages up to and including the AI response
					// This ensures the new branch inherits ALL context from parent branch (inherited + branch messages)
					inheritedMessageIds = parentMessages.slice(0, aiIndex + 1).map((m) => m.id)
				} else {
					// AI response not found in parent, include all parent messages + AI response
					inheritedMessageIds = [...parentMessages.map((m) => m.id)]
					if (aiResponse) {
						inheritedMessageIds.push(aiResponse.id)
					}
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

			// 6. Determine which AI should be selected for this branch
			// If branching from an AI response, use only the AI that generated that response
			let branchSelectedAIs: AI[] = []
			if (aiResponse) {
				// Find the AI that matches the response's ai or aiModel
				const responseAIId = aiResponse.ai || aiResponse.aiModel
				const matchingAI = selectedAIs.find(ai => {
					// Match by ID (exact match)
					if (ai.id === responseAIId) return true
					// Match by normalized ID (handle variations like 'mistral-large' -> 'mistral')
					const normalizedAIId = ai.id.toLowerCase()
					const normalizedResponseId = responseAIId?.toLowerCase() || ''
					if (normalizedAIId === normalizedResponseId) return true
					// Match by name (fallback)
					if (ai.name && responseAIId && ai.name.toLowerCase().includes(responseAIId.toLowerCase())) return true
					return false
				})

				if (matchingAI) {
					branchSelectedAIs = [matchingAI]
				} else {
					// Fallback: use first AI or round-robin if no match found
					branchSelectedAIs = [selectedAIs[0] || selectedAIs[branchIndex % selectedAIs.length]]
					console.warn('⚠️ Could not match AI for branch, using fallback:', {
						branchId,
						responseAIId,
						fallbackAI: branchSelectedAIs[0]?.id,
						availableAIs: selectedAIs.map(ai => ({ id: ai.id, name: ai.name }))
					})
				}
			} else {
				// No AI response (shouldn't happen, but fallback)
				branchSelectedAIs = [selectedAIs[0] || selectedAIs[branchIndex % selectedAIs.length]]
			}

			// 7. Create branch context with proper snapshot
			// When branching from AI message, the AI response is in inheritedMessageIds, not branchMessageIds
			// branchMessageIds should be empty initially (will be populated when user sends messages in branch)
			const branchContext: BranchContext = {
				branchId,
				parentBranchId: parentNodeId,
				contextSnapshot: snapshot,
				branchMessageIds: [], // Empty initially - messages created in this branch will be added here
				metadata: {
					selectedAIs: branchSelectedAIs,
					branchGroupId: branchGroupId
				}
			}

			// 8. Store branch context
			branchStore.set(branchContext)

			// 9. Create React Flow node with lightweight snapshot
			// Use the branch point message ID (AI response) for parentMessageId
			const branchNode = createBranchNode(
				parentNodeId,
				snapshot, // Pass lightweight snapshot
				branchSelectedAIs, // Use only the matched AI for this branch
				branchPointMessageId, // Use AI response ID as parent message
				branchIndex,
				totalBranches,
				parentNode,
				{
					onBranch: (nodeId: string, msgId?: string, isMultiBranch?: boolean, options?: any) =>
						handleBranchRef.current?.(nodeId, msgId, isMultiBranch, options),
					onSendMessage: handleSendMessageRef.current || (async () => { }),
					onAddAI: (nodeId: string, ai: AI) => handleBranchAddAI(nodeId, ai),
					onRemoveAI: (nodeId: string, aiId: string) =>
						handleBranchRemoveAI(nodeId, aiId),
					onSelectSingle: (nodeId: string, aiId: string) =>
						handleBranchSelectSingle(nodeId, aiId),
					getBestAvailableModel,
					onDeleteBranch,
					onToggleMultiModel: () => { }
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
		async (
			parentNodeId: string,
			messageId?: string,
			isMultiBranch: boolean = false,
			options?: { allowDuplicate?: boolean; branchGroupId?: string; overrideMessages?: Message[] }
		) => {
			if (!messageId) return

			// Check limits first
			try {
				const limitRes = await fetch('/api/user/limits?type=branch')
				const limitData = await limitRes.json()

				if (!limitData.allowed) {
					onBranchWarning?.({
						messageId,
						isMultiBranch,
						parentNodeId,
						limitReached: true,
						limitMessage: limitData.error || 'Branch limit reached. Please sign up for more.',
						existingBranchesCount: limitData.count
					})
					return
				}
			} catch (e) {
				console.error('Failed to check limits', e)
			}

			const allowDuplicate = options?.allowDuplicate ?? false
			const branchGroupId = options?.branchGroupId
			const overrideMessages = options?.overrideMessages

			const existingBranches = nodesRef.current.filter(
				(node) =>
					node.id !== 'main' &&
					node.id !== parentNodeId &&
					node.data?.parentId === parentNodeId &&
					node.data?.parentMessageId === messageId
			)
			const existingCount = existingBranches.length

			let targetMessage: Message | undefined

			// Use override messages if provided (most reliable source)
			if (overrideMessages) {
				targetMessage = overrideMessages.find((m) => m.id === messageId)
				targetMessage = overrideMessages.find((m) => m.id === messageId)
				if (targetMessage) {
					// Found target message in overrideMessages
				}
			}

			// Fallback to standard sources if not found in override
			if (!targetMessage) {
				targetMessage =
					parentNodeId === 'main'
						? mainMessages.find((m) => m.id === messageId)
						: contextManager.getContextForDisplay(parentNodeId).find((m) => m.id === messageId)
			}

			if (!isMultiBranch) {
				if (existingCount >= MAX_DUPLICATE_BRANCHES) {
					onBranchWarning?.({
						messageId,
						messageText: targetMessage?.text?.substring(0, 100),
						existingBranchId: existingBranches[0]?.id,
						isMultiBranch,
						existingBranchesCount: existingCount,
						parentNodeId,
						limitReached: true
					})
					return
				}

				if (existingCount > 0 && !allowDuplicate) {
					const existingBranch = existingBranches[0]
					if (onBranchWarning) {
						onBranchWarning({
							messageId,
							messageText: targetMessage?.text?.substring(0, 100),
							existingBranchId: existingBranch?.id,
							isMultiBranch,
							existingBranchesCount: existingCount,
							parentNodeId
						})
					} else if (existingBranch?.id && onNodeDoubleClick) {
						onNodeDoubleClick(existingBranch.id)
					}
					return
				}
			}

			// Force duplicate creation if allowDuplicate is true
			const forceDuplicate = allowDuplicate && existingCount > 0

			// Lock check - prevent duplicate branch creation (after checking if exists)
			// Check if this specific messageId is already locked (prevents rapid double-clicks)
			if (branchCreationLockRef.current.has(messageId)) {
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
			// Ensure main messages are in store if branching from main
			if (parentNodeId === 'main') {
				mainMessages.forEach(m => {
					if (m && m.id) messageStore.set(m)
				})
			}

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
					const nodeMessageIds = new Set(parentMessages.map((m: Message) => m.id))
					const additionalMessages = parentNode.data.messages.filter(
						(m: Message) => !nodeMessageIds.has(m.id)
					)
					parentMessages = [...parentMessages, ...additionalMessages]

					// Also ensure all node messages are in messageStore
					parentNode.data.messages.forEach((msg: Message) => {
						if (msg && msg.id) {
							messageStore.set(msg)
						}
					})
				}
			}

			// Find target message in parent messages (update if not already found)
			if (!targetMessage) {
				targetMessage = parentMessages.find((m) => m.id === messageId)
			}

			// If still not found, try messageStore directly
			if (!targetMessage) {
				targetMessage = messageStore.get(messageId)
				if (targetMessage) {
					parentMessages.push(targetMessage)
				}
			}

			// Fallback: Search in mainMessages explicitly if still not found (sometimes store sync lags)
			if (!targetMessage && parentNodeId === 'main') {
				targetMessage = mainMessages.find(m => m.id === messageId)
				if (targetMessage) {
					messageStore.set(targetMessage) // Sync back to store
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
					nodeMessages: parentNodeId !== 'main' ? nodesRef.current.find(n => n.id === parentNodeId)?.data?.messages?.map((m: Message) => m.id) : []
				})
				branchCreationLockRef.current.delete(messageId)
				return
			}

			// Determine AI responses to create branches for
			let aiResponses: Message[] = []
			let userMessageForContext: Message | null = null
			// Use provided branchGroupId or undefined (will be generated if needed for multi-branch)
			let finalBranchGroupId: string | undefined = branchGroupId

			if (targetMessage.isUser && isMultiBranch) {
				// Multi-branch: create one branch per AI response generated for this user message

				// Determine which messages to search for AI responses
				let searchMessages = parentMessages

				// Priority 1: Use override messages if provided (most reliable)
				if (overrideMessages && overrideMessages.length > 0) {
					searchMessages = overrideMessages
				}
				// Priority 2: Use branch messages if branching from a branch node
				else if (parentNodeId !== 'main') {
					const parentNode = nodesRef.current.find(n => n.id === parentNodeId)
					if (parentNode?.data?.messages) {
						const msgInBranch = parentNode.data.messages.find((m: Message) => m.id === messageId)
						if (msgInBranch) {
							searchMessages = parentNode.data.messages
						}
					}
				}

				const userIndex = searchMessages.findIndex((m) => m.id === messageId)
				userMessageForContext = targetMessage



				// Collect AI responses until the next user message appears
				const allAIResponses: Message[] = []
				for (let i = userIndex + 1; i < searchMessages.length; i++) {
					const candidate = searchMessages[i]
					if (!candidate) continue

					if (candidate.isUser) {
						break // Stop at the next user prompt (different turn)
					}



					if (!candidate.isUser && (candidate.aiModel || candidate.ai) && (candidate.text || candidate.streamingText)) {
						allAIResponses.push(candidate)
					}
				}



				aiResponses = allAIResponses

				// Use existing groupId from responses when available for visual grouping
				if (!finalBranchGroupId) {
					const firstGroupId = aiResponses[0]?.groupId
					finalBranchGroupId = (typeof firstGroupId === 'string' ? firstGroupId : undefined) || `group-${messageId}`
				}
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



			if (aiResponses.length === 0) {
				console.error('❌ No AI responses found for branching')
				branchCreationLockRef.current.delete(messageId)
				return
			}

			// Create branch nodes
			const newNodes: Node[] = []
			const newEdges: Edge[] = []
			const nodesToUpdate: Node[] = [] // Existing nodes that need updates (e.g. group ID)
			const allBranchIds: string[] = [] // Track all relevant branches (new + existing)

			aiResponses.forEach((aiResponse, idx) => {
				// Check if branch already exists for this AI response
				const existingBranchNode = nodesRef.current.find((node) =>
					node.id !== 'main' &&
					node.id !== parentNodeId &&
					node.data?.parentId === parentNodeId &&
					node.data?.parentMessageId === aiResponse.id
				)
				const branchExists = !!existingBranchNode

				// Lock check: 
				// - The messageId lock was set at the start to prevent double-clicks
				// - If messageId === aiResponse.id, the lock exists but we should proceed (this is the intended call)
				// - If messageId !== aiResponse.id, check if aiResponse.id is locked separately
				// We only skip if aiResponse.id is locked AND it's different from messageId
				const isLocked = aiResponse.id !== messageId && branchCreationLockRef.current.has(aiResponse.id)



				// Prevent double-create if branch exists, UNLESS allowing duplicates
				if (branchExists && !forceDuplicate) {
					// If in multi-branch mode, ensure existing branches join the group
					if (isMultiBranch && finalBranchGroupId && existingBranchNode.data?.branchGroupId !== finalBranchGroupId) {
						nodesToUpdate.push({
							...existingBranchNode,
							data: {
								...existingBranchNode.data,
								branchGroupId: finalBranchGroupId
							}
						})
					}
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
					finalBranchGroupId // Pass group ID for visual grouping
				)

				// If this is a duplicate branch, update its label
				if (forceDuplicate) {
					const duplicateCount = existingCount + 1
					branchNode.data.label = `Duplicate Branch ${duplicateCount}`
				}

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



				newNodes.push(branchNode)
				allBranchIds.push(branchNode.id)
				addDirtyNode(branchNode.id) // Mark new branch as dirty

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

			if (newNodes.length === 0 && nodesToUpdate.length === 0) {
				if (allBranchIds.length > 0) {
					setTimeout(() => {
						fitViewportToNodes(allBranchIds, 0.25, true)
					}, 100)
				} else {
					console.error('❌ No branch nodes created or found')
				}
				branchCreationLockRef.current.delete(messageId)
				return
			}

			// Update state
			try {
				const currentNodes = nodesRef.current
				const currentEdges = edgesRef.current

				// Merge updates:
				// 1. Filter out nodes that are being updated from currentNodes
				// 2. Add updated nodes
				// 3. Add new nodes
				const nodesToUpdateIds = new Set(nodesToUpdate.map(n => n.id))
				const filteredCurrentNodes = currentNodes.filter(n => !nodesToUpdateIds.has(n.id))

				const updatedNodes = [...filteredCurrentNodes, ...nodesToUpdate, ...newNodes]
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

						// Focus on the new branch (or last relevant one)
						if (allBranchIds.length > 0) {
							// Clear any pending focus timeout to prevent fighting
							if (focusTimeoutRef.current) {
								clearTimeout(focusTimeoutRef.current)
							}

							// Wait for layout and render to settle
							focusTimeoutRef.current = setTimeout(() => {
								const nodeToActivate = newNodes.length > 0 ? newNodes[newNodes.length - 1].id : allBranchIds[allBranchIds.length - 1]

								if (nodeToActivate) {
									// Focus directly on the target node
									fitViewportToNodes([nodeToActivate], 0.1, true, validatedNodes, parentNodeId)

									if (setNodeActive) {
										setNodeActive(nodeToActivate)
									}
								}
								focusTimeoutRef.current = null
							}, 250) // Increased delay to prevent layout/focus fighting
						}
					} catch (error) {
						console.error('Error applying layout:', error)
						// Fallback: just update nodes without layout if layout fails
						setNodes(updatedNodes)
						setEdges(updatedEdges)
					}
				})
			} catch (error) {
				console.error('Error updating nodes:', error)
			} finally {
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
			fitViewportToNodes,
			generateBranchId,
			minimizedNodes,
			activeNodeId,
			toggleNodeMinimize,
			handleBranchAddAI,
			handleBranchRemoveAI,
			handleBranchSelectSingle,
			getBestAvailableModel,
			onDeleteBranch,
			setNodeActive
		]
	)

	const handleBranch = useCallback(
		(
			parentNodeId: string,
			messageId?: string,
			isMultiBranch?: boolean,
			options?: { allowDuplicate?: boolean; branchGroupId?: string; overrideMessages?: Message[] }
		) => {
			handleBranchRef.current(parentNodeId, messageId, isMultiBranch, options)
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
