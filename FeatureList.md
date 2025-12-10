# Branched - Complete Feature List

> A powerful multi-model AI conversation platform with visual branching, context management, and collaboration tools.

---

## 🤖 Multi-Model AI Conversations

### Supported AI Models
| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Haiku |
| **Google** | Gemini Pro, Gemini Flash |
| **Mistral** | Mistral Large, Mistral Medium, Mistral Small |
| **xAI** | Grok |

### Multi-Model Features
- **Simultaneous Responses**: Send a single prompt and receive responses from multiple AI models at once
- **AI Pills**: Visual model selector with color-coded indicators showing which models are active
- **Model Switching**: Easily add, remove, or switch between AI models mid-conversation
- **BYOK (Bring Your Own Key)**: Use your own API keys for OpenAI, Anthropic, Google, Mistral, and xAI
- **Model Discovery**: Automatic detection and validation of available models when you enter an API key
- **Response Streaming**: Real-time token-by-token streaming of AI responses with visual "Thinking..." and "Generating..." indicators

---

## 🌳 Branching System

### Core Branching
- **One-Click Branching**: Create a new branch from any message by clicking the branch icon
- **Multi-Branch Creation**: Use "Create Branches for All" to spawn separate branches for each AI model's response
- **Infinite Depth**: Branch from branches - create nested conversation trees with unlimited depth
- **Branch Inheritance**: New branches automatically inherit the full conversation history from their parent

### Branch Management
- **Branch Labels**: Each branch shows its depth level and multi-model group indicators
- **Delete Branch**: Remove unwanted branches with a confirmation modal
- **Branch Warning**: Alert when creating too many branches (6+) from a single message to prevent clutter
- **Branch Linking**: Connect branches to share context between different conversation paths (reference-based injection)

### Visual Indicators
- **Depth Tags**: Visual badge showing "Level 2", "Level 3", etc. for nested branches
- **Multi-Model Tags**: "Multi-Model" badge for branches created from multi-model responses
- **Branch Origin**: "Branched from:" indicator showing the source message

---

## 🎨 Visual Flow Canvas

### Canvas Features
- **Node-Based Graph**: Visual representation of your entire conversation tree using React Flow
- **Pan & Zoom**: Navigate large conversation trees with mouse drag and scroll
- **Mini-Map**: Small overview map in the corner for quick navigation across large canvases
- **Background Dots**: Subtle dot pattern background with proper visibility in dark and light modes

### Node States
- **Minimized Nodes**: Collapse nodes to save space - shows message count and last message preview
- **Active Node**: Visual highlighting (purple border/ring) for the currently focused node
- **Selected Nodes**: Multi-select nodes with Ctrl/Cmd+Click for batch operations
- **Generating State**: Pulsing indicator when a node is actively receiving AI responses

### Layout & Navigation
- **Auto-Layout**: Automatic node positioning using the Dagre algorithm (top-to-bottom hierarchy)
- **Smooth Animations**: Animated transitions when navigating between nodes
- **Focus on Branch**: Double-click a node or use sidebar to focus and center on that branch
- **Drag & Drop**: Manually reposition nodes on the canvas

---

## 💬 Chat Interface

### Message Display
- **Markdown Rendering**: Full markdown support including headers, lists, code blocks, and inline formatting
- **Code Highlighting**: Syntax-highlighted code blocks with proper styling
- **Streaming Display**: Real-time text appearance as AI generates responses
- **Message Timestamps**: Time indicators on each message

### Message Actions (Hover Toolbar)
- **Copy**: Copy message text to clipboard with visual confirmation
- **Edit**: Edit user messages and regenerate AI responses
- **Branch**: Create a new branch from this specific message

### User Message Features
- **Multi-Select**: Ctrl/Cmd+Click to select multiple messages
- **Edit & Regenerate**: Modify a sent message and get a new AI response

### AI Response Features
- **Model Indicator**: Shows which AI model generated each response with its logo
- **Response Grouping**: Multiple AI responses to the same prompt are visually grouped
- **Compare View**: Toggle between stacked view and side-by-side comparison for grouped responses
- **Synthesize**: (Planned) Combine multiple AI responses into a unified answer

---

## 📊 Comparison & Analysis

