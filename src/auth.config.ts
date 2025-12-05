import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    pages: {
        signIn: '/', // Redirect to home where we can show modal
        error: '/',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            // Allow access to everything by default
            // We will handle protection logic in the app
            return true
        },
        session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub
            }
            return session
        },
        jwt({ token, user }) {
            if (user) {
                token.sub = user.id
            }
            return token
        }
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig
