// API Route: /api/branches/replay
import { NextRequest, NextResponse } from 'next/server'
import { BranchReplayService } from '@/services/branch-replay-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, branchId, newModel, startFromMessageId } = body

    if (!conversationId || !branchId || !newModel) {
      return NextResponse.json(
        { success: false, error: 'conversationId, branchId, and newModel required' },
        { status: 400 }
      )
    }

    const replayBranch = await BranchReplayService.replayBranch(
      conversationId,
      branchId,
      newModel,
      startFromMessageId
    )

    return NextResponse.json({ 
      success: true, 
      replayBranch 
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
    const branchId = searchParams.get('branchId')

    if (!conversationId || !branchId) {
      return NextResponse.json(
        { success: false, error: 'conversationId and branchId required' },
        { status: 400 }
      )
    }

    const replayHistory = await BranchReplayService.getReplayHistory(conversationId, branchId)
    return NextResponse.json({ 
      success: true, 
      replayHistory 
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

