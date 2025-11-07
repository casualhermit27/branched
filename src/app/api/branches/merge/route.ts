// API Route: /api/branches/merge
import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Conversation } from '@/models/conversation'
import { AuditLogger } from '@/services/analytics-service'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    const body = await request.json()
    const { conversationId, branchIds, mergeStrategy = 'combine' } = body

    if (!conversationId || !branchIds || !Array.isArray(branchIds) || branchIds.length < 2) {
      return NextResponse.json(
        { success: false, error: 'conversationId and at least 2 branchIds required' },
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

    // Find branches to merge
    const branchesToMerge = conversation.branches.filter((b: any) => 
      branchIds.includes(b.id)
    )

    if (branchesToMerge.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Not all branches found' },
        { status: 404 }
      )
    }

    // Merge strategy: 'combine' or 'summarize'
    let mergedMessages: any[] = []
    
    if (mergeStrategy === 'combine') {
      // Combine all messages chronologically
      const allMessages = branchesToMerge.flatMap((b: any) => b.messages)
      mergedMessages = allMessages.sort((a: any, b: any) => a.timestamp - b.timestamp)
      
      // Deduplicate by message ID
      const seen = new Set<string>()
      mergedMessages = mergedMessages.filter((m: any) => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })
    } else if (mergeStrategy === 'summarize') {
      // For summarize, we'd need to call an AI model to create a summary
      // For now, just combine and mark as needing summary
      const allMessages = branchesToMerge.flatMap((b: any) => b.messages)
      mergedMessages = allMessages.sort((a: any, b: any) => a.timestamp - b.timestamp)
      
      // Add a summary marker message
      mergedMessages.push({
        id: `merge-summary-${Date.now()}`,
        text: `[Merged ${branchesToMerge.length} branches - Summary needed]`,
        isUser: false,
        timestamp: Date.now(),
        children: []
      })
    }

    // Create new merged branch
    const mergedBranch = {
      id: `merged-${Date.now()}`,
      label: `Merged: ${branchesToMerge.map((b: any) => b.label).join(', ')}`,
      parentId: branchesToMerge[0].parentId,
      messages: mergedMessages,
      selectedAIs: branchesToMerge[0].selectedAIs,
      multiModelMode: false,
      isMinimized: false,
      isActive: false,
      isGenerating: false,
      isHighlighted: false,
      position: {
        x: branchesToMerge[0].position.x,
        y: branchesToMerge[0].position.y + 200
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        mergedFrom: branchIds,
        mergeStrategy
      }
    }

    // Remove old branches and add merged branch
    conversation.branches = conversation.branches.filter((b: any) => 
      !branchIds.includes(b.id)
    )
    conversation.branches.push(mergedBranch)

    await conversation.save()

    // Log the merge
    await AuditLogger.log(conversationId, 'branches_merged', {
      branchIds,
      mergedBranchId: mergedBranch.id,
      mergeStrategy
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Branches merged successfully',
      mergedBranch,
      conversation 
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

