'use server'

import connectDB from '@/lib/mongodb'
import { BranchLink, IBranchLink } from '@/models/branch-link'
import { Conversation } from '@/models/conversation'

export type LinkType = 'merge' | 'reference' | 'continuation' | 'alternative'

export interface CreateLinkParams {
  sourceBranchId: string
  targetBranchId: string
  linkType: LinkType
  conversationId: string
  description?: string
  weight?: number
  createdBy?: string
}

export interface LinkContext {
  sourceBranch: {
    id: string
    messages: any[]
    inheritedMessages: any[]
  }
  targetBranch: {
    id: string
    messages: any[]
    inheritedMessages: any[]
  }
  linkType: LinkType
  weight: number
}

/**
 * Branch Link Manager - Handles creation, deletion, and context management of branch links
 */
export class BranchLinkManager {
  /**
   * Create a new branch link
   */
  static async createLink(params: CreateLinkParams): Promise<IBranchLink> {
    await connectDB()

    // Validate branches exist and belong to conversation
    const conversation = await Conversation.findOne({ _id: params.conversationId })
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    // Check if link already exists
    const existingLink = await BranchLink.findOne({
      sourceBranchId: params.sourceBranchId,
      targetBranchId: params.targetBranchId,
      conversationId: params.conversationId
    })

    if (existingLink) {
      throw new Error('Link already exists between these branches')
    }

    // Prevent self-linking
    if (params.sourceBranchId === params.targetBranchId) {
      throw new Error('Cannot link a branch to itself')
    }

    const linkId = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const link = new BranchLink({
      id: linkId,
      sourceBranchId: params.sourceBranchId,
      targetBranchId: params.targetBranchId,
      linkType: params.linkType,
      conversationId: params.conversationId,
      metadata: {
        createdAt: Date.now(),
        createdBy: params.createdBy,
        description: params.description,
        weight: params.weight ?? 0.5
      }
    })

    await link.save()

    // Update branch linkedBranches arrays
    await this.updateBranchLinks(params.sourceBranchId, params.targetBranchId, params.conversationId, 'add')

    return link
  }

  /**
   * Delete a branch link
   */
  static async deleteLink(linkId: string, conversationId: string): Promise<void> {
    await connectDB()

    const link = await BranchLink.findOne({ id: linkId, conversationId })
    if (!link) {
      throw new Error('Link not found')
    }

    await BranchLink.deleteOne({ id: linkId })

    // Update branch linkedBranches arrays
    await this.updateBranchLinks(link.sourceBranchId, link.targetBranchId, conversationId, 'remove')
  }

  /**
   * Get all links for a branch
   */
  static async getBranchLinks(branchId: string, conversationId: string): Promise<{
    incoming: IBranchLink[]
    outgoing: IBranchLink[]
  }> {
    await connectDB()

    const incoming = await BranchLink.find({
      targetBranchId: branchId,
      conversationId
    }).sort({ 'metadata.createdAt': -1 })

    const outgoing = await BranchLink.find({
      sourceBranchId: branchId,
      conversationId
    }).sort({ 'metadata.createdAt': -1 })

    return { incoming, outgoing }
  }

  /**
   * Get all links for a conversation
   */
  static async getConversationLinks(conversationId: string): Promise<IBranchLink[]> {
    await connectDB()

    return await BranchLink.find({ conversationId }).sort({ 'metadata.createdAt': -1 })
  }

  /**
   * Get context for a branch (all linked branches' messages)
   */
  static async getLinkContext(branchId: string, conversationId: string): Promise<LinkContext[]> {
    await connectDB()

    const links = await BranchLink.find({
      $or: [
        { sourceBranchId: branchId, conversationId },
        { targetBranchId: branchId, conversationId }
      ]
    })

    const conversation = await Conversation.findOne({ _id: conversationId })
    if (!conversation) {
      return []
    }

    const contexts: LinkContext[] = []

    for (const link of links) {
      // Find both branches
      const sourceBranch = conversation.branches.find(b => b.id === link.sourceBranchId)
      const targetBranch = conversation.branches.find(b => b.id === link.targetBranchId)

      if (!sourceBranch || !targetBranch) continue

      contexts.push({
        sourceBranch: {
          id: link.sourceBranchId,
          messages: sourceBranch.branchMessages || [],
          inheritedMessages: sourceBranch.inheritedMessages || []
        },
        targetBranch: {
          id: link.targetBranchId,
          messages: targetBranch.branchMessages || [],
          inheritedMessages: targetBranch.inheritedMessages || []
        },
        linkType: link.linkType,
        weight: link.metadata.weight || 0.5
      })
    }

    return contexts
  }

