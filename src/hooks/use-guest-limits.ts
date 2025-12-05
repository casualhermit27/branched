import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { IBranch, IMessage } from '@/models/conversation'

const MAX_GUEST_BRANCHES = 5
const MAX_GUEST_MESSAGES = 10

export function useGuestLimits(branches: any[], messages: any[]) {
    const { data: session } = useSession()
    const [showLoginModal, setShowLoginModal] = useState(false)
    const [limitReachedType, setLimitReachedType] = useState<'branch' | 'message' | null>(null)

    const checkLimit = (type: 'branch' | 'message') => {
        if (session) return true

        if (type === 'branch') {
            if (branches.length >= MAX_GUEST_BRANCHES) {
                setLimitReachedType('branch')
                setShowLoginModal(true)
                return false
            }
        } else if (type === 'message') {
            // Count user messages
            const userMessageCount = messages.filter(m => m.isUser).length
            if (userMessageCount >= MAX_GUEST_MESSAGES) {
                setLimitReachedType('message')
                setShowLoginModal(true)
                return false
            }
        }
        return true
    }

    return {
        checkLimit,
        showLoginModal,
        setShowLoginModal,
        limitReachedType
    }
}
