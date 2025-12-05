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
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(text: string): string {
	const htmlEntities: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	}
	return text.replace(/[&<>"']/g, char => htmlEntities[char] || char)
}

/**
 * Escape regex special characters
 */
function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Highlight search matches in text (XSS-safe)
 */
export function highlightSearchMatch(
	text: string,
	query: string
): string {
	if (!query || query.trim().length === 0) {
		return escapeHtml(text)
	}

	// First escape HTML to prevent XSS
	const escapedText = escapeHtml(text)
	const escapedQuery = escapeHtml(query.trim())

	// Escape regex special characters in the search term
	const safeSearchTerm = escapeRegex(escapedQuery)
	const regex = new RegExp(`(${safeSearchTerm})`, 'gi')

	return escapedText.replace(regex, '<mark>$1</mark>')
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
	const messageIndex = messages.findIndex((m: Message) => m.id === result.messageId)

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

