import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Conversation } from '@/models/conversation'

// POST /api/branches/create - Create a new branch with duplicate prevention
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    
    const body = await req.json()
    const { conversationId, parentMessageId, aiModel, branchType = 'single' } = body
    
    if (!conversationId || !parentMessageId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: conversationId, parentMessageId' },
        { status: 400 }
      )
    }
    
    // Find the conversation
    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }
    
    // Check for existing branch with same parentMessageId and model
    const existingBranch = conversation.branches?.find((b: any) => 
      b.parentMessageId === parentMessageId && 
      (branchType === 'multi' || b.selectedAIs?.some((ai: any) => ai.id === aiModel))
    )
    
    if (existingBranch) {
      console.log('⚠️ Branch already exists:', existingBranch.id)
      return NextResponse.json({
        success: true,
        exists: true,
        branchId: existingBranch.id,
        data: existingBranch
      })
    }
    
    // Create new branch using findOneAndUpdate with upsert for atomicity
    const branchId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newBranch = {
      id: branchId,
      label: `Branch from message`,
      parentId: 'main',
      parentMessageId: parentMessageId,
      inheritedMessages: [],
      branchMessages: [],
      selectedAIs: aiModel ? [{ id: aiModel, name: aiModel, color: '', functional: true }] : [],
      isMinimized: false,
      isActive: false,
      isGenerating: false,
      isHighlighted: false,
      position: { x: 0, y: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Use findOneAndUpdate with upsert for atomic operation
    const updatedConversation = await Conversation.findOneAndUpdate(
      { 
        _id: conversationId,
        'branches.id': { $ne: branchId }, // Ensure branch doesn't already exist
        'branches.parentMessageId': { $ne: parentMessageId } // Ensure no duplicate parentMessageId
      },
      { 
        $push: { branches: newBranch },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    )
    
    if (!updatedConversation) {
      // Branch might have been created by another request - check again
      const recheckConversation = await Conversation.findById(conversationId)
      const recheckBranch = recheckConversation?.branches?.find((b: any) => 
        b.parentMessageId === parentMessageId
      )
      
      if (recheckBranch) {
        return NextResponse.json({
          success: true,
          exists: true,
          branchId: recheckBranch.id,
          data: recheckBranch
        })
      }
      
      return NextResponse.json(
        { success: false, error: 'Failed to create branch - possible duplicate' },
        { status: 409 }
      )
    }
    
    // Find the newly created branch
    const createdBranch = updatedConversation.branches?.find((b: any) => b.id === branchId)
    
    console.log('✅ Created new branch:', branchId)
    
    return NextResponse.json({
      success: true,
      exists: false,
      branchId: branchId,
      data: createdBranch
    })
  } catch (error: any) {
    console.error('Error creating branch:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

