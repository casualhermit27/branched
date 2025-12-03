import { NextApiRequest, NextApiResponse } from 'next'
import connectDB from '../../../lib/mongodb'
import { Conversation } from '../../../models/conversation'

// GET /api/conversations/[id] - Get a specific conversation
async function getConversation(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    await connectDB()

    // Check if using normalized structure
    const useNormalized = req.query.normalized === 'true'

    if (useNormalized) {
      // Use normalized structure (messages and branches collections)
      const { MongoClient } = await import('mongodb')
      const client = await MongoClient.connect(process.env.MONGODB_URI || '')
      const db = client.db(process.env.MONGODB_DB_NAME || 'branched')

      // 1. Get all branches for this conversation
      const branches = await db
        .collection('branches')
        .find({ conversationId: id })
        .sort({ createdAt: 1 })
        .toArray()

      // 2. Get all message IDs from all branches
      const allMessageIds = new Set<string>()
      branches.forEach((branch: any) => {
        // Add branch messages
        if (branch.messageIds) {
          branch.messageIds.forEach((msgId: string) => allMessageIds.add(msgId))
        }
        // Add inherited messages
        if (branch.contextSnapshot?.inheritedMessageIds) {
          branch.contextSnapshot.inheritedMessageIds.forEach((msgId: string) =>
            allMessageIds.add(msgId)
          )
        }
      })

      // 3. Fetch all messages
      const messages = await db
        .collection('messages')
        .find({ _id: { $in: Array.from(allMessageIds) } })
        .sort({ timestamp: 1 })
        .toArray()

      // 4. Get conversation metadata
      const conversation = await db
        .collection('conversations')
        .findOne({ _id: id })

      await client.close()

      return res.status(200).json({
        success: true,
        data: {
          id,
          title: conversation?.title || 'Conversation',
          branches: branches.map((b: any) => ({
            ...b,
            _id: b._id.toString()
          })),
          messages: messages.map((m: any) => ({
            ...m,
            _id: m._id.toString(),
            id: m._id // Use _id as id for compatibility
          })),
          createdAt: conversation?.createdAt,
          updatedAt: conversation?.updatedAt
        }
      })
    } else {
      // Use legacy structure (single conversation document)
      const conversation = await Conversation.findById(id)

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        })
      }

      return res.status(200).json({
        success: true,
        data: conversation
      })
    }
  } catch (error: any) {
    console.error('Error getting conversation:', error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

// PUT /api/conversations/[id] - Update a conversation
async function updateConversation(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    await connectDB()

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date() // Always update the timestamp
    }

    // Only include fields that are provided
    if (req.body.title !== undefined) updateData.title = req.body.title
    if (req.body.mainMessages !== undefined) updateData.mainMessages = req.body.mainMessages
    if (req.body.selectedAIs !== undefined) updateData.selectedAIs = req.body.selectedAIs
    if (req.body.branches !== undefined) updateData.branches = req.body.branches
    if (req.body.contextLinks !== undefined) updateData.contextLinks = req.body.contextLinks
    if (req.body.collapsedNodes !== undefined) updateData.collapsedNodes = req.body.collapsedNodes
    if (req.body.minimizedNodes !== undefined) updateData.minimizedNodes = req.body.minimizedNodes
    if (req.body.activeNodeId !== undefined) updateData.activeNodeId = req.body.activeNodeId
    if (req.body.viewport !== undefined) updateData.viewport = req.body.viewport

    // Update conversation - Mongoose handles the update object directly
    const conversation = await Conversation.findByIdAndUpdate(
      id,
      updateData, // Mongoose will automatically use $set internally
      { new: true, runValidators: true } // Return updated document and run validators
    )

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      })
    }

    return res.status(200).json({
      success: true,
      data: conversation
    })
  } catch (error: any) {
    console.error('Error updating conversation:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      error
    })

    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

// DELETE /api/conversations/[id] - Delete a conversation
async function deleteConversation(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    await connectDB()

    const conversation = await Conversation.findByIdAndDelete(id)

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      })
    }

    return res.status(200).json({
      success: true,
      data: {}
    })
  } catch (error: any) {
    console.error('Error deleting conversation:', error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ success: false, error: 'Invalid conversation ID' })
  }

  switch (req.method) {
    case 'GET':
      return getConversation(req, res, id)
    case 'PUT':
      return updateConversation(req, res, id)
    case 'DELETE':
      return deleteConversation(req, res, id)
    default:
      return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
}