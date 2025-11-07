// Analytics Service - Track model performance and usage
import { Analytics, IAnalytics, AuditLog, IAuditLog } from '@/models/analytics'

export interface AnalyticsMetrics {
  totalRequests: number
  averageLatency: number
  totalTokens: number
  totalCost: number
  successRate: number
  modelBreakdown: {
    [model: string]: {
      count: number
      avgLatency: number
      totalTokens: number
      totalCost: number
      successRate: number
    }
  }
}

export class AnalyticsService {
  /**
   * Track model usage
   */
  static async trackModelUsage(
    conversationId: string,
    branchId: string | undefined,
    messageId: string,
    model: string,
    latency: number,
    tokensUsed: number = 0,
    cost: number = 0,
    success: boolean = true,
    error?: string
  ): Promise<IAnalytics> {
    const analytics = new Analytics({
      conversationId,
      branchId,
      messageId,
      model,
      latency,
      tokensUsed,
      cost,
      success,
      error,
      timestamp: new Date()
    })

    return await analytics.save()
  }

  /**
   * Get metrics for a conversation
   */
  static async getConversationMetrics(conversationId: string): Promise<AnalyticsMetrics> {
    const records = await Analytics.find({ conversationId }).exec()
    
    const totalRequests = records.length
    const successful = records.filter(r => r.success).length
    const successRate = totalRequests > 0 ? successful / totalRequests : 0
    
    const totalLatency = records.reduce((sum, r) => sum + r.latency, 0)
    const averageLatency = totalRequests > 0 ? totalLatency / totalRequests : 0
    
    const totalTokens = records.reduce((sum, r) => sum + (r.tokensUsed || 0), 0)
    const totalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0)

    // Model breakdown
    const modelBreakdown: { [key: string]: any } = {}
    records.forEach(record => {
      if (!modelBreakdown[record.model]) {
        modelBreakdown[record.model] = {
          count: 0,
          totalLatency: 0,
          totalTokens: 0,
          totalCost: 0,
          successful: 0
        }
      }
      const breakdown = modelBreakdown[record.model]
      breakdown.count++
      breakdown.totalLatency += record.latency
      breakdown.totalTokens += record.tokensUsed || 0
      breakdown.totalCost += record.cost || 0
      if (record.success) breakdown.successful++
    })

    // Calculate averages for each model
    Object.keys(modelBreakdown).forEach(model => {
      const breakdown = modelBreakdown[model]
      breakdown.avgLatency = breakdown.totalLatency / breakdown.count
      breakdown.successRate = breakdown.successful / breakdown.count
    })

    return {
      totalRequests,
      averageLatency,
      totalTokens,
      totalCost,
      successRate,
      modelBreakdown
    }
  }

  /**
   * Get branch depth statistics
   */
  static async getBranchDepthStats(conversationId: string): Promise<{
    maxDepth: number
    averageDepth: number
    branchCount: number
  }> {
    // This would need to query branches and calculate depth
    // For now, return placeholder
    return {
      maxDepth: 0,
      averageDepth: 0,
      branchCount: 0
    }
  }

  /**
   * Get user engagement per branch
   */
  static async getBranchEngagement(conversationId: string): Promise<{
    [branchId: string]: {
      messageCount: number
      lastActivity: Date
      avgLatency: number
    }
  }> {
    const records = await Analytics.find({ conversationId }).exec()
    const engagement: { [key: string]: any } = {}

    records.forEach(record => {
      if (record.branchId) {
        if (!engagement[record.branchId]) {
          engagement[record.branchId] = {
            messageCount: 0,
            lastActivity: record.timestamp,
            totalLatency: 0,
            latencyCount: 0
          }
        }
        const branch = engagement[record.branchId]
        branch.messageCount++
        if (record.timestamp > branch.lastActivity) {
          branch.lastActivity = record.timestamp
        }
        branch.totalLatency += record.latency
        branch.latencyCount++
      }
    })

    // Calculate averages
    Object.keys(engagement).forEach(branchId => {
      const branch = engagement[branchId]
      branch.avgLatency = branch.latencyCount > 0 
        ? branch.totalLatency / branch.latencyCount 
        : 0
      delete branch.totalLatency
      delete branch.latencyCount
    })

    return engagement
  }
}

export class AuditLogger {
  /**
   * Log an action
   */
  static async log(
    conversationId: string,
    action: string,
    metadata: Record<string, any> = {},
    branchId?: string,
    model?: string,
    userId?: string
  ): Promise<IAuditLog> {
    const log = new AuditLog({
      conversationId,
      branchId,
      action,
      model,
      metadata,
      userId,
      timestamp: new Date()
    })

    return await log.save()
  }

  /**
   * Log branch creation
   */
  static async logBranchCreation(
    conversationId: string,
    branchId: string,
    parentId: string,
    model: string
  ): Promise<void> {
    await this.log(conversationId, 'branch_created', {
      branchId,
      parentId,
      model
    }, branchId, model)
  }

  /**
   * Log branch promotion
   */
  static async logBranchPromotion(
    conversationId: string,
    branchId: string,
    previousMainId: string
  ): Promise<void> {
    await this.log(conversationId, 'branch_promoted', {
      branchId,
      previousMainId
    }, branchId)
  }

  /**
   * Log model usage
   */
  static async logModelUsage(
    conversationId: string,
    model: string,
    tokensUsed: number,
    cost: number,
    branchId?: string
  ): Promise<void> {
    await this.log(conversationId, 'model_used', {
      tokensUsed,
      cost
    }, branchId, model)
  }

  /**
   * Get audit logs for a conversation
   */
  static async getConversationLogs(
    conversationId: string,
    limit: number = 100
  ): Promise<IAuditLog[]> {
    return await AuditLog.find({ conversationId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec()
  }
}

