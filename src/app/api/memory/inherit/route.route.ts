import { NextRequest, NextResponse } from 'next/server'
import { memoryService } from '@/services/memory-service'

// POST /api/memory/inherit - Inherit memory when creating a branch
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { newBranchId, parentBranchId, userId } = body
    
    if (!newBranchId || !parentBranchId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: newBranchId, parentBranchId' },
        { status: 400 }
      )
    }
    
    await memoryService.inheritMemoryForBranch({
      newBranchId,
      parentBranchId,
      userId
    })
    
    return NextResponse.json({
      success: true,
      message: 'Memory inherited successfully'
    })
  } catch (error: any) {
    console.error('Error inheriting memory:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

