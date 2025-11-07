// API Route: /api/branches/promote
import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Conversation } from '@/models/conversation'
import { AuditLogger } from '@/services/analytics-service'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    const body = await request.json()
    const { conversationId, branchId } = body

    if (!conversationId || !branchId) {
      return NextResponse.json(
        { success: false, error: 'conversationId and branchId required' },
        { status: 400 }
      )
    }

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Find the branch to promote
    const branchToPromote = conversation.branches.find((b: any) => b.id === branchId)
    if (!branchToPromote) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }

    // Store previous main messages
    const previousMainMessages = [...conversation.mainMessages]

    // Promote branch: swap main messages with branch messages
    conversation.mainMessages = branchToPromote.messages
    branchToPromote.messages = previousMainMessages
    branchToPromote.isPromoted = true

    // Mark other branches as not promoted
    conversation.branches.forEach((b: any) => {
      if (b.id !== branchId) {
        b.isPromoted = false
      }
    })

    await conversation.save()

    // Log the promotion
    await AuditLogger.logBranchPromotion(conversationId, branchId, 'main')

    return NextResponse.json({ 
      success: true, 
      message: 'Branch promoted successfully',
      conversation 
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

