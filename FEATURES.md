# Features & Implementation

A minimal, aesthetic conversation tree app with multi-AI support and infinite branching capabilities.

---

## 🎯 **COMPLETE APPLICATION OVERVIEW**

### **Frontend (UI/UX)**
- **Framework**: Next.js 15.5.4 with App Router (Turbopack)
- **Language**: TypeScript (100% type safety)
- **Styling**: Tailwind CSS v3.4.0
- **UI Components**: ShadCN UI + Radix UI primitives
- **Animations**: Framer Motion
- **Icons**: Phosphor Icons (@phosphor-icons/react)
- **Flow Diagram**: React Flow with Dagre automatic layout
- **State Management**: React hooks (useState, useRef, useCallback)

### **Backend**
- **No Backend Required**: Pure frontend application
- **AI Integration**: Simulated AI responses (no actual API calls)
- **Data Storage**: Client-side only (React state)
- **File Structure**: Component-based architecture

### **Core Features**
1. **Multi-AI Selection System** - Choose from 8+ AI models with custom logos
2. **Single/Multi Mode Toggle** - One AI or multiple AIs simultaneously  
3. **Infinite Conversation Branching** - Branch from any message infinitely
4. **Visual Tree Structure** - React Flow canvas with automatic Dagre layout
5. **Context Preservation** - Full conversation history in each branch
6. **Enhanced Text Input** - Multi-line textarea with auto-resize
7. **Smart Positioning** - No overlaps, clean hierarchical layout
8. **Advanced Search & Navigation** - Real-time search across all conversations
9. **Collapsible Tree Management** - Right-click to collapse/expand branches
10. **Minimize/Restore Windows** - Space-efficient window management

### **Technical Architecture**
```
src/
├── app/
│   ├── page.tsx              # Main orchestrator & state management
│   ├── layout.tsx            # Root layout with metadata
│   └── globals.css           # Global styles & Tailwind config
├── components/
│   ├── ai-pills.tsx          # AI selection dropdown & pills
│   ├── chat-interface.tsx    # Message display & input bar
│   ├── chat-node.tsx         # Custom React Flow node component
│   ├── conversation-canvas.tsx # Canvas wrapper component
│   ├── export-import-modal.tsx # Data export/import functionality
│   ├── focus-mode-modal.tsx  # Focus mode for individual nodes
│   ├── flow-canvas.tsx       # React Flow wrapper & Dagre layout
│   ├── sidebar.tsx           # Conversation tree sidebar
│   ├── transform-button.tsx  # Canvas transformation controls
│   └── zoomable-canvas.tsx   # Zoom and pan controls
├── lib/
│   └── utils.ts              # Utility functions
└── services/
    ├── ai-api.ts             # AI service integration
    └── conversation-export.ts # Export/import functionality
```

### **Key Dependencies**
- `next` - React framework
- `react` - UI library
- `typescript` - Type safety
- `tailwindcss` - Styling
- `@radix-ui/*` - UI primitives
- `framer-motion` - Animations
- `@phosphor-icons/react` - Icons
- `reactflow` - Flow diagram
- `dagre` - Automatic layout algorithm

---

## 🎯 Core Features

### AI Selection System
- **Default "Best" Model**: App starts with "Best" AI model selected by default
- **Custom Best Model Logo**: Minimal geometric logo with checkmark pattern representing excellence
- **Single Mode Dropdown**: Clean dropdown to select one AI model at a time
- **Multi Mode Pills**: Pill-based interface to select multiple AI models
- **Add AI Button**: Click "+" button in multi mode to add more AI models
- **Real Logos**: Authentic SVG logos for each AI model:
  - **Best Model**: Custom geometric logo with purple checkmark pattern
  - **OpenAI**: ChatGPT, GPT-4, GPT-3.5 logos
  - **Anthropic**: Claude, Claude Sonnet, Claude Opus logos
  - **Google**: Gemini, Gemini Pro logos
  - **xAI**: Grok, Grok 2 logos
  - **Meta**: Llama 3, Llama 3.1 logos
  - **Mistral AI**: Mistral, Mixtral logos
  - **Cohere**: Command R+ logos
  - **Perplexity**: Perplexity AI logos
- **Remove AI**: Click "×" on any pill to remove that AI model
- **Logo Consistency**: Same company logos used for different model versions

