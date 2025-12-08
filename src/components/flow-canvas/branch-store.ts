'use client'

import type { BranchContext } from './context-manager'

/**
 * Global branch store - stores branch contexts with lightweight snapshots
 */
export class BranchStore {
	private branches: Map<string, BranchContext> = new Map()

	/**
	 * Get branch context
	 */
	get(branchId: string): BranchContext | undefined {
		return this.branches.get(branchId)
	}

	/**
	 * Set branch context
	 */
	set(branch: BranchContext): void {
		this.branches.set(branch.branchId, branch)
	}

	/**
	 * Check if branch exists
	 */
	has(branchId: string): boolean {
		return this.branches.has(branchId)
	}

	/**
	 * Delete branch
	 */
	delete(branchId: string): void {
		this.branches.delete(branchId)
	}

	/**
	 * Get all branch IDs
	 */
	getAllIds(): string[] {
		return Array.from(this.branches.keys())
	}

	/**
	 * Get all branches
	 */
	getAll(): BranchContext[] {
		return Array.from(this.branches.values())
	}

	/**
	 * Get branches by parent
	 */
	getByParent(parentBranchId: string): BranchContext[] {
		return Array.from(this.branches.values()).filter(
			(branch) => branch.parentBranchId === parentBranchId
		)
	}

	/**
	 * Update branch metadata
	 */
	updateMetadata(
		branchId: string,
		metadata: Partial<BranchContext['metadata']>
	): void {
		const branch = this.branches.get(branchId)
		if (branch) {
			branch.metadata = {
				...branch.metadata,
				...metadata
			}
			this.branches.set(branchId, branch)
		}
	}

	/**
	 * Add message ID to branch
	 */
	addMessage(branchId: string, messageId: string): void {
		const branch = this.branches.get(branchId)
		if (branch) {
			if (!branch.branchMessageIds.includes(messageId)) {
				branch.branchMessageIds.push(messageId)
				this.branches.set(branchId, branch)
			}
		}
	}

	/**
	 * Remove message ID from branch
	 */
	removeMessage(branchId: string, messageId: string): void {
		const branch = this.branches.get(branchId)
		if (branch) {
			branch.branchMessageIds = branch.branchMessageIds.filter(
				(id) => id !== messageId
			)
			this.branches.set(branchId, branch)
		}
	}

	/**
	 * Clear all branches
	 */
	clear(): void {
		this.branches.clear()
	}

	/**
	 * Export for MongoDB
	 */
	export(): BranchContext[] {
		return Array.from(this.branches.values())
	}

	/**
	 * Import from MongoDB
	 */
	import(branches: BranchContext[]): void {
		branches.forEach((branch) => {
			this.branches.set(branch.branchId, branch)
		})
	}
}

// Singleton instance - only create on client side
let branchStoreInstance: BranchStore | null = null

export const branchStore = (() => {
	if (typeof window === 'undefined') {
		// Return a dummy instance during SSR
		return {
			get: () => undefined,
			set: () => { },
			has: () => false,
			delete: () => { },
			getAllIds: () => [],
			getAll: () => [],
			getByParent: () => [],
			updateMetadata: () => { },
			addMessage: () => { },
			removeMessage: () => { },
			clear: () => { },
			export: () => [],
			import: () => { }
		} as unknown as BranchStore
	}

	if (!branchStoreInstance) {
		branchStoreInstance = new BranchStore()
	}
	return branchStoreInstance
})()

