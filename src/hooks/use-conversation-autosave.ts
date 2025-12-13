import { useEffect } from 'react'
import { mongoDBService } from '@/services/mongodb-service'
import type { AI, Message } from './use-conversation-state'
import { sanitizeMessages } from '@/utils/conversation-restore'

interface UseConversationAutosaveParams {
	messages: Message[]
	selectedAIs: AI[]
	conversationNodes: any[]
	currentBranch: string | null
	branches: { id: string }[]
	autoSaveConversation: (data: any, id?: string) => void
	currentConversationIdRef: React.MutableRefObject<string | null>
	isInitialLoadRef: React.MutableRefObject<boolean>
}

import { useSyncStore } from '@/stores/sync-store'

export function useConversationAutosave({
	messages,
	selectedAIs,
	conversationNodes,
	currentBranch,
	branches,
	autoSaveConversation,
	currentConversationIdRef,
	isInitialLoadRef
}: UseConversationAutosaveParams) {
	useEffect(() => {
		// ... (keep existing checks for hasMessages, hasNodes, hasBranches)
		const hasMessages = messages.length > 0 && messages.some((m: any) => m.text || m.streamingText)
		const hasNodes = conversationNodes.length > 0 && conversationNodes.some((n: any) => {
			const nodeMessages = n.data?.messages || n.messages || []
			return nodeMessages.length > 0
		})
		const hasBranches = branches.length > 0

		const shouldSave = !isInitialLoadRef.current && (hasMessages || hasNodes || hasBranches)

		if (shouldSave) {
			const timeoutId = setTimeout(() => {
				const dirtyNodeIds = useSyncStore.getState().getDirtyNodes()
				const conversationId = currentConversationIdRef.current

				// If we have a conversation ID and dirty nodes, try a delta update
				if (conversationId && dirtyNodeIds.size > 0) {
					// Prepare delta payload
					const updates: Record<string, any> = {}

					// Check if main messages changed (special case)
					// In a real implementation, we'd track 'main' as a dirty node too
					// For now, let's assume if dirtyNodeIds has 'main', we update main messages

					conversationNodes.forEach(node => {
						if (dirtyNodeIds.has(node.id)) {
							// Construct node data similar to full save logic
							// ... (reuse the node construction logic here or extract it)
							// For brevity in this step, I will reuse the existing logic but filter by dirty IDs
							// In a full refactor, we should extract the "node to mongo object" logic
						}
					})

					// FALLBACK: For this iteration, let's stick to the full save but clear the dirty flag
					// The actual delta payload construction requires refactoring the mapping logic above into a helper
					// which is safer to do in a separate step. 
					// Let's proceed with the full save for now but clear the dirty set to indicate we handled it.
					useSyncStore.getState().clearDirtyNodes()
				}

				let allNodes = [...conversationNodes]
				// ... (rest of the existing full save logic)
				const hasMainNode = allNodes.some(node => node.id === 'main')

				if (!hasMainNode) {
					allNodes.push({
						id: 'main',
						type: 'main',
						title: 'Main Conversation',
						messages: messages,
						timestamp: Date.now(),
						parentId: undefined,
						children: [],
						isActive: !currentBranch,
						selectedAIs: selectedAIs,
						isMain: true,
						position: { x: 0, y: 0 }
					})
				}

				// Debug: Log what we're about to save
				console.log('[Autosave] Saving conversation:', {
					conversationId: currentConversationIdRef.current,
					totalNodes: allNodes.length,
					branchNodes: allNodes.filter(n => n.id !== 'main' && !n.isMain).length,
					nodePositions: allNodes.map(n => ({ id: n.id, position: n.position }))
				})

				const branchesForSave = allNodes.map(node => {
					const isMainNode = node.id === 'main' || node.isMain
					let nodeMessages: any[] = []

					if (isMainNode) {
						nodeMessages = messages
					} else {
						const inheritedMessages = node.data?.inheritedMessages || node.inheritedMessages || []
						const branchMessages = node.data?.branchMessages || node.branchMessages || []

						if (inheritedMessages.length > 0 || branchMessages.length > 0) {
							nodeMessages = [...inheritedMessages, ...branchMessages]
						} else {
							nodeMessages = node.data?.messages || node.messages || []
						}
					}

					let parentMessageId = node.data?.parentMessageId || node.parentMessageId || node.nodeData?.parentMessageId

					if (!parentMessageId && !isMainNode && nodeMessages.length > 0) {
						const firstUserMessage = nodeMessages.find((m: any) => m.isUser)
						if (firstUserMessage?.parentId) {
							parentMessageId = firstUserMessage.parentId
						}
					}

					if (!parentMessageId && !isMainNode) {
						const inherited = node.data?.inheritedMessages || node.inheritedMessages || []
						if (inherited.length > 0) {
							const lastInherited = inherited[inherited.length - 1]
							parentMessageId = lastInherited.id
						}
					}

					let finalParentId = node.parentId || node.data?.parentId
					if (!isMainNode && finalParentId === node.id) {
						finalParentId = 'main'
					}
					if (!isMainNode && !finalParentId) {
						finalParentId = 'main'
					}

					const inheritedMessages = isMainNode ? undefined : sanitizeMessages(node.data?.inheritedMessages || node.inheritedMessages || [])
					const branchMessages = isMainNode ? undefined : sanitizeMessages(node.data?.branchMessages || node.branchMessages || [])
					const combinedMessages = sanitizeMessages(nodeMessages)

					return {
						id: node.id,
						label: node.title || node.data?.label || 'Untitled',
						parentId: isMainNode ? undefined : finalParentId,
						parentMessageId: isMainNode ? undefined : parentMessageId,
						inheritedMessages: inheritedMessages,
						branchMessages: branchMessages,
						messages: combinedMessages,
						selectedAIs: isMainNode ? selectedAIs : (node.selectedAIs || node.data?.selectedAIs || []),
						isMinimized: node.isMinimized || node.data?.isMinimized || false,
						isActive: node.id === currentBranch,
						isGenerating: node.data?.isGenerating || false,
						isHighlighted: node.data?.isHighlighted || false,
						position: node.position || node.data?.position || { x: 0, y: 0 },
						isMain: isMainNode,
						branchGroupId: node.data?.branchGroupId || node.branchGroupId || node.data?.groupId || node.groupId,
						metadata: node.data?.metadata || node.metadata || {}
					}
				})

				const branchesOnly = branchesForSave.filter(b => !b.isMain && b.id !== 'main')

				const mainMessagesToSave = sanitizeMessages(messages).filter((msg: any) =>
					msg && msg.id && (msg.text || msg.streamingText)
				)

				if (mainMessagesToSave.length === 0 && branchesOnly.length === 0) {
					return
				}

				const branchesWithMessages = branchesOnly.map((branch: any) => {
					const branchMessages = branch.messages || []
					const inheritedMessages = branch.inheritedMessages || []
					const branchOnlyMessages = branch.branchMessages || []

					const finalMessages = (inheritedMessages.length > 0 || branchOnlyMessages.length > 0)
						? [...inheritedMessages, ...branchOnlyMessages]
						: branchMessages

					return {
						...branch,
						messages: sanitizeMessages(finalMessages),
						inheritedMessages: sanitizeMessages(inheritedMessages),
						branchMessages: sanitizeMessages(branchOnlyMessages)
					}
				})

				const conversationData = mongoDBService.convertAppStateToMongoDB({
					title: 'Conversation',
					messages: mainMessagesToSave,
					selectedAIs,
					branches: branchesWithMessages,
					contextLinks: [],
					collapsedNodes: [],
					minimizedNodes: [],
					activeNodeId: currentBranch || undefined,
					viewport: { x: 0, y: 0, zoom: 1 }
				})

				const conversationIdToSave = currentConversationIdRef.current

				// If we have dirty nodes and an ID, we *could* do a delta update here.
				// For now, we are just clearing the dirty state to acknowledge we have "saved" (even if fully).
				// The next step would be to actually call a `saveDelta` method on mongoDBService.
				if (conversationIdToSave) {
					useSyncStore.getState().clearDirtyNodes()
				}

				autoSaveConversation(conversationData, conversationIdToSave || undefined)
			}, 100)

			return () => clearTimeout(timeoutId)
		}
	}, [messages, selectedAIs, conversationNodes, currentBranch, branches, autoSaveConversation, currentConversationIdRef, isInitialLoadRef])
}

