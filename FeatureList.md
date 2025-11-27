# Feature List

## Core Conversation & Branching

### Multi-Model Conversations
- **Simultaneous AI Responses**: Interact with multiple AI models (e.g., Mistral, Gemini) within the same conversation thread.
- **Model Selection**: Dynamically select which AI models participate in a conversation or specific branch.
- **AI Pills**: Visual indicators and selectors for active AI models.
- **Unified Interface**: A single chat interface that aggregates responses from multiple models.

### Advanced Branching System
- **Infinite Branching**: Create new conversation branches from any message at any point.
- **Visual Flow Canvas**: A node-based graph visualization of the entire conversation tree.
- **Auto-Layout**: Automatic positioning of nodes using the Dagre algorithm for a clean, organized view.
- **Branch Management**:
    - **Create**: One-click branching from any message.
    - **Delete**: Remove unwanted branches with confirmation.
    - **Link**: Connect disparate branches to merge contexts or create references.
    - **Navigate**: Jump between branches using the sidebar or by clicking nodes on the canvas.
- **Branch Warning**: Alerts users when creating too many branches from a single node to prevent clutter.

### Context & Memory
- **Context Inheritance**: Branches automatically inherit the conversation history from their parent path.
- **Context Linking**: Link branches to share context, allowing for complex conversation flows (Merge, Reference, Continuation, Alternative).
- **Memory Panel**: View and manage the "memory" or context available to the current conversation branch.
- **Memory Recall**: Mechanisms to recall and display relevant past information.

## Visualization & Navigation

### Flow Canvas
- **Interactive Graph**: Pan and zoom capability to explore large conversation trees.
- **Node Minimization**: Collapse nodes to save space and focus on active branches.
- **Focus Mode**:
    - **Auto-Focus**: Automatically centers and zooms on newly created branches.
    - **Smooth Animations**: Fluid transitions when navigating between nodes.
- **Mini-Map**: A small overview map for quick navigation across large canvases.
- **Background Controls**: Customizable background patterns (dots, lines, cross).

### View Modes
- **Canvas View**: The default node-based graph view.
- **Chat View**: A focused, linear chat interface for the active branch.
- **Split View**: Side-by-side comparison of different branches or model responses.

### Sidebar & Navigation
- **Conversation History**: List of all saved conversations.
- **Branch Tree**: A hierarchical tree view of branches within the current conversation.
- **Quick Navigation**: Jump to specific nodes or branches directly from the sidebar.
- **Search**: Filter and find specific conversations or branches.

## Comparison & Analysis

### Branch Comparison
- **Side-by-Side Viewer**: Visually compare two or more branches to see differences in AI responses.
- **Diff Highlighting**: Color-coded text highlighting to show additions, deletions, and modifications.
- **AI Summary**: Automated generation of summaries highlighting key differences between branches.
- **Opposing Information**: Detection of contradictory information across different branches.

### Model Comparison
- **Performance Metrics**: Compare response times, token usage, and costs (mocked/planned).
- **Quality Metrics**: User voting (up/down) and feedback on specific model responses.

## Data Management & Utilities

### Persistence
- **MongoDB Integration**: Robust data storage for conversations, branches, and messages.
- **Auto-Save**: Changes are automatically saved to the database.
- **Local Development**: Support for embedded MongoDB for easy local setup.

### Export & Import
- **Full State Export**: Export entire conversations, including the branching structure, to a JSON file.
- **Import**: Restore conversations from previously exported files.
- **Format Support**: Planned support for PDF, Markdown, and other formats.

### Command Palette
- **Quick Actions**: Access common commands (e.g., "New Conversation", "Export", "Toggle Theme") via a keyboard shortcut (Cmd+K).
- **Navigation**: Quickly jump to different parts of the application.

## UI/UX & Customization

### Theming
- **Dark/Light Mode**: Fully supported dark and light themes.
- **Responsive Design**: Mobile-friendly layout for chat nodes and interface elements.

### Onboarding
- **Interactive Tour**: Step-by-step guide for new users to understand the interface and features.

### Pricing & Plans
- **Pricing Modal**: Display of subscription tiers (Free, Pro, Team) and features.
- **Subscription Management**: UI for managing user subscriptions (mocked integration).

## Developer & System Features

### AI Integration
- **Unified API Wrapper**: Abstraction layer for interacting with different AI providers.
- **Streaming Support**: Real-time text streaming for AI responses.
- **Error Handling**: Graceful fallback and error messaging for API failures.

### Analytics & Feedback
- **Usage Analytics**: Tracking of user interactions and feature usage.
- **Feedback Loop**: Mechanism for users to provide feedback on AI responses.
