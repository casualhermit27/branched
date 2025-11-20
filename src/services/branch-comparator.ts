'use server'

import connectDB from '@/lib/mongodb'
import { Conversation } from '@/models/conversation'
import { diffWords } from 'diff'

export interface ComparisonResult {
  branch1Id: string
  branch2Id: string
  branch1Messages: any[]
  branch2Messages: any[]
  differences: MessageDifference[]
  similarity: number // 0-1
  summary?: string
}

export interface MessageDifference {
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  branch1Message?: any
  branch2Message?: any
  textDiff?: diff.Change[]
  similarity?: number
}

/**
 * Branch Comparator - Compares branches and generates diff analysis
 */
export class BranchComparator {
  /**
   * Compare two branches
   */
  static async compareBranches(
    branch1Id: string,
    branch2Id: string,
    conversationId: string
  ): Promise<ComparisonResult> {
    await connectDB()

    const conversation = await Conversation.findOne({ _id: conversationId })
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const branch1 = conversation.branches.find(b => b.id === branch1Id)
    const branch2 = conversation.branches.find(b => b.id === branch2Id)

    if (!branch1 || !branch2) {
      throw new Error('One or both branches not found')
    }

    // Get all messages from both branches (inherited + branch messages)
    const branch1Messages = [
      ...(branch1.inheritedMessages || []),
      ...(branch1.branchMessages || [])
    ]

    const branch2Messages = [
      ...(branch2.inheritedMessages || []),
      ...(branch2.branchMessages || [])
    ]

    // Calculate differences
    const differences = this.calculateDifferences(branch1Messages, branch2Messages)

    // Calculate similarity score
    const similarity = this.calculateSimilarity(branch1Messages, branch2Messages, differences)

    return {
      branch1Id,
      branch2Id,
      branch1Messages,
      branch2Messages,
      differences,
      similarity
    }
  }

  /**
   * Compare multiple branches (3+)
   */
  static async compareMultipleBranches(
    branchIds: string[],
    conversationId: string
  ): Promise<ComparisonResult[]> {
    await connectDB()

    const results: ComparisonResult[] = []

    // Compare each pair
    for (let i = 0; i < branchIds.length; i++) {
      for (let j = i + 1; j < branchIds.length; j++) {
        try {
          const comparison = await this.compareBranches(
            branchIds[i],
            branchIds[j],
            conversationId
          )
          results.push(comparison)
        } catch (error) {
          console.error(`Error comparing branches ${branchIds[i]} and ${branchIds[j]}:`, error)
        }
      }
    }

    return results
  }

  /**
   * Calculate differences between two message arrays
   */
  private static calculateDifferences(
    messages1: any[],
    messages2: any[]
  ): MessageDifference[] {
    const differences: MessageDifference[] = []
    const maxLength = Math.max(messages1.length, messages2.length)

    for (let i = 0; i < maxLength; i++) {
      const msg1 = messages1[i]
      const msg2 = messages2[i]

      if (!msg1 && msg2) {
        // Message only in branch2
        differences.push({
          type: 'added',
          branch2Message: msg2
        })
      } else if (msg1 && !msg2) {
        // Message only in branch1
        differences.push({
          type: 'removed',
          branch1Message: msg1
        })
      } else if (msg1 && msg2) {
        // Both exist - check if they're the same
        if (msg1.id === msg2.id) {
          differences.push({
            type: 'unchanged',
            branch1Message: msg1,
            branch2Message: msg2
          })
        } else {
          // Different messages at same position
          const textDiff = diffWords(
            msg1.text || '',
            msg2.text || ''
          )
          const similarity = this.calculateTextSimilarity(msg1.text || '', msg2.text || '')

          differences.push({
            type: 'modified',
            branch1Message: msg1,
            branch2Message: msg2,
            textDiff,
            similarity
          })
        }
      }
    }

    return differences
  }

  /**
   * Calculate similarity between two message arrays
   */
  private static calculateSimilarity(
    messages1: any[],
    messages2: any[],
    differences: MessageDifference[]
  ): number {
    if (messages1.length === 0 && messages2.length === 0) return 1
    if (messages1.length === 0 || messages2.length === 0) return 0

    const unchanged = differences.filter(d => d.type === 'unchanged').length
    const total = Math.max(messages1.length, messages2.length)

    if (total === 0) return 1

    // Base similarity from unchanged messages
    let similarity = unchanged / total

    // Adjust for modified messages (partial similarity)
    const modified = differences.filter(d => d.type === 'modified')
    for (const mod of modified) {
      if (mod.similarity !== undefined) {
        similarity += (mod.similarity / total) * 0.5 // Weight modified messages less
      }
    }

    return Math.min(1, Math.max(0, similarity))
  }

  /**
   * Calculate text similarity between two strings
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 && !text2) return 1
    if (!text1 || !text2) return 0

    // Simple word-based similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter(w => words2.has(w)))
    const union = new Set([...words1, ...words2])

    if (union.size === 0) return 1

    return intersection.size / union.size
  }

  /**
   * Find opposing information (contradictions) between branches
   */
  static async findOpposingInfo(
    branch1Id: string,
    branch2Id: string,
    conversationId: string
  ): Promise<{
    contradictions: Array<{
      branch1Message: any
      branch2Message: any
      reason: string
    }>
  }> {
    const comparison = await this.compareBranches(branch1Id, branch2Id, conversationId)

    const contradictions: Array<{
      branch1Message: any
      branch2Message: any
      reason: string
    }> = []

    // Look for modified messages with low similarity (potential contradictions)
    for (const diff of comparison.differences) {
      if (diff.type === 'modified' && diff.similarity !== undefined && diff.similarity < 0.3) {
        contradictions.push({
          branch1Message: diff.branch1Message,
          branch2Message: diff.branch2Message,
          reason: `Low similarity (${(diff.similarity * 100).toFixed(0)}%) suggests opposing viewpoints`
        })
      }
    }

    return { contradictions }
  }

  /**
   * Generate AI summary of comparison (placeholder - will be implemented with AI service)
   */
  static async generateSummary(
    comparison: ComparisonResult
  ): Promise<string> {
    // TODO: Integrate with AI service to generate summary
    // For now, return a basic summary

    const unchanged = comparison.differences.filter(d => d.type === 'unchanged').length
    const modified = comparison.differences.filter(d => d.type === 'modified').length
    const added = comparison.differences.filter(d => d.type === 'added').length
    const removed = comparison.differences.filter(d => d.type === 'removed').length

    return `Comparison Summary:
- Similarity: ${(comparison.similarity * 100).toFixed(0)}%
- Unchanged messages: ${unchanged}
- Modified messages: ${modified}
- Added messages: ${added}
- Removed messages: ${removed}

${comparison.similarity > 0.7 
  ? 'Branches are highly similar' 
  : comparison.similarity > 0.4 
  ? 'Branches have moderate differences' 
  : 'Branches are significantly different'}`
  }
}

