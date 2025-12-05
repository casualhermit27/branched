import { NextRequest, NextResponse } from 'next/server'
import { memoryService } from '@/services/memory-service'

// GET /api/memory/context - Get memory context for a branch
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId')
    const userId = searchParams.get('userId')
    const depth = parseInt(searchParams.get('depth') || '3')
    const messageHistoryLimit = parseInt(searchParams.get('messageHistoryLimit') || '10')
    const maxMemories = parseInt(searchParams.get('maxMemories') || '50')
    
    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: branchId' },
        { status: 400 }
      )
    }
    
    const context = await memoryService.getMemoryContext({
      userId: userId || undefined,
      branchId,
      depth,
      messageHistoryLimit,
      maxMemories
    })
    
    return NextResponse.json({
      success: true,
      data: context
    })
  } catch (error: any) {
    console.error('Error getting memory context:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

