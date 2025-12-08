import { NextRequest, NextResponse } from 'next/server'
import { generateServerResponse } from '@/lib/server-ai'
import connectDB from '@/lib/mongodb'
import { User } from '@/models/User'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { model, message, context, provider = 'openai' } = body
        const messages = context?.messages || []

        // 1. BYOK Check (Header)
        const apiKey = req.headers.get('x-api-key')
        if (apiKey) {
            // Direct proxy with provided key
            const response = await generateServerResponse(provider, { model, apiKey }, messages)
            return new NextResponse(response.body, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            })
        }

        // 2. Auth & Tier Check (Managed)
        // For now, get User ID from header (Client passes it for simplicity in this step)
        // In production, use session = await getServerSession(authOptions)
        const userId = req.headers.get('x-user-id')

        if (userId) {
            // Connect DB (Note: Mongoose in Next.js edge/serverless can be tricky, ensure cached connection)
            await connectDB()

            const user = await User.findById(userId)
            if (user) {
                // Daily Limit Reset Check
                const now = new Date()
                const lastReset = new Date(user.lastDailyReset || 0)
                if (now.getDate() !== lastReset.getDate()) {
                    user.dailyFreeUsage = 0
                    user.lastDailyReset = now
                }

                // Logic
                const isProModel = ['gpt-4', 'claude-3-5-sonnet', 'claude-3-opus'].some(m => model.includes(m))

                if (user.tier === 'free') {
                    if (isProModel) {
                        return NextResponse.json({ error: 'Pro model requires upgrade' }, { status: 403 })
                    }
                    if (user.dailyFreeUsage >= 50) {
                        return NextResponse.json({ error: 'Daily limit reached' }, { status: 402 })
                    }
                    // Increment usage
                    user.dailyFreeUsage += 1
                    await user.save()
                } else if (user.tier === 'pro') {
                    // Deduction logic
                    const cost = isProModel ? 1 : 0
                    if (user.credits < cost) {
                        return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
                    }
                    user.credits -= cost
                    await user.save()
                }
            }
        } else {
            // Guest Logic - Allow for now or block?
            // User asked for "Tier 1: Guest (No Login)". Limits handled on client.
            // Server should ideally block or have a rate limit.
            // For zero-risk, we only allow "Free" models for guests.
            const isProModel = ['gpt-4', 'claude-3-5-sonnet', 'claude-3-opus'].some(m => model.includes(m))
            if (isProModel) {
                return NextResponse.json({ error: 'Login required for Pro models' }, { status: 401 })
            }
        }

        // 3. Generate Response (Server Managed Keys)
        const response = await generateServerResponse(provider, { model }, messages)

        return new NextResponse(response.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        })

    } catch (error: any) {
        console.error('Chat Route Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
