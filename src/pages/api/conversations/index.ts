import { NextApiRequest, NextApiResponse } from 'next'
import connectDB from '../../../lib/mongodb'
import { Conversation } from '../../../models/conversation'

// GET /api/conversations - Get all conversations
async function getConversations(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectDB()
    
    // Get all conversations, sorted by updatedAt (newest first)
    const conversations = await Conversation.find({})
      .sort({ updatedAt: -1 })
      .limit(50) // Limit to 50 most recent conversations
    
    return res.status(200).json({
      success: true,
      data: conversations
    })
  } catch (error: any) {
    console.error('Error getting conversations:', error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

// POST /api/conversations - Create a new conversation
async function createConversation(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectDB()
    
    console.log('Creating new conversation with data:', {
      hasBody: !!req.body,
      title: req.body?.title,
      mainMessagesCount: req.body?.mainMessages?.length,
      selectedAIsCount: req.body?.selectedAIs?.length,
      branchesCount: req.body?.branches?.length
    })
    
    // Create conversation with data from request body
    const conversation = await Conversation.create({
      title: req.body.title || 'New Conversation',
      mainMessages: req.body.mainMessages || [],
      selectedAIs: req.body.selectedAIs || [],
      branches: req.body.branches || [],
      contextLinks: req.body.contextLinks || [],
      collapsedNodes: req.body.collapsedNodes || [],
      minimizedNodes: req.body.minimizedNodes || [],
      activeNodeId: req.body.activeNodeId,
      viewport: req.body.viewport || { x: 0, y: 0, zoom: 1 }
    })
    
    console.log('✅ Created new conversation:', conversation._id)
    
    return res.status(201).json({
      success: true,
      data: conversation
    })
  } catch (error: any) {
    console.error('Error creating conversation:', error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

// PUT /api/conversations - Update a conversation
async function updateConversation(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectDB()
    
    const conversationId = req.query.id || req.body.id
    
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'No conversation ID provided'
      })
    }
    
    console.log(`Updating conversation ${conversationId} with data:`, {
      hasBody: !!req.body,
      title: req.body?.title,
      mainMessagesCount: req.body?.mainMessages?.length,
      selectedAIsCount: req.body?.selectedAIs?.length,
      branchesCount: req.body?.branches?.length,
      branchIds: req.body?.branches?.map((b: any) => b.id)
    })
    
    // Prepare update data
    const updateData: any = {}
    
    // Only include fields that are provided
    if (req.body.title !== undefined) updateData.title = req.body.title
    if (req.body.branches !== undefined) updateData.branches = req.body.branches
    if (req.body.contextLinks !== undefined) updateData.contextLinks = req.body.contextLinks
    if (req.body.collapsedNodes !== undefined) updateData.collapsedNodes = req.body.collapsedNodes
    if (req.body.minimizedNodes !== undefined) updateData.minimizedNodes = req.body.minimizedNodes
    if (req.body.activeNodeId !== undefined) updateData.activeNodeId = req.body.activeNodeId
    if (req.body.viewport !== undefined) updateData.viewport = req.body.viewport
    
    // Handle main messages - support both formats
    if (req.body.main?.messages !== undefined) {
      updateData.main = {
        messages: req.body.main.messages || [],
        selectedAIs: req.body.main.selectedAIs || req.body.selectedAIs || []
      }
    } else {
      // Legacy format
      if (req.body.mainMessages !== undefined) updateData.mainMessages = req.body.mainMessages
      if (req.body.selectedAIs !== undefined) updateData.selectedAIs = req.body.selectedAIs
    }
    
    // Update conversation
    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      updateData,
      { new: true } // Return updated document
    )
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      })
    }
    
    console.log(`✅ Updated conversation ${conversationId}`)
    console.log(`📦 Saved branches count:`, conversation.branches?.length || 0)
    if (conversation.branches && conversation.branches.length > 0) {
      console.log(`📦 Saved branch IDs:`, conversation.branches.map((b: any) => ({ id: b.id, isMain: b.isMain, messagesCount: b.messages?.length || 0 })))
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getConversations(req, res)
    case 'POST':
      return createConversation(req, res)
    case 'PUT':
      return updateConversation(req, res)
    default:
      return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
}