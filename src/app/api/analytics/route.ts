// API Route: /api/analytics
import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { AnalyticsService } from '@/services/analytics-service'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    const body = await request.json()
    const {
      conversationId,
      branchId,
      messageId,
      model,
      latency,
      tokensUsed,
      cost,
      success,
      error
    } = body

    const analytics = await AnalyticsService.trackModelUsage(
      conversationId,
      branchId,
      messageId,
      model,
      latency,
      tokensUsed,
      cost,
      success,
      error
    )

    return NextResponse.json({ success: true, analytics })
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
    const type = searchParams.get('type') || 'metrics'

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId required' },
        { status: 400 }
      )
    }

    if (type === 'metrics') {
      const metrics = await AnalyticsService.getConversationMetrics(conversationId)
      return NextResponse.json({ success: true, metrics })
    } else if (type === 'engagement') {
      const engagement = await AnalyticsService.getBranchEngagement(conversationId)
      return NextResponse.json({ success: true, engagement })
    } else if (type === 'depth') {
      const depthStats = await AnalyticsService.getBranchDepthStats(conversationId)
      return NextResponse.json({ success: true, depthStats })
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

