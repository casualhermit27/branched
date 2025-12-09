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
		currentConversationId
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
		checkLimit
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

	const commandPaletteCommands = [
		{
			id: 'export-conversation',
			title: 'Export Conversation',
			description: 'Export current conversation to file',
			action: () => setShowExportImport(true)
		},
		{
			id: 'clear-conversation',
			title: 'Clear Conversation',
			description: 'Start a new conversation',
			action: () => {
				setMessages([])
				setBranches([])
				setConversationNodes([])
				addToast({
					type: 'success',
					title: 'Conversation cleared',
					message: 'Started a new conversation'
				})
			}
		},
		{
			id: 'focus-mode',
			title: 'Focus Mode',
			description: 'Enter focus mode for detailed work',
			action: () => {
				addToast({
					type: 'info',
					title: 'Focus Mode',
					message: 'Click on any branch to enter focus mode'
				})
			}
		}
	]

	return (
		<>
			<ConversationAppShell
				state={conversationState}
				actions={actions}
				commandPaletteCommands={commandPaletteCommands}
				onLoginClick={() => setShowLoginModal(true)}
			/>
			<LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
		</>
	)
}
