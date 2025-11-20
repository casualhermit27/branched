import { NextApiRequest, NextApiResponse } from 'next'
import connectDB from '@/lib/mongodb'
import { BranchLinkManager } from '@/services/branch-link-manager'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await connectDB()

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { branchId } = req.query
  const conversationId = req.method === 'POST' ? req.body.conversationId : req.query.conversationId

  if (!branchId || typeof branchId !== 'string') {
    return res.status(400).json({ error: 'Branch ID is required' })
  }

  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'Conversation ID is required' })
  }

  try {
    const integrity = await BranchLinkManager.checkContextIntegrity(branchId, conversationId)
    return res.status(200).json(integrity)
  } catch (error: any) {
    console.error('Error checking context integrity:', error)
    return res.status(500).json({ error: error.message || 'Failed to check context integrity' })
  }
}

