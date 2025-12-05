import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import connectDB from "@/lib/mongodb"
import { User } from "@/models/User"
import bcrypt from "bcryptjs"

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null

                try {
                    await connectDB()
                    const user = await User.findOne({ email: credentials.email })
                    if (!user || !user.password) return null

                    const passwordsMatch = await bcrypt.compare(
                        credentials.password as string,
                        user.password
                    )

                    if (passwordsMatch) {
                        return {
                            id: user._id.toString(),
                            name: user.name,
                            email: user.email,
                            image: user.image,
                        }
                    }
                } catch (error) {
                    console.error("Auth error:", error)
                    return null
                }
                return null
            },
        }),
    ],
})
