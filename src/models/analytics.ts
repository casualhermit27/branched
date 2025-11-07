import mongoose, { Schema, Document } from 'mongoose'

// Analytics Schema - tracks model performance and usage
export interface IAnalytics {
  _id?: string
  conversationId: string
  branchId?: string
  messageId: string
  model: string
  latency: number // Response time in ms
  tokensUsed: number
  cost: number // Estimated cost in USD
  timestamp: Date
  success: boolean
  error?: string
}

const AnalyticsSchema = new Schema<IAnalytics>({
  conversationId: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  messageId: { type: String, required: true },
  model: { type: String, required: true, index: true },
  latency: { type: Number, required: true },
  tokensUsed: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now, index: true },
  success: { type: Boolean, default: true },
  error: { type: String }
})

export const Analytics = mongoose.models.Analytics || mongoose.model<IAnalytics>('Analytics', AnalyticsSchema)

// Audit Log Schema - comprehensive logging
export interface IAuditLog {
  _id?: string
  conversationId: string
  branchId?: string
  action: string // 'branch_created', 'model_used', 'promotion', etc.
  model?: string
  metadata: Record<string, any>
  timestamp: Date
  userId?: string
}

const AuditLogSchema = new Schema<IAuditLog>({
  conversationId: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  action: { type: String, required: true, index: true },
  model: { type: String, index: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true },
  userId: { type: String, index: true }
})

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)

