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
		const hasMessages = messages.length > 0 && messages.some((m: any) => m.text || m.streamingText)
		const hasNodes = conversationNodes.length > 0 && conversationNodes.some((n: any) => {
			const nodeMessages = n.data?.messages || n.messages || []
			return nodeMessages.length > 0
		})
		const hasBranches = branches.length > 0

		console.log(`💾 Autosave check: Messages=${messages.length}, Nodes=${conversationNodes.length}, Branches=${branches.length}`)
		conversationNodes.forEach(n => {
			const msgCount = (n.data?.messages || n.messages || []).length
			if (msgCount > 0) console.log(`   Node ${n.id}: ${msgCount} messages`)
		})

		const shouldSave = !isInitialLoadRef.current && (hasMessages || hasNodes || hasBranches)

		if (shouldSave) {
			const timeoutId = setTimeout(() => {
				let allNodes = [...conversationNodes]

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
						branchGroupId: node.data?.branchGroupId || node.branchGroupId,
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
				autoSaveConversation(conversationData, conversationIdToSave || undefined)
			}, 100)

			return () => clearTimeout(timeoutId)
		}
	}, [messages, selectedAIs, conversationNodes, currentBranch, branches, autoSaveConversation, currentConversationIdRef, isInitialLoadRef])
}

