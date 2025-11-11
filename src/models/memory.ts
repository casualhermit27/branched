import mongoose, { Schema, Document } from 'mongoose'

// Memory Layer Types
export type MemoryLayer = 'global' | 'branch' | 'node'

export interface IMemoryEntry {
  id: string
  userId?: string // For global memories
  branchId?: string // For branch memories
  nodeId?: string // For node memories
  parentBranchId?: string // For branch memory inheritance
  inheritsFrom?: string[] // Array of branch IDs this memory inherits from
  
  // Content
  content: string // The actual memory/fact
  normalizedHash: string // Hash for deduplication
  embedding?: number[] // Vector embedding for semantic search
  
  // Metadata
  topic?: string // Category/topic tag
  relevanceScore: number // 0-1 relevance score
  sourceMessageId?: string // Which message generated this memory
  sourceBranchId?: string // Which branch this memory came from
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  
  // Memory type
  layer: MemoryLayer
  
  // For merging similar facts
  mergedFrom?: string[] // IDs of memories merged into this one
  similarityScore?: number // Similarity to existing memories
}

export interface IGlobalMemory extends IMemoryEntry {
  layer: 'global'
  userId: string
}

export interface IBranchMemory extends IMemoryEntry {
  layer: 'branch'
  branchId: string
  parentBranchId?: string
  inheritsFrom?: string[]
}

export interface INodeMemory extends IMemoryEntry {
  layer: 'node'
  nodeId: string
  branchId: string
  messageIds: string[] // Messages this memory covers
}

// MongoDB Schemas
const MemoryEntrySchema = new Schema<IMemoryEntry>({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: false, index: true },
  branchId: { type: String, required: false, index: true },
  nodeId: { type: String, required: false, index: true },
  parentBranchId: { type: String, required: false },
  inheritsFrom: { type: [String], default: [] },
  
  content: { type: String, required: true },
  normalizedHash: { type: String, required: true, index: true },
  embedding: { type: [Number], required: false },
  
  topic: { type: String, required: false, index: true },
  relevanceScore: { type: Number, required: true, default: 1.0, min: 0, max: 1 },
  sourceMessageId: { type: String, required: false },
  sourceBranchId: { type: String, required: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  layer: { type: String, required: true, enum: ['global', 'branch', 'node'], index: true },
  
  mergedFrom: { type: [String], default: [] },
  similarityScore: { type: Number, required: false }
}, {
  timestamps: true
})

// Compound indexes for efficient queries
MemoryEntrySchema.index({ userId: 1, layer: 1, topic: 1 })
MemoryEntrySchema.index({ branchId: 1, layer: 1, relevanceScore: -1 })
MemoryEntrySchema.index({ normalizedHash: 1, branchId: 1 }, { unique: true })
MemoryEntrySchema.index({ branchId: 1, parentBranchId: 1 })

// Virtual for memory inheritance path
MemoryEntrySchema.virtual('inheritancePath').get(function() {
  if (this.layer === 'branch' && this.inheritsFrom) {
    return this.inheritsFrom
  }
  return []
})

export const MemoryEntry = mongoose.models.MemoryEntry || mongoose.model<IMemoryEntry>('MemoryEntry', MemoryEntrySchema)

// Memory Aggregation Result
export interface IMemoryContext {
  globalMemories: IMemoryEntry[]
  branchMemories: IMemoryEntry[]
  nodeMemories: IMemoryEntry[]
  aggregatedContext: string // Combined context string for prompt injection
  memoryCount: number
  relevanceDecay: number // Applied decay factor
}

// Memory Extraction Result
export interface IExtractedMemory {
  facts: string[]
  topics: string[]
  relevanceScore: number
  sourceMessageId: string
  sourceBranchId: string
}
