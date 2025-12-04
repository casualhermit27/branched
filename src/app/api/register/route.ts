import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/mongodb'
import { cookies } from 'next/headers'
import { GUEST_COOKIE_NAME } from '@/lib/guest'
import { Conversation } from '@/models/conversation'
import { User } from '@/models/user'

export async function POST(req: Request) {
    try {
        const { email, password, name } = await req.json()

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        await connectDB()

        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        const user = await User.create({
            email,
            password: hashedPassword,
            name: name || email.split('@')[0],
            usage: {
                branchesCreated: 0,
                messagesSent: 0,
                isPremium: false
            }
        })

        // Migrate Guest Data
        const cookieStore = await cookies()
        const guestToken = cookieStore.get(GUEST_COOKIE_NAME)?.value

        if (guestToken) {
            await Conversation.updateMany(
                { userId: guestToken },
                { $set: { userId: user._id.toString() } }
            )
            console.log(`Migrated data from guest ${guestToken} to user ${user._id}`)
        }

        return NextResponse.json({ message: 'User created successfully', userId: user._id }, { status: 201 })
    } catch (error) {
        console.error('Registration error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
