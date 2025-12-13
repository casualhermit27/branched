import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Conversation } from '@/models/conversation'
import { auth } from '@/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth()
        await connectDB()
        const { id } = await params

        const conversation = await Conversation.findById(id)

        if (!conversation) {
            return NextResponse.json(
                { success: false, error: 'Conversation not found' },
                { status: 404 }
            )
        }

        if (conversation.userId && conversation.userId !== session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 403 }
            )
        }

        return NextResponse.json({ success: true, data: conversation })
    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Failed to fetch conversation' },
            { status: 500 }
        )
    }
}

import { z } from 'zod'

const updateConversationSchema = z.object({
    title: z.string().optional(),
    messages: z.array(z.any()).optional(), // Consider a more strict schema for messages if possible
    branches: z.array(z.any()).optional(),
    conversationNodes: z.array(z.any()).optional(),
    userId: z.string().optional()
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth()
        await connectDB()
        const { id } = await params
        const rawBody = await req.json()

        const parseResult = updateConversationSchema.safeParse(rawBody)
        if (!parseResult.success) {
            return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
        }

        const data = parseResult.data

        const existing = await Conversation.findById(id)
        if (!existing) {
            return NextResponse.json(
                { success: false, error: 'Conversation not found' },
                { status: 404 }
            )
        }

        if (existing.userId && existing.userId !== session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 403 }
            )
        }

        // Claim guest conversation if now logged in
        if (!existing.userId && session?.user?.id) {
            data.userId = session.user.id
        }

        const conversation = await Conversation.findByIdAndUpdate(
            id,
            { ...data, updatedAt: new Date() },
            { new: true }
        )

        return NextResponse.json({ success: true, data: conversation })
    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Failed to update conversation' },
            { status: 500 }
        )
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth()
        await connectDB()
        const { id } = await params

        const existing = await Conversation.findById(id)
        if (!existing) {
            return NextResponse.json(
                { success: false, error: 'Conversation not found' },
                { status: 404 }
            )
        }

        if (existing.userId && existing.userId !== session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 403 }
            )
        }

        await Conversation.findByIdAndDelete(id)

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Failed to delete conversation' },
            { status: 500 }
        )
    }
}
