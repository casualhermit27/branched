// Memory Service - Global/Long-term Memory Management
import { GlobalMemory, IGlobalMemory } from '@/models/memory'

export interface MemoryFact {
  fact: string
  context: string
  importance: number
  tags: string[]
}

export class MemoryService {
  /**
   * Extract and store important facts from conversation
   */
  static async addMemory(
    conversationId: string,
    fact: string,
    context: string,
    importance: number = 0.5,
    tags: string[] = []
  ): Promise<IGlobalMemory> {
    const memory = new GlobalMemory({
      conversationId,
      fact,
      context,
      importance,
      tags,
      createdAt: new Date(),
      updatedAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0
    })

    return await memory.save()
  }

  /**
   * Recall relevant memories for a given query
   */
  static async recallMemories(
    conversationId: string,
    query: string,
    limit: number = 5
  ): Promise<IGlobalMemory[]> {
    // Simple keyword matching - can be enhanced with semantic search
    const keywords = query.toLowerCase().split(/\s+/)
    
    const memories = await GlobalMemory.find({
      conversationId,
      $or: [
        { fact: { $regex: keywords.join('|'), $options: 'i' } },
        { tags: { $in: keywords } }
      ]
    })
      .sort({ importance: -1, accessCount: -1 })
      .limit(limit)
      .exec()

    // Update access times
    const ids = memories.map(m => m._id)
    await GlobalMemory.updateMany(
      { _id: { $in: ids } },
      { 
        $inc: { accessCount: 1 },
        $set: { accessedAt: new Date() }
      }
    )

    return memories
  }

  /**
   * Get all memories for a conversation
   */
  static async getConversationMemories(conversationId: string): Promise<IGlobalMemory[]> {
    return await GlobalMemory.find({ conversationId })
      .sort({ importance: -1, createdAt: -1 })
      .exec()
  }

  /**
   * Update memory importance
   */
  static async updateImportance(memoryId: string, importance: number): Promise<void> {
    await GlobalMemory.updateOne(
      { _id: memoryId },
      { 
        $set: { 
          importance: Math.max(0, Math.min(1, importance)),
          updatedAt: new Date()
        }
      }
    )
  }

  /**
   * Delete memory
   */
  static async deleteMemory(memoryId: string): Promise<void> {
    await GlobalMemory.deleteOne({ _id: memoryId })
  }

  /**
   * Extract facts from message text (simple implementation)
   */
  static extractFacts(message: string): MemoryFact[] {
    const facts: MemoryFact[] = []
    
    // Simple pattern matching for facts
    // This can be enhanced with NLP/LLM-based extraction
    const factPatterns = [
      /(?:I|we|they|it) (?:am|is|are|was|were) (.+?)(?:\.|$)/gi,
      /(?:The|A|An) (.+?) (?:is|are|was|were) (.+?)(?:\.|$)/gi,
      /(?:Remember|Note|Important): (.+?)(?:\.|$)/gi
    ]

    factPatterns.forEach(pattern => {
      const matches = message.matchAll(pattern)
      for (const match of matches) {
        if (match[1] && match[1].length > 10) {
          facts.push({
            fact: match[1].trim(),
            context: message.substring(0, 200),
            importance: 0.6,
            tags: this.extractTags(message)
          })
        }
      }
    })

    return facts
  }

  /**
   * Extract tags from message
   */
  private static extractTags(message: string): string[] {
    const tags: string[] = []
    const tagPattern = /#(\w+)/g
    const matches = message.matchAll(tagPattern)
    for (const match of matches) {
      tags.push(match[1].toLowerCase())
    }
    return tags
  }
}

