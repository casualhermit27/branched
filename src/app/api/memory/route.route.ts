// API Route: /api/memory
import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { MemoryService } from '@/services/memory-service'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    const body = await request.json()
    const { conversationId, fact, context, importance, tags } = body

    const memory = await MemoryService.addMemory(
      conversationId,
      fact,
      context,
      importance,
      tags
    )

    return NextResponse.json({ success: true, memory })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const query = searchParams.get('query') || ''
    const limit = parseInt(searchParams.get('limit') || '5')

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId required' },
        { status: 400 }
      )
    }

    if (query) {
      const memories = await MemoryService.recallMemories(conversationId, query, limit)
      return NextResponse.json({ success: true, memories })
    } else {
      const memories = await MemoryService.getConversationMemories(conversationId)
      return NextResponse.json({ success: true, memories })
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB()
    const body = await request.json()
    const { memoryId, importance } = body

    await MemoryService.updateImportance(memoryId, importance)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const memoryId = searchParams.get('memoryId')

    if (!memoryId) {
      return NextResponse.json(
        { success: false, error: 'memoryId required' },
        { status: 400 }
      )
    }

    await MemoryService.deleteMemory(memoryId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

