'use client'

import { useEffect } from 'react'
import type { ConversationState } from './use-conversation-state'
import type { ConversationActions } from './use-conversation-actions'
import type { AI } from './use-conversation-state'

interface UseConversationPageEffectsParams {
	state: ConversationState
	actions: ConversationActions
	defaultAI: AI
	addToast: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string }) => void
	loadConversations: () => Promise<boolean>
	restoreConversationState: (conversation: any) => void
	currentConversationId: string | null
}

export function useConversationPageEffects({
	state,
	actions,
	defaultAI,
	addToast,
	loadConversations,
	restoreConversationState,
	currentConversationId
}: UseConversationPageEffectsParams) {
	const {
		showMenu,
		setShowMenu,
		menuRef,
		setShowOnboarding,
		allConversations,
		currentConversationIdRef,
		setShowCommandPalette,
		messages,
		isInitialLoadRef,
		setAllConversations,
		selectedAIs,
		setSelectedAIs,
		viewMode,
		conversationNodes,
		setConversationNodes,
		currentBranch,
		activeBranchId,
		savedBranches
	} = state

	const { saveCurrentBranch } = actions

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setShowMenu(false)
			}
		}

		if (showMenu) {
			document.addEventListener('mousedown', handleClickOutside)
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [menuRef, setShowMenu, showMenu])

	useEffect(() => {
		const hasSeenOnboarding = typeof window !== 'undefined' ? localStorage.getItem('hasSeenOnboarding') : 'true'
		if (!hasSeenOnboarding) {
			setShowOnboarding(true)
		}

		const checkAndSeed = async () => {
			await new Promise(resolve => setTimeout(resolve, 1000))

			if (allConversations.length === 0 && !currentConversationIdRef.current) {
				// No-op for now, reserved for future seeding logic
			}
		}

		checkAndSeed()
	}, [allConversations, currentConversationIdRef, setShowOnboarding])

	useEffect(() => {
		if (currentConversationId && currentConversationId !== currentConversationIdRef.current) {
			currentConversationIdRef.current = currentConversationId

			if (typeof window !== 'undefined') {
				const url = new URL(window.location.href)
				if (!url.pathname.includes(currentConversationId)) {
					window.history.replaceState({}, '', `/conversation/${currentConversationId}`)
				}
			}
		}
	}, [currentConversationId, currentConversationIdRef])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault()
				setShowCommandPalette(true)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [setShowCommandPalette])

	useEffect(() => {
		if (isInitialLoadRef.current) {
			isInitialLoadRef.current = false

			loadConversations().then(success => {
				if (!success) {
					state.setIsLoading(false)
					return
				}

				if (typeof window !== 'undefined') {
					fetch('/api/conversations')
						.then(res => res.json())
						.then(data => {
							if (data.success && data.data) {
								setAllConversations(data.data)

								const conversationWithContent = data.data.find((conv: any) => {
									const hasMessages = (conv.mainMessages && conv.mainMessages.length > 0) ||
										(conv.messages && conv.messages.length > 0)
									const hasBranches = conv.branches && conv.branches.length > 0
									return hasMessages || hasBranches
								})

								if (conversationWithContent) {
									restoreConversationState(conversationWithContent)
								}
							}
						})
						.catch(error => {
							console.error('❌ Error loading conversations:', error)
						})
						.finally(() => {
							state.setIsLoading(false)
						})
				} else {
					state.setIsLoading(false)
				}
			})
		}
	}, [isInitialLoadRef, loadConversations, restoreConversationState, setAllConversations, state])

	useEffect(() => {
		if (selectedAIs.length === 0) {
			setSelectedAIs([defaultAI])
		}
	}, [defaultAI, selectedAIs, setSelectedAIs])

	useEffect(() => {
		if (viewMode === 'chat' && conversationNodes.length === 0) {
			const mainNode = {
				id: 'main',
				type: 'main',
				title: 'Main Conversation',
				messages: messages || [],
				timestamp: Date.now(),
				parentId: undefined,
				children: [],
				isActive: !currentBranch,
				selectedAIs: selectedAIs || [],
				isMain: true,
				position: { x: 400, y: 50 }
			}
			setConversationNodes([mainNode])
		} else if (viewMode === 'chat' && conversationNodes.length > 0) {
			const mainNode = conversationNodes.find(n => n.id === 'main' || n.isMain)
			if (mainNode) {
				const currentMessages = mainNode.messages || []
				const globalMessages = messages || []

				// Only update if message count differs or last message ID differs
				// This prevents infinite loops when object references change but content is same
				const hasChanges = currentMessages.length !== globalMessages.length ||
					(currentMessages.length > 0 && globalMessages.length > 0 &&
						currentMessages[currentMessages.length - 1].id !== globalMessages[globalMessages.length - 1].id)

				if (hasChanges) {
					setConversationNodes(prev => prev.map(node => {
						if (node.id === 'main' || node.isMain) {
							return {
								...node,
								messages: globalMessages
							}
						}
						return node
					}))
				}
			}
		}
	}, [conversationNodes, currentBranch, messages, selectedAIs, setConversationNodes, viewMode])

	useEffect(() => {
		if (messages.length > 0 && !activeBranchId && savedBranches.length === 0) {
			saveCurrentBranch()
		}
	}, [activeBranchId, messages, savedBranches.length, saveCurrentBranch])
}

