import { NextApiRequest, NextApiResponse } from 'next'
import connectDB from '@/lib/mongodb'
import { BranchLinkManager } from '@/services/branch-link-manager'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await connectDB()

  const { branchId } = req.query
  const { conversationId } = req.body

  if (!branchId || typeof branchId !== 'string') {
    return res.status(400).json({ error: 'Branch ID is required' })
  }

  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'Conversation ID is required' })
  }

  try {
    if (req.method === 'GET') {
      const links = await BranchLinkManager.getBranchLinks(branchId, conversationId)
      return res.status(200).json(links)
    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error fetching branch links:', error)
    return res.status(500).json({ error: 'Failed to fetch branch links' })
  }
}

