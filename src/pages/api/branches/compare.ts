import { NextApiRequest, NextApiResponse } from 'next'
import connectDB from '@/lib/mongodb'
import { BranchComparator } from '@/services/branch-comparator'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await connectDB()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { branchIds, conversationId, includeSummary, findOpposing } = req.body

  if (!branchIds || !Array.isArray(branchIds) || branchIds.length < 2) {
    return res.status(400).json({ error: 'At least 2 branch IDs are required' })
  }

  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'Conversation ID is required' })
  }

  try {
    let results

    if (branchIds.length === 2) {
      // Compare two branches
      const comparison = await BranchComparator.compareBranches(
        branchIds[0],
        branchIds[1],
        conversationId
      )

      // Add summary if requested
      if (includeSummary) {
        comparison.summary = await BranchComparator.generateSummary(comparison)
      }

      // Find opposing info if requested
      if (findOpposing) {
        const opposing = await BranchComparator.findOpposingInfo(
          branchIds[0],
          branchIds[1],
          conversationId
        )
        results = { comparison, opposing }
      } else {
        results = { comparison }
      }
    } else {
      // Compare multiple branches
      const comparisons = await BranchComparator.compareMultipleBranches(
        branchIds,
        conversationId
      )

      // Add summaries if requested
      if (includeSummary) {
        for (const comp of comparisons) {
          comp.summary = await BranchComparator.generateSummary(comp)
        }
      }

      results = { comparisons }
    }

    return res.status(200).json(results)
  } catch (error: any) {
    console.error('Error comparing branches:', error)
    return res.status(500).json({ error: error.message || 'Failed to compare branches' })
  }
}

