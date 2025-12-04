'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { aiService } from '@/services/ai-api'

export function useUserKeys() {
    const { data: session } = useSession()
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        async function fetchKeys() {
            if (!session?.user) return

            setLoading(true)
            try {
                const res = await fetch('/api/user/keys')
                if (res.ok) {
                    const data = await res.json()
                    if (data.keys) {
                        Object.entries(data.keys).forEach(([provider, key]) => {
                            aiService.updateKey(provider, key as string)
                        })
                    }
                }
            } catch (error) {
                console.error('Failed to fetch user keys:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchKeys()
    }, [session])

    return { loading }
}
