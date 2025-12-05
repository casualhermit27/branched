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
	restoreConversationState,
	checkLimit
}: UseConversationActionsParams & { checkLimit?: (type: 'branch' | 'message') => boolean }) {
	const branchActions = useConversationBranchActions({
		state,
		defaultAI,
		addToast,
		restoreConversationState,
		checkLimit
	})

	const messageActions = useConversationMessageActions({
		state,
		addToast,
		checkLimit
	})

	return {
		...messageActions,
		...branchActions
	}
}

export type ConversationActions = ReturnType<typeof useConversationActions>

