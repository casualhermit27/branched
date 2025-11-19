import { NextApiRequest, NextApiResponse } from 'next'
import connectDB from '@/lib/mongodb'
import { BranchLinkManager } from '@/services/branch-link-manager'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await connectDB()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sourceBranchId, targetBranchId, linkType, conversationId, description, weight, createdBy } = req.body

  if (!sourceBranchId || !targetBranchId || !linkType || !conversationId) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const link = await BranchLinkManager.createLink({
      sourceBranchId,
      targetBranchId,
      linkType,
      conversationId,
      description,
      weight,
      createdBy
    })

    return res.status(201).json(link)
  } catch (error: any) {
    console.error('Error creating branch link:', error)
    return res.status(500).json({ error: error.message || 'Failed to create branch link' })
  }
}

