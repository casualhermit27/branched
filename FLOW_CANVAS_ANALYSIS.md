# Flow Canvas Component Analysis

## Current State
**File Size**: ~4,760 lines  
**Complexity**: Extremely High  
**Responsibilities**: 20+ distinct features

---

## All Logic/Features Currently in flow-canvas.tsx

### 1. **Node Management** (~500 lines)
- Node creation, updates, deletion
- Node state management (minimized, collapsed, active)
- Node validation (position, dimensions)
- Node restoration from MongoDB
- Main node initialization

### 2. **Branch Creation Logic** (~800 lines) ⚠️ MOST COMPLEX
- Branch creation from messages (user/AI)
- Multi-branch creation (one per AI model)
- Single branch creation
- Branch deduplication
- Branch locking mechanism
- Context inheritance (inheritedMessages + branchMessages)
- Message deduplication
- Branch positioning calculations
- Branch node factory function
- Streaming message handling during branch creation

### 3. **Layout & Positioning** (~400 lines)
- Dagre graph layout algorithm
- Node positioning calculations
- Multi-model branch positioning
- Single branch positioning
- Child branch positioning
- Viewport fitting
- Auto-centering logic

### 4. **Viewport & Navigation** (~300 lines)
- Focus on node (smooth animations)
- Viewport management
- Zoom controls
- Pan controls
- Active node tracking
- Navigation to branches
- Overview mode

### 5. **Message Handling** (~600 lines)
- Message sending in branches
- Streaming AI responses
- Multi-model message generation
- Single-model message generation
- Message context building
- Parent chain message gathering
- Context linking between branches
- Memory context integration

### 6. **State Management** (~200 lines)
- 20+ useState hooks
- Multiple useRef hooks
- Branch-level multi-model state
- Branch selected AIs state
- Minimized/collapsed state
- Generating state
- Active/hovered state

### 7. **Search Functionality** (~100 lines)
- Search across conversations
- Search result navigation
- Search query handling

### 8. **Edge Management** (~150 lines)
- Edge creation
- Edge styling (color coding)
- Edge hover effects
- Context link edges
- Edge validation

### 9. **UI Interactions** (~200 lines)
- Node click handlers
- Node double-click (focus mode)
- Node context menu
- Edge click handlers
- Canvas click handlers
- Keyboard shortcuts

### 10. **Focus Mode** (~50 lines)
- Focus mode modal integration
- Parent/child branch navigation
- Focus mode state

### 11. **Minimap** (~100 lines)
- Minimap rendering
- Node color coding
- Minimap positioning
- Minimap interactions

### 12. **Validation & Error Handling** (~200 lines)
- Node position validation (NaN checks)
- Viewport validation
- Dimension validation
- Error recovery

### 13. **Memory Integration** (~50 lines)
- Memory context fetching
- Memory extraction
- Memory inheritance for branches

### 14. **Streaming Support** (~300 lines)
- Streaming message placeholders
- Streaming text updates
- Abort controllers
- Generation stopping
- Streaming finalization

### 15. **Restoration Logic** (~400 lines)
- MongoDB node restoration
- Conversation restoration
- Node initialization from restored data
- Edge restoration
- Layout restoration

### 16. **Branch Multi-Model Support** (~200 lines)
- Per-branch AI selection
- Per-branch multi-model toggle
- Branch AI state sync

### 17. **Context Linking** (~100 lines)
- Create context links between branches
- Remove context links
- Context link visualization

### 18. **Path Highlighting** (~100 lines)
- Path to root calculation
- Edge highlighting
- Auto-clear highlights

### 19. **Effects & Side Effects** (~500 lines)
- 15+ useEffect hooks
- Node update notifications
- State synchronization
- Auto-branch creation
- Pending branch handling

### 20. **Utility Functions** (~200 lines)
- Message deduplication
- Model deduplication
- Get messages till point
- Calculate positions
- Validation helpers

---

## Problems with Current Architecture

### 1. **Single Responsibility Violation**
- One component handles 20+ distinct features
- Impossible to test individual features
- Hard to maintain and debug

### 2. **State Management Chaos**
- 20+ useState hooks
- Complex state interdependencies
- Difficult to track state flow

### 3. **Massive useEffect Chains**
- 15+ useEffect hooks
- Complex dependency arrays
- Potential infinite loop risks

### 4. **Tight Coupling**
- All features tightly coupled
- Can't reuse logic elsewhere
- Hard to modify one feature without breaking others

### 5. **Performance Issues**
- Large component re-renders frequently
- Many unnecessary re-renders
- Complex memoization needed

### 6. **Code Duplication**
- Similar logic repeated in multiple places
- Branch creation logic duplicated
- Message handling duplicated

---

## Recommended Refactoring Strategy

### Phase 1: Extract Custom Hooks

#### 1. `useBranchManagement.ts` (~300 lines)
```typescript
// Handles all branch creation logic
- createBranchNode
- handleBranch
- branchExistsForMessage
- generateBranchId
- getMessagesTill
- deduplicateMessages
```

