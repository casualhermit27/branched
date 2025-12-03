import { useCallback } from 'react'
import type { AI, Message } from './use-conversation-state'
import { restoreAILogos, restoreBranchAILogos, sanitizeMessages } from '@/utils/conversation-restore'

interface RestoreConversationParams {
	conversation: any
	setMessages: (messages: Message[]) => void
	setSelectedAIs: (ais: AI[]) => void
	setBranches: (branches: { id: string }[]) => void
	setConversationNodes: (nodes: any[]) => void
	setCurrentBranch: (branch: string | null) => void
	setActiveBranchId: (branchId: string | null) => void
	currentConversationIdRef: React.MutableRefObject<string | null>
	selectedAIs: AI[]
	defaultAI: AI
}

export function useConversationRestore() {
	const restoreConversation = useCallback(({
		conversation,
		setMessages,
		setSelectedAIs,
		setBranches,
		setConversationNodes,
		setCurrentBranch,
		setActiveBranchId,
		currentConversationIdRef,
		selectedAIs,
		defaultAI
	}: RestoreConversationParams) => {


		const hasMessages = (conversation.mainMessages && conversation.mainMessages.length > 0) ||
			(conversation.messages && conversation.messages.length > 0)
		const hasBranches = conversation.branches && conversation.branches.length > 0

		if (!hasMessages && !hasBranches) {
			return
		}

		if (conversation._id) {
			currentConversationIdRef.current = conversation._id
			currentConversationIdRef.current = conversation._id
		}

		if (conversation.mainMessages && Array.isArray(conversation.mainMessages)) {
			const validMessages = conversation.mainMessages
				.filter((msg: any) => msg && msg.id)
				.map((msg: any) => ({
					...msg,
					text: msg.text || msg.streamingText || '',
					isStreaming: false,
					streamingText: undefined
				}))

			setMessages(validMessages)
			setMessages(validMessages)
		} else {
			setMessages([])
		}

		if (conversation.selectedAIs && conversation.selectedAIs.length > 0) {
			const restoredAIs = conversation.selectedAIs.map((ai: any) => restoreAILogos(ai))
			setSelectedAIs(restoredAIs)
			setSelectedAIs(restoredAIs)
		} else {
			setSelectedAIs([defaultAI])
		}

		const mainNodeInBranches = conversation.branches?.find((b: any) => b.id === 'main' || b.isMain)

		if (conversation.branches && conversation.branches.length > 0) {
			const nonMainBranches = conversation.branches.filter((b: any) => b.id !== 'main' && !b.isMain)

			if (nonMainBranches.length > 0) {
				setBranches(nonMainBranches.map((b: any) => ({ id: b.id })))
			} else {
				setBranches([])
			}

			let restoredNodes = conversation.branches.map((b: any) => {
				const isMainNode = b.isMain || b.id === 'main'

				const restoredAIs = b.selectedAIs?.map((ai: any) => {
					if (ai.type && ai.props && ai._owner !== undefined) {
						return null
					}
					return restoreBranchAILogos(ai)
				}).filter((ai: any) => ai !== null) || []

				let branchMessages: any[] = []
				let inheritedMessages: any[] = []

				if (isMainNode) {
					branchMessages = (conversation.mainMessages || [])
						.filter((msg: any) => msg && msg.id && (msg.text || msg.streamingText))
						.map((msg: any) => ({
							...msg,
							text: msg.text || msg.streamingText || '',
							isStreaming: false,
							streamingText: undefined
						}))
				} else {
					if (b.messages && Array.isArray(b.messages) && b.messages.length > 0) {
						branchMessages = b.messages
							.filter((msg: any) => msg && msg.id)
							.map((msg: any) => ({
								...msg,
								text: msg.text || msg.streamingText || '',
								isStreaming: false,
								streamingText: undefined
							}))
					} else if ((b.inheritedMessages && b.inheritedMessages.length > 0) ||
						(b.branchMessages && b.branchMessages.length > 0)) {
						inheritedMessages = sanitizeMessages(b.inheritedMessages || [])
						branchMessages = sanitizeMessages(b.branchMessages || [])
					}
				}

				const allMessages = [...inheritedMessages, ...branchMessages]

				return {
					id: b.id,
					type: 'chatNode',
					position: b.position || { x: 0, y: 0 },
					data: {
						label: b.label || b.title || (isMainNode ? 'Main Conversation' : 'Branch'),
						messages: allMessages,
						inheritedMessages: inheritedMessages,
						branchMessages: branchMessages,
						selectedAIs: restoredAIs || [],
						isMain: b.isMain || b.id === 'main',
						isMinimized: b.isMinimized || false,
						showAIPill: b.showAIPill !== undefined ? b.showAIPill : !isMainNode,
						parentId: isMainNode ? undefined : (b.parentId || 'main'),
						parentMessageId: b.parentMessageId,
						contextSnapshot: b.contextSnapshot,
						nodeId: b.id,
						branchGroupId: b.branchGroupId || b.groupId || b.data?.branchGroupId || b.data?.groupId
					}
				}
			})



			if (!mainNodeInBranches) {
				const mainMessages = sanitizeMessages(conversation.mainMessages || [])
				const mainNode = {
					id: 'main',
					type: 'chatNode',
					position: { x: 400, y: 50 },
					data: {
						label: 'Main Conversation',
						messages: mainMessages,
						inheritedMessages: [],
						branchMessages: [],
						selectedAIs: conversation.selectedAIs || selectedAIs,
						isMain: true,
						isMinimized: false,
						showAIPill: false,
						parentId: undefined,
						parentMessageId: undefined,
						nodeId: 'main'
					}
				}
				restoredNodes = [mainNode, ...restoredNodes]
			} else {
				const mainNodeIndex = restoredNodes.findIndex((n: any) => n.id === 'main' || n.data?.isMain)
				if (mainNodeIndex !== -1) {
					const mainMessages = sanitizeMessages(conversation.mainMessages || [])
					restoredNodes[mainNodeIndex].data.messages = mainMessages
				}
			}

			setConversationNodes(restoredNodes)
		} else {
			const mainMessages = sanitizeMessages(conversation.mainMessages || [])
			const mainNode = {
				id: 'main',
				type: 'chatNode',
				position: { x: 400, y: 50 },
				data: {
					label: 'Main Conversation',
					messages: mainMessages,
					inheritedMessages: [],
					branchMessages: [],
					selectedAIs: conversation.selectedAIs || selectedAIs,
					isMain: true,
					isMinimized: false,
					showAIPill: false,
					parentId: undefined,
					parentMessageId: undefined,
					nodeId: 'main'
				}
			}
			setBranches([])
			setConversationNodes([mainNode])
		}

		// Restore active node/branch if available
		if (conversation.activeNodeId) {
			setActiveBranchId(conversation.activeNodeId)
			if (conversation.activeNodeId !== 'main') {
				setCurrentBranch(conversation.activeNodeId)
			} else {
				setCurrentBranch(null)
			}
		} else {
			setCurrentBranch(null)
			setActiveBranchId('main')
		}

		currentConversationIdRef.current = conversation._id
	}, [])

	return { restoreConversation }
}

