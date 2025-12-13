'use client'

import { useCallback } from 'react'
import { useToast } from '@/components/toast'
import { useMongoDB } from '@/hooks/use-mongodb'
import { useConversationState } from '@/hooks/use-conversation-state'
import type { AI } from '@/hooks/use-conversation-state'
import { useConversationRestore } from '@/hooks/use-conversation-restore'
import { useConversationAutosave } from '@/hooks/use-conversation-autosave'
import { useConversationActions } from '@/hooks/use-conversation-actions'
import { useConversationPageEffects } from '@/hooks/use-conversation-page-effects'
import ConversationAppShell from '@/components/conversation-app-shell'
import { LoginModal } from '@/components/auth/login-modal'
import { useGuestLimits } from '@/hooks/use-guest-limits'

import { allAIOptions } from '@/components/ai-pills'

interface ConversationPageProps {
	initialConversationId?: string
}

export default function ConversationPage({ initialConversationId }: ConversationPageProps) {
	const defaultAI: AI = allAIOptions[0]

	const conversationState = useConversationState()
	const {
		setMessages,
		setBranches,
		setConversationNodes,
		setShowExportImport
	} = conversationState

	const { checkLimit, showLoginModal, setShowLoginModal } = useGuestLimits(
		conversationState.savedBranches,
		conversationState.messages
	)

	const { addToast } = useToast()

	const {
		autoSaveConversation,
		loadConversations,
		currentConversationId,
		setCurrentConversationId
	} = useMongoDB({
		autoSave: true,
		autoSaveDelay: 500,
		initialConversationId,
		onSave: (success, error) => {
			if (!success && error) {
				addToast({
					type: 'error',
					title: 'Save Failed',
					message: 'Could not save conversation to database.'
				})
			}
		}
	})

	const { restoreConversation } = useConversationRestore()

	const restoreConversationState = useCallback((conversation: any) => {
		restoreConversation({
			conversation,
			setMessages,
			setSelectedAIs: conversationState.setSelectedAIs,
			setBranches,
			setConversationNodes,
			setCurrentBranch: conversationState.setCurrentBranch,
			setActiveBranchId: conversationState.setActiveBranchId,
			currentConversationIdRef: conversationState.currentConversationIdRef,
			selectedAIs: conversationState.selectedAIs,
			defaultAI,
			setLoadingStatus: conversationState.setLoadingStatus
		})
	}, [conversationState, defaultAI, restoreConversation, setBranches, setConversationNodes, setMessages])

	useConversationAutosave({
		messages: conversationState.messages,
		selectedAIs: conversationState.selectedAIs,
		conversationNodes: conversationState.conversationNodes,
		currentBranch: conversationState.currentBranch,
		branches: conversationState.branches,
		autoSaveConversation,
		currentConversationIdRef: conversationState.currentConversationIdRef,
		isInitialLoadRef: conversationState.isInitialLoadRef
	})

	const actions = useConversationActions({
		state: conversationState,
		defaultAI,
		addToast,
		restoreConversationState,
		checkLimit,
		setCurrentConversationId
	})

	useConversationPageEffects({
		state: conversationState,
		actions,
		defaultAI,
		addToast,
		loadConversations,
		restoreConversationState,
		currentConversationId
	})

	// Command Palette Helpers
	const searchNodes = useCallback((query: string) => {
		if (!query.trim()) return []
		const lowerQuery = query.toLowerCase()
		return conversationState.conversationNodes
			.filter(node => {
				const label = (node.data?.label || '').toLowerCase()
				const messages = (node.data?.messages || []).map((m: any) => m.text.toLowerCase()).join(' ')
				return label.includes(lowerQuery) || messages.includes(lowerQuery)
			})
			.map(node => ({
				id: `node-${node.id}`,
				title: node.data?.label || 'Untitled Node',
				description: node.data?.messages?.[0]?.text?.substring(0, 50) + '...',
				action: () => navigateToNode(node.id),
				keywords: ['node', 'search', node.id]
			}))
	}, [conversationState.conversationNodes])

	const navigateToNode = useCallback((nodeId: string) => {
		// We need to trigger the focus logic in FlowCanvas
		// Since we don't have direct access to FlowCanvas ref here,
		// we'll set the activeNodeId which FlowCanvas watches
		conversationState.setActiveNodeId(nodeId)

		addToast({
			type: 'info',
			title: 'Navigating',
			message: 'Teleporting to node...'
		})
	}, [conversationState, addToast])

	const commandPaletteCommands = [
		// Search Commands (Dynamic) will be handled by the CommandPalette component's filtering?
		// No, usually CommandPalette takes a static list. To support dynamic search, we might need a custom search handler in CommandPalette.
		// For now, let's pre-populate "Recent Nodes" or add a "Search Nodes" command that opens a sub-menu?
		// Simpler V1: Add ALL nodes as commands (if < 100), or top 20 recent.
		...conversationState.conversationNodes.slice(-20).reverse().map(node => ({
			id: `jump-${node.id}`,
			title: `Go to: ${node.data?.label || (node.data?.messages?.[0]?.text?.substring(0, 30) || 'Untitled')}`,
			description: 'Jump to this branch node',
			action: () => navigateToNode(node.id),
			keywords: ['jump', 'goto', node.data?.label || '', ...(node.data?.messages || []).map((m: any) => m.text.substring(0, 20))]
		})),

		// Actions
		{
			id: 'export-conversation',
			title: 'Export Conversation',
			description: 'Save flow as JSON',
			action: () => setShowExportImport(true),
			keywords: ['save', 'download']
		},
		{
			id: 'new-conversation',
			title: 'New Conversation',
			description: 'Clear and start fresh',
			action: () => {
				if (window.confirm('Are you sure? Unsaved changes will be lost.')) {
					setMessages([])
					setBranches([])
					setConversationNodes([])
					addToast({
						type: 'success',
						title: 'New Conversation',
						message: 'Started fresh workspace'
					})
				}
			},
			keywords: ['clear', 'reset', 'start']
		},
		{
			id: 'toggle-theme',
			title: 'Toggle Theme',
			description: 'Switch dark/light mode',
			action: () => document.getElementById('theme-toggle-btn')?.click(),
			keywords: ['dark', 'light', 'mode', 'color']
		}
	]

	return (
		<>
			<ConversationAppShell
				state={conversationState}
				actions={actions}
				commandPaletteCommands={commandPaletteCommands}
				onLoginClick={() => setShowLoginModal(true)}
				currentConversationId={currentConversationId}
			/>
			<LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
		</>
	)
}