### Conversation Modes
- **Single Mode** (Default): Send message to one selected AI at a time
  - Shows dropdown selector with "Best" as default
  - Click dropdown to choose from all available AI models
  - Clean, minimal interface
  - Cannot remove the selected AI (always have one)
- **Multi Mode**: Send one message and get responses from all selected AIs simultaneously
  - Shows AI pills interface with "Add AI +" button
  - Add up to 6 AI models to compare responses
  - Remove AIs individually with × button
- **Mode Toggle**: Clean, minimal toggle switch to switch between modes
- **Triangle Branching Layout**: When multiple AIs selected in multi-mode:
  - For 2 AIs: Creates triangle pattern (one left, one right)
  - For 3+ AIs: Spreads them horizontally in a row
  - Each window shows that specific AI's response
  - AI model pill/logo displayed at top-left of each window
  - All connected to the main conversation node with dotted lines
  - Users can continue conversations in any AI window independently

### Infinite Conversation Branching
- **Branch from Any Message**: Hover over any message (user or AI) to reveal branch icon
- **Branch Icon**: Circular grey icon with git-style branching symbol
  - Appears on the right for AI messages
  - Appears on the left for user messages
- **Visual Tree Structure**: Conversations arranged in a tree layout with dotted connection lines
- **Infinite Depth**: Create branches from branches infinitely deep
- **Context Preservation**: Each branch includes full conversation history from parent
- **Independent Conversations**: Each branch maintains its own isolated chat context

### React Flow Canvas
- **Visual Node-Based UI**: Each conversation displayed as a draggable node
- **Zoom Controls**: Built-in zoom in/out controls
- **Pan & Navigate**: Click and drag to move around the canvas
- **Enhanced MiniMap**: Color-coded overview with node status indicators
  - **Purple**: Main conversation node
  - **Green**: Expanded branch nodes
  - **Orange**: Collapsed branch nodes
  - **Rounded Design**: Modern, clean appearance
- **Background Grid**: Subtle grid pattern for visual guidance
- **Auto-fit View**: Automatically centers and fits all nodes on load
- **Dagre Automatic Layout**: Industry-standard hierarchical layout algorithm
  - **No Overlaps**: Guaranteed clean positioning
  - **Optimal Spacing**: 300px vertical, 200px horizontal between nodes
  - **Auto-reorganization**: All nodes reposition when new branches added
  - **Professional Structure**: Top-to-bottom tree layout
  - **Scalable**: Works for any number of branches and depth levels

### Collapsible Tree Management
- **Right-Click Context Menu**: Right-click any node with children to collapse/expand
- **Collapse/Expand Branches**: Hide/show entire branch subtrees
- **Visual Indicators**: Collapsed nodes show as orange in MiniMap
- **Smart Filtering**: Only visible nodes and edges are rendered
- **Hierarchical Hiding**: Collapsing a parent hides all its children
- **Smooth Transitions**: Animated collapse/expand with 200ms duration

### Minimize/Restore Windows
- **Minimize Button**: Click minimize icon in top-right of any chat window
- **Compact View**: Minimized windows show title and message count
- **Restore Functionality**: Click restore icon to expand back to full view
- **Visual Feedback**: Active nodes highlighted with blue ring
- **Space Efficient**: Minimized windows take minimal space on canvas

### Advanced Search & Navigation
- **Real-time Search**: Search across all conversation messages
- **Search Bar**: Top-left search input with magnifying glass icon
- **Live Results**: Dropdown shows matching nodes as you type
- **Context Preview**: Shows matching message text in search results
- **One-Click Navigation**: Click result to zoom to and highlight node
- **Clear Search**: X button to clear search and results
- **Message Count**: Shows number of messages in each search result

### Auto-Center & Active Node Tracking
- **Click to Activate**: Click any node to make it active
- **Auto-Center**: Active node automatically centers when user types
- **Visual Highlighting**: Active nodes show blue ring highlight
- **Smooth Animation**: 800ms animated zoom to active node
- **Smart Zoom**: Zooms to 1.2x scale for better visibility

### Dual Layout System
- **Initial Simple View**: Clean centered chat interface before any branching
- **Canvas View**: Automatically switches to React Flow canvas when first branch is created
- **Seamless Transition**: Maintains all conversation context during layout switch
- **Consistent UI**: All chat nodes use identical design as the initial chat interface

---

## 🎨 UI/UX Design

