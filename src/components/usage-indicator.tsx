'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Sparkle, LockKey } from '@phosphor-icons/react'
import Link from 'next/link'

interface UsageStats {
    allowed: boolean
    count: number
    limit: number
}

export function UsageIndicator() {
    const { data: session, status } = useSession()
    const [branchUsage, setBranchUsage] = useState<UsageStats | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchUsage = async () => {
        try {
            const res = await fetch('/api/user/limits?type=branch')
            const data = await res.json()
            setBranchUsage(data)
        } catch (error) {
            console.error('Failed to fetch usage:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsage()
        // Poll every 30 seconds to keep updated
        const interval = setInterval(fetchUsage, 30000)
        return () => clearInterval(interval)
    }, [session])

    if (loading) return null

    const isGuest = !session?.user
    const percentage = branchUsage ? Math.min((branchUsage.count / branchUsage.limit) * 100, 100) : 0
    const isLimitReached = branchUsage ? branchUsage.count >= branchUsage.limit : false

    return (
        <div className="p-4 mx-2 mb-2 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {isGuest ? 'Guest Mode' : 'Free Plan'}
                </span>
                {isGuest && (
                    <span className="text-xs font-medium text-amber-500">
                        Not Saved
                    </span>
                )}
            </div>

            <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-foreground">Branches</span>
                    <span className="text-muted-foreground">
                        {branchUsage?.count} / {branchUsage?.limit === Infinity ? '∞' : branchUsage?.limit}
                    </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full rounded-full ${isLimitReached ? 'bg-red-500' : 'bg-primary'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
            </div>

            {isGuest ? (
                <Link href="/register" className="block w-full">
                    <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                        <Sparkle className="w-4 h-4" weight="fill" />
                        <span>Sign Up to Save</span>
                    </button>
                </Link>
            ) : (
                <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm">
                    <LockKey className="w-4 h-4" weight="fill" />
                    <span>Upgrade to Pro</span>
                </button>
            )}
        </div>
    )
}
