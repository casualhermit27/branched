'use client'

import type { Message, SearchResult } from './types'
import type { Node } from 'reactflow'

/**
 * Search across all messages in nodes
 */
export function searchMessages(
	query: string,
	nodes: Node[]
): SearchResult[] {
	if (!query || query.trim().length === 0) {
		return []
	}

	const searchTerm = query.toLowerCase().trim()
	const results: SearchResult[] = []

	nodes.forEach((node) => {
		const messages = node.data?.messages || []
		
		messages.forEach((message: Message) => {
			if (!message.text) return
			
			const text = message.text.toLowerCase()
			if (text.includes(searchTerm)) {
				// Find match position for preview
				const index = text.indexOf(searchTerm)
				const start = Math.max(0, index - 50)
				const end = Math.min(text.length, index + searchTerm.length + 50)
				const preview = message.text.substring(start, end)
				
				results.push({
					nodeId: node.id,
					messageId: message.id,
					messageText: message.text,
					preview: `...${preview}...`
				})
			}
		})
	})

	return results
}

/**
 * Highlight search matches in text
 */
export function highlightSearchMatch(
	text: string,
	query: string
): string {
	if (!query || query.trim().length === 0) {
		return text
	}

	const searchTerm = query.trim()
	const regex = new RegExp(`(${searchTerm})`, 'gi')
	
	return text.replace(regex, '<mark>$1</mark>')
}

/**
 * Get search result context (surrounding messages)
 */
export function getSearchResultContext(
	result: SearchResult,
	nodes: Node[],
	contextSize: number = 2
): Message[] {
	const node = nodes.find((n) => n.id === result.nodeId)
	if (!node || !node.data) {
		return []
	}

	const messages = node.data.messages || []
	const messageIndex = messages.findIndex((m) => m.id === result.messageId)
	
	if (messageIndex === -1) {
		return []
	}

	const start = Math.max(0, messageIndex - contextSize)
	const end = Math.min(messages.length, messageIndex + contextSize + 1)
	
	return messages.slice(start, end)
}

/**
 * Navigate to search result
 */
export function navigateToSearchResult(
	result: SearchResult,
	onNavigate: (nodeId: string, messageId?: string) => void
): void {
	onNavigate(result.nodeId, result.messageId)
}

