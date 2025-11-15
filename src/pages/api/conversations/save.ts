import { NextApiRequest, NextApiResponse } from 'next'
import connectDB from '../../lib/mongodb'
import { MongoClient } from 'mongodb'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ success: false, error: 'Method not allowed' })
	}

	try {
		const { conversationId, branches, messages } = req.body

		if (!conversationId) {
			return res.status(400).json({ success: false, error: 'conversationId is required' })
		}

		await connectDB()
		const client = await MongoClient.connect(process.env.MONGODB_URI || '')
		const db = client.db(process.env.MONGODB_DB_NAME || 'branched')

		// 1. Upsert messages (deduplicated)
		const messageOps = messages.map((msg: any) => ({
			updateOne: {
				filter: { _id: msg.id },
				update: {
					$set: {
						conversationId,
						text: msg.text,
						isUser: msg.isUser,
						timestamp: msg.timestamp,
						aiModel: msg.aiModel || null,
						role: msg.isUser ? 'user' : 'assistant',
						parentId: msg.parentId || null,
						children: msg.children || [],
						nodeId: msg.nodeId || null,
						groupId: msg.groupId || null,
						updatedAt: new Date()
					},
					$setOnInsert: {
						createdAt: new Date()
					}
				},
				upsert: true
			}
		}))

		if (messageOps.length > 0) {
			await db.collection('messages').bulkWrite(messageOps)
		}

		// 2. Upsert branches
		const branchOps = branches.map((branch: any) => ({
			updateOne: {
				filter: { _id: branch.id },
				update: {
					$set: {
						conversationId,
						type: branch.type,
						label: branch.label,
						parentBranchId: branch.parentBranchId,
						branchPointMessageId: branch.branchPointMessageId,
						messageIds: branch.messageIds,
						contextSnapshot: branch.contextSnapshot,
						selectedAIs: branch.selectedAIs,
						multiModelMode: branch.multiModelMode,
						groupId: branch.groupId,
						metadata: branch.metadata,
						updatedAt: new Date()
					},
					$setOnInsert: {
						createdAt: branch.createdAt || new Date()
					}
				},
				upsert: true
			}
		}))

		if (branchOps.length > 0) {
			await db.collection('branches').bulkWrite(branchOps)
		}

		// 3. Update conversation
		await db.collection('conversations').updateOne(
			{ _id: conversationId },
			{
				$set: {
					updatedAt: new Date()
				},
				$setOnInsert: {
					createdAt: new Date(),
					title: 'New Conversation'
				}
			},
			{ upsert: true }
		)

		await client.close()

		return res.status(200).json({ success: true })
	} catch (error: any) {
		console.error('Save error:', error)
		return res.status(500).json({ success: false, error: error.message || 'Save failed' })
	}
}