### Design Philosophy
- **Minimal & Aesthetic**: Clean, modern design inspired by ChatGPT and Perplexity
- **Subtle Colors**: Grey tones, white backgrounds, minimal shadows
- **Ample White Space**: Generous padding and spacing throughout
- **No Gradients**: Flat, clean design aesthetic (except for AI pill backgrounds)
- **Phosphor Icons**: Consistent iconography library
- **Subtle Animations**: Minimal, elegant hover effects (no scaling except neo-brutal buttons)

### Color Scheme
- **Primary**: Purple (`#8B5CF6`) for accents and highlights
- **Background**: Light grey (`#F9FAFB`) for main background
- **Cards**: White (`#FFFFFF`) with subtle shadows
- **Text**: Dark grey (`#111827`) for primary text
- **Secondary Text**: Medium grey (`#6B7280`) for secondary text
- **Borders**: Light grey (`#E5E7EB`) for subtle borders
- **AI Pills**: Gradient backgrounds with matching text colors

### Typography
- **Font Family**: Inter (system font stack)
- **Headings**: Semi-bold (600) weight
- **Body Text**: Regular (400) weight
- **Small Text**: 14px for secondary information
- **Line Height**: 1.5 for optimal readability

### Chat Interface Components

**AI Pills Section**
- Rounded pill design with AI logos
- Minimal border styling (border-gray-200)
- Smooth hover effects with scale transform
- Close button appears on hover
- Horizontal scrollable layout
- Gradient backgrounds for visual distinction

**Chat Messages**
- **User Messages**: 
  - Right-aligned
  - Dark background (bg-gray-900)
  - White text
  - Branch icon on left side
  - Rounded corners (rounded-lg)
- **AI Messages**: 
  - Left-aligned
  - Light grey background (bg-gray-50)
  - Dark text
  - Branch icon on right side
  - Rounded corners (rounded-lg)
- **Styling**:
  - Small text (text-sm)
  - Compact padding (px-3 py-2)
  - Maximum width constraint (max-w-[85%])
  - Smooth animations on hover

**Input Bar**
- **Multi-line Textarea**: Enhanced from single-line input to textarea
- **Auto-resize**: Automatically adjusts height based on content (60px min, 200px max)
- **Expand Upward**: Grows upward instead of pushing content down
- **Enter to Send**: Press Enter to submit message
- **Shift+Enter**: Create new lines within message
- **Minimal Send Button**: Paper plane icon with hover effects
- **Border on Focus**: Focus-within:border-gray-400
- **Subtle Shadow**: shadow-lg with hover:shadow-xl
- **Context-aware Placeholder**: "Ask anything..." or "Ask X AIs..."
- **Rounded Design**: rounded-2xl for modern aesthetic

**Branch Nodes (Canvas)**
- Fixed width: 600px for consistency
- Identical design to initial chat interface
- Connection handles (top and bottom)
- Dotted grey connection lines (strokeDasharray: '6 4')
- Alternating positioning: left (-300px) and right (+300px)
- Vertical spacing: 350px between parent and child
- White background with subtle shadow
- Smooth animations on hover and focus

### Visual Feedback
- **Framer Motion Animations**:
  - Message appear: opacity 0→1, y 10→0
  - Node appear: opacity 0→1, scale 0.95→1
  - Hover effects: subtle scale transforms
- **Hover States**: All interactive elements have hover feedback
- **Transition Effects**: Smooth opacity and transform transitions
- **Branch Icon**: Appears only on hover with smooth fade-in
- **Active States**: Blue ring highlight for active nodes

---

## ⚙️ Technical Implementation

### Tech Stack
- **Framework**: Next.js 15.5.4 with App Router (Turbopack)
- **Language**: TypeScript (full type safety)
- **Styling**: Tailwind CSS v3.4.0
- **UI Components**: ShadCN UI + Radix UI
- **Animations**: Framer Motion
- **Icons**: Phosphor Icons (@phosphor-icons/react)
- **Flow Diagram**: React Flow (reactflow)
- **Layout Algorithm**: Dagre (dagre) for automatic hierarchical positioning
- **State Management**: React useState + useRef pattern

### Component Architecture

