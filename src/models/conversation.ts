import mongoose, { Schema, Document } from 'mongoose'

// AI Model Schema
export interface IAIModel {
  id: string
  name: string
  color: string
  logo?: string // Store as string/svg - optional since we skip React elements
  functional?: boolean
}

const AIModelSchema = new Schema<IAIModel>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
  logo: { type: String, required: false, default: '' }, // Optional - default to empty string
  functional: { type: Boolean, default: true }
}, { _id: false })

// Message Schema
export interface IMessage {
  id: string
  text: string
  isUser: boolean
  ai?: string
  parentId?: string
  children: string[]
  timestamp: number
  responses?: { [aiId: string]: string }
  aiModel?: string
  groupId?: string
  isStreaming?: boolean
  streamingText?: string
  nodeId?: string // Which node this message belongs to
  // New fields for advanced features
  confidenceScore?: number // Model confidence for this response
  reasoningScore?: number // Quality/reasoning score
  latency?: number // Response time in ms
  tokensUsed?: number
  cost?: number
  contextUsed?: string[] // Memory IDs that were used
}

const MessageSchema = new Schema<IMessage>({
  id: { type: String, required: true },
  text: { type: String, required: true },
  isUser: {
    type: Boolean,
    required: true,
    default: function () {
      // Auto-compute isUser based on AI indicators
      return !(this.aiModel || this.ai || this.role === 'assistant')
    }
  },
  ai: { type: String },
  parentId: { type: String },
  children: { type: [String], default: [] },
  timestamp: { type: Number, required: true },
  responses: { type: Map, of: String },
  aiModel: { type: String },
  groupId: { type: String },
  isStreaming: { type: Boolean, default: false },
  streamingText: { type: String },
  nodeId: { type: String },
  // New fields
  confidenceScore: { type: Number, min: 0, max: 1 },
  reasoningScore: { type: Number, min: 0, max: 1 },
  latency: { type: Number },
  tokensUsed: { type: Number },
  cost: { type: Number },
  contextUsed: { type: [String], default: [] }
})

// Virtual getter for isUser to ensure it's always computed correctly at read-time
MessageSchema.virtual('isUserComputed').get(function () {
  return !(this.aiModel || this.ai || this.role === 'assistant')
})

// Branch Schema - Refactored with clear separation
export interface IBranch {
  id: string
  label: string
  parentId?: string // Parent node ID (e.g., 'main' or another branch ID)
  parentMessageId: string // Message ID that created this branch
  inheritedMessages: IMessage[] // All messages from root till the parent message (for context)
  branchMessages: IMessage[] // Only new messages within this branch
  selectedAIs: IAIModel[] // Which model(s) this branch is exploring
  isMinimized: boolean
  isActive: boolean
  isGenerating: boolean
  isHighlighted: boolean
  position: {
    x: number
    y: number
  }
  createdAt: Date
  updatedAt: Date
  // New fields for advanced features
  depthLevel?: number // Tree depth for layout
  branchGroupId?: string // Group ID for visual grouping of multi-model branches
  metadata?: {
    temperature?: number
    topP?: number
    maxTokens?: number
    [key: string]: any
  }
  confidenceScore?: number // 0-1 score for model comparison
  reasoningScore?: number // Quality score
  isPromoted?: boolean // Whether this branch is promoted to main
  upvotes?: number // User feedback
  downvotes?: number
  contextLinks?: string[] // Links to other branches for context sharing
  linkedBranches?: {
    incoming: string[] // Branch IDs that link TO this branch
    outgoing: string[] // Branch IDs this branch links TO
  }
  contextIntegrity?: {
    lastChecked: number
    issues: string[]
    score: number // 0-100
  }
}

const BranchSchema = new Schema<IBranch>({
  id: { type: String, required: true },
  label: { type: String, required: true },
  parentId: { type: String }, // Parent node ID
  parentMessageId: { type: String, required: false }, // Message that created this branch - optional to allow saving
  inheritedMessages: [MessageSchema], // Context messages from root
  branchMessages: [MessageSchema], // Messages within this branch only
  selectedAIs: [AIModelSchema],
  isMinimized: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false },
  isGenerating: { type: Boolean, default: false },
  isHighlighted: { type: Boolean, default: false },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // New fields
  depthLevel: { type: Number, default: 0 },
  branchGroupId: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  confidenceScore: { type: Number, min: 0, max: 1 },
  reasoningScore: { type: Number, min: 0, max: 1 },
  isPromoted: { type: Boolean, default: false },
  upvotes: { type: Number, default: 0 },
  downvotes: { type: Number, default: 0 },
  contextLinks: { type: [String], default: [] },
  linkedBranches: {
    incoming: { type: [String], default: [] },
    outgoing: { type: [String], default: [] }
  },
  contextIntegrity: {
    lastChecked: { type: Number },
    issues: { type: [String], default: [] },
    score: { type: Number, min: 0, max: 100 }
  }
})

// Main Conversation Schema - Refactored structure
export interface IConversation {
  _id?: string
  title: string
  main: {
    messages: IMessage[] // Main conversation thread
    selectedAIs: IAIModel[] // Active models for main thread
  }
  branches: IBranch[] // Side explorations
  contextLinks: string[] // Edge IDs for context connections
  collapsedNodes: string[]
  minimizedNodes: string[]
  activeNodeId?: string
  viewport: {
    x: number
    y: number
    zoom: number
  }
  createdAt: Date
  updatedAt: Date
  userId?: string // For future user authentication
  // Legacy fields for backward compatibility (will be migrated)
  mainMessages?: IMessage[]
  selectedAIs?: IAIModel[]
}

const ConversationSchema = new Schema<IConversation>({
  title: { type: String, required: true, default: 'New Conversation' },
  main: {
    messages: { type: [MessageSchema], default: [] },
    selectedAIs: { type: [AIModelSchema], default: [] }
  },
  branches: { type: [BranchSchema], default: [] },
  contextLinks: { type: [String], default: [] },
  collapsedNodes: { type: [String], default: [] },
  minimizedNodes: { type: [String], default: [] },
  activeNodeId: { type: String },
  viewport: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    zoom: { type: Number, default: 1 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  userId: { type: String },
  // Legacy fields for backward compatibility
  mainMessages: { type: [MessageSchema], required: false },
  selectedAIs: { type: [AIModelSchema], required: false }
})

// Update timestamps
ConversationSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

BranchSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

// Export models
export const Conversation = mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema)
export const Branch = mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema)
export const Message = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema)
export const AIModel = mongoose.models.AIModel || mongoose.model<IAIModel>('AIModel', AIModelSchema)
