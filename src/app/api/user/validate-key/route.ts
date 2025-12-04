import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/mongodb'
import { User } from '@/models/user'
import { encrypt } from '@/lib/crypto'

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { provider, key } = await req.json()

        if (!provider || !key) {
            return NextResponse.json({ error: 'Missing provider or key' }, { status: 400 })
        }

        // Validate Key (Simple check by making a request)
        let isValid = false
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${key}` }
            })
            isValid = res.ok
        } else if (provider === 'anthropic') {
            const res = await fetch('https://api.anthropic.com/v1/models', {
                headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
            })
            isValid = res.ok
        } else if (provider === 'gemini') {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
            isValid = res.ok
        } else if (provider === 'mistral') {
            const res = await fetch('https://api.mistral.ai/v1/models', {
                headers: { Authorization: `Bearer ${key}` }
            })
            isValid = res.ok
        } else {
            // Unknown provider, assume valid if not empty? Or fail?
            // For now, let's assume valid to allow saving custom keys
            isValid = true
        }

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid API Key' }, { status: 400 })
        }

        // Encrypt and Save
        await connectDB()
        const encrypted = encrypt(key)

        await User.findByIdAndUpdate(session.user.id, {
            [`apiKeys.${provider}`]: {
                key: encrypted.encryptedData,
                iv: encrypted.iv
            }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Key validation error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
