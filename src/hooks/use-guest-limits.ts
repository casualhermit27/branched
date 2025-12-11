import { useSession } from 'next-auth/react'
import { useState, useCallback, useRef, useEffect } from 'react'

const MAX_GUEST_BRANCHES = 5
const MAX_GUEST_MESSAGES = 10

export function useGuestLimits(branches: any[], messages: any[]) {
    const { data: session, status } = useSession()
    const [showLoginModal, setShowLoginModal] = useState(false)
    const [limitReachedType, setLimitReachedType] = useState<'branch' | 'message' | null>(null)

    // Use a ref to track pending modal open to avoid setState during render
    const pendingModalOpen = useRef(false)

    // Effect to handle deferred modal opening
    useEffect(() => {
        if (pendingModalOpen.current) {
            setShowLoginModal(true)
            pendingModalOpen.current = false
        }
    })

    const checkLimit = useCallback((type: 'branch' | 'message') => {
        // If user is logged in, they can do everything (Free Tier limits handled by server/other logic)
        // Check both session existence and explicit authenticated status
        if (session?.user || status === 'authenticated') return true

        // If not logged in, BLOCK EVERYTHING
        // Don't call setState directly - defer it to avoid React render error
        pendingModalOpen.current = true
        return false
    }, [session, status])

    return {
        checkLimit,
        showLoginModal,
        setShowLoginModal,
        limitReachedType
    }
}
