import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getGuestIdServer } from '@/lib/guest'
import { checkUsageLimit } from '@/lib/limits'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const type = searchParams.get('type') as 'branch' | 'message'

        if (!type) {
            return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 })
        }

        const session = await auth()
        let userId = session?.user?.id
        let isGuest = false

        if (!userId) {
            const guestId = await getGuestIdServer()
            userId = guestId || undefined
            isGuest = true
        }

        if (!userId) {
            // Should not happen if guest logic works, but fallback
            return NextResponse.json({ allowed: true, count: 0, limit: 100 })
        }

        const limitCheck = await checkUsageLimit(userId, isGuest, type)

        return NextResponse.json(limitCheck)
    } catch (error: any) {
        console.error('Error checking limits:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
