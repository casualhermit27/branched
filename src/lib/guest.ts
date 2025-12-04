import { v4 as uuidv4 } from 'uuid'
import { NextApiRequest, NextApiResponse } from 'next'
import { cookies } from 'next/headers'

export const GUEST_COOKIE_NAME = 'guest_token'

export function getGuestIdFromReq(req: NextApiRequest): string | null {
    return req.cookies[GUEST_COOKIE_NAME] || null
}

export function setGuestId(res: NextApiResponse, guestId: string) {
    res.setHeader('Set-Cookie', `${GUEST_COOKIE_NAME}=${guestId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`) // 1 year
}

export function generateGuestId(): string {
    return uuidv4()
}

// For App Router / Server Actions
export async function getGuestIdServer(): Promise<string | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get(GUEST_COOKIE_NAME)
    return token?.value || null
}
