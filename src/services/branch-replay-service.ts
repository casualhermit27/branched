// Branch Replay Service - Re-run past prompts with updated models
import { Conversation } from '@/models/conversation'
import connectDB from '@/lib/mongodb'
import { unifiedAPI } from './unified-api-wrapper'
import { AuditLogger } from './analytics-service'

export class BranchReplayService {
  /**
   * Replay a branch's messages with a different model
   */
  static async replayBranch(
    conversationId: string,
    branchId: string,
    newModel: string,
    startFromMessageId?: string
  ): Promise<any> {
    await connectDB()

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const branch = conversation.branches.find((b: any) => b.id === branchId)
    if (!branch) {
      throw new Error('Branch not found')
    }

    // Find starting point
    let startIndex = 0
    if (startFromMessageId) {
      startIndex = branch.messages.findIndex((m: any) => m.id === startFromMessageId)
      if (startIndex === -1) startIndex = 0
    }

    // Create new replay branch
    const replayBranchId = `replay-${branchId}-${Date.now()}`
    const replayBranch = {
      id: replayBranchId,
      label: `Replay: ${branch.label} (${newModel})`,
      parentId: branch.parentId,
      messages: [...branch.messages.slice(0, startIndex)], // Copy messages up to start point
      selectedAIs: [{ id: newModel, name: newModel, color: 'bg-blue-100 text-blue-800 border-blue-200', functional: true }],
      isMinimized: false,
      isActive: false,
      isGenerating: false,
      isHighlighted: false,
      position: {
        x: branch.position.x + 300,
        y: branch.position.y
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        replayedFrom: branchId,
        originalModel: branch.selectedAIs[0]?.id,
        newModel,
        startFromMessageId
      }
    }

    // Replay messages
    const messagesToReplay = branch.messages.slice(startIndex).filter((m: any) => m.isUser)
    
    for (const userMessage of messagesToReplay) {
      // Get context up to this point
      const contextMessages = replayBranch.messages.map((m: any) => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text
      }))

      // Generate response with new model
      const response = await unifiedAPI.generateResponse(
        {
          model: newModel,
          messages: [...contextMessages, { role: 'user', content: userMessage.text }],
          temperature: branch.metadata?.temperature || 0.7
        },
        conversationId,
        replayBranchId,
        userMessage.id
      )

      // Add user message and AI response to replay branch
      replayBranch.messages.push(userMessage)
      replayBranch.messages.push({
        id: `msg-${Date.now()}`,
        text: response.text,
        isUser: false,
        aiModel: newModel,
        timestamp: Date.now(),
        children: [],
        latency: response.latency,
        tokensUsed: response.tokensUsed,
        cost: response.cost
      })
    }

    // Add replay branch to conversation
    conversation.branches.push(replayBranch)
    await conversation.save()

    // Log replay
    await AuditLogger.log(conversationId, 'branch_replayed', {
      originalBranchId: branchId,
      replayBranchId,
      newModel,
      messagesReplayed: messagesToReplay.length
    })

    return replayBranch
  }

  /**
   * Get replay history for a branch
   */
  static async getReplayHistory(conversationId: string, branchId: string): Promise<any[]> {
    await connectDB()

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) return []

    return conversation.branches.filter((b: any) => 
      b.metadata?.replayedFrom === branchId
    )
  }
}

