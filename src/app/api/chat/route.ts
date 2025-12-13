import { NextRequest, NextResponse } from 'next/server'
import { generateServerResponse } from '@/lib/server-ai'
import connectDB from '@/lib/mongodb'
import { User } from '@/models/User'
import { MODELS, FREE_DAILY_LIMIT } from '@/config/models'
import { auth } from '@/auth'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Simple in-memory rate limiter for guests (IP-based)
// In production, use Redis or a proper KV store
const guestRateLimit = new Map<string, { count: number, resetTime: number }>()
const GUEST_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour
const GUEST_LIMIT_COUNT = 20 // 20 messages per hour for guests

// Zod schema for input validation
const chatRequestSchema = z.object({
    model: z.string(),
    message: z.string(),
    context: z.object({
        messages: z.array(z.object({
            role: z.string().optional(),
            content: z.string().optional(),
            text: z.string().optional(), // Support both formats
            isUser: z.boolean().optional()
        })).optional()
    }).optional(),
    provider: z.string().optional().default('openai')
})

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Validate input with Zod
        const parseResult = chatRequestSchema.safeParse(body)
        if (!parseResult.success) {
            return NextResponse.json({ error: 'Invalid request body', details: parseResult.error }, { status: 400 })
        }

        const { model, message, context, provider } = parseResult.data
        const messages = context?.messages || []

        // Debug logging
        console.log('[Chat API] Received request:', {
            model,
            provider,
            messageCount: messages.length
        })

        // 1. BYOK Check (Header) - Still allow this for pure client-side keys if needed, 
        // but typically clients send keys to server to proxy.
        // NOTE: If you wanted to really lock this down, you'd validate this key is valid here too.
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

        // 2. Auth & Tier Check (Secure Session)
        const session = await auth()
        const userId = session?.user?.id

        if (userId) {
            // Authenticated User Logic
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

                // Tier Logic
                const modelConfig = MODELS[model]
                const isProModel = modelConfig?.tier === 'pro'

                if (user.tier === 'free') {
                    if (isProModel) {
                        return NextResponse.json({ error: 'Pro model requires upgrade' }, { status: 403 })
                    }
                    if (user.dailyFreeUsage >= FREE_DAILY_LIMIT) {
                        return NextResponse.json({ error: 'Daily limit reached' }, { status: 402 })
                    }
                    // Increment usage
                    user.dailyFreeUsage += 1
                    await user.save()
                } else if (user.tier === 'pro') {
                    // Deduction logic
                    const cost = modelConfig?.costPerMessage || 0
                    if (user.credits < cost) {
                        return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
                    }
                    user.credits -= cost
                    await user.save()
                }
            }
        } else {
            // Guest Logic with Rate Limiting
            const ip = req.headers.get('x-forwarded-for') || 'unknown'

            // Allow Free models only
            const modelConfig = MODELS[model]
            const isProModel = modelConfig?.tier === 'pro'
            if (isProModel) {
                return NextResponse.json({ error: 'Login required for Pro models' }, { status: 401 })
            }

            // Check Rate Limit
            const now = Date.now()
            const record = guestRateLimit.get(ip)

            if (record) {
                if (now > record.resetTime) {
                    // Reset expired window
                    guestRateLimit.set(ip, { count: 1, resetTime: now + GUEST_LIMIT_WINDOW })
                } else if (record.count >= GUEST_LIMIT_COUNT) {
                    return NextResponse.json({ error: 'Guest rate limit reached. Please log in.' }, { status: 429 })
                } else {
                    record.count++
                }
            } else {
                guestRateLimit.set(ip, { count: 1, resetTime: now + GUEST_LIMIT_WINDOW })
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