  /**
   * Update branch linkedBranches arrays
   */
  private static async updateBranchLinks(
    sourceBranchId: string,
    targetBranchId: string,
    conversationId: string,
    operation: 'add' | 'remove'
  ): Promise<void> {
    await connectDB()

    const conversation = await Conversation.findOne({ _id: conversationId })
    if (!conversation) return

    const sourceBranch = conversation.branches.find(b => b.id === sourceBranchId)
    const targetBranch = conversation.branches.find(b => b.id === targetBranchId)

    if (sourceBranch) {
      if (!sourceBranch.linkedBranches) {
        sourceBranch.linkedBranches = { incoming: [], outgoing: [] }
      }
      if (operation === 'add') {
        if (!sourceBranch.linkedBranches.outgoing.includes(targetBranchId)) {
          sourceBranch.linkedBranches.outgoing.push(targetBranchId)
        }
      } else {
        sourceBranch.linkedBranches.outgoing = sourceBranch.linkedBranches.outgoing.filter(
          id => id !== targetBranchId
        )
      }
    }

    if (targetBranch) {
      if (!targetBranch.linkedBranches) {
        targetBranch.linkedBranches = { incoming: [], outgoing: [] }
      }
      if (operation === 'add') {
        if (!targetBranch.linkedBranches.incoming.includes(sourceBranchId)) {
          targetBranch.linkedBranches.incoming.push(sourceBranchId)
        }
      } else {
        targetBranch.linkedBranches.incoming = targetBranch.linkedBranches.incoming.filter(
          id => id !== sourceBranchId
        )
      }
    }

    await conversation.save()
  }

  /**
   * Check context integrity for a branch
   */
  static async checkContextIntegrity(branchId: string, conversationId: string): Promise<{
    score: number
    issues: string[]
  }> {
    await connectDB()

    const links = await this.getBranchLinks(branchId, conversationId)
    const conversation = await Conversation.findOne({ _id: conversationId })
    if (!conversation) {
      return { score: 0, issues: ['Conversation not found'] }
    }

    const branch = conversation.branches.find(b => b.id === branchId)
    if (!branch) {
      return { score: 0, issues: ['Branch not found'] }
    }

    const issues: string[] = []
    let score = 100

    // Check for circular links
    const visited = new Set<string>()
    const checkCircular = (currentId: string, path: string[]): boolean => {
      if (path.includes(currentId)) {
        issues.push(`Circular link detected: ${path.join(' -> ')} -> ${currentId}`)
        return true
      }
      if (visited.has(currentId)) return false
      visited.add(currentId)

      // This would need recursive checking - simplified for now
      return false
    }

    // Check for orphaned links (target branch doesn't exist)
    for (const link of links.outgoing) {
      const targetExists = conversation.branches.some(b => b.id === link.targetBranchId)
      if (!targetExists) {
        issues.push(`Orphaned link: target branch ${link.targetBranchId} not found`)
        score -= 10
      }
    }

    // Check for missing context (branches with no links but should have)
    if (links.incoming.length === 0 && links.outgoing.length === 0 && conversation.branches.length > 1) {
      // Not necessarily an issue, but could indicate missing context
    }

    // Update branch context integrity
    if (branch.contextIntegrity) {
      branch.contextIntegrity.lastChecked = Date.now()
      branch.contextIntegrity.issues = issues
      branch.contextIntegrity.score = Math.max(0, score)
    } else {
      branch.contextIntegrity = {
        lastChecked: Date.now(),
        issues,
        score: Math.max(0, score)
      }
    }

    await conversation.save()

    return { score: Math.max(0, score), issues }
  }
}

