import { NextApiRequest, NextApiResponse } from 'next'
import connectDB from '@/lib/mongodb'
import { BranchLinkManager } from '@/services/branch-link-manager'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await connectDB()

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { linkId } = req.query
  const { conversationId } = req.body

  if (!linkId || typeof linkId !== 'string') {
    return res.status(400).json({ error: 'Link ID is required' })
  }

  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'Conversation ID is required' })
  }

  try {
    await BranchLinkManager.deleteLink(linkId, conversationId)
    return res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('Error deleting branch link:', error)
    return res.status(500).json({ error: error.message || 'Failed to delete branch link' })
  }
}

