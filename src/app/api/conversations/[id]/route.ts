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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth()
        await connectDB()
        const { id } = await params
        const data = await req.json()

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
