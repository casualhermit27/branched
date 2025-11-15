'use client'

import type { Message } from './types'

/**
 * Global message store - single source of truth for all messages
 * Uses Map for O(1) lookups
 */
export class MessageStore {
	private messages: Map<string, Message> = new Map()

	/**
	 * Get message by ID
	 */
	get(messageId: string): Message | undefined {
		return this.messages.get(messageId)
	}

	/**
	 * Set message (add or update)
	 */
	set(message: Message): void {
		this.messages.set(message.id, message)
	}

	/**
	 * Get multiple messages by IDs
	 */
	getMany(messageIds: string[]): Message[] {
		return messageIds
			.map((id) => this.messages.get(id))
			.filter((msg): msg is Message => msg !== undefined)
	}

	/**
	 * Check if message exists
	 */
	has(messageId: string): boolean {
		return this.messages.has(messageId)
	}

	/**
	 * Delete message
	 */
	delete(messageId: string): void {
		this.messages.delete(messageId)
	}

	/**
	 * Get all messages
	 */
	getAll(): Message[] {
		return Array.from(this.messages.values())
	}

	/**
	 * Get messages by node ID
	 */
	getByNodeId(nodeId: string): Message[] {
		return Array.from(this.messages.values()).filter(
			(msg) => msg.nodeId === nodeId
		)
	}

	/**
	 * Clear all messages
	 */
	clear(): void {
		this.messages.clear()
	}

	/**
	 * Get size
	 */
	size(): number {
		return this.messages.size
	}

	/**
	 * Batch set messages
	 */
	setMany(messages: Message[]): void {
		messages.forEach((msg) => {
			this.messages.set(msg.id, msg)
		})
	}

	/**
	 * Export for MongoDB
	 */
	export(): Message[] {
		return Array.from(this.messages.values())
	}

	/**
	 * Import from MongoDB
	 */
	import(messages: Message[]): void {
		this.setMany(messages)
	}
}

// Singleton instance - only create on client side
let messageStoreInstance: MessageStore | null = null

export const messageStore = (() => {
	if (typeof window === 'undefined') {
		// Return a dummy instance during SSR
		return {
			get: () => undefined,
			set: () => {},
			getMany: () => [],
			has: () => false,
			delete: () => {},
			getAll: () => [],
			getByNodeId: () => [],
			clear: () => {},
			size: () => 0,
			setMany: () => {},
			export: () => [],
			import: () => {}
		} as MessageStore
	}
	
	if (!messageStoreInstance) {
		messageStoreInstance = new MessageStore()
	}
	return messageStoreInstance
})()

