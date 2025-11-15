'use client'

import { createContext, useContext, ReactNode } from 'react'
import { ContextManager } from './context-manager'
import { messageStore } from './message-store'
import { branchStore } from './branch-store'

// Create ContextManager instance
const contextManager = new ContextManager(
	messageStore as any,
	branchStore as any
)

const ContextManagerContext = createContext<ContextManager>(contextManager)

export function ContextManagerProvider({ children }: { children: ReactNode }) {
	return (
		<ContextManagerContext.Provider value={contextManager}>
			{children}
		</ContextManagerContext.Provider>
	)
}

export function useContextManager(): ContextManager {
	const context = useContext(ContextManagerContext)
	if (!context) {
		throw new Error('useContextManager must be used within ContextManagerProvider')
	}
	return context
}

// Export singleton instance for direct use
export { contextManager }