```
src/
├── app/
│   ├── page.tsx              # Main orchestrator, state management
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles, Tailwind config
├── components/
│   ├── ai-pills.tsx          # AI selection dropdown and pills
│   ├── chat-interface.tsx    # Message display and input
│   ├── chat-node.tsx         # Custom React Flow node component
│   ├── conversation-canvas.tsx # Canvas wrapper component
│   ├── export-import-modal.tsx # Data export/import functionality
│   ├── focus-mode-modal.tsx  # Focus mode for individual nodes
│   ├── flow-canvas.tsx       # React Flow wrapper and branching logic
│   ├── sidebar.tsx           # Conversation tree sidebar
│   ├── transform-button.tsx  # Canvas transformation controls
│   └── zoomable-canvas.tsx   # Zoom and pan controls
├── lib/
│   └── utils.ts              # Utility functions
└── services/
    ├── ai-api.ts             # AI service integration
    └── conversation-export.ts # Export/import functionality
```

### State Management

**Main State (page.tsx)**
- `selectedAIs`: Array of AI objects with id, name, color, logo
- `messages`: Array of message objects with:
  - id, text, isUser, timestamp
  - parentId (for relationships)
  - children (array of child message ids)
  - responses (for multi-model mode)
- `currentBranch`: ID of message being branched from
- `multiModelMode`: Boolean for single/multi mode toggle
- `branches`: Trigger array for canvas mode switch

**Flow Canvas State**
- `nodes`: React Flow nodes array (useNodesState)
- `edges`: React Flow edges array (useEdgesState)
- `nodeId`: Counter for unique node IDs
- `hasCreatedInitialBranch`: Flag to prevent duplicate initial branch

### Key Technical Patterns

**1. Stable Handler References**
- Using `useRef` to store handler functions
- Prevents infinite re-render loops
- Maintains stable references across renders
- Pattern: `handlerRef.current = () => { ... }`

**2. Functional State Updates**
- Using callback form: `setNodes(nds => ...)`
- Accesses current state via refs: `nodesRef.current`
- Avoids stale closure problems
- Ensures latest state is always used

**3. Event Handling**
- `stopPropagation()` on branch button clicks
- Prevents event bubbling to parent elements
- Clean separation of concerns

**4. Dynamic Positioning Algorithm**
```typescript
const childrenCount = edges.filter(e => e.source === parentId).length
const offsetX = childrenCount % 2 === 0 ? -300 : 300
const newPosition = {
  x: parentNode.position.x + offsetX,
  y: parentNode.position.y + 350
}
```

**5. Context Preservation**
- Each branch copies all parent messages: `[...parentMessages, newMessage]`
- Branching point displayed: `"Branched from: [message text]..."`
- Full conversation history maintained

**6. Unique ID Generation**
- Edges: `Date.now() + random string`
- Messages: `msg-${Date.now()}`
- Branches: `branch-${nodeId}-init`

**7. Dagre Automatic Layout**
```typescript
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setGraph({ 
    rankdir: 'TB',        // Top-to-bottom
    ranksep: 300,        // 300px vertical spacing
    nodesep: 200,        // 200px horizontal spacing
    marginx: 50,         // 50px side margins
    marginy: 50          // 50px top/bottom margins
  })
  
  // Add nodes and edges to graph
  nodes.forEach(node => dagreGraph.setNode(node.id, { width: 600, height: 400 }))
  edges.forEach(edge => dagreGraph.setEdge(edge.source, edge.target))
  
  // Calculate layout
  dagre.layout(dagreGraph)
  
  // Apply calculated positions
  return nodes.map(node => ({
    ...node,
    position: { x: dagreGraph.node(node.id).x - 300, y: dagreGraph.node(node.id).y - 200 }
  }))
}
```

---

## 🚀 User Flow

1. **Start Application**
   - Clean centered interface with "Best" AI model selected by default
   - Mode toggle visible (Single/Multi)
   - Custom geometric logo for Best model

2. **Add AI Models**
   - Click "+" button in Multi mode
   - Select from dropdown of all available AIs
   - Pills appear in header with authentic logos

3. **Start Conversation**
   - Type message in multi-line textarea
   - Press Enter or click send button
   - AI responds with simulated response

4. **Branch Conversation**
   - Hover over any message (user or AI)
   - Circular branch icon appears
   - Click icon to create branch

5. **Canvas Mode (Auto-Triggered)**
   - First branch click switches to canvas view
   - Main conversation becomes a node
   - Branch appears as new node below
   - Dotted line connects them

6. **Continue in Branches**
   - Type messages in any node
   - Each node has independent conversation
   - All messages in a node can be branched

