import mongoose, { Schema, Document } from 'mongoose'

// Global Memory Schema - stores facts that persist across branches
export interface IGlobalMemory {
  _id?: string
  conversationId: string
  fact: string
  context: string // The conversation context when this fact was extracted
  importance: number // 0-1 score of importance
  tags: string[]
  createdAt: Date
  updatedAt: Date
  accessedAt: Date // Last time this memory was recalled
  accessCount: number // How many times this memory was accessed
}

const GlobalMemorySchema = new Schema<IGlobalMemory>({
  conversationId: { type: String, required: true, index: true },
  fact: { type: String, required: true },
  context: { type: String, required: true },
  importance: { type: Number, default: 0.5, min: 0, max: 1 },
  tags: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  accessedAt: { type: Date, default: Date.now },
  accessCount: { type: Number, default: 0 }
})

export const GlobalMemory = mongoose.models.GlobalMemory || mongoose.model<IGlobalMemory>('GlobalMemory', GlobalMemorySchema)

