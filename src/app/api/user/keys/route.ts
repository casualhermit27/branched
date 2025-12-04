import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { User } from '@/models/user'
import { decrypt } from '@/lib/crypto'

export async function GET(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await connectDB()
        const user = await User.findById(session.user.id)

        if (!user || !user.apiKeys) {
            return NextResponse.json({ keys: {} })
        }

        const keys: Record<string, string> = {}

        // Decrypt keys
        if (user.apiKeys instanceof Map) {
            user.apiKeys.forEach((value: any, key: string) => {
                if (value && value.key && value.iv) {
                    try {
                        keys[key] = decrypt({ encryptedData: value.key, iv: value.iv })
                    } catch (e) {
                        console.error(`Failed to decrypt key for ${key}`, e)
                    }
                }
            })
        } else {
            // Handle if it's a plain object (though Schema defines Map)
            for (const [provider, data] of Object.entries(user.apiKeys)) {
                if (data && (data as any).key && (data as any).iv) {
                    try {
                        keys[provider] = decrypt({ encryptedData: (data as any).key, iv: (data as any).iv })
                    } catch (e) {
                        console.error(`Failed to decrypt key for ${provider}`, e)
                    }
                }
            }
        }

        return NextResponse.json({ keys })
    } catch (error: any) {
        console.error('Error fetching keys:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
