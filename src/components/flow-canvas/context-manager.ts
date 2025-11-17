'use client'

import type { Message } from './types'

export interface ContextSnapshot {
	branchPointMessageId: string
	inheritedMessageIds: string[]
	timestamp: number
}

export interface BranchContext {
	branchId: string
	parentBranchId: string
	contextSnapshot: ContextSnapshot
	branchMessageIds: string[]
	metadata?: {
		selectedAIs?: any[]
		[label: string]: any
	}
}

export interface ConversationContext {
	messages: Message[]
	currentBranch: string
	memoryContext?: string
	linkedBranches?: string[]
	timestamp: number
}

export class ContextManager {
	constructor(
		private messageStore: Map<string, Message>,
		private branchStore: Map<string, BranchContext>
	) {}

	/**
	 * Create a lightweight snapshot at branch creation time
	 */
	createContextSnapshot(
		parentBranchId: string,
		branchPointMessageId: string
	): ContextSnapshot {
		// Get all parent messages up to branch point
		const parentMessages = this.getMessagesUpTo(
			parentBranchId,
			branchPointMessageId
		)

		// Return lightweight snapshot (just IDs)
		return {
			branchPointMessageId,
			inheritedMessageIds: parentMessages.map((m) => m.id),
			timestamp: Date.now()
		}
	}

	/**
	 * Get inherited context (from parent chain)
	 */
	getInheritedContext(branchId: string): Message[] {
		const branch = this.branchStore.get(branchId)
		if (!branch) return []

		// Resolve IDs to full messages
		return branch.contextSnapshot.inheritedMessageIds
			.map((id) => this.messageStore.get(id))
			.filter((msg): msg is Message => msg !== undefined)
	}

	/**
	 * Get branch-specific messages
	 */
	getBranchMessages(branchId: string): Message[] {
		const branch = this.branchStore.get(branchId)
		if (!branch) return []

		return branch.branchMessageIds
			.map((id) => this.messageStore.get(id))
			.filter((msg): msg is Message => msg !== undefined)
	}

	/**
	 * Get full context for display (inherited + branch messages)
	 */
	getContextForDisplay(branchId: string): Message[] {
		return [
			...this.getInheritedContext(branchId),
			...this.getBranchMessages(branchId)
		]
	}

	/**
	 * Get full context for AI (includes memory, linked branches)
	 */
	async getFullContext(branchId: string): Promise<ConversationContext> {
		const messages = this.getContextForDisplay(branchId)

		// Get memory context
		const memoryContext = await this.getMemoryContext(branchId)

		// Get linked branch contexts
		const linkedMessages = await this.getLinkedBranchMessages(branchId)

		return {
			messages: [...messages, ...linkedMessages],
			currentBranch: branchId,
			memoryContext,
			timestamp: Date.now()
		}
	}

	/**
	 * Get branch context
	 */
	getBranchContext(branchId: string): BranchContext | undefined {
		return this.branchStore.get(branchId)
	}

	/**
	 * Set branch context
	 */
	setBranchContext(branch: BranchContext): void {
		this.branchStore.set(branch.branchId, branch)
	}

	/**
	 * Add message to branch
	 */
	addMessageToBranch(branchId: string, messageId: string): void {
		const branch = this.branchStore.get(branchId)
		if (branch) {
			branch.branchMessageIds.push(messageId)
			this.branchStore.set(branchId, branch)
		}
	}

	/**
	 * Get message by ID
	 */
	getMessage(messageId: string): Message | undefined {
		return this.messageStore.get(messageId)
	}

	/**
	 * Set message in store
	 */
	setMessage(message: Message): void {
		this.messageStore.set(message.id, message)
	}

	/**
	 * Get multiple messages by IDs
	 */
	getMessages(messageIds: string[]): Message[] {
		return messageIds
			.map((id) => this.messageStore.get(id))
			.filter((msg): msg is Message => msg !== undefined)
	}

	/**
	 * Helper: Get messages up to a point
	 */
	private getMessagesUpTo(
		branchId: string,
		targetMessageId: string
	): Message[] {
		const allMessages = this.getContextForDisplay(branchId)
		const targetIndex = allMessages.findIndex((m) => m.id === targetMessageId)
		
		// Include the target message itself (targetIndex + 1)
		// This ensures the branch point message (AI reply) is included
		if (targetIndex >= 0) {
			return allMessages.slice(0, targetIndex + 1)
		}
		
		// If message not found, try to get it from messageStore and include it
		const targetMessage = this.messageStore.get(targetMessageId)
		if (targetMessage) {
			return [...allMessages, targetMessage]
		}
		
		return allMessages
	}

	/**
	 * Get memory context for branch
	 */
	private async getMemoryContext(branchId: string): Promise<string> {
		try {
			const response = await fetch(
				`/api/memory/context?branchId=${branchId}&depth=3&maxMemories=50`
			)
			if (response.ok) {
				const data = await response.json()
				if (data.success) {
					return data.data.aggregatedContext || ''
				}
			}
		} catch (error) {
			console.error('Error fetching memory context:', error)
		}
		return ''
	}

	/**
	 * Get linked branch messages (for context linking)
	 */
	private async getLinkedBranchMessages(branchId: string): Promise<Message[]> {
		const branch = this.branchStore.get(branchId)
		if (!branch || !branch.metadata?.linkedBranches) {
			return []
		}

		const linkedMessages: Message[] = []
		for (const linkedBranchId of branch.metadata.linkedBranches) {
			const linkedBranchMessages = this.getBranchMessages(linkedBranchId)
			linkedMessages.push(...linkedBranchMessages)
		}

		return linkedMessages
	}

	/**
	 * Validate context integrity
	 */
	validateContext(branchId: string): boolean {
		const branch = this.branchStore.get(branchId)
		if (!branch) return false

		// Check all inherited messages exist
		const inheritedExist = branch.contextSnapshot.inheritedMessageIds.every(
			(id) => this.messageStore.has(id)
		)

		// Check all branch messages exist
		const branchExist = branch.branchMessageIds.every((id) =>
			this.messageStore.has(id)
		)

		return inheritedExist && branchExist
	}

	/**
	 * Get all branch IDs
	 */
	getAllBranchIds(): string[] {
		return Array.from(this.branchStore.keys())
	}

	/**
	 * Delete branch context
	 */
	deleteBranchContext(branchId: string): void {
		this.branchStore.delete(branchId)
	}

	/**
	 * Clear all contexts
	 */
	clear(): void {
		this.messageStore.clear()
		this.branchStore.clear()
	}

	/**
	 * Export context for MongoDB
	 */
	exportContext(): {
		messages: Message[]
		branches: BranchContext[]
	} {
		return {
			messages: Array.from(this.messageStore.values()),
			branches: Array.from(this.branchStore.values())
		}
	}

	/**
	 * Import context from MongoDB
	 */
	importContext(data: { messages: Message[]; branches: BranchContext[] }): void {
		// Clear existing
		this.clear()

		// Import messages
		data.messages.forEach((msg) => {
			this.messageStore.set(msg.id, msg)
		})

		// Import branches
		data.branches.forEach((branch) => {
			this.branchStore.set(branch.branchId, branch)
		})
	}
}

