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
}

const MessageSchema = new Schema<IMessage>({
  id: { type: String, required: true },
  text: { type: String, required: true },
  isUser: { type: Boolean, required: true },
  ai: { type: String },
  parentId: { type: String },
  children: { type: [String], default: [] },
  timestamp: { type: Number, required: true },
  responses: { type: Map, of: String },
  aiModel: { type: String },
  groupId: { type: String },
  isStreaming: { type: Boolean, default: false },
  streamingText: { type: String },
  nodeId: { type: String }
})

// Branch Schema
export interface IBranch {
  id: string
  label: string
  parentId?: string
  messages: IMessage[]
  selectedAIs: IAIModel[]
  multiModelMode: boolean
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
}

const BranchSchema = new Schema<IBranch>({
  id: { type: String, required: true }, // Remove unique constraint as branches are nested in arrays
  label: { type: String, required: true },
  parentId: { type: String },
  messages: [MessageSchema],
  selectedAIs: [AIModelSchema],
  multiModelMode: { type: Boolean, default: false },
  isMinimized: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false },
  isGenerating: { type: Boolean, default: false },
  isHighlighted: { type: Boolean, default: false },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Main Conversation Schema
export interface IConversation {
  _id?: string
  title: string
  mainMessages: IMessage[]
  selectedAIs: IAIModel[]
  multiModelMode: boolean
  branches: IBranch[]
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
}

const ConversationSchema = new Schema<IConversation>({
  title: { type: String, required: true, default: 'New Conversation' },
  mainMessages: [MessageSchema],
  selectedAIs: [AIModelSchema],
  multiModelMode: { type: Boolean, default: false },
  branches: [BranchSchema],
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
  userId: { type: String }
})

// Update timestamps
ConversationSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

BranchSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

// Export models
export const Conversation = mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema)
export const Branch = mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema)
export const Message = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema)
export const AIModel = mongoose.models.AIModel || mongoose.model<IAIModel>('AIModel', AIModelSchema)
