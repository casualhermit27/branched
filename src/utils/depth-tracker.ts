// Depth Level Tracking Utility
// Calculates and maintains branch depth for tree layout

export interface BranchNode {
  id: string
  parentId?: string
  depthLevel?: number
}

export class DepthTracker {
  /**
   * Calculate depth levels for all branches
   */
  static calculateDepths(branches: BranchNode[]): Map<string, number> {
    const depthMap = new Map<string, number>()
    const visited = new Set<string>()

    // Find root branches (no parentId or parentId is 'main')
    const rootBranches = branches.filter(b => !b.parentId || b.parentId === 'main')
    rootBranches.forEach(b => depthMap.set(b.id, 0))

    // Calculate depth for each branch using BFS
    const queue: Array<{ id: string; depth: number }> = rootBranches.map(b => ({ id: b.id, depth: 0 }))

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current.id)) continue
      visited.add(current.id)

      // Find children
      const children = branches.filter(b => b.parentId === current.id)
      children.forEach(child => {
        const childDepth = current.depth + 1
        depthMap.set(child.id, childDepth)
        queue.push({ id: child.id, depth: childDepth })
      })
    }

    // Handle any remaining branches (orphaned)
    branches.forEach(branch => {
      if (!depthMap.has(branch.id)) {
        // Try to find depth from parent
        if (branch.parentId) {
          const parentDepth = depthMap.get(branch.parentId)
          if (parentDepth !== undefined) {
            depthMap.set(branch.id, parentDepth + 1)
          } else {
            depthMap.set(branch.id, 0) // Default to root level
          }
        } else {
          depthMap.set(branch.id, 0)
        }
      }
    })

    return depthMap
  }

  /**
   * Get max depth in tree
   */
  static getMaxDepth(branches: BranchNode[]): number {
    const depths = Array.from(this.calculateDepths(branches).values())
    return depths.length > 0 ? Math.max(...depths) : 0
  }

  /**
   * Get branches at specific depth
   */
  static getBranchesAtDepth(branches: BranchNode[], depth: number): BranchNode[] {
    const depthMap = this.calculateDepths(branches)
    return branches.filter(b => depthMap.get(b.id) === depth)
  }

  /**
   * Update depth levels in branch objects
   */
  static updateBranchDepths(branches: any[]): any[] {
    const depthMap = this.calculateDepths(branches)
    return branches.map(branch => ({
      ...branch,
      depthLevel: depthMap.get(branch.id) || 0
    }))
  }
}

