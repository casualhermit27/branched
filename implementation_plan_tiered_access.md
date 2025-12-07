# Implementation Plan: Tiered Access & Credit System (Zero Risk Model)

This plan details how to transition the current client-side API architecture to a secure, tiered server-side architecture. This ensures we can offer a "Free Tier" using hardcoded server keys while monetizing "Pro" models via a credit system.

## 1. Database Schema Updates
We need to track user credits and usage limits.

### Action: Update `src/models/User.ts`
Add the following fields to the User schema:
- `tier`: Enum `['free', 'pro']` (Default: 'free')
- `credits`: Number (Default: 0 for Free, 1000 for Pro)
- `dailyFreeUsage`: Number (Tracks daily usage for free tier throttling)
- `lastDailyReset`: Date (To reset `dailyFreeUsage`)

```typescript
// Proposed Interface Extension
interface IUser extends Document {
  // ... existing fields
  tier: 'free' | 'pro';
  credits: number;
  dailyFreeUsage: number;
  lastDailyReset: Date;
}
```

## 2. Backend Infrastructure (The "Gateway")
We will move direct API calls from the client (where keys are exposed) to a secure server-side route.

### Action: Create `src/app/api/chat/route.ts`
This route will be the single entry point for all chat generation.

**Logic Flow:**
1.  **Auth Check:** Identify the user (Session) or check for "Guest" status.
2.  **BYOK Check:** Look for `x-api-key` header.
    *   **If Present:** SKIP all credit/limit checks. Proxy the request to the provider using the User's Key.
3.  **Managed Tier Check (No BYOK):**
    *   **Fetch User Profile** from DB.
    *   **Daily Limit Check (Free Tier):** If `dailyFreeUsage > 50` AND `tier === 'free'`, return 402 "Daily limit reached".
    *   **Credit Check (Pro Models):**
        *   If Model is `gpt-4o` / `claude-3-5-sonnet`: Check if `credits >= 1`.
            *   **If Yes:** Deduct 1 credit, proceed using **Server-Side Enviroment Variables** (Secure Keys).
            *   **If No:** Return 402 "Insufficient Credits".
        *   If Model is `gemini-1.5-flash` / `llama-3`:
            *   Free charge (0 credits). Proceed using Secure Keys.

## 3. Client-Side Service Adaptation
Refactor `src/services/ai-api.ts` to stop calling providers directly and instead call our new Gateway.

### Action: Modify `src/services/ai-api.ts`
- **Current:** `fetch('https://api.anthropic.com/...')`
- **New:** `fetch('/api/chat', { body: { model, message, ... } })`
- **BYOK Support:** If the user has entered a custom key in settings, attach it as `x-api-key` header.

## 4. Frontend "Guest" Limits (Local Storage)
For users who are not logged in.

### Action: Update `src/hooks/use-conversation-page-effects.ts` (or similar)
- Implement a `useGuestLimits` hook.
- Store `guest_usage_count` in `localStorage`.
- **Limit:** 10 messages total.
- **Enforcement:** If limit reached, disable input and show "Sign Up" modal.

## 5. UI/UX Enhancements ("The Upsell")

### Action: Update `src/components/ai-pills.tsx`
- Add a visual "Lock" icon 🔒 to Pro models (GPT-4o, Claude 3.5) if the user is on Free tier.
- **Click Behavior:**
    *   **Free Model:** Selects immediately.
    *   **Pro Model (Locked):** Opens the **Upsell Modal**.

### Action: Create `src/components/upsell-modal.tsx`
- **Title:** "Unlock Claude 3.5 Sonnet"
- **Option A (Pro):** "Subscribe for $20/mo" (1000 Credits)
- **Option B (BYOK):** "Enter your Anthropic API Key" (Free, Unlimited)

## 6. Implementation Steps Summary
1.  **DB:** Update `User.ts`.
2.  **API:** Build `src/app/api/chat/route.ts` with rate-limiting & credit deduction logic.
3.  **Service:** Point `ai-api.ts` to the new API route.
4.  **UI:** Add Lock icons in `ai-pills`, create Upsell Modal, and implement Guest blocking.
