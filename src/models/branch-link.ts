import mongoose, { Schema, Document } from 'mongoose'

export interface IBranchLink extends Document {
  id: string
  sourceBranchId: string
  targetBranchId: string
  linkType: 'merge' | 'reference' | 'continuation' | 'alternative'
  metadata: {
    createdAt: number
    createdBy?: string
    description?: string
    weight?: number // For context importance (0-1)
  }
  conversationId: string // Which conversation this link belongs to
  createdAt: Date
  updatedAt: Date
}

const BranchLinkSchema = new Schema<IBranchLink>({
  id: { type: String, required: true, unique: true },
  sourceBranchId: { type: String, required: true, index: true },
  targetBranchId: { type: String, required: true, index: true },
  linkType: {
    type: String,
    enum: ['merge', 'reference', 'continuation', 'alternative'],
    required: true,
    default: 'reference'
  },
  metadata: {
    createdAt: { type: Number, required: true, default: Date.now },
    createdBy: { type: String },
    description: { type: String },
    weight: { type: Number, min: 0, max: 1, default: 0.5 }
  },
  conversationId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Update timestamp
BranchLinkSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

// Compound indexes for efficient queries
BranchLinkSchema.index({ sourceBranchId: 1, targetBranchId: 1 })
BranchLinkSchema.index({ conversationId: 1, sourceBranchId: 1 })
BranchLinkSchema.index({ conversationId: 1, targetBranchId: 1 })

export const BranchLink = mongoose.models.BranchLink || mongoose.model<IBranchLink>('BranchLink', BranchLinkSchema)