### Side-by-Side Comparison
- **Multi-Model Comparison**: View responses from different AI models side by side
- **Branch Comparison**: Compare content between different conversation branches
- **Expand/Collapse**: Toggle between stacked and comparison views for grouped responses

### Branch Compare Viewer
- **Full Branch Comparison**: Open a dedicated modal to compare two branches in detail
- **AI Summary**: Generate an AI-powered summary of differences between branches
- **Similarity Analysis**: (Planned) Show how similar or different responses are

### 🔀 Synthesize (Merge) Responses

**Purpose**: Merge multiple sibling node responses into a single "Best of" synthesized answer.

#### How It Works
1. **Selection**: User selects Node A, Node B, Node C (sibling branches) using Ctrl/Cmd+Click
2. **Action**: Click the "Synthesize" button that appears in the selection toolbar
3. **AI Processing**:
   - Constructs a prompt containing the text from all selected nodes
   - Appends synthesis instructions: "Find consensus, resolve conflicts, combine best elements"
   - Sends to `/api/chat` using a high-reasoning model (e.g., GPT-4o)
4. **Graph Update**:
   - Creates a new Node D (the synthesized response)
   - Creates edges: A→D, B→D, C→D (marking D as a child of all selected nodes)
   - Renders Node D with a unique "Synthesis" style (gold border, merge icon)

