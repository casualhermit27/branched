'use client'

import type { Message, AI } from '@/components/flow-canvas/types'

export interface BranchData {
	id: string
	conversationId: string
	type: 'main' | 'branch'
	label: string
	parentBranchId: string | null
	branchPointMessageId: string | null
	messageIds: string[]
	contextSnapshot?: {
		inheritedMessageIds: string[]
		timestamp: number
	}
	selectedAIs: any[]
	groupId?: string
	metadata: {
		isMinimized: boolean
		lastActivity: number
	}
	createdAt: string
}

export interface ConversationData {
	id: string
	title: string
	branches: BranchData[]
	messages: Message[]
	createdAt: string
	updatedAt: string
}

class BranchService {
	/**
	 * Save conversation to MongoDB with normalized structure
	 */
	async saveConversation(
		conversationId: string,
		branches: any[], // From FlowCanvas nodes
		allMessages: Message[]
	): Promise<void> {
		// 1. Extract unique messages (deduplicated)
		const uniqueMessages = this.deduplicateMessages(allMessages)

		// 2. Convert FlowCanvas nodes to branch structure
		const branchData = branches.map((node) => this.nodeToBranchData(node, conversationId))

		// 3. Save to MongoDB
		const response = await fetch('/api/conversations/save', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				conversationId,
				branches: branchData,
				messages: uniqueMessages
			})
		})

		if (!response.ok) {
			const error = await response.json()
			throw new Error(error.error || 'Failed to save conversation')
		}
	}

	/**
	 * Load conversation from MongoDB
	 */
	async loadConversation(conversationId: string): Promise<ConversationData> {
		const response = await fetch(`/api/conversations/${conversationId}`)

		if (!response.ok) {
			const error = await response.json()
			throw new Error(error.error || 'Failed to load conversation')
		}

		const data = await response.json()

		if (!data.success) {
			throw new Error(data.error || 'Failed to load conversation')
		}

		return data.data
	}

	/**
	 * Convert FlowCanvas node to branch data for MongoDB
	 */
	private nodeToBranchData(node: any, conversationId: string): BranchData {
		const isMain = node.id === 'main' || node.data?.isMain

		// For main node
		if (isMain) {
			return {
				id: 'branch-main',
				conversationId,
				type: 'main',
				label: 'Main Conversation',
				parentBranchId: null,
				branchPointMessageId: null,
				messageIds: (node.data?.messages || node.messages || []).map((m: Message) => m.id),
				selectedAIs: this.sanitizeAIs(node.data?.selectedAIs || node.selectedAIs || []),
				metadata: {
					isMinimized: node.data?.isMinimized || node.isMinimized || false,
					lastActivity: Date.now()
				},
				createdAt: node.data?.createdAt || node.createdAt || new Date().toISOString()
			}
		}

		// For branch nodes
		const nodeData = node.data || node
		
		// Get inherited message IDs from contextSnapshot or inheritedMessages
		const inheritedMessageIds =
			nodeData.contextSnapshot?.inheritedMessageIds ||
			(nodeData.inheritedMessages || []).map((m: Message) => m.id) ||
			[]

		// Get branch message IDs (only new messages in this branch)
		const allMessageIds = (nodeData.messages || []).map((m: Message) => m.id)
		const branchMessageIds = allMessageIds.filter(
			(id: string) => !inheritedMessageIds.includes(id)
		)

		return {
			id: node.id,
			conversationId,
			type: 'branch',
			label: nodeData.label || 'Branch',
			parentBranchId: nodeData.parentId || 'branch-main',
			branchPointMessageId: nodeData.parentMessageId || null,
			messageIds: branchMessageIds, // ONLY new messages in this branch
			contextSnapshot: {
				inheritedMessageIds, // Messages inherited from parent chain
				timestamp: nodeData.contextSnapshot?.timestamp || Date.now()
			},
			selectedAIs: this.sanitizeAIs(nodeData.selectedAIs || []),
			groupId: nodeData.groupId, // For multi-model branches
			metadata: {
				isMinimized: nodeData.isMinimized || false,
				lastActivity: nodeData.metadata?.lastActivity || nodeData.lastActivity || Date.now()
			},
			createdAt: nodeData.createdAt || node.createdAt || new Date().toISOString()
		}
	}

	/**
	 * Convert branch data to FlowCanvas node
	 */
	branchDataToNode(
		branch: BranchData,
		allMessages: Message[],
		handlers: any
	): any {
		// Build message store
		const messageStore = new Map(allMessages.map((m) => [m.id, m]))

		// Get inherited messages
		const inheritedMessages =
			branch.contextSnapshot?.inheritedMessageIds
				.map((id) => messageStore.get(id))
				.filter(Boolean) || []

		// Get branch messages
		const branchMessages = branch.messageIds
			.map((id) => messageStore.get(id))
			.filter(Boolean)

		// Combine for display
		const combinedMessages = [...inheritedMessages, ...branchMessages]

		const isMain = branch.type === 'main'

		return {
			id: branch.id,
			type: 'chatNode',
			position: { x: 0, y: 0 }, // Will be calculated by layout
			data: {
				label: branch.label,
				messages: combinedMessages, // For display
				inheritedMessages, // For context tracking
				branchMessages, // For context tracking
				parentId: branch.parentBranchId,
				parentMessageId: branch.branchPointMessageId,
				selectedAIs: branch.selectedAIs,
				isMain,
				isMinimized: branch.metadata.isMinimized,
				groupId: branch.groupId,
				contextSnapshot: branch.contextSnapshot,
				// Handlers
				...handlers
			}
		}
	}

	/**
	 * Deduplicate messages by ID
	 */
	private deduplicateMessages(messages: Message[]): Message[] {
		const seen = new Set<string>()
		return messages.filter((msg) => {
			if (seen.has(msg.id)) return false
			seen.add(msg.id)
			return true
		})
	}

	/**
	 * Sanitize AI objects for MongoDB (remove React elements)
	 */
	private sanitizeAIs(ais: AI[]): any[] {
		return ais.map((ai) => ({
			id: ai.id,
			name: ai.name,
			color: ai.color,
			functional: ai.functional !== undefined ? ai.functional : true
			// Don't save logo (React element)
		}))
	}
}

export const branchService = new BranchService()

