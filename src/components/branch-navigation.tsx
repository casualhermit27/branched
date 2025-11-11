'use client'

import { motion } from 'framer-motion'
import { GitBranch, CaretRight } from '@phosphor-icons/react'

interface BranchNavigationProps {
  branches: Array<{
    id: string
    label: string
    parentId?: string
    parentMessageId?: string
  }>
  currentBranchId?: string | null
  onNavigateToBranch: (branchId: string) => void
  onNavigateToMain: () => void
  mainLabel?: string
}

export function BranchNavigation({
  branches,
  currentBranchId,
  onNavigateToBranch,
  onNavigateToMain,
  mainLabel = 'Main Conversation'
}: BranchNavigationProps) {
  // Build breadcrumb path
  const buildBreadcrumb = () => {
    const path: Array<{ id: string; label: string }> = []
    
    // Always include main
    path.push({ id: 'main', label: mainLabel })
    
    // If we're on a branch, find its path
    if (currentBranchId && currentBranchId !== 'main') {
      const currentBranch = branches.find(b => b.id === currentBranchId)
      if (currentBranch) {
        // Find parent chain
        let parentId = currentBranch.parentId
        const branchPath: Array<{ id: string; label: string }> = []
        
        while (parentId && parentId !== 'main') {
          const parent = branches.find(b => b.id === parentId)
          if (parent) {
            branchPath.unshift({ id: parent.id, label: parent.label })
            parentId = parent.parentId
          } else {
            break
          }
        }
        
        // Add current branch
        branchPath.push({ id: currentBranch.id, label: currentBranch.label })
        
        // Combine paths
        path.push(...branchPath)
      }
    }
    
    return path
  }

  const breadcrumb = buildBreadcrumb()

  if (breadcrumb.length <= 1) {
    return null // Don't show navigation if we're only on main
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg shadow-sm mb-4 overflow-x-auto"
    >
      <GitBranch className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      
      <div className="flex items-center gap-1.5 min-w-0">
        {breadcrumb.map((item, index) => {
          const isLast = index === breadcrumb.length - 1
          
          return (
            <div key={item.id} className="flex items-center gap-1.5 flex-shrink-0">
              {index > 0 && (
                <CaretRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              )}
              
              <button
                onClick={() => {
                  if (item.id === 'main') {
                    onNavigateToMain()
                  } else {
                    onNavigateToBranch(item.id)
                  }
                }}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isLast
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {item.label}
              </button>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

