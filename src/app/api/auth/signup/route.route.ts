import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/mongodb'
import { User } from '@/models/User'

export async function POST(req: Request) {
    try {
        const { email, password, name } = await req.json()

        if (!email || !password) {
            return NextResponse.json(
                { message: 'Missing required fields' },
                { status: 400 }
            )
        }

        await connectDB()

        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return NextResponse.json(
                { message: 'User already exists' },
                { status: 409 }
            )
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await User.create({
            email,
            name: name || email.split('@')[0],
            password: hashedPassword,
        })

        return NextResponse.json(
            { message: 'User created successfully', userId: user._id },
            { status: 201 }
        )
    } catch (error) {
        console.error('Signup error:', error)
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        )
    }
}
