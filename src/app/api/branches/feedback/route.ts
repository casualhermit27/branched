// API Route: /api/branches/feedback
import { NextRequest, NextResponse } from 'next/server'
import { FeedbackLoopService } from '@/services/feedback-loop-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, branchId, feedback } = body

    if (!conversationId || !branchId || !feedback) {
      return NextResponse.json(
        { success: false, error: 'conversationId, branchId, and feedback required' },
        { status: 400 }
      )
    }

    if (feedback !== 'upvote' && feedback !== 'downvote') {
      return NextResponse.json(
        { success: false, error: 'feedback must be "upvote" or "downvote"' },
        { status: 400 }
      )
    }

    await FeedbackLoopService.recordFeedback(conversationId, branchId, feedback)

    return NextResponse.json({ 
      success: true,
      message: 'Feedback recorded'
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const type = searchParams.get('type') || 'performance'

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId required' },
        { status: 400 }
      )
    }

    if (type === 'performance') {
      const performance = await FeedbackLoopService.getModelPerformance(conversationId)
      return NextResponse.json({ success: true, performance })
    } else if (type === 'recommended') {
      const recommended = await FeedbackLoopService.getRecommendedModel(conversationId)
      return NextResponse.json({ success: true, recommended })
    } else if (type === 'weights') {
      const weights = await FeedbackLoopService.updateModelWeights(conversationId)
      return NextResponse.json({ success: true, weights: Object.fromEntries(weights) })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