#### Visual Design
| Element | Style |
|---------|-------|
| Synthesized Node Border | Gold/Amber (#F59E0B) |
| Node Badge | "Synthesized" with merge icon |
| Source Indicator | "Merged from N nodes" |
| Edges | Multiple incoming edges (dashed, gold) |

---

## 🧠 Context & Memory

### Context Management
- **Full Context Inheritance**: Branches receive complete conversation history from their parent path
- **Context Snapshot**: Each branch stores a snapshot of its inherited context at branch creation time
- **Message Store**: Efficient global message storage to avoid duplication

### Memory Panel
- **Memory Layers**: Three-tier memory system (Global, Branch, Node)
- **Memory Recall**: View and manage context that influences AI responses
- **Relevance Scoring**: Memories ranked by relevance to current conversation

---

## 📁 Sidebar & Navigation

### Conversation History Tab
- **Conversation List**: All saved conversations grouped by date
- **Conversation Preview**: Shows message count and branch count
- **Quick Navigation**: Click to load any previous conversation
- **Delete Conversation**: Remove conversations with confirmation

### Branch Tree Tab
- **Hierarchical Tree**: Visual tree structure of all branches in current conversation
- **Expandable Nodes**: Collapse/expand branch groups
- **Active Indicator**: Highlight showing which branch is currently active
- **Quick Jump**: Click any branch to navigate and focus on it

### Settings Tab
- **API Key Management**: Securely enter and store API keys for each provider
- **Key Visibility Toggle**: Show/hide API keys
- **Key Validation**: Visual indicators for valid/invalid keys
- **Model Discovery**: Auto-discover available models after entering a key

---

## 🔍 Search & Command Palette

### Global Search (Cmd/Ctrl + Shift + F)
- **Full-Text Search**: Search across all messages in all nodes
- **Node Filtering**: Search results grouped by node/branch
- **Instant Navigation**: Click a result to focus on that node and highlight the message

### Command Palette (Cmd/Ctrl + K)
- **Quick Actions**: Access common commands via keyboard
- **Available Commands**:
  - Switch between AI models
  - Export conversation
  - New conversation
  - Toggle theme
  - Navigate to branches

---

## 💾 Data Persistence

### MongoDB Storage
- **Auto-Save**: Conversations automatically saved after changes (2-second debounce)
- **User Accounts**: Conversations linked to authenticated users
- **Guest Mode**: Legacy conversations work without login
- **Conversation Claiming**: Guest conversations auto-claimed when user logs in

### Export & Import
- **JSON Export**: Export full conversation state including all branches and positions
- **JSON Import**: Restore conversations from exported files
- **Node Positions**: Canvas layout preserved in exports

---

## 🔐 Authentication & User Management

### Authentication
- **Email/Password Login**: Traditional credential-based authentication
- **Sign Up**: Create new accounts with email and password
- **Session Management**: Secure session handling via NextAuth.js

### User Experience
- **Login Modal**: Clean modal interface for login/signup
- **Session Persistence**: Stay logged in across browser sessions
- **Auto-Refresh**: Conversation list auto-updates on login/logout

---

## 🎨 UI/UX Features

### Theming
- **Dark Mode**: Premium dark theme with purple accents
- **Light Mode**: Clean light theme with proper contrast
- **Theme Toggle**: One-click switching between modes

### Animations & Polish
- **Framer Motion**: Smooth animations throughout the app
- **Glassmorphism**: Subtle glass effects on cards and modals
- **Hover States**: Interactive feedback on all clickable elements
- **Loading States**: Detailed loading screens with status messages

### Responsive Design
- **Desktop Optimized**: Best experience on large screens with full canvas view
- **Collapsible Sidebar**: Hide/show navigation to maximize workspace
- **Resizable Nodes**: Consistent node sizing across different screen sizes

---

## 🎓 Onboarding

### Interactive Tour
- **Step-by-Step Guide**: Introduction to key features for new users
- **Highlighted Elements**: Visual focus on UI elements being explained
- **Skip Option**: Users can skip the tour if they're already familiar

---

## 💳 Pricing & Plans

### Tiers
| Feature | Free | Pro |
|---------|------|-----|
| Conversations | 5 | Unlimited |
| Branches per conversation | 10 | Unlimited |
| AI Models | 3 | All |
| Export/Import | ✓ | ✓ |
| Priority Support | ✗ | ✓ |

### Upsell Experience
- **Usage Limits**: Clear indicators when approaching free tier limits
- **Upgrade Prompts**: Contextual prompts to upgrade when hitting limits
- **Pricing Modal**: Detailed comparison of plan features

---

## ⚙️ Developer Features

### API Architecture
- **Unified API Wrapper**: Single interface for all AI providers
- **Server-Side Routing**: API calls routed through Next.js API routes
- **Error Handling**: Graceful error messages for API failures
- **Abort Support**: Cancel in-progress AI generations

### Analytics & Feedback
- **Usage Analytics**: Track feature usage patterns
- **Feedback Loop**: Collect user feedback on AI responses

### Caching
- **Conversation Caching**: Fast restoration of recent conversations
- **Model Discovery Caching**: Cached model lists for quick provider switching

---

## ⌨️ Keyboard Shortcuts (Core V1)

Essential keyboard shortcuts for power users and developer workflows.

### Core Shortcuts
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Cmd/Ctrl + Enter` | Send Message | Submit the current message |
| `Cmd/Ctrl + K` | Command Palette | Open quick actions and search |
| `Cmd/Ctrl + \` | Fork/Branch | Create a branch from current node |
| `Tab` | Cycle Models | Switch between active AI models |
| `Cmd/Ctrl + Shift + F` | Global Search | Search across all messages |
| `Escape` | Close/Cancel | Close modals, cancel selection |

### Navigation Shortcuts
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Cmd/Ctrl + 1` | Canvas View | Switch to flow canvas view |
| `Cmd/Ctrl + 2` | Chat View | Switch to focused chat view |
| `Arrow Keys` | Navigate Nodes | Move between nodes on canvas |
| `Home` | Go to Main | Focus on the main conversation node |

### Selection Shortcuts
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Cmd/Ctrl + Click` | Multi-Select | Select multiple nodes/messages |
| `Cmd/Ctrl + A` | Select All | Select all nodes in current view |
| `Cmd/Ctrl + D` | Deselect All | Clear current selection |

---

## 🚀 Planned Features

| Feature | Status | Description |
|---------|--------|-------------|
| Diff Highlighting | Planned | Color-coded changes between branches |
| PDF/Markdown Export | Planned | Export in additional formats |
| Team Collaboration | Planned | Share conversations with team members |
| Voice Input | Planned | Speech-to-text message input |
| Image Attachments | Planned | Send images to vision-capable models |
| Custom Themes | Planned | User-defined color schemes |

---

## 📝 Technical Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Framer Motion
- **Canvas**: React Flow for node-based visualization
- **Database**: MongoDB with Mongoose
- **Authentication**: NextAuth.js
- **AI Integration**: Direct API calls to OpenAI, Anthropic, Google, Mistral, xAI

---

*Last Updated: December 10, 2024*