#### 2. `useNodeLayout.ts` (~200 lines)
```typescript
// Handles layout and positioning
- getLayoutedElements
- calculateMultiModelPositions
- calculateSingleBranchPosition
- calculateChildBranchPosition
- getBranchPosition
```

#### 3. `useViewportNavigation.ts` (~200 lines)
```typescript
// Handles viewport and navigation
- focusOnNode
- fitViewportToNodes
- handleNodeClick
- handleNodeDoubleClick
```

#### 4. `useBranchMessages.ts` (~300 lines)
```typescript
// Handles message operations in branches
- handleSendMessage
- gatherParentChainMessages
- getContextLinkedMessages
- buildContext
```

#### 5. `useNodeState.ts` (~200 lines)
```typescript
// Manages node UI state
- minimizedNodes
- collapsedNodes
- activeNodeId
- hoveredNodeId
- toggleNodeMinimize
- toggleNodeCollapse
```

#### 6. `useBranchMultiModel.ts` (~150 lines)
```typescript
// Handles branch-level multi-model
- branchSelectedAIs
- branchMultiModelModes
- handleBranchAddAI
- handleBranchRemoveAI
- handleBranchToggleMultiModel
```

#### 7. `useNodeRestoration.ts` (~200 lines)
```typescript
// Handles MongoDB restoration
- restoreNodes
- restoreEdges
- initializeFromRestored
```

#### 8. `useSearch.ts` (~100 lines)
```typescript
// Handles search functionality
- performSearch
- navigateToResult
- searchQuery state
```

#### 9. `useStreaming.ts` (~200 lines)
```typescript
// Handles streaming responses
- createStreamingMessage
- updateStreamingText
- finalizeStreaming
- handleStopGeneration
```

#### 10. `useContextLinking.ts` (~100 lines)
```typescript
// Handles context links
- createContextLink
- removeContextLink
- contextLinks state
```

### Phase 2: Extract Utility Functions

#### `utils/branch-utils.ts`
- deduplicateMessages
- deduplicateByModel
- getMessagesTill
- generateBranchId

#### `utils/layout-utils.ts`
- getLayoutedElements
- calculatePositions
- validateNodePositions

#### `utils/message-utils.ts`
- gatherParentChainMessages
- buildContext
- validateMessages

### Phase 3: Extract Sub-Components

#### `components/flow-canvas/SearchBar.tsx`
- Search input
- Search results dropdown

#### `components/flow-canvas/ContextMenu.tsx`
- Right-click context menu
- Branch actions

#### `components/flow-canvas/FlowControls.tsx`
- Zoom controls
- Fit view button
- Minimap wrapper

### Phase 4: Simplify Main Component

#### `components/flow-canvas.tsx` (Target: ~500 lines)
```typescript
// Main orchestrator component
- Uses all custom hooks
- Renders ReactFlow
- Handles high-level coordination
- Minimal state management
```

---

## Refactoring Benefits

### 1. **Maintainability**
- Each feature in its own file
- Easy to locate and fix bugs
- Clear separation of concerns

### 2. **Testability**
- Test hooks independently
- Test utilities in isolation
- Mock dependencies easily

### 3. **Reusability**
- Hooks can be reused in other components
- Utilities can be shared
- Components can be composed

### 4. **Performance**
- Smaller components re-render less
- Better memoization opportunities
- Easier to optimize

### 5. **Developer Experience**
- Easier to understand codebase
- Faster onboarding
- Less cognitive load

---

## Migration Strategy

### Step 1: Create Hook Structure
1. Create `hooks/flow-canvas/` directory
2. Extract one hook at a time
3. Test each hook independently
4. Gradually replace in main component

### Step 2: Extract Utilities
1. Create `utils/flow-canvas/` directory
2. Move pure functions
3. Add unit tests
4. Update imports

### Step 3: Extract Components
1. Create `components/flow-canvas/` directory
2. Extract UI components
3. Update imports
4. Test rendering

### Step 4: Refactor Main Component
1. Replace logic with hooks
2. Simplify state management
3. Remove duplicate code
4. Add integration tests

---

## Estimated Refactoring Time

- **Phase 1 (Hooks)**: 8-12 hours
- **Phase 2 (Utils)**: 2-4 hours
- **Phase 3 (Components)**: 4-6 hours
- **Phase 4 (Main Component)**: 4-6 hours
- **Testing & Bug Fixes**: 4-8 hours

**Total**: ~22-36 hours

---

## Priority Order

1. **HIGH**: Extract branch creation logic (most complex)
2. **HIGH**: Extract message handling (frequently changed)
3. **MEDIUM**: Extract layout logic (stable but complex)
4. **MEDIUM**: Extract viewport navigation (user-facing)
5. **LOW**: Extract UI components (cosmetic)

---

## Notes

- Keep backward compatibility during migration
- Write tests before refactoring
- Refactor incrementally
- Don't change functionality, only structure
- Use TypeScript strictly
- Document each hook/utility

