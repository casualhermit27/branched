# Conversational AI App - Features & Components Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Core Features](#core-features)
- [UI Components](#ui-components)
- [View Modes](#view-modes)
- [AI Models](#ai-models)
- [Branching System](#branching-system)
- [Memory System](#memory-system)
- [Persistence & Data](#persistence--data)
- [User Interface](#user-interface)
- [API Routes](#api-routes)
- [State Management](#state-management)

---

## 🎯 Overview

A sophisticated conversational AI application with advanced branching capabilities, multi-model support, and persistent conversation management. Built with Next.js, React, TypeScript, MongoDB, and React Flow.

**Key Technologies:**
- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes, MongoDB
- **Visualization**: React Flow with Dagre layout
- **State Management**: React Hooks, Context API
- **Styling**: Tailwind CSS with custom theme system

---

## ✨ Core Features

### 1. **Multi-Model AI Support**
- Select and chat with multiple AI models simultaneously
- Supported models:
  - **Best** (auto-selects optimal model)
  - Mistral Large
  - Gemini 2.5 Pro
  - GPT-4, GPT-4o (coming soon)
  - Claude 3.5 Sonnet, Claude 3 Opus (coming soon)
  - Grok-2, Perplexity Pro, LLaMA 3.1, Cohere Command, Pi, o1 Preview, DeepSeek V2, Qwen Max (coming soon)
- Single mode: Chat with one AI at a time
- Multi mode: Get responses from multiple AIs simultaneously
- Model comparison and selection interface

### 2. **Conversation Branching**
- Create branches from any message (user or AI)
- Explore alternative conversation paths
- Preserve full context up to branch point
- Visual branch hierarchy with parent-child relationships
- Nested branches support (branches from branches)
- Branch navigation and breadcrumbs
- Duplicate branch detection and warnings

### 3. **Dual View Modes**

#### **Map View** (FlowCanvas)
- Visual graph representation of conversations
- React Flow with Dagre layout algorithm
- Interactive node-based interface
- Zoom, pan, and fit-to-view controls
- MiniMap for navigation
- Node expansion/collapse
- Context linking between nodes
- Step/straight edge types for clean connections

#### **Chat View** (ChatBranchesView)
- Accordion-style conversation list
- Main conversation + nested branches
- Professional, minimal design
- Dotted line connectors showing hierarchy
- Expandable/collapsible branches
- Active branch highlighting
- Message count and timestamps
- Clean, focused conversation threads

### 4. **Memory System** (Branch-Scoped Layered Memory)
- **Global Memory**: User-level persistent facts
- **Branch Memory**: Conversation-specific facts, inherited by child branches
- **Node/Local Memory**: Short-term context from message history
- Memory inheritance across branch hierarchy
- Fact extraction from AI responses
- Memory deduplication and pruning
- Relevance scoring with depth-based decay
- Vector embeddings support (conceptual)

### 5. **Streaming Responses**
- Real-time streaming for AI responses
- Word-by-word text updates
- Streaming state management
- Multi-model streaming support
- Stop generation controls
- Streaming message finalization

### 6. **Dark/Light Mode**
- System preference detection
- Manual theme toggle
- Persistent theme preference
- Consistent theming across all components
- Smooth transitions

### 7. **Persistence & Data Management**
- MongoDB integration for conversations
- Auto-save functionality
- Conversation history management
- Export/Import conversations (JSON)
- Branch persistence with full context
- Message history preservation

---

## 🎨 UI Components

### **Core Components**

#### 1. **ChatInterface** (`chat-interface.tsx`)
- Main chat UI component
- Message display (user right, AI left)
- Text input with auto-resize
- Branch button on each message
- AI model pills display
- Streaming message indicators
- Auto-scroll management
- Message grouping for multi-model responses
- Timestamp display
- Normalized message alignment

#### 2. **FlowCanvas** (`flow-canvas.tsx`)
- React Flow-based visualization
- Node creation and management
- Edge rendering (step/straight types)
- Dagre layout algorithm
- MiniMap with custom styling
- Node interactions (click, double-click, drag)
- Branch creation logic
- Context preservation
- Streaming message handling
- Node state management (active, minimized, highlighted)
- Auto-layout and positioning

#### 3. **ChatBranchesView** (`chat-branches-view.tsx`)
- Accordion-style branch display
- Recursive tree rendering
- Main conversation card
- Branch cards with hierarchy
- Dotted line connectors
- Expand/collapse functionality
- Active branch highlighting
- Message count badges
- Timestamp display
- Delete branch functionality
- Professional minimal design

#### 4. **Sidebar** (`sidebar.tsx`)
- Three-tab interface:
  - **History**: Conversation list with date grouping
  - **Branches**: Tree view of conversation branches
  - **Settings**: App configuration
- Conversation selection
- Branch navigation
- Delete conversation functionality
- New conversation creation
- Expandable tree nodes
- Active state indicators

#### 5. **AIPills** (`ai-pills.tsx`)
- AI model selection interface
- Single mode dropdown selector
- Multi mode pill display with add/remove
- Model logos and colors
- Functional/non-functional state
- Dropdown animations
- Maximum AI limit (6 models)

### **Modal Components**

#### 1. **DeleteConfirmModal** (`delete-confirm-modal.tsx`)
- Reusable delete confirmation dialog
- Customizable title and message
- Item name display
- Destructive styling
- Cancel/Delete actions
- Backdrop blur
- Smooth animations

#### 2. **BranchWarningModal** (`branch-warning-modal.tsx`)
- Duplicate branch detection
- Warning for existing branches
- Multi-branch mode support
- Message preview
- Create/Cancel options

#### 3. **ExportImportModal** (`export-import-modal.tsx`)
- Export conversations to JSON
- Import conversations from JSON
- Data validation
- File handling

#### 4. **FocusModeModal** (`focus-mode-modal.tsx`)
- Focused conversation view
- Context timeline
- Parent/child branch navigation
- Tab-based interface

### **Navigation & Utility Components**

#### 1. **BranchNavigation** (`branch-navigation.tsx`)
- Breadcrumb navigation
- Branch hierarchy display
- Navigate to parent/main
- Visual path indicators

#### 2. **ThemeToggle** (`theme-toggle.tsx`)
- Light/Dark mode switcher
- Icon-based toggle
- System preference detection
- Persistent storage

#### 3. **TransformButton** (`transform-button.tsx`)
- Send/Stop generation button
- Loading states
- Icon animations
- Disabled states

#### 4. **Toast** (`toast.tsx`)
- Notification system
- Success/Error/Info types
- Auto-dismiss
- Stack management
- Animations

#### 5. **CommandPalette** (`command-palette.tsx`)
- Keyboard shortcut interface
- Command search
- Quick actions
- Keyboard navigation

### **Specialized Components**

#### 1. **MemoryPanel** (`memory-panel.tsx`)
- Display layered memory
- Memory context visualization
- Relevance indicators
- Memory management UI

#### 2. **ModelComparison** (`model-comparison.tsx`)
- Side-by-side model comparison
- Response evaluation
- Promote/Upvote/Downvote
- Branch comparison

#### 3. **ContextLinking** (`context-linking.tsx`)
- Visual connections between nodes
- Context flow indicators
- Relationship visualization

#### 4. **AutoBranchSuggestions** (`auto-branch-suggestions.tsx`)
- AI-powered branch suggestions
- Smart branching recommendations
- Context-aware suggestions

---

## 🔄 View Modes

### **Map View** (Default)
- **Purpose**: Visual exploration of conversation structure
- **Features**:
  - Interactive node graph
  - Zoom and pan controls
  - MiniMap navigation
  - Node expansion/collapse
  - Context linking visualization
  - Drag-and-drop node positioning
  - Fit-to-view functionality
- **Best For**: Understanding conversation flow, exploring branches visually

### **Chat View**
- **Purpose**: Focused conversation reading and interaction
- **Features**:
  - Accordion-style branch list
  - Main conversation + nested branches
  - Clean, minimal design
  - Dotted line hierarchy
  - Expandable threads
  - Active branch highlighting
- **Best For**: Reading conversations, focused chat interactions

### **View Toggle**
- Located in top-right header
- Icon-based toggle (map/chat icons)
- Only visible when branches exist
- Smooth transitions between views

---

## 🤖 AI Models

### **Available Models**

#### **Functional Models** (Active)
- **Best**: Auto-selects optimal model (star icon)
- **Mistral Large**: Purple theme
- **Gemini 2.5 Pro**: Blue theme

#### **Coming Soon** (Displayed but disabled)
- GPT-4, GPT-4o
- Claude 3.5 Sonnet, Claude 3 Opus
- Grok-2
- Perplexity Pro
- LLaMA 3.1
- Cohere Command
- Pi
- o1 Preview
- DeepSeek V2
- Qwen Max

### **Model Features**
- Custom logos and colors
- Functional status indicators
- Model metadata display
- API integration ready
- Streaming support
- Error handling

---

## 🌿 Branching System

### **Branch Creation**
- **From User Messages**: Creates branch with all context up to that point
- **From AI Messages**: Includes AI response and all previous context
- **Multi-Mode**: Automatically creates branches for each selected AI
- **Single-Mode**: Manual branch creation with AI selection

### **Branch Properties**
- **Parent Message ID**: Links to originating message
- **Parent Branch ID**: Links to parent branch (for nested branches)
- **Inherited Messages**: All messages before branch point
- **Branch Messages**: Messages specific to this branch
- **Selected AIs**: AI models active in this branch
- **Multi-Model Mode**: Whether branch uses multiple AIs
- **Position**: Visual position in map view
- **Label/Title**: Branch name (auto-generated or custom)

### **Branch Features**
- Full context preservation
- Independent conversation threads
- Nested branching (branches from branches)
- Branch deletion with confirmation
- Branch navigation
- Duplicate detection
- Warning modals for duplicates

### **Branch Visualization**
- **Map View**: Nodes connected with edges
- **Chat View**: Indented accordion with dotted lines
- **Hierarchy**: Visual parent-child relationships
- **Active State**: Highlighting for current branch

---

## 🧠 Memory System

### **Memory Layers**

#### **1. Global Memory**
- User-level persistent facts
- Stored in `global_memories` collection
- Indexed by: `userId`, `topic`, `embedding`
- Always available across all conversations
- Examples: User preferences, persistent facts

#### **2. Branch Memory**
- Conversation/branch-specific facts
- Stored in `branch_memories` collection
- Indexed by: `branchId`, `topic`, `embedding`
- Inherited by child branches
- Examples: Branch context, conversation-specific facts

#### **3. Node/Local Memory**
- Short-term context from message history
- Stored inline or in `context_cache`
- Used for immediate replies
- Last N messages context

### **Memory Operations**

#### **Inheritance**
- New branches inherit parent branch memory
- Recursive inheritance up the tree
- Memory references (not duplication)
- Depth-based relevance decay

#### **Extraction**
- Extract facts from AI responses
- Automatic fact identification
- Topic categorization
- Relevance scoring

#### **Aggregation**
- Collect memory from all layers
- Relevance filtering
- Depth-based weighting
- Context building for prompts

#### **Deduplication**
- Hash-based deduplication
- Similarity merging (cosine similarity > 0.92)
- Automatic pruning (200 entry limit)
- Relevance-based trimming

### **Memory API Routes**
- `/api/memory/inherit` - Inherit memory from parent
- `/api/memory/extract` - Extract memories from responses
- `/api/memory/context` - Get aggregated memory context
- `/api/memory/promote` - Promote branch memory to global

---

## 💾 Persistence & Data

### **MongoDB Schema**

#### **Conversation Document**
```typescript
{
  _id: ObjectId
  title: string
  mainMessages: Message[]
  branches: Branch[]
  selectedAIs: AI[]
  multiModelMode: boolean
  viewport: { x, y, zoom }
  createdAt: Date
  updatedAt: Date
}
```

#### **Branch Document**
```typescript
{
  id: string
  label: string
  parentId: string
  parentMessageId: string
  inheritedMessages: Message[]
  branchMessages: Message[]
  selectedAIs: AI[]
  multiModelMode: boolean
  isMain: boolean
  position: { x, y }
  createdAt: Date
  updatedAt: Date
}
```

#### **Message Document**
```typescript
{
  id: string
  text: string
  isUser: boolean
  timestamp: number
  parentId?: string
  children: string[]
  aiModel?: string
  groupId?: string
  isStreaming?: boolean
  streamingText?: string
}
```

### **Data Operations**
- **Auto-save**: Periodic conversation saves
- **Manual save**: On conversation changes
- **Load**: Restore conversations from MongoDB
- **Delete**: Remove conversations/branches
- **Export**: Download as JSON
- **Import**: Upload JSON files

### **State Management**
- React state for UI
- Refs for caching and guards
- MongoDB for persistence
- Local state synchronization

---

## 🎨 User Interface

### **Layout Structure**

#### **Top Bar** (Fixed)
- Left: Sidebar toggle button
- Center: Title (chat mode only)
- Right: View mode toggle, Theme toggle

#### **Sidebar** (Slide-in)
- Three tabs: History, Branches, Settings
- Conversation list with date grouping
- Branch tree view
- Settings panel

#### **Main Content Area**
- **Map View**: FlowCanvas with nodes
- **Chat View**: ChatBranchesView with accordions
- Responsive layout
- Scrollable content

#### **Bottom Indicators**
- Save status indicator
- MongoDB sync status
- Positioned above MiniMap

### **Color Scheme**

#### **Light Mode**
- Background: White/light gray
- Cards: White with subtle borders
- Text: Dark gray/black
- Accents: Purple, blue, emerald

#### **Dark Mode**
- Background: Dark gray/black
- Cards: Dark with subtle borders
- Text: Light gray/white
- Accents: Purple, blue, emerald (adjusted opacity)

### **Typography**
- Font: System fonts (San Francisco, Segoe UI, etc.)
- Sizes: Responsive text sizing
- Weights: Regular, medium, semibold, bold
- Line heights: Optimized for readability

### **Animations**
- Framer Motion for transitions
- Smooth page transitions
- Modal animations
- Button hover effects
- Loading states
- Staggered list animations

### **Responsive Design**
- Mobile-first approach
- Breakpoint-based layouts
- Touch-friendly interactions
- Adaptive spacing

---

## 🔌 API Routes

### **Conversation Routes**
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/[id]` - Get specific conversation
- `PUT /api/conversations/[id]` - Update conversation
- `DELETE /api/conversations/[id]` - Delete conversation

### **Branch Routes**
- `POST /api/branches/create` - Create branch (atomic, duplicate prevention)
- `POST /api/branches/merge` - Merge multiple branches
- `POST /api/branches/promote` - Promote branch to main
- `POST /api/branches/replay` - Replay branch conversation
- `POST /api/branches/suggest` - Get branch suggestions
- `POST /api/branches/feedback` - Submit branch feedback

### **Memory Routes**
- `POST /api/memory/inherit` - Inherit memory from parent
- `POST /api/memory/extract` - Extract memories from response
- `GET /api/memory/context` - Get aggregated memory context
- `POST /api/memory/promote` - Promote memory to global
- `PUT /api/memory` - Update memory entry
- `DELETE /api/memory` - Delete memory entry

### **Analytics Routes**
- `POST /api/analytics` - Track user interactions

---

## 🔧 State Management

### **Main State** (`page.tsx`)
- `selectedAIs`: Currently selected AI models
- `messages`: Main conversation messages
- `conversationNodes`: All conversation nodes (main + branches)
- `activeBranchId`: Currently active branch
- `multiModelMode`: Single or multi-mode
- `viewMode`: Map or chat view
- `isGenerating`: AI generation state

### **Refs & Caches**
- `currentConversationIdRef`: Current conversation ID
- `branchCacheRef`: Branch existence cache
- `creatingBranchRef`: Branch creation guard
- `branchDataRef`: Branch data storage

### **Side Effects**
- Auto-save conversations
- Restore conversations on load
- Sync with MongoDB
- Update UI on state changes

---

## 🎯 Key Interactions

### **Creating Branches**
1. Click branch icon on message
2. System checks for duplicates
3. Shows warning if duplicate exists
4. Creates branch with full context
5. Updates UI immediately
6. Saves to MongoDB

### **Sending Messages**
1. Type in textarea
2. Press Enter or click Send
3. Message appears immediately
4. AI generates response (streaming)
5. Response appears word-by-word
6. Auto-saves conversation

### **Switching Views**
1. Click view toggle in header
2. Smooth transition animation
3. Preserves active branch
4. Maintains scroll position

### **Deleting Items**
1. Click delete button
2. Confirmation modal appears
3. Shows item name and warning
4. Confirm or cancel
5. Updates UI and MongoDB

---

## 📱 Component Hierarchy

```
Home (page.tsx)
├── Sidebar
│   ├── ConversationHistory
│   ├── BranchTree
│   └── Settings
├── TopBar
│   ├── ViewToggle
│   └── ThemeToggle
├── FlowCanvas (Map View)
│   ├── ReactFlow
│   ├── MiniMap
│   ├── Controls
│   └── ChatNode
│       └── ChatInterface
└── ChatBranchesView (Chat View)
    ├── MainConversationCard
    │   └── ChatInterface
    └── BranchCards (recursive)
        └── ChatInterface

Modals (overlay)
├── DeleteConfirmModal
├── BranchWarningModal
├── ExportImportModal
└── FocusModeModal

Utilities
├── Toast (notifications)
├── CommandPalette
└── BranchNavigation
```

---

## 🚀 Future Enhancements (Planned)

- [ ] Vector database integration (Pinecone/Weaviate/pgvector)
- [ ] Advanced memory management UI
- [ ] Branch comparison tools
- [ ] Export to various formats (Markdown, PDF)
- [ ] Collaboration features
- [ ] Search across conversations
- [ ] Tagging and categorization
- [ ] Branch templates
- [ ] AI model fine-tuning
- [ ] Analytics dashboard

---

## 📝 Notes

- All components support dark/light mode
- Responsive design for mobile and desktop
- Accessibility considerations (ARIA labels, keyboard navigation)
- Performance optimizations (memoization, lazy loading)
- Error handling and user feedback
- Clean, maintainable code structure
- TypeScript for type safety

---

**Last Updated**: Current as of latest implementation
**Version**: 1.0.0