7. **Infinite Branching**
   - Hover over messages in branch nodes
   - Branch from any message in any node
   - Tree grows with alternating left/right layout

8. **Multi-Model Mode**
   - Add multiple AI models (e.g., GPT-4, Claude, Gemini)
   - Toggle "Multi" mode
   - Type one message and send
   - Automatically switches to canvas view
   - Multiple chat windows appear side-by-side
   - Each window shows that AI's unique response
   - Continue conversations in any window independently

9. **Navigate Tree**
   - Pan: Click and drag canvas
   - Zoom: Use controls or scroll
   - MiniMap: Click to jump to areas
   - Search: Real-time search across all conversations
   - Collapse: Right-click nodes to collapse/expand

---

## 📝 Implementation Details

### Message Flow
```
User types → sendMessage() → messages state updates →
AI response added → ChatInterface re-renders →
New message appears with animation
```

### Branch Creation Flow
```
Click branch icon → handleBranch(nodeId, messageId) →
Find parent node → Calculate position →
Create new node with parent messages + branch indicator →
Create edge connection → Update nodes and edges state →
React Flow re-renders with new node
```

### Canvas Initialization Flow
```
branchFromMessage() called → branches.length === 0? →
Set branches = [{id: messageId}] →
page.tsx switches to FlowCanvas component →
FlowCanvas mounts → Initialize main node →
Auto-create initial branch → Canvas ready
```

---

## 🎯 Key Features Summary

✅ Multi-AI selection with custom logos  
✅ Single/Multi conversation modes  
✅ Hover-to-reveal branch buttons  
✅ Infinite conversation branching  
✅ Visual tree structure with React Flow  
✅ Context preservation in branches  
✅ Minimal, aesthetic UI design  
✅ Smooth animations with Framer Motion  
✅ Full TypeScript type safety  
✅ Responsive and performant  
✅ Advanced search & navigation  
✅ Collapsible tree management  
✅ Minimize/restore windows  
✅ Auto-center active nodes  
✅ Real-time search functionality  
✅ Custom Best model logo  

---

## 🛡️ Edge Cases Handled

### Dynamic AI Management
- ✅ **Adding AIs After Initial Response**: New AI models create additional windows alongside existing ones
- ✅ **Automatic Repositioning**: When adding new AIs, existing windows reposition to maintain clean layout
- ✅ **Maximum AI Limit**: Capped at 6 AI models to prevent UI overflow (shows "Max 6" indicator)
- ✅ **Removed AI Cleanup**: Removing AIs properly cleans up their associated windows

### Default State
- ✅ **Always One AI Selected**: App starts with "Best" model selected by default
- ✅ **Cannot Remove Last AI**: Prevents removing all AIs (always keep at least one)
- ✅ **No Empty State**: No warning messages needed, app always ready to use

### Mode Switching
- ✅ **Single → Multi**: Seamlessly enables multi-model responses
- ✅ **Multi → Single**: Prevents multi-model responses, uses only first AI
- ✅ **Add Button Visibility**: "Add AI +" only appears in Multi mode

### Message Validation
- ✅ **Empty Messages**: Blocks sending empty/whitespace-only messages
- ✅ **Console Warnings**: Helpful debug messages for edge cases
- ✅ **Dynamic Placeholder**: Shows context-aware hints ("Ask 3 AIs..." etc.)

### Layout Management
- ✅ **2 AIs**: Triangle pattern (left/right positioning)
- ✅ **3-6 AIs**: Horizontal spread with calculated spacing
- ✅ **No Overlap**: 650px horizontal spacing (600px node width + 50px gap)
- ✅ **Collision Detection**: Automatically finds non-overlapping positions for new branches
- ✅ **Smart Positioning**: Checks all nodes at same Y-level before placing new node
- ✅ **Fallback Strategy**: If no space found, places node to the far right
- ✅ **Vertical Spacing**: 350px between parent and child nodes
- ✅ **Overflow Prevention**: Max 6 AIs prevents canvas overflow
- ✅ **Node Tracking**: Prevents duplicate node creation with ref-based tracking

### Branch Behavior
- ✅ **Independent Branching**: Each multi-model window can branch separately
- ✅ **Context Preservation**: All branches maintain full conversation history
- ✅ **Infinite Depth**: No limit on branching depth

