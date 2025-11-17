'use client'

import { Node } from 'reactflow'
import type { AI, Message, ChatNodeData } from './types'
import {
	calculateBranchPosition,
	calculateSingleBranchPosition,
	calculateMultiBranchPositions,
	calculateNodeDimensions
} from './layout-engine'
import { ContextManager } from './context-manager'
import { messageStore } from './message-store'
import { branchStore } from './branch-store'
import type { BranchContext, ContextSnapshot } from './context-manager'

/**
 * Create main conversation node
 */
export function createMainNode(
	messages: Message[],
	selectedAIs: AI[],
	handlers: {
		onAddAI: (ai: AI) => void
		onRemoveAI: (aiId: string) => void
		onSendMessage: (nodeId: string, message: string) => Promise<void>
		onBranch: (nodeId: string, messageId?: string) => void
		onExportImport?: () => void
		getBestAvailableModel?: () => string
		onSelectSingle?: (aiId: string) => void
		onToggleMultiModel?: (nodeId: string) => void
	},
	state: {
		isMinimized: boolean
		isActive: boolean
		isGenerating: boolean
		onToggleMinimize?: (nodeId: string) => void
	}
): Node<ChatNodeData> {
	return {
		id: 'main',
		type: 'chatNode',
		position: { x: 0, y: 0 },
		data: {
			label: 'Main Conversation',
			messages,
			selectedAIs,
			onBranch: handlers.onBranch,
			onSendMessage: handlers.onSendMessage,
			onAddAI: handlers.onAddAI,
			onRemoveAI: handlers.onRemoveAI,
			onSelectSingle: handlers.onSelectSingle,
			onToggleMultiModel: handlers.onToggleMultiModel,
			getBestAvailableModel: handlers.getBestAvailableModel,
			onExportImport: handlers.onExportImport,
			isMain: true,
			showAIPill: true,
			isMinimized: state.isMinimized,
			isActive: state.isActive,
			isGenerating: state.isGenerating,
			nodeId: 'main',
			onToggleMinimize: state.onToggleMinimize
		}
	}
}

/**
 * Create branch node using ContextManager (lightweight snapshot approach)
 */
export function createBranchNode(
	parentNodeId: string,
	contextSnapshot: ContextSnapshot,
	selectedAIs: AI[],
	parentMessageId: string,
	branchIndex: number,
	totalBranches: number,
	parentNode: Node,
	handlers: {
		onBranch: (nodeId: string, messageId?: string) => void
		onSendMessage: (nodeId: string, message: string) => Promise<void>
		onAddAI: (nodeId: string, ai: AI) => void
		onRemoveAI: (nodeId: string, aiId: string) => void
		onSelectSingle: (nodeId: string, aiId: string) => void
		onToggleMultiModel: (nodeId: string) => void
		getBestAvailableModel?: () => string
		onDeleteBranch?: (nodeId: string) => void
	},
	state: {
		isMinimized: boolean
		isActive: boolean
		isGenerating: boolean
		onToggleMinimize?: (nodeId: string) => void
	},
	branchId: string,
	branchGroupId?: string // Group ID for visual grouping
): Node<ChatNodeData> {
	// Calculate position based on branch count
	const parentDims = calculateNodeDimensions(
		parentNode.data?.messages?.length || 0,
		parentNode.data?.isMinimized || false
	)

	let position: { x: number; y: number }

	if (totalBranches === 1) {
		// Single branch - straight down
		position = calculateSingleBranchPosition(parentNode, parentDims.height)
	} else {
		// Multiple branches - spread horizontally
		const positions = calculateMultiBranchPositions(
			parentNode,
			parentDims.height,
			totalBranches
		)
		position = positions[branchIndex] || calculateSingleBranchPosition(parentNode, parentDims.height)
	}
	
	// Get branch context
	const branchContext = branchStore.get(branchId)
	
	// Ensure branch context exists before trying to get messages
	if (!branchContext) {
		console.warn('⚠️ Branch context not found for branchId:', branchId)
		return {
			id: branchId,
			type: 'chatNode',
			position,
			data: {
				label: `Branch ${branchId.slice(-6)}`,
				messages: [],
				inheritedMessages: [],
				branchMessages: [],
				selectedAIs,
				parentMessageId,
				parentId: parentNodeId,
				contextSnapshot,
				...handlers,
				isMain: false,
				showAIPill: true,
				isMinimized: state.isMinimized,
				isActive: state.isActive,
				isGenerating: state.isGenerating,
				nodeId: branchId,
				onToggleMinimize: state.onToggleMinimize,
				onDeleteBranch: handlers.onDeleteBranch
			}
		}
	}
	
	// Get messages for display using ContextManager
	const contextManager = new ContextManager(messageStore as any, branchStore as any)
	const displayMessages = contextManager.getContextForDisplay(branchId)
	
	// Generate branch label
	const parentMessage = messageStore.get(contextSnapshot.branchPointMessageId)
	const label = parentMessage
		? `Branch from: ${parentMessage.text.substring(0, 40)}...`
		: `Branch ${branchId.slice(-6)}`
	
	// Log for debugging
	if (displayMessages.length === 0) {
		console.warn('⚠️ Branch has no messages after context resolution:', {
			branchId,
			inheritedMessageIds: branchContext.contextSnapshot.inheritedMessageIds,
			branchMessageIds: branchContext.branchMessageIds,
			parentMessageId: contextSnapshot.branchPointMessageId,
			parentMessageExists: !!parentMessage
		})
	}

	return {
		id: branchId,
		type: 'chatNode',
		position,
		data: {
			label,
			messages: displayMessages, // Resolved from ContextManager
			inheritedMessages: contextManager.getInheritedContext(branchId),
			branchMessages: contextManager.getBranchMessages(branchId),
			selectedAIs,
			parentMessageId,
			parentId: parentNodeId,
			contextSnapshot, // Store lightweight snapshot
			onBranch: handlers.onBranch,
			onSendMessage: handlers.onSendMessage,
			onAddAI: (ai: AI) => handlers.onAddAI(branchId, ai),
			onRemoveAI: (aiId: string) => handlers.onRemoveAI(branchId, aiId),
			onSelectSingle: (aiId: string) => handlers.onSelectSingle(branchId, aiId),
			onToggleMultiModel: () => handlers.onToggleMultiModel(branchId),
			getBestAvailableModel: handlers.getBestAvailableModel,
			isMain: false,
			showAIPill: true,
			isMinimized: state.isMinimized,
			isActive: state.isActive,
			isGenerating: state.isGenerating,
			nodeId: branchId,
			onToggleMinimize: state.onToggleMinimize,
			onDeleteBranch: handlers.onDeleteBranch,
			branchGroupId // Store group ID for visual grouping
		}
	}
}

