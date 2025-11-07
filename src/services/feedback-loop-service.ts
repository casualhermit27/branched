// Feedback Loop Service - User upvotes influence model selection
import { Conversation } from '@/models/conversation'
import connectDB from '@/lib/mongodb'
import { AuditLogger } from '@/services/analytics-service'

export interface ModelPerformance {
  model: string
  upvotes: number
  downvotes: number
  totalUses: number
  successRate: number
  averageConfidence: number
}

export class FeedbackLoopService {
  /**
   * Record user feedback (upvote/downvote)
   */
  static async recordFeedback(
    conversationId: string,
    branchId: string,
    feedback: 'upvote' | 'downvote'
  ): Promise<void> {
    await connectDB()

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const branch = conversation.branches.find((b: any) => b.id === branchId)
    if (!branch) {
      throw new Error('Branch not found')
    }

    if (feedback === 'upvote') {
      branch.upvotes = (branch.upvotes || 0) + 1
    } else {
      branch.downvotes = (branch.downvotes || 0) + 1
    }

    await conversation.save()

    // Log feedback
    await AuditLogger.log(conversationId, `branch_${feedback}`, {
      branchId,
      model: branch.selectedAIs[0]?.id
    }, branchId, branch.selectedAIs[0]?.id)
  }

  /**
   * Get model performance metrics based on feedback
   */
  static async getModelPerformance(conversationId: string): Promise<ModelPerformance[]> {
    await connectDB()

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) return []

    const modelStats: Map<string, ModelPerformance> = new Map()

    conversation.branches.forEach((branch: any) => {
      const modelId = branch.selectedAIs[0]?.id || 'unknown'
      
      if (!modelStats.has(modelId)) {
        modelStats.set(modelId, {
          model: modelId,
          upvotes: 0,
          downvotes: 0,
          totalUses: 0,
          successRate: 0,
          averageConfidence: 0
        })
      }

      const stats = modelStats.get(modelId)!
      stats.upvotes += branch.upvotes || 0
      stats.downvotes += branch.downvotes || 0
      stats.totalUses += 1
      
      if (branch.confidenceScore) {
        const currentAvg = stats.averageConfidence * (stats.totalUses - 1)
        stats.averageConfidence = (currentAvg + branch.confidenceScore) / stats.totalUses
      }
    })

    // Calculate success rate (upvotes / total votes)
    modelStats.forEach(stats => {
      const totalVotes = stats.upvotes + stats.downvotes
      stats.successRate = totalVotes > 0 ? stats.upvotes / totalVotes : 0
    })

    return Array.from(modelStats.values()).sort((a, b) => {
      // Sort by success rate, then by upvotes
      if (b.successRate !== a.successRate) {
        return b.successRate - a.successRate
      }
      return b.upvotes - a.upvotes
    })
  }

  /**
   * Get recommended model based on feedback
   */
  static async getRecommendedModel(conversationId: string): Promise<string | null> {
    const performance = await this.getModelPerformance(conversationId)
    if (performance.length === 0) return null

    // Return model with highest success rate
    return performance[0].model
  }

  /**
   * Update model weights based on feedback (for future use)
   */
  static async updateModelWeights(conversationId: string): Promise<Map<string, number>> {
    const performance = await this.getModelPerformance(conversationId)
    const weights = new Map<string, number>()

    performance.forEach(stat => {
      // Weight = success rate * (1 + upvotes / 10) to favor models with more data
      const weight = stat.successRate * (1 + stat.upvotes / 10)
      weights.set(stat.model, weight)
    })

    return weights
  }
}

