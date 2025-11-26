'use client'

import type { ConversationState, AI } from './use-conversation-state'
import { useConversationBranchActions } from './use-conversation-branch-actions'
import { useConversationMessageActions } from './use-conversation-message-actions'

interface ToastOptions {
	type: 'success' | 'error' | 'info' | 'warning'
	title: string
	message: string
}

interface UseConversationActionsParams {
	state: ConversationState
	defaultAI: AI
	addToast: (toast: ToastOptions) => void
	restoreConversationState: (conversation: any) => void
}

export function useConversationActions({
	state,
	defaultAI,
	addToast,
	restoreConversationState
}: UseConversationActionsParams) {
	const branchActions = useConversationBranchActions({
		state,
		defaultAI,
		addToast,
		restoreConversationState
	})

	const messageActions = useConversationMessageActions({
		state,
		addToast
	})

	return {
		...messageActions,
		...branchActions
	}
}

export type ConversationActions = ReturnType<typeof useConversationActions>

