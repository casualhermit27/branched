# Context Service Pattern Architecture

## Overview

The FlowCanvas now uses a **Context Service Pattern** with lightweight snapshots instead of duplicating messages across branches. This dramatically reduces memory usage and improves performance.

## Key Components

### 1. ContextManager (`context-manager.ts`)
- **Single source of truth** for all context operations
- Creates lightweight snapshots (just message IDs, not full messages)
- Resolves IDs to full messages when needed
- Handles memory context and linked branches

### 2. MessageStore (`message-store.ts`)
- **Global message store** - messages stored once, referenced everywhere
- O(1) lookups using Map
- No duplication - 100 branches = 100 snapshots, not 100 × N messages

### 3. BranchStore (`branch-store.ts`)
- Stores branch contexts with lightweight snapshots
- Each branch only stores:
  - `contextSnapshot` (just IDs)
  - `branchMessageIds` (IDs of messages created in this branch)
  - Metadata (selectedAIs, etc.)

## Architecture Flow

### Creating a Branch

```typescript
// 1. Create lightweight snapshot
const snapshot = contextManager.createContextSnapshot(
  parentBranchId,
  branchPointMessageId
)
// Returns: { branchPointMessageId, inheritedMessageIds: [id1, id2...], timestamp }

// 2. Create branch context
const branchContext: BranchContext = {
  branchId,
  parentBranchId,
  contextSnapshot: snapshot,  // Just IDs!
  branchMessageIds: [],
  metadata: { selectedAIs }
}

// 3. Store branch
branchStore.set(branchContext)

// 4. Add initial AI response
const aiMessage = createAIMessage(...)
messageStore.set(aiMessage)  // Store once
branchStore.addMessage(branchId, aiMessage.id)  // Just reference ID
```

### Displaying a Branch

```typescript
// Get messages for display (resolves IDs to full messages)
const messages = contextManager.getContextForDisplay(branchId)
// Returns: [...inheritedMessages, ...branchMessages]
```

### Sending a Message in Branch

```typescript
// 1. Create user message
const userMessage = createMessage(text, branchId)
messageStore.set(userMessage)  // Store once
branchStore.addMessage(branchId, userMessage.id)  // Just reference

// 2. Get FULL context for AI (with memory)
const fullContext = await contextManager.getFullContext(branchId)

// 3. Call AI
const aiResponse = await aiService.generate(fullContext)

// 4. Store AI response
messageStore.set(aiResponse)  // Store once
branchStore.addMessage(branchId, aiResponse.id)  // Just reference
```

## Benefits

✅ **No Duplication** - Messages stored once, referenced everywhere
✅ **Memory Efficient** - 100 branches = 100 snapshots, not 100 × N messages
✅ **Fast Lookups** - O(1) instead of array scanning
✅ **Easy Updates** - Update message once, reflects everywhere
✅ **MongoDB Friendly** - Snapshot is tiny JSON
✅ **Scalable** - Can have 1000s of branches

## MongoDB Schema

### Message Collection
```json
{
  "_id": "msg-123",
  "text": "Hello",
  "isUser": true,
  "timestamp": 1234567890,
  "aiModel": null
}
```

### Branch Collection
```json
{
  "_id": "branch-456",
  "conversationId": "conv-789",
  "parentBranchId": "main",
  "contextSnapshot": {
    "branchPointMessageId": "msg-100",
    "inheritedMessageIds": ["msg-1", "msg-2", "msg-100"],
    "timestamp": 1234567890
  },
  "branchMessageIds": ["msg-101", "msg-102"],
  "metadata": {
    "selectedAIs": [...],
  }
}
```

## Migration Notes

The `use-branch-management.ts` hook has been refactored to use the ContextManager pattern. All context operations are now handled through the ContextManager, making the code cleaner and more efficient.

## Usage

```typescript
import { useContextManager } from '@/components/flow-canvas/context-provider'
import { messageStore } from '@/components/flow-canvas/message-store'
import { branchStore } from '@/components/flow-canvas/branch-store'

// In component
const contextManager = useContextManager()

// Get messages for display
const messages = contextManager.getContextForDisplay(branchId)

// Get full context for AI
const fullContext = await contextManager.getFullContext(branchId)
```

