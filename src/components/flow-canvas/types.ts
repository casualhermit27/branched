'use client'

import { Node, Edge } from 'reactflow'

export interface AI {
	id: string
	name: string
	color: string
	logo: React.JSX.Element
	functional?: boolean
}

export interface Message {
	id: string
	text: string
	isUser: boolean
	ai?: string
	parentId?: string
	children: string[]
	timestamp: number
	responses?: { [aiId: string]: string }
	aiModel?: string
	groupId?: string
	isStreaming?: boolean
	streamingText?: string
	nodeId?: string
	confidenceScore?: number
	reasoningScore?: number
	latency?: number
	tokensUsed?: number
	cost?: number
	contextUsed?: string[]
}

export interface ChatNodeData {
	label: string
	messages: Message[]
	selectedAIs: AI[]
	onBranch?: (nodeId: string, messageId?: string) => void
	onSendMessage?: (nodeId: string, message: string) => void
	onAddAI?: (ai: AI) => void
	onRemoveAI?: (aiId: string) => void
	onSelectSingle?: (aiId: string) => void
	onToggleMultiModel?: (nodeId: string) => void
	getBestAvailableModel?: () => string
	onExportImport?: () => void
	isMain?: boolean
	showAIPill?: boolean
	isMinimized?: boolean
	onToggleMinimize?: (nodeId: string) => void
	isActive?: boolean
	isGenerating?: boolean
	onStopGeneration?: (nodeId: string) => void
	existingBranchesCount?: number
	height?: number
	isHighlighted?: boolean
	multiModelMode?: boolean
	nodeId?: string
	parentMessageId?: string
	inheritedMessages?: Message[]
	branchMessages?: Message[]
	onDeleteBranch?: (nodeId: string) => void
	parentId?: string
	messageIds?: string[]
	contextSnapshot?: {
		branchPointMessageId: string
		inheritedMessageIds: string[]
		timestamp: number
	}
}

export interface FlowCanvasProps {
	selectedAIs: AI[]
	onAddAI: (ai: AI) => void
	onRemoveAI: (aiId: string) => void
	mainMessages: Message[]
	onSendMainMessage: (message: string) => Promise<void>
	onBranchFromMain: (messageId: string) => void
	initialBranchMessageId?: string | null
	pendingBranchMessageId?: string | null
	onPendingBranchProcessed?: () => void
	onNodesUpdate?: (nodes: any[]) => void
	onNodeDoubleClick?: (nodeId: string) => void
	onPillClick?: (aiId: string) => void
	getBestAvailableModel?: () => string
	onSelectSingle?: (aiId: string) => void
	multiModelMode: boolean
	onExportImport?: () => void
	restoredConversationNodes?: any[]
	selectedBranchId?: string | null
	onBranchWarning?: (data: {
		messageId: string
		messageText?: string
		existingBranchId: string
		isMultiBranch: boolean
	}) => void
	onMinimizeAllRef?: (fn: (() => void) | null) => void
	onAllNodesMinimizedChange?: (minimized: boolean) => void
}

export interface LayoutConfig {
	direction: 'TB' | 'LR' | 'BT' | 'RL'
	nodeWidth: number
	nodeHeight: number
	nodeSpacing: {
		horizontal: number
		vertical: number
	}
}

export interface ViewportState {
	x: number
	y: number
	zoom: number
}

export interface SearchResult {
	nodeId: string
	messageId: string
	messageText: string
	preview: string
}

export interface BranchCreationParams {
	parentNodeId: string
	messageId: string
	isMultiBranch?: boolean
}

export interface NodeState {
	isMinimized: boolean
	isActive: boolean
	isGenerating: boolean
	isHighlighted: boolean
}

export type CustomNode = Node<ChatNodeData>
export type CustomEdge = Edge

