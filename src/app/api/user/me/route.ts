import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import connectDB from '@/lib/mongodb'
import { User } from '@/models/User'
import { FREE_DAILY_LIMIT } from '@/config/models'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await connectDB()
        const user = await User.findOne({ email: session.user.email })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Check for daily reset logic here too, to be safe/consistent
        const now = new Date()
        const lastReset = new Date(user.lastDailyReset || 0)
        if (now.getDate() !== lastReset.getDate()) {
            user.dailyFreeUsage = 0
            user.lastDailyReset = now
            await user.save()
        }

        return NextResponse.json({
            tier: user.tier,
            credits: user.credits,
            dailyFreeUsage: user.dailyFreeUsage,
            subscriptionStatus: user.subscriptionStatus
        })
    } catch (error) {
        console.error('User profile error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