/**
 * Update node data while preserving structure
 */
export function updateNodeData<T extends ChatNodeData>(
	node: Node<T>,
	updates: Partial<T>
): Node<T> {
	return {
		...node,
		data: {
			...node.data,
			...updates
		}
	}
}

/**
 * Update node state (minimized, active, etc.)
 */
export function updateNodeState(
	node: Node<ChatNodeData>,
	state: Partial<{
		isMinimized: boolean
		isActive: boolean
		isGenerating: boolean
		isHighlighted: boolean
	}>
): Node<ChatNodeData> {
	return updateNodeData(node, state)
}

/**
 * Restore nodes from saved state
 */
export function restoreNodesFromState(
	savedNodes: any[],
	messages: Message[],
	selectedAIs: AI[],
	handlers: any,
	state: any
): Node<ChatNodeData>[] {
	if (!savedNodes || savedNodes.length === 0) {
		return [createMainNode(messages, selectedAIs, handlers, state)]
	}

	return savedNodes.map((savedNode) => {
		// Validate savedNode structure
		if (!savedNode || !savedNode.id) {
			console.warn('Invalid saved node, skipping:', savedNode)
			return null
		}

		if (savedNode.id === 'main') {
			return createMainNode(messages, selectedAIs, handlers, {
				...state,
				isMinimized: savedNode.data?.isMinimized ?? false
			})
		}

		// Restore branch node - handle cases where data might be undefined
		const nodeData = savedNode.data || {}
		
		// Try to use ContextManager if we have a contextSnapshot
		const contextSnapshot = nodeData.contextSnapshot
		if (contextSnapshot && contextSnapshot.inheritedMessageIds) {
			const contextManager = new ContextManager(messageStore as any, branchStore as any)
			const branchId = savedNode.id
			
			// Check if branch context exists in store
			const branchContext = branchStore.get(branchId)
			if (branchContext) {
				// Branch context exists, get messages from ContextManager
				const displayMessages = contextManager.getContextForDisplay(branchId)
				const inheritedMessages = contextManager.getInheritedContext(branchId)
				const branchMessages = contextManager.getBranchMessages(branchId)
				
				// Only use ContextManager if we got messages
				if (displayMessages.length > 0 || inheritedMessages.length > 0 || branchMessages.length > 0) {
					return {
						...savedNode,
						// Preserve position from saved node
						position: savedNode.position || { x: 400, y: 50 },
						data: {
							...nodeData,
							messages: displayMessages,
							inheritedMessages: inheritedMessages,
							branchMessages: branchMessages,
							selectedAIs: nodeData.selectedAIs || selectedAIs,
							contextSnapshot: nodeData.contextSnapshot,
							...handlers
						}
					}
				}
			}
		}

		// Fallback: restore with data from savedNode (legacy format or when stores not populated)
		// Safely access nested properties with defaults
		const fallbackMessages = Array.isArray(nodeData.messages) ? nodeData.messages : []
		const fallbackInherited = Array.isArray(nodeData.inheritedMessages) ? nodeData.inheritedMessages : []
		const fallbackBranch = Array.isArray(nodeData.branchMessages) ? nodeData.branchMessages : []
		
		// Combine messages for display
		const combinedMessages = [...fallbackInherited, ...fallbackBranch]
		
		return {
			...savedNode,
			// Preserve position from saved node
			position: savedNode.position || { x: 400, y: 50 },
			data: {
				label: nodeData.label || `Branch ${savedNode.id.slice(-6)}`,
				messages: combinedMessages.length > 0 ? combinedMessages : fallbackMessages,
				inheritedMessages: fallbackInherited,
				branchMessages: fallbackBranch,
				selectedAIs: Array.isArray(nodeData.selectedAIs) ? nodeData.selectedAIs : selectedAIs,
				parentMessageId: nodeData.parentMessageId,
				parentId: nodeData.parentId && nodeData.parentId !== savedNode.id
					? nodeData.parentId
					: savedNode.id === 'main' ? undefined : 'main',
				contextSnapshot: nodeData.contextSnapshot,
				...handlers
			}
		}
	}).filter((node): node is Node<ChatNodeData> => node !== null)
}

/**
 * Validate node structure
 */
export function validateNode(node: Node<ChatNodeData>): boolean {
	if (!node.id || !node.type) {
		return false
	}

	if (node.type === 'chatNode' && !node.data) {
		return false
	}

	// Validate position
	if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
		return false
	}

	return true
}

/**
 * Filter valid nodes
 */
export function filterValidNodes(nodes: Node<ChatNodeData>[]): Node<ChatNodeData>[] {
	return nodes.filter(validateNode)
}

