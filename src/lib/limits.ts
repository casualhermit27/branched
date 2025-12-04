import { Conversation } from '@/models/conversation'
import { User } from '@/models/user'
import connectDB from '@/lib/mongodb'

export const LIMITS = {
    GUEST: {
        BRANCHES: 5,
        MESSAGES: 10
    }
}

export async function checkUsageLimit(userId: string, isGuest: boolean, type: 'branch' | 'message'): Promise<{ allowed: boolean, count: number, limit: number }> {
    await connectDB()

    if (!isGuest) {
        // For now, logged in users have no limits (or high limits)
        // We could check User.usage here if we wanted to enforce limits for free users
        return { allowed: true, count: 0, limit: Infinity }
    }

    // Guest Logic
    // We need to aggregate usage across all conversations for this guest
    const conversations = await Conversation.find({ userId })

    let totalBranches = 0
    let totalMessages = 0

    for (const conv of conversations) {
        // Count branches (nodes that are not main)
        // Legacy 'branches' array or 'nodes' map
        if (conv.nodes) {
            // If nodes is a Map, we iterate values
            // Mongoose Map is a bit special
            const nodes = conv.nodes instanceof Map ? Array.from(conv.nodes.values()) : Object.values(conv.nodes)
            totalBranches += nodes.filter((n: any) => n.id !== 'main').length
        } else if (conv.branches) {
            totalBranches += conv.branches.length
        }

        // Count messages
        // Main messages
        totalMessages += (conv.main?.messages?.length || 0)

        // Branch messages
        if (conv.nodes) {
            const nodes = conv.nodes instanceof Map ? Array.from(conv.nodes.values()) : Object.values(conv.nodes)
            nodes.forEach((n: any) => {
                totalMessages += (n.messages?.length || 0)
                // Also check inherited/branchMessages structure if different
                if (n.branchMessages) totalMessages += n.branchMessages.length
            })
        } else if (conv.branches) {
            conv.branches.forEach((b: any) => {
                totalMessages += (b.branchMessages?.length || 0)
            })
        }
    }

    if (type === 'branch') {
        return {
            allowed: totalBranches < LIMITS.GUEST.BRANCHES,
            count: totalBranches,
            limit: LIMITS.GUEST.BRANCHES
        }
    } else {
        return {
            allowed: totalMessages < LIMITS.GUEST.MESSAGES,
            count: totalMessages,
            limit: LIMITS.GUEST.MESSAGES
        }
    }
}
