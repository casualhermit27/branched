
import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { memoryService } from '@/services/memory-service'
import { MemoryEntry } from '@/models/memory'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    const body = await request.json()
    const { conversationId, fact, context, importance, tags } = body

    const memory = await memoryService.createMemory({
      branchId: conversationId,
      content: fact,
      topic: tags?.[0],
      relevanceScore: importance,
      layer: 'branch'
    })

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

    let memories;
    if (query) {
      memories = await MemoryEntry.find({
        branchId: conversationId,
        content: { $regex: query, $options: 'i' }
      })
        .sort({ relevanceScore: -1 })
        .limit(limit)
    } else {
      memories = await MemoryEntry.find({ branchId: conversationId })
        .sort({ updatedAt: -1 })
        .limit(20)
    }

    return NextResponse.json({ success: true, memories })
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

    if (!memoryId) {
      return NextResponse.json({ success: false, error: 'memoryId required' }, { status: 400 })
    }

    await MemoryEntry.updateOne({ id: memoryId }, { relevanceScore: importance })
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

    await MemoryEntry.deleteOne({ id: memoryId })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
