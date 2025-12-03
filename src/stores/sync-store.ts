import { create } from 'zustand'

interface SyncState {
    dirtyNodeIds: Set<string>
    addDirtyNode: (nodeId: string) => void
    clearDirtyNodes: () => void
    getDirtyNodes: () => Set<string>
}

export const useSyncStore = create<SyncState>((set, get) => ({
    dirtyNodeIds: new Set(),
    addDirtyNode: (nodeId) => set((state) => {
        const newSet = new Set(state.dirtyNodeIds)
        newSet.add(nodeId)
        return { dirtyNodeIds: newSet }
    }),
    clearDirtyNodes: () => set({ dirtyNodeIds: new Set() }),
    getDirtyNodes: () => get().dirtyNodeIds
}))
