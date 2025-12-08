'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function BranchPage() {
  const params = useParams()
  const router = useRouter()
  const branchId = params?.branchId ? String(params.branchId) : null

  useEffect(() => {
    if (branchId && branchId !== 'main') {
      console.log('Loading branch:', branchId)
    }
  }, [branchId])

  return (
    <div>
      {/* Branch content will be rendered here */}
    </div>
  )
}

// Utility hook for URL-based navigation
export function useBranchNavigation() {
  const router = useRouter()

  const navigateToBranch = (branchId: string, conversationId?: string) => {
    if (conversationId) {
      router.push(`/chat/${conversationId}/${branchId}`)
    } else {
      router.push(`/chat/${branchId}`)
    }
  }

  const navigateToMain = (conversationId?: string) => {
    if (conversationId) {
      router.push(`/chat/${conversationId}`)
    } else {
      router.push('/chat')
    }
  }

  return { navigateToBranch, navigateToMain }
}

