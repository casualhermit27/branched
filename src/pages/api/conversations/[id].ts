import { NextApiRequest, NextApiResponse } from 'next'
import connectDB from '../../../lib/mongodb'
import { Conversation } from '../../../models/conversation'

// GET /api/conversations/[id] - Get a specific conversation
async function getConversation(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    await connectDB()
    
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
    
    console.log(`Updating conversation ${id} with data:`, {
      hasBody: !!req.body,
      title: req.body?.title,
      mainMessagesCount: req.body?.mainMessages?.length,
      selectedAIsCount: req.body?.selectedAIs?.length,
      branchesCount: req.body?.branches?.length
    })
    
    // Prepare update data
    const updateData: any = {}
    
    // Only include fields that are provided
    if (req.body.title !== undefined) updateData.title = req.body.title
    if (req.body.mainMessages !== undefined) updateData.mainMessages = req.body.mainMessages
    if (req.body.selectedAIs !== undefined) updateData.selectedAIs = req.body.selectedAIs
    if (req.body.multiModelMode !== undefined) updateData.multiModelMode = req.body.multiModelMode
    if (req.body.branches !== undefined) updateData.branches = req.body.branches
    if (req.body.contextLinks !== undefined) updateData.contextLinks = req.body.contextLinks
    if (req.body.collapsedNodes !== undefined) updateData.collapsedNodes = req.body.collapsedNodes
    if (req.body.minimizedNodes !== undefined) updateData.minimizedNodes = req.body.minimizedNodes
    if (req.body.activeNodeId !== undefined) updateData.activeNodeId = req.body.activeNodeId
    if (req.body.viewport !== undefined) updateData.viewport = req.body.viewport
    
    // Update conversation
    const conversation = await Conversation.findByIdAndUpdate(
      id,
      updateData,
      { new: true } // Return updated document
    )
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      })
    }
    
    console.log(`✅ Updated conversation ${id}`)
    
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
    
    console.log(`✅ Deleted conversation ${id}`)
    
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