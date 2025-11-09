import { NextRequest, NextResponse } from 'next/server'
import { memoryService } from '@/services/memory-service'

// POST /api/memory/promote - Promote branch memory to global
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { memoryId, userId } = body
    
    if (!memoryId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: memoryId, userId' },
        { status: 400 }
      )
    }
    
    const globalMemory = await memoryService.promoteToGlobal({
      memoryId,
      userId
    })
    
    return NextResponse.json({
      success: true,
      data: globalMemory
    })
  } catch (error: any) {
    console.error('Error promoting memory:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

