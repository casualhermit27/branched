import { useState, useRef } from 'react'

export interface AI {
	id: string
	name: string
	color: string
	logo: React.JSX.Element
}

export interface Message {
	id: string
	text: string
	isUser: boolean
	timestamp: number
	parentId?: string
	children: string[]
	responses?: { [aiId: string]: string }
	aiModel?: string
	groupId?: string
	isStreaming?: boolean
	streamingText?: string
}

export interface Branch {
	id: string
	title: string
	messages: Message[]
	timestamp: number
	parentBranchId?: string
	children?: string[]
}

export function useConversationState() {
	const [selectedAIs, setSelectedAIs] = useState<AI[]>([])
	const [messages, setMessages] = useState<Message[]>([])
	const [currentBranch, setCurrentBranch] = useState<string | null>(null)
	const [branches, setBranches] = useState<{ id: string }[]>([])
	const [conversationNodes, setConversationNodes] = useState<any[]>([])
	const [showExportImport, setShowExportImport] = useState(false)
	const [showCommandPalette, setShowCommandPalette] = useState(false)
	const [viewMode, setViewMode] = useState<'map' | 'chat' | 'comparison'>('map')
	const [allNodesMinimized, setAllNodesMinimized] = useState(false)
	const minimizeAllRef = useRef<(() => void) | null>(null)
	const maximizeAllRef = useRef<(() => void) | null>(null)
	const [showMenu, setShowMenu] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
	const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([])
	const [showPricingModal, setShowPricingModal] = useState(false)
	const [messageCount, setMessageCount] = useState(34)
	const [showOnboarding, setShowOnboarding] = useState(false)
	const [allConversations, setAllConversations] = useState<any[]>([])
	const [activeBranchId, setActiveBranchId] = useState<string | null>('main')
	const [pendingBranchMessageId, setPendingBranchMessageId] = useState<string | null>(null)
	const [isGenerating, setIsGenerating] = useState(false)
	const mainAbortControllerRef = useRef<AbortController | null>(null)
	const [savedBranches, setSavedBranches] = useState<Branch[]>([])
	const [lastBranchTime, setLastBranchTime] = useState<number>(0)
	const [showBranchWarning, setShowBranchWarning] = useState(false)
	const [pendingBranchData, setPendingBranchData] = useState<{
		messageId: string
		isMultiBranch: boolean
		messageText?: string
		parentNodeId?: string
		allowDuplicate?: boolean
		existingBranchesCount?: number
		limitReached?: boolean
		branchGroupId?: string
	} | null>(null)
	const creatingBranchRef = useRef<Set<string>>(new Set())
	const branchCacheRef = useRef<Map<string, string>>(new Map())
	const currentConversationIdRef = useRef<string | null>(null)
	const isInitialLoadRef = useRef(true)
	const [isLoading, setIsLoading] = useState(true)

	return {
		selectedAIs,
		setSelectedAIs,
		messages,
		setMessages,
		currentBranch,
		setCurrentBranch,
		branches,
		setBranches,
		conversationNodes,
		setConversationNodes,
		showExportImport,
		setShowExportImport,
		showCommandPalette,
		setShowCommandPalette,
		viewMode,
		setViewMode,
		allNodesMinimized,
		setAllNodesMinimized,
		minimizeAllRef,
		maximizeAllRef,
		showMenu,
		setShowMenu,
		menuRef,
		selectedBranchIds,
		setSelectedBranchIds,
		selectedMessageIds,
		setSelectedMessageIds,
		showPricingModal,
		setShowPricingModal,
		messageCount,
		setMessageCount,
		showOnboarding,
		setShowOnboarding,
		allConversations,
		setAllConversations,
		activeBranchId,
		setActiveBranchId,
		pendingBranchMessageId,
		setPendingBranchMessageId,
		isGenerating,
		setIsGenerating,
		mainAbortControllerRef,
		savedBranches,
		setSavedBranches,
		lastBranchTime,
		setLastBranchTime,
		showBranchWarning,
		setShowBranchWarning,
		pendingBranchData,
		setPendingBranchData,
		creatingBranchRef,
		branchCacheRef,
		currentConversationIdRef,
		isInitialLoadRef,
		isLoading,
		setIsLoading
	}
}

export type ConversationState = ReturnType<typeof useConversationState>

