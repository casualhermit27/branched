'use client'

import { useCallback } from 'react'
import type {
	AI,
	Message,
	Branch as ConversationBranch,
	ConversationState
} from './use-conversation-state'
import { ConversationExport } from '@/services/conversation-export'

interface ToastOptions {
	type: 'success' | 'error' | 'info' | 'warning'
	title: string
	message: string
}

interface UseConversationBranchActionsParams {
	state: ConversationState
	defaultAI: AI
	addToast: (toast: ToastOptions) => void
	restoreConversationState: (conversation: any) => void
}

export function useConversationBranchActions({
	state,
	defaultAI,
	addToast,
	restoreConversationState
}: UseConversationBranchActionsParams) {
	const {
		selectedAIs,
		setSelectedAIs,
		messages,
		setMessages,
		setCurrentBranch,
		setBranches,
		conversationNodes,
		setConversationNodes,
		setAllConversations,
		activeBranchId,
		setActiveBranchId,
		savedBranches,
		setSavedBranches,
		currentConversationIdRef,
		branchCacheRef,
		creatingBranchRef
	} = state

	const handleImportConversation = useCallback((importData: ConversationExport) => {
		try {
			if (importData.conversation.messages) {
				setMessages(importData.conversation.messages)
			}
			if (importData.conversation.branches) {
				setBranches(importData.conversation.branches)
			}
			if (importData.conversation.nodes) {
				setConversationNodes(importData.conversation.nodes)
			}
		} catch (error) {
			console.error('❌ Failed to import conversation:', error)
		}
	}, [setBranches, setConversationNodes, setMessages])

	const generateBranchTitle = useCallback((branchMessages: Message[]) => {
		const firstUserMessage = branchMessages.find(m => m.isUser)
		if (firstUserMessage) {
			return firstUserMessage.text.length > 40
				? `${firstUserMessage.text.substring(0, 40)}...`
				: firstUserMessage.text
		}
		return 'New conversation'
	}, [])

	const saveCurrentBranch = useCallback(() => {
		if (messages.length === 0) return

		const branchId = `branch-${Date.now()}`
		const newBranch: ConversationBranch = {
			id: branchId,
			title: generateBranchTitle(messages),
			messages: [...messages],
			timestamp: Date.now(),
			parentBranchId: activeBranchId || undefined,
			children: []
		}

		setSavedBranches(prev => [...prev, newBranch])
		setActiveBranchId(branchId)
	}, [messages, generateBranchTitle, activeBranchId, setActiveBranchId, setSavedBranches])

	const handleSelectBranch = useCallback((branchId: string) => {
		const branchNode = conversationNodes.find(n => n.id === branchId)

		if (branchNode) {
			setActiveBranchId(branchId)
		 return
		}

		const branch = savedBranches.find(b => b.id === branchId)
		if (branch) {
			setMessages(branch.messages)
			setActiveBranchId(branchId)
		} else {
			console.warn('⚠️ Branch not found:', branchId)
		}
	}, [conversationNodes, savedBranches, setActiveBranchId, setMessages])

	const handleDeleteBranch = useCallback(async (branchId: string) => {
		try {
			if (branchId === 'main') {
				addToast({
					type: 'error',
					title: 'Cannot Delete',
					message: 'Cannot delete the main conversation.'
				})
				return
			}

			setConversationNodes(prev => {
				const updated = prev.filter(n => n.id !== branchId)

				if (currentConversationIdRef.current) {
					setTimeout(async () => {
						try {
							await fetch(`/api/conversations/${currentConversationIdRef.current}`, {
								method: 'PUT',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									branches: updated
										.filter(n => n.id !== 'main' && !n.isMain)
										.map(n => ({
											id: n.id,
											label: n.title || 'Branch',
											messages: n.messages || [],
											inheritedMessages: n.inheritedMessages || [],
											branchMessages: n.branchMessages || [],
											parentId: n.parentId,
											parentMessageId: n.parentMessageId,
											selectedAIs: n.selectedAIs || [],
											isMain: n.isMain || false,
											position: n.position || { x: 0, y: 0 }
										}))
								})
							})
						} catch (error) {
							console.error('Error updating MongoDB:', error)
						}
					}, 100)
				}

				return updated
			})

			setSavedBranches(prev => prev.filter(b => b.id !== branchId))

			if (activeBranchId === branchId) {
				setActiveBranchId('main')
				setCurrentBranch(null)
			}

			addToast({
				type: 'success',
				title: 'Deleted',
				message: 'Branch deleted successfully.'
			})
		} catch (error) {
			console.error('Error deleting branch:', error)
			addToast({
				type: 'error',
				title: 'Delete Failed',
				message: 'Could not delete branch.'
			})
		}
	}, [
		activeBranchId,
		addToast,
		currentConversationIdRef,
		setActiveBranchId,
		setConversationNodes,
		setCurrentBranch,
		setSavedBranches
	])

	const handleCreateNewConversation = useCallback(async () => {
		setMessages([])
		setSelectedAIs([defaultAI])
		setBranches([])
		setConversationNodes([])
		setCurrentBranch(null)
		setActiveBranchId(null)

		currentConversationIdRef.current = null
		branchCacheRef.current.clear()
		creatingBranchRef.current.clear()

		try {
			const uniqueTitle = `New Conversation ${new Date().toLocaleString()}`

			const response = await fetch('/api/conversations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: uniqueTitle,
					mainMessages: [],
					selectedAIs: [{
						id: defaultAI.id,
						name: defaultAI.name,
						color: defaultAI.color,
						functional: true
					}],
					branches: [{
						id: 'main',
						label: 'Main Conversation',
						messages: [],
						selectedAIs: [{
							id: defaultAI.id,
							name: defaultAI.name,
							color: defaultAI.color,
							functional: true
						}],
						isMain: true,
						position: { x: 0, y: 0 }
					}],
					viewport: { x: 0, y: 0, zoom: 1 }
				})
			})

			const data = await response.json()

			if (data.success && data.data?._id) {
				currentConversationIdRef.current = data.data._id

				const mainNode = {
					id: 'main',
					type: 'main',
					title: 'Main Conversation',
					messages: [],
					timestamp: Date.now(),
					parentId: undefined,
					children: [],
					isActive: false,
					selectedAIs: [defaultAI],
					isMain: true,
					isMinimized: false,
					showAIPill: false,
					position: { x: 400, y: 50 },
					nodeData: {},
					parentMessageId: undefined,
					inheritedMessages: [],
					branchMessages: []
				}

				setConversationNodes([mainNode])

				const conversationsResponse = await fetch('/api/conversations')
				const conversationsData = await conversationsResponse.json()

				if (conversationsData.success) {
					setAllConversations(conversationsData.data)
				}

				addToast({
					type: 'success',
					title: 'New Conversation',
					message: `Created a new conversation (${data.data._id.slice(-8)})`
				})
			} else {
				addToast({
					type: 'error',
					title: 'Error',
					message: 'Failed to create new conversation'
				})
			}
		} catch (error) {
			console.error('❌ Error creating conversation:', error)
			addToast({
				type: 'error',
				title: 'Error',
				message: 'Failed to create new conversation'
			})
		}
	}, [
		addToast,
		branchCacheRef,
		creatingBranchRef,
		currentConversationIdRef,
		defaultAI,
		setActiveBranchId,
		setAllConversations,
		setBranches,
		setConversationNodes,
		setCurrentBranch,
		setMessages,
		setSelectedAIs
	])

	const handleSelectConversation = useCallback(async (conversationId: string) => {
		try {
			setMessages([])
			setBranches([])
			setConversationNodes([])
			setCurrentBranch(null)
			setActiveBranchId(null)

			branchCacheRef.current.clear()
			creatingBranchRef.current.clear()

			const response = await fetch(`/api/conversations/${conversationId}`)
			const data = await response.json()

			if (data.success && data.data) {
				currentConversationIdRef.current = conversationId
				restoreConversationState(data.data)
				addToast({
					type: 'success',
					title: 'Conversation Loaded',
					message: `Loaded: ${data.data.title || 'Conversation'}`
				})
			} else {
				addToast({
					type: 'error',
					title: 'Error',
					message: 'Failed to load conversation'
				})
			}
		} catch (error) {
			console.error('❌ Error loading conversation:', error)
			addToast({
				type: 'error',
				title: 'Error',
				message: 'Failed to load conversation'
			})
		}
	}, [
		addToast,
		branchCacheRef,
		creatingBranchRef,
		currentConversationIdRef,
		restoreConversationState,
		setActiveBranchId,
		setBranches,
		setConversationNodes,
		setCurrentBranch,
		setMessages
	])

	const handleDeleteConversation = useCallback(async (conversationId: string) => {
		try {
			const response = await fetch(`/api/conversations/${conversationId}`, {
				method: 'DELETE'
			})

			const data = await response.json()

			if (data.success) {
				setAllConversations(prev => prev.filter(conv => conv._id !== conversationId))

				if (currentConversationIdRef.current === conversationId) {
					setMessages([])
					setSelectedAIs([defaultAI])
					setBranches([])
					setConversationNodes([])
					setCurrentBranch(null)
					currentConversationIdRef.current = null

					const conversationsResponse = await fetch('/api/conversations')
					const conversationsData = await conversationsResponse.json()

					if (conversationsData.success) {
						setAllConversations(conversationsData.data)
					}

					return
				}

				const conversationsResponse = await fetch('/api/conversations')
				const conversationsData = await conversationsResponse.json()

				if (conversationsData.success) {
					setAllConversations(conversationsData.data)
				}

				addToast({
					type: 'success',
					title: 'Conversation Deleted',
					message: 'Successfully deleted conversation'
				})
			} else {
				addToast({
					type: 'error',
					title: 'Error',
					message: 'Failed to delete conversation'
				})
			}
		} catch (error) {
			console.error('❌ Error deleting conversation:', error)
			addToast({
				type: 'error',
				title: 'Error',
				message: 'Failed to delete conversation'
			})
		}
	}, [
		addToast,
		currentConversationIdRef,
		defaultAI,
		setAllConversations,
		setBranches,
		setConversationNodes,
		setCurrentBranch,
		setMessages,
		setSelectedAIs
	])

	return {
		handleImportConversation,
		saveCurrentBranch,
		handleSelectBranch,
		handleDeleteBranch,
		handleCreateNewConversation,
		handleSelectConversation,
		handleDeleteConversation
	}
}

