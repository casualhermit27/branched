import { NextRequest, NextResponse } from 'next/server'
import { memoryService } from '@/services/memory-service'

// POST /api/memory/extract - Extract memories from AI response
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { responseText, branchId, messageId, userId, topic } = body
    
    if (!responseText || !branchId || !messageId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: responseText, branchId, messageId' },
        { status: 400 }
      )
    }
    
    const extracted = await memoryService.extractMemoriesFromResponse({
      responseText,
      branchId,
      messageId,
      userId,
      topic
    })
    
    return NextResponse.json({
      success: true,
      data: extracted
    })
  } catch (error: any) {
    console.error('Error extracting memory:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

