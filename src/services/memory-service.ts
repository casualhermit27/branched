import crypto from 'crypto'
import { MemoryEntry, IMemoryEntry, IMemoryContext, IExtractedMemory, MemoryLayer } from '@/models/memory'
import connectDB from '@/lib/mongodb'

// Simple text normalization for hashing
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
}

// Generate hash for deduplication
function generateHash(text: string): string {
  const normalized = normalizeText(text)
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

// Simple cosine similarity (for basic similarity checking)
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

export class MemoryService {
  private static instance: MemoryService
  
  static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService()
    }
    return MemoryService.instance
  }
  
  /**
   * Create a new memory entry
   */
  async createMemory(params: {
    userId?: string
    branchId?: string
    nodeId?: string
    parentBranchId?: string
    inheritsFrom?: string[]
    content: string
    topic?: string
    relevanceScore?: number
    sourceMessageId?: string
    sourceBranchId?: string
    layer: MemoryLayer
    embedding?: number[]
  }): Promise<IMemoryEntry> {
    await connectDB()
    
    const normalizedHash = generateHash(params.content)
    
    // Check for duplicates
    const existing = await MemoryEntry.findOne({
      normalizedHash,
      branchId: params.branchId || null,
      userId: params.userId || null
    })
    
    if (existing) {
      // Update relevance if higher
      if (params.relevanceScore && params.relevanceScore > existing.relevanceScore) {
        existing.relevanceScore = params.relevanceScore
        existing.updatedAt = new Date()
        await existing.save()
      }
      return existing.toObject()
    }
    
    // Check for similar memories (if embeddings provided)
    if (params.embedding && params.embedding.length > 0) {
      const similarMemories = await MemoryEntry.find({
        branchId: params.branchId || null,
        userId: params.userId || null,
        embedding: { $exists: true }
      }).limit(10)
      
      for (const memory of similarMemories) {
        if (memory.embedding && memory.embedding.length > 0) {
          const similarity = cosineSimilarity(params.embedding, memory.embedding)
          if (similarity > 0.92) {
            // Merge into existing memory
            const mergedContent = `${memory.content}\n${params.content}`
            memory.content = mergedContent
            memory.mergedFrom = [...(memory.mergedFrom || []), memory.id]
            memory.updatedAt = new Date()
            await memory.save()
            return memory.toObject()
          }
        }
      }
    }
    
    // Create new memory
    const memory = new MemoryEntry({
      id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...params,
      normalizedHash,
      relevanceScore: params.relevanceScore || 1.0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    
    await memory.save()
    return memory.toObject()
  }
  
  /**
   * Get memory context for a branch (aggregates all layers)
   */
  async getMemoryContext(params: {
    userId?: string
    branchId: string
    depth?: number // How many parent levels to traverse
    messageHistoryLimit?: number // Limit for node memories
    maxMemories?: number // Total memory limit
  }): Promise<IMemoryContext> {
    await connectDB()
    
    const {
      userId,
      branchId,
      depth = 3,
      messageHistoryLimit = 10,
      maxMemories = 50
    } = params
    
    // 1. Get global memories
    const globalMemories = userId
      ? await MemoryEntry.find({
          userId,
          layer: 'global'
        })
          .sort({ relevanceScore: -1, updatedAt: -1 })
          .limit(10)
          .lean()
      : []
    
    // 2. Get branch memories (current + parent chain)
    const branchMemories: IMemoryEntry[] = []
    const visitedBranches = new Set<string>()
    
    const collectBranchMemories = async (currentBranchId: string, currentDepth: number) => {
      if (currentDepth > depth || visitedBranches.has(currentBranchId)) return
      visitedBranches.add(currentBranchId)
      
      const memories = await MemoryEntry.find({
        branchId: currentBranchId,
        layer: 'branch'
      })
        .sort({ relevanceScore: -1, updatedAt: -1 })
        .lean()
      
      // Apply relevance decay based on depth
      const decayFactor = Math.pow(0.8, currentDepth)
      memories.forEach(m => {
        m.relevanceScore = (m.relevanceScore || 1.0) * decayFactor
      })
      
      branchMemories.push(...memories)
      
      // Get parent branch and recurse
      const branchMemory = memories.find(m => m.parentBranchId)
      if (branchMemory?.parentBranchId) {
        await collectBranchMemories(branchMemory.parentBranchId, currentDepth + 1)
      }
    }
    
    await collectBranchMemories(branchId, 0)
    
    // 3. Get node memories (recent messages)
    const nodeMemories = await MemoryEntry.find({
      branchId,
      layer: 'node'
    })
      .sort({ updatedAt: -1 })
      .limit(messageHistoryLimit)
      .lean()
    
    // Combine and sort by relevance
    const allMemories = [
      ...globalMemories,
      ...branchMemories,
      ...nodeMemories
    ].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, maxMemories)
    
    // Build aggregated context string
    const aggregatedContext = allMemories
      .map(m => {
        const prefix = m.layer === 'global' ? '[Global]' : 
                      m.layer === 'branch' ? '[Branch]' : '[Context]'
        return `${prefix} ${m.content}`
      })
      .join('\n')
    
    return {
      globalMemories,
      branchMemories,
      nodeMemories,
      aggregatedContext,
      memoryCount: allMemories.length,
      relevanceDecay: Math.pow(0.8, depth)
    }
  }
  
  /**
   * Inherit memory when creating a branch
   */
  async inheritMemoryForBranch(params: {
    newBranchId: string
    parentBranchId: string
    userId?: string
  }): Promise<void> {
    await connectDB()
    
    const { newBranchId, parentBranchId, userId } = params
    
    // Get parent branch memories
    const parentMemories = await MemoryEntry.find({
      branchId: parentBranchId,
      layer: { $in: ['branch', 'node'] }
    }).lean()
    
    // Create memory references (don't duplicate, just reference)
    for (const memory of parentMemories) {
      // Create a reference entry
      await MemoryEntry.create({
        id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: memory.userId,
        branchId: newBranchId,
        parentBranchId,
        inheritsFrom: [parentBranchId, ...(memory.inheritsFrom || [])],
        content: memory.content,
        normalizedHash: memory.normalizedHash,
        embedding: memory.embedding,
        topic: memory.topic,
        relevanceScore: memory.relevanceScore || 1.0,
        sourceMessageId: memory.sourceMessageId,
        sourceBranchId: memory.sourceBranchId,
        layer: memory.layer,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }
  }
  
  /**
   * Extract memories from AI response
   */
  async extractMemoriesFromResponse(params: {
    responseText: string
    branchId: string
    messageId: string
    userId?: string
    topic?: string
  }): Promise<IExtractedMemory> {
    // Simple extraction: split by sentences and identify facts
    // In production, you'd use NLP/LLM to extract structured facts
    const sentences = params.responseText
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20) // Only substantial sentences
    
    const facts = sentences.slice(0, 5) // Limit to 5 facts
    
    // Create memory entries
    for (const fact of facts) {
      await this.createMemory({
        userId: params.userId,
        branchId: params.branchId,
        content: fact,
        topic: params.topic,
        relevanceScore: 0.8, // Default relevance
        sourceMessageId: params.messageId,
        sourceBranchId: params.branchId,
        layer: 'branch'
      })
    }
    
    return {
      facts,
      topics: params.topic ? [params.topic] : [],
      relevanceScore: 0.8,
      sourceMessageId: params.messageId,
      sourceBranchId: params.branchId
    }
  }
  
  /**
   * Prune old/low-relevance memories
   */
  async pruneMemories(params: {
    branchId?: string
    userId?: string
    maxMemories?: number
  }): Promise<number> {
    await connectDB()
    
    const { branchId, userId, maxMemories = 200 } = params
    
    const query: any = {}
    if (branchId) query.branchId = branchId
    if (userId) query.userId = userId
    
    const allMemories = await MemoryEntry.find(query)
      .sort({ relevanceScore: 1, updatedAt: 1 }) // Lowest relevance first
      .lean()
    
    if (allMemories.length <= maxMemories) return 0
    
    const toDelete = allMemories.slice(0, allMemories.length - maxMemories)
    const idsToDelete = toDelete.map(m => m.id)
    
    await MemoryEntry.deleteMany({ id: { $in: idsToDelete } })
    
    return idsToDelete.length
  }
  
  /**
   * Promote branch memory to global
   */
  async promoteToGlobal(params: {
    memoryId: string
    userId: string
  }): Promise<IMemoryEntry> {
    await connectDB()
    
    const memory = await MemoryEntry.findOne({ id: params.memoryId })
    if (!memory) {
      throw new Error('Memory not found')
    }
    
    // Create global copy
    const globalMemory = await this.createMemory({
      userId: params.userId,
      content: memory.content,
      topic: memory.topic,
      relevanceScore: memory.relevanceScore || 1.0,
      layer: 'global',
      embedding: memory.embedding
    })
    
    return globalMemory
  }
}

export const memoryService = MemoryService.getInstance()