### React Flow Integration
- ✅ **Valid Props**: All React Flow props are valid and properly configured
- ✅ **Error Handling**: Removed invalid `panOnDragMode` prop
- ✅ **Performance**: Optimized rendering with proper state management
- ✅ **Accessibility**: Proper ARIA labels and keyboard navigation

---

## 🔄 Recent Updates

**Latest Changes:**
- ✅ **Custom Best Model Logo**: Created minimal geometric logo with checkmark pattern
- ✅ **React Flow Error Fix**: Removed invalid `panOnDragMode` prop
- ✅ **Enhanced UI/UX**: Comprehensive design system documentation
- ✅ **Collapsible Tree Management**: Right-click any node to collapse/expand branches
- ✅ **Minimize/Restore Windows**: Minimize chat windows to save space with restore functionality
- ✅ **Advanced Search & Navigation**: Real-time search across all conversations with live results
- ✅ **Auto-Center Active Nodes**: Click nodes to activate and auto-center when typing
- ✅ **Enhanced MiniMap**: Color-coded overview showing node status (purple=main, green=expanded, orange=collapsed)
- ✅ **Visual Node Highlighting**: Active nodes highlighted with blue ring for better focus
- ✅ **Smart Context Menu**: Right-click context menu for nodes with children
- ✅ **Hierarchical Filtering**: Collapsing parent nodes hides all children automatically
- ✅ **Dagre Automatic Layout**: Integrated industry-standard Dagre library for perfect hierarchical positioning
- ✅ **No More Manual Positioning**: Eliminated complex manual positioning algorithms
- ✅ **Guaranteed Clean Layout**: Dagre ensures no overlaps and optimal spacing
- ✅ **Professional Tree Structure**: Industry-standard graph layout algorithm
- ✅ **Automatic Reorganization**: All nodes reposition automatically when new branches added
- ✅ **Enhanced Text Input**: Multi-line textarea that expands upward (60px min, 200px max)
- ✅ **Enter to Send**: Press Enter to submit, Shift+Enter for new lines
- ✅ **Auto-resize Input**: Textarea automatically adjusts height based on content
- ✅ **Simple Left/Right Rule**: 1st branch=left, 2nd=right, 3rd=left, 4th=right... (no overlaps!)
- ✅ **Fixed 400px Spacing**: Always exactly 400px from parent - no complex calculations
- ✅ **Closer Branch Spacing**: Branches now only 400px apart (was 650px) - much closer to parent!
- ✅ **Tighter Vertical**: Branches appear 350px below parent (was 280px)
- ✅ **Smart Zoom on Branch**: When branching, camera zooms OUT to show all nodes (was zooming in)
- ✅ **Smooth Transitions**: 800ms animated zoom with 20% padding for better visibility
- ✅ **Improved Multi-Model Spacing**: Fixed cluttered layout - now uses 650px spacing (was 700px)
- ✅ **Symmetrical Triangle**: Multi-model windows now positioned ±650px from center
- ✅ **Better Vertical Spacing**: Multi-model nodes positioned 500px below main (was 400px)
- ✅ **Default "Best" Model**: App now starts with "Best" AI selected by default (no empty state)
- ✅ **Single Mode Dropdown**: Clean dropdown selector replaces empty state warnings
- ✅ **Always Ready**: Input always enabled with at least one AI selected
- ✅ **Cannot Remove Last AI**: Prevents removing all AIs for better UX
- ✅ **Comprehensive Edge Case Handling**: Added 15+ edge case validations and UI improvements
- ✅ **Dynamic AI Window Management**: New AIs automatically reposition existing windows
- ✅ **Max AI Limit**: 6 AI limit with visual indicator when reached
- ✅ **Triangle Branching Layout**: 2 AI models branch in triangle pattern (left/right), 3+ spread horizontally
- ✅ **AI Model Pills on Branches**: Each multi-model response window shows which AI it belongs to at top-left
- ✅ **Context-Aware Add Button**: "Add AI +" only appears in Multi mode, hidden in Single mode
- ✅ **Multi-Model Side-by-Side Windows**: Multiple AIs create separate chat windows with proper positioning
- ✅ Fixed infinite re-render loop using ref pattern for handlers
- ✅ Implemented stable handler references with useRef
- ✅ All messages now show branch icons on hover (user and AI)
- ✅ Branch nodes properly receive updated handlers
- ✅ Full conversation history displayed (not just last 3 messages)
- ✅ Dotted connection lines for better visual hierarchy

---

*Last Updated: January 2025*
