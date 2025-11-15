'use client'

import type { Message, AI } from './types'
import type { Node } from 'reactflow'

/**
 * Build conversation context for AI API
 */
export function buildConversationContext(
	messages: Message[],
	includeMemory: boolean = true
): Array<{ role: 'user' | 'assistant'; content: string }> {
	return messages
		.filter((msg) => msg.text && msg.text.trim().length > 0)
		.map((msg) => ({
			role: msg.isUser ? 'user' : 'assistant',
			content: msg.text
		}))
}

/**
 * Get parent chain messages (all messages from root to current node)
 */
export function getParentChainMessages(
	nodeId: string,
	nodes: Node[],
	allMessages: Message[]
): Message[] {
	if (nodeId === 'main') {
		return allMessages
	}

	const node = nodes.find((n) => n.id === nodeId)
	if (!node || !node.data) {
		return []
	}

	const inheritedMessages = node.data.inheritedMessages || []
	const branchMessages = node.data.branchMessages || []
	
	return [...inheritedMessages, ...branchMessages]
}

/**
 * Deduplicate messages by ID
 */
export function deduplicateMessages(messages: Message[]): Message[] {
	const seen = new Set<string>()
	return messages.filter((msg) => {
		if (!msg.id) return true
		if (seen.has(msg.id)) return false
		seen.add(msg.id)
		return true
	})
}

/**
 * Validate message structure
 */
export function validateMessage(message: Partial<Message>): message is Message {
	return !!(
		message.id &&
		typeof message.text === 'string' &&
		typeof message.isUser === 'boolean' &&
		typeof message.timestamp === 'number'
	)
}

/**
 * Create user message
 */
export function createUserMessage(
	text: string,
	parentId?: string,
	nodeId?: string
): Message {
	return {
		id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		text: text.trim(),
		isUser: true,
		parentId,
		children: [],
		timestamp: Date.now(),
		nodeId
	}
}

/**
 * Create AI message
 */
export function createAIMessage(
	text: string,
	aiModel: string,
	parentId?: string,
	nodeId?: string,
	metadata?: Partial<Message>
): Message {
	return {
		id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		text: text.trim(),
		isUser: false,
		ai: aiModel,
		aiModel: aiModel,
		parentId,
		children: [],
		timestamp: Date.now(),
		nodeId,
		...metadata
	}
}

/**
 * Create streaming message placeholder
 */
export function createStreamingMessage(
	aiModel: string,
	parentId?: string,
	nodeId?: string
): Message {
	return {
		id: `streaming-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		text: '',
		isUser: false,
		ai: aiModel,
		aiModel: aiModel,
		parentId,
		children: [],
		timestamp: Date.now(),
		nodeId,
		isStreaming: true,
		streamingText: ''
	}
}

/**
 * Update streaming message
 */
export function updateStreamingMessage(
	message: Message,
	chunk: string
): Message {
	return {
		...message,
		streamingText: (message.streamingText || '') + chunk,
		text: (message.text || '') + chunk
	}
}

/**
 * Finalize streaming message
 */
export function finalizeStreamingMessage(message: Message): Message {
	return {
		...message,
		isStreaming: false,
		streamingText: undefined
	}
}

/**
 * Get messages for a specific node
 */
export function getNodeMessages(
	nodeId: string,
	nodes: Node[]
): Message[] {
	const node = nodes.find((n) => n.id === nodeId)
	if (!node || !node.data) {
		return []
	}

	return node.data.messages || []
}

/**
 * Add message to node
 */
export function addMessageToNode(
	nodeId: string,
	message: Message,
	nodes: Node[]
): Node[] {
	return nodes.map((node) => {
		if (node.id !== nodeId) return node

		const currentMessages = node.data?.messages || []
		return {
			...node,
			data: {
				...node.data,
				messages: [...currentMessages, message]
			}
		}
	})
}

/**
 * Update message in node
 */
export function updateMessageInNode(
	nodeId: string,
	messageId: string,
	updates: Partial<Message>,
	nodes: Node[]
): Node[] {
	return nodes.map((node) => {
		if (node.id !== nodeId) return node

		const messages = (node.data?.messages || []).map((msg) =>
			msg.id === messageId ? { ...msg, ...updates } : msg
		)

		return {
			...node,
			data: {
				...node.data,
				messages
			}
		}
	})
}

/**
 * Get context for memory extraction
 */
export function getMemoryContext(
	messages: Message[],
	maxMessages: number = 10
): Message[] {
	// Get most recent messages for context
	return messages.slice(-maxMessages)
}

