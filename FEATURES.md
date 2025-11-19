# Main Features

## Core Functionality

### 1. Multi-AI Conversations
- Support for multiple AI models simultaneously (Mistral, Gemini, etc.)
- Select one or multiple AIs per conversation
- Each AI generates independent responses
- Grouped visual representation when multiple AIs respond together

### 2. Conversation Branching
- Branch from any message (user or AI) at any point in the conversation
- Create single branches or multi-branches (one per AI response)
- Visual flow canvas showing all conversation paths
- Branch grouping for multi-AI responses with color coding
- Up to 6 branches per message (with warning system)

### 3. Flow Canvas Visualization
- Interactive node-based graph view of all conversations
- Visual representation of conversation branches and relationships
- Pan, zoom, and navigate through conversation trees
- Minimize/expand nodes for better organization
- Smooth focus animations when creating or selecting branches
- Auto-layout using Dagre algorithm

### 4. Dual View Modes
- **Map View**: Visual graph of all branches and relationships
- **Chat View**: Focused conversation threads for detailed work
- Seamless switching between views

## Data Persistence

### 5. MongoDB Integration
- Full conversation state persistence
- Saves messages, branches, UI state, and metadata
- Automatic save on conversation changes
- Restore conversations on reload

### 6. Embedded MongoDB (Development)
- Zero-setup MongoDB for local development
- File-system backed storage
- Automatic fallback when no external MongoDB configured
- Easy project cloning without database setup

### 7. Docker Support
- Complete Docker containerization
- Docker Compose setup with MongoDB
- Consistent environment across all machines
- Persistent data volumes

## User Experience

### 8. Branch Management
- Warning system for duplicate branches
- Branch limit enforcement (6 per message)
- Visual indicators for branch relationships
- Delete branches with confirmation
- Navigate between branches easily

### 9. Focus & Navigation
- Auto-focus on newly created branches
- Smooth zoom animations
- Focus on last active branch on reload
- Branch navigation sidebar
- Active branch highlighting

### 10. AI Response Handling
- Streaming responses with real-time updates
- Mock responses for unsupported/configured models
- Error handling with graceful fallbacks
- Support for "Best Available Model" selection
- Response grouping for multi-AI conversations

## Interface Features

### 11. Export/Import
- Export conversations to file
- Import conversations from file
- Preserve full conversation state

### 12. Theme Support
- Light/Dark mode toggle
- Persistent theme preference
- Modern UI with smooth transitions

### 13. Command Palette
- Quick access to common actions
- Keyboard shortcuts support
- Export, clear, focus mode commands

### 14. Sidebar Navigation
- List of all conversations
- List of all branches
- Quick navigation to any branch or conversation
- Create new conversations
- Delete conversations and branches

## Technical Features

### 15. Context Management
- Efficient message inheritance across branches
- Lightweight snapshots (no message duplication)
- Full conversation context for each branch
- Parent chain message tracking

### 16. Layout Engine
- Automatic node positioning
- Grouped branch alignment
- Responsive canvas layout
- Node dimension calculations

### 17. State Management
- React hooks for state management
- Optimized re-renders
- Message and branch stores
- Ref-based optimizations

### 18. Error Handling
- Graceful error messages
- Fallback to mock responses
- Connection error handling
- User-friendly error notifications

## Development Features

### 19. Easy Setup
- Embedded MongoDB for zero-config development
- Docker for production-ready deployment
- Environment variable configuration
- Clear documentation

### 20. Type Safety
- Full TypeScript support
- Type-safe component props
- Interface definitions for all data structures

