# Implementation Plan: Authentication, BYOK, and Usage Limits

## 1. Authentication & Session Management
We will use **NextAuth.js (v5)** for robust authentication and session management. This provides secure, persistent sessions and supports multiple providers.

### 1.1. Setup NextAuth.js
- **Install Dependencies**: `npm install next-auth@beta @auth/mongodb-adapter`
- **Configuration**: Create `auth.ts` (or `src/app/api/auth/[...nextauth]/route.ts`).
- **Providers**:
  - **Google / GitHub**: Standard OAuth providers.
  - **Email (Magic Links)**: For passwordless login (optional, but good for "just works").
- **Database Adapter**: Use `@auth/mongodb-adapter` to store User, Session, and Account data directly in your existing MongoDB.

### 1.2. Session Persistence
- NextAuth handles "stay logged in" by default using secure cookies and database sessions.
- **Session Strategy**: Use `"database"` strategy. This ensures that if you delete a session from the DB, the user is logged out immediately (good for security).

## 2. Database Schema Updates
We need to update/create schemas to support Users, Keys, and Usage Tracking.

### 2.1. User Schema (New)
This will be managed mostly by NextAuth, but we will extend it.
```typescript
interface IUser {
  _id: string;
  name: string;
  email: string;
  image?: string;
  emailVerified?: Date;
  // Custom fields
  apiKeys: {
    openai?: { key: string; iv: string }; // Encrypted
    anthropic?: { key: string; iv: string };
    google?: { key: string; iv: string };
    // ... others
  };
  usage: {
    branchesCreated: number;
    messagesSent: number;
    isPremium: boolean;
  };
  createdAt: Date;
}
```

### 2.2. Conversation Schema Update
Ensure `userId` is indexed and required for non-guest data.
```typescript
// src/models/conversation.ts
ConversationSchema.index({ userId: 1 }); // For fast lookups
```

## 3. Data Isolation Strategy
- **API Layer**: All API routes (`/api/conversations`, `/api/chat`, etc.) must be protected.
- **Logic**:
  ```typescript
  const session = await auth();
  const userId = session?.user?.id || getGuestId(req);
  
  // Query
  const conversations = await Conversation.find({ userId });
  ```
- **Guest ID**: For non-logged-in users, generate a persistent UUID stored in a `guest_token` cookie.

## 4. BYOK (Bring Your Own Key) Integration
Securely managing user API keys.

### 4.1. Key Storage (Encryption)
- **Never store keys in plain text.**
- Create a utility `src/lib/crypto.ts` using Node.js `crypto` module (AES-256-GCM).
- **Encrypt**: `encrypt(apiKey) -> { content, iv }`
- **Decrypt**: `decrypt(content, iv) -> apiKey`

### 4.2. Key Validation Endpoint
Create `src/app/api/user/validate-key/route.ts`.
- **Input**: `{ provider: 'openai', key: 'sk-...' }`
- **Process**:
  1. Make a minimal request to the provider (e.g., list models or simple chat completion).
  2. If 200 OK -> Return Valid.
  3. If 401/403 -> Return Invalid.
- **Action**: If valid, encrypt and update `User.apiKeys` in DB.

### 4.3. Integration in Chat Flow
Modify `src/services/ai-service.ts` (or equivalent backend handler):
1. **Check Request**: Did the frontend send a temporary key?
2. **Check DB**: Does the logged-in user have a saved key for this model?
   - `const user = await User.findById(userId);`
   - `const apiKey = decrypt(user.apiKeys[provider]);`
3. **Fallback**: Use system env var key (if allowed/configured).

## 5. Usage Limits (Freemium Model)
Enforcing the 5 branches / 10 messages limit for guests.

### 5.1. Tracking Usage
- **Guests**: Track usage on the `Conversation` objects associated with the `guest_token`.
  - Count total branches across all conversations for this guest ID.
  - Count total messages.
- **Logged-in Users**: Track in `User.usage` (optional, if we want limits for free accounts too).

### 5.2. Enforcement Middleware
In your API routes (e.g., `/api/branch/create`, `/api/chat/send`):
```typescript
const isGuest = !session?.user;

if (isGuest) {
  const branchCount = await countGuestBranches(guestId);
  if (branchCount >= 5) {
    return NextResponse.json({ error: 'LIMIT_REACHED', type: 'branch' }, { status: 403 });
  }
  // Same for messages
}
```

### 5.3. UI Handling
- **Frontend**: Handle the `403 LIMIT_REACHED` error.
- **Action**: Show a "Sign Up to Continue" modal.
- **Blocker**: Disable input/branching buttons if local state indicates limit reached (optimistic check).

## 6. Migration (Guest -> User)
When a user finally signs up, we must move their work.

### 6.1. The "Merge" Hook
- On successful login (NextAuth callback `signIn` or custom hook after login):
  1. Read `guest_token` cookie.
  2. Find all `Conversation`s where `userId === guest_token`.
  3. Update them: `userId = new_user_id`.
  4. Clear `guest_token`.

## 7. Step-by-Step Execution Plan

1.  **Phase 1: Auth Foundation**
    - Install NextAuth.
    - Setup Google/GitHub providers.
    - Create `User` model in MongoDB.
    - Protect a test route.

2.  **Phase 2: Data Isolation**
    - Implement `guest_token` logic (middleware or util).
    - Update all `Conversation` queries to filter by `userId` (Session ID or Guest ID).
    - Verify users only see their own data.

3.  **Phase 3: Usage Limits**
    - Implement usage counting logic.
    - Add checks in API routes.
    - Create "Limit Reached" Modal in UI.

4.  **Phase 4: BYOK & Security**
    - Implement Encryption utils.
    - Create Validation API.
    - Update Chat Backend to fetch/decrypt user keys.
    - Build "API Keys" settings UI with validation feedback.

5.  **Phase 5: Polish**
    - Guest-to-User data migration.
    - UI refinements (User avatar, Logout button).
