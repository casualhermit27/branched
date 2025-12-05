import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Conversation } from '@/models/conversation'
import { auth } from '@/auth'

export async function GET(req: Request) {
    try {
        const session = await auth()
        await connectDB()

        let query = {}
        if (session?.user?.id) {
            query = { userId: session.user.id }
        } else {
            // Guest: return empty list for now
            return NextResponse.json({ success: true, data: [] })
        }

        const conversations = await Conversation.find(query)
            .sort({ updatedAt: -1 })
            .limit(50)

        return NextResponse.json({ success: true, data: conversations })
    } catch (error) {
        console.error('Error fetching conversations:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch conversations' },
            { status: 500 }
        )
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth()
        await connectDB()
        const data = await req.json()

        if (session?.user?.id) {
            data.userId = session.user.id
        }

        const conversation = await Conversation.create(data)

        return NextResponse.json({ success: true, data: conversation })
    } catch (error) {
        console.error('Error creating conversation:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create conversation' },
            { status: 500 }
        )
    }
}
