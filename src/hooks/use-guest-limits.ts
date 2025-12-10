import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { IBranch, IMessage } from '@/models/conversation'

const MAX_GUEST_BRANCHES = 5
const MAX_GUEST_MESSAGES = 10

export function useGuestLimits(branches: any[], messages: any[]) {
    const { data: session, status } = useSession()
    const [showLoginModal, setShowLoginModal] = useState(false)
    const [limitReachedType, setLimitReachedType] = useState<'branch' | 'message' | null>(null)

    const checkLimit = (type: 'branch' | 'message') => {
        // If user is logged in, they can do everything (Free Tier limits handled by server/other logic)
        // Check both session existence and explicit authenticated status
        if (session?.user || status === 'authenticated') return true

        // If not logged in, BLOCK EVERYTHING and show login modal
        setShowLoginModal(true)
        return false
    }

    return {
        checkLimit,
        showLoginModal,
        setShowLoginModal,
        limitReachedType
    }
}
