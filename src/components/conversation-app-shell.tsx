'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { User, SignOut } from '@phosphor-icons/react'

import FlowCanvas from '@/components/flow-canvas/index'
import AIPills from '@/components/ai-pills'
import ChatInterface from '@/components/chat-interface'
import { ComparisonView } from '@/components/comparison-view'
import { PricingModal } from '@/components/pricing-modal'
import { OnboardingTour } from '@/components/onboarding-tour'
import Sidebar from '@/components/sidebar'
import ExportImportModal from '@/components/export-import-modal'
import { CommandPalette } from '@/components/command-palette'
import { ThemeToggle } from '@/components/theme-toggle'
import { BranchWarningModal } from '@/components/branch-warning-modal'
import { BranchNavigation } from '@/components/branch-navigation'
import { ArrowsIn, ArrowsOut, DotsThree, ArrowsLeftRight, MagnifyingGlass, Gear, GitMerge, X, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { GlobalSearch } from '@/components/global-search'
import type { ConversationState } from '@/hooks/use-conversation-state'
import type { ConversationActions } from '@/hooks/use-conversation-actions'
import { EmptyState } from '@/components/empty-state'
import { LoadingScreen } from '@/components/loading-screen'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { SynthesizeModal } from '@/components/synthesize-modal'

interface CommandPaletteCommand {
    id: string
    title: string
    description: string
    action: () => void
}

interface ConversationAppShellProps {
    state: ConversationState
    actions: ConversationActions
    commandPaletteCommands: CommandPaletteCommand[]
    onLoginClick: () => void
    currentConversationId?: string | null
}

const MAX_DUPLICATE_BRANCHES = 6

export default function ConversationAppShell({
    state,
    actions,
    commandPaletteCommands,
    onLoginClick,
    currentConversationId
}: ConversationAppShellProps) {
    const { data: session } = useSession()
    const {
        selectedAIs,
        messages,
        currentBranch,
        branches,
        conversationNodes,
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
        showPricingModal,
        setShowPricingModal,
        showOnboarding,
        setShowOnboarding,
        allConversations,
        activeBranchId,
        setActiveBranchId,
        pendingBranchMessageId,
        setPendingBranchMessageId,
        pendingBranchData,
        setPendingBranchData,
        showBranchWarning,
        savedBranches,
        currentConversationIdRef,
        setCurrentBranch,
        isGenerating,
        selectedMessageIds,
        setSelectedMessageIds
    } = state

    const [showGlobalSearch, setShowGlobalSearch] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [isControlsCollapsed, setIsControlsCollapsed] = useState(false)
    const [sidebarTab, setSidebarTab] = useState<'history' | 'settings'>('history')
    const [currentAIIndex, setCurrentAIIndex] = useState(0)
    const [showSynthesizeModal, setShowSynthesizeModal] = useState(false)

    // Tiered Access State
    const [userProfile, setUserProfile] = useState<{
        tier: 'free' | 'pro'
        credits: number
        dailyFreeUsage: number
    }>({
        tier: 'free',
        credits: 0,
        dailyFreeUsage: 0
    })

    // Fetch user profile on mount and when session changes
    useEffect(() => {
        if (session?.user) {
            fetch('/api/user/me')
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        setUserProfile({
                            tier: data.tier || 'free',
                            credits: data.credits || 0,
                            dailyFreeUsage: data.dailyFreeUsage || 0
                        })
                    }
                })
                .catch(err => console.error('Failed to fetch user profile:', err))
        }
    }, [session])

    const tier = userProfile.tier
    const credits = userProfile.credits

    const {
        addAI,
        removeAI,
        selectSingleAI,
        selectSingleAIById,
        handleImportConversation,
        handleSelectBranch,
        handleDeleteBranch,
        handleCreateNewConversation,
        handleSelectConversation,
        handleDeleteConversation,
        updateConversationNodes,
        stopGeneration,
        sendMessage,
        branchFromMessage,

        handleBranchWarning,
        handleBranchWarningConfirm,
        handleBranchWarningCancel,
        getBestAvailableModel,
        editMessage,
        checkLimit
    } = actions

    // Cycle through AI models
    const handleCycleModels = useCallback(() => {
        if (selectedAIs.length <= 1) return
        const nextIndex = (currentAIIndex + 1) % selectedAIs.length
        setCurrentAIIndex(nextIndex)
        // Optionally focus/highlight the next AI
        selectSingleAIById(selectedAIs[nextIndex].id)
    }, [selectedAIs, currentAIIndex, selectSingleAIById])

    // Branch from current active node
    const handleBranchCurrentNode = useCallback(() => {
        if (checkLimit && !checkLimit('branch')) return
        // Get the last user message from the current context
        const lastUserMessage = [...messages].reverse().find(m => m.isUser)
        if (lastUserMessage) {
            branchFromMessage(lastUserMessage.id, false)
        }
    }, [messages, branchFromMessage, checkLimit])

    // Close all modals/overlays
    const handleEscape = useCallback(() => {
        if (showGlobalSearch) {
            setShowGlobalSearch(false)
            return
        }
        if (showCommandPalette) {
            setShowCommandPalette(false)
            return
        }
        if (showExportImport) {
            setShowExportImport(false)
            return
        }
        if (showPricingModal) {
            setShowPricingModal(false)
            return
        }
        if (sidebarOpen) {
            setSidebarOpen(false)
            return
        }
    }, [showGlobalSearch, showCommandPalette, showExportImport, showPricingModal, sidebarOpen, setShowCommandPalette, setShowExportImport, setShowPricingModal])

    // Go to main node
    const handleGoToMain = useCallback(() => {
        setActiveBranchId('main')
        setCurrentBranch(null)
    }, [setActiveBranchId, setCurrentBranch])

    // Keyboard shortcuts
    useKeyboardShortcuts({
        onOpenCommandPalette: () => setShowCommandPalette(true),
        onGlobalSearch: () => setShowGlobalSearch(true),
        onBranchCurrentNode: handleBranchCurrentNode,
        onCycleModels: handleCycleModels,
        onEscape: handleEscape,
        onCanvasView: () => setViewMode('map'),
        onChatView: () => setViewMode('chat'),
        onGoToMain: handleGoToMain,
        onNewConversation: handleCreateNewConversation,
        onExport: () => setShowExportImport(true),
        onDeselectAll: () => {
            setSelectedBranchIds([])
            setSelectedMessageIds([])
        },
        // Disabled when modals are open
        disabled: showGlobalSearch || showCommandPalette || showExportImport || showPricingModal || showOnboarding || showBranchWarning
    })

    // Handle navigation from search
    const handleNavigateToSearchResult = (nodeId: string, messageId?: string) => {
        // If it's main node, just switch to main
        if (nodeId === 'main') {
            setActiveBranchId('main')
            setCurrentBranch(null)
        } else {
            // For branches, select the branch
            handleSelectBranch(nodeId)
        }

        // If messageId is provided, we could potentially highlight it
        // This would require passing the highlighted message ID down to ChatNode -> ChatInterface
        if (messageId) {
            // Optional: Implement message highlighting logic here
            console.log('Navigating to message:', messageId)
        }
    }

    return (
        <div
            className={`h-screen bg-background overflow-hidden transition-all duration-300 ease-in-out ${sidebarOpen ? 'ml-80' : 'ml-0'}`}
            onClick={(e) => {
                if (!sidebarOpen) return
                const target = e.target as HTMLElement
                // Don't close if clicking interactive elements
                if (target.closest('button, input, textarea, a, [role="button"], .react-flow__node')) return
                setSidebarOpen(false)
            }}
        >
            {/* Floating Controls */}
            {/* Floating Controls */}
            <div className="fixed top-4 right-4 z-50 flex items-center gap-2 p-1.5 bg-card border border-border shadow-sm rounded-2xl transition-all duration-300">
                {/* Collapsable Content */}
                <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${isControlsCollapsed ? 'w-0 opacity-0 scale-95' : 'w-auto opacity-100 scale-100'}`}>
                    <button
                        onClick={() => setShowGlobalSearch(true)}
                        className="p-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/80"
                        title="Search messages (Cmd+K)"
                    >
                        <MagnifyingGlass className="w-5 h-5" weight="bold" />
                    </button>

                    {viewMode === 'map' && conversationNodes.length > 0 && (
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/80"
                                title="More options"
                            >
                                <DotsThree className="w-5 h-5" weight="bold" />
                            </button>

                            {showMenu && (
                                <div className="absolute top-full right-0 mt-2 bg-card dark:bg-card border border-border dark:border-border/60 z-50 min-w-[180px] rounded-xl shadow-lg overflow-hidden">
                                    <button
                                        onClick={() => {
                                            if (allNodesMinimized) {
                                                maximizeAllRef.current?.()
                                            } else {
                                                minimizeAllRef.current?.()
                                            }
                                            setShowMenu(false)
                                        }}
                                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${allNodesMinimized
                                            ? 'bg-primary/10 hover:bg-primary/20 text-primary dark:bg-primary/20 dark:hover:bg-primary/30'
                                            : 'hover:bg-muted dark:hover:bg-muted/80 text-foreground'
                                            }`}
                                    >
                                        {allNodesMinimized ? (
                                            <>
                                                <ArrowsOut className="w-4 h-4" weight="bold" />
                                                <span>Maximize All</span>
                                            </>
                                        ) : (
                                            <>
                                                <ArrowsIn className="w-4 h-4" weight="bold" />
                                                <span>Minimize All</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length > 0 && (
                        <div className="flex items-center gap-2 pl-2 border-l border-border/50">
                            <button
                                onClick={() => setViewMode('map')}
                                className={`p-2 rounded-xl transition-all duration-200 ${viewMode === 'map'
                                    ? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                                    : 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80'
                                    }`}
                                title="Map View"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 3h18v18H3zM3 9h18M9 3v18" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setViewMode('comparison')}
                                className={`p-2 rounded-xl transition-colors ${viewMode === 'comparison'
                                    ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                    : 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80'
                                    }`}
                                title="Comparison View"
                            >
                                <ArrowsLeftRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    <div className="w-px h-4 bg-border/50 mx-0.5"></div>

                    <button
                        onClick={() => {
                            setSidebarTab('settings')
                            setSidebarOpen(true)
                        }}
                        className="p-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/80"
                        title="Settings"
                    >
                        <Gear className="w-5 h-5" weight="bold" />
                    </button>
                    <ThemeToggle />

                    <div className="w-px h-4 bg-border/50 mx-0.5"></div>
                </div>

                {/* Always Visible Profile */}
                {session?.user ? (
                    <div className="relative group">
                        <button
                            className="p-1 rounded-full border-2 border-transparent hover:border-primary/20 transition-all duration-200"
                            title={session.user.name || 'User'}
                        >
                            {session.user.image ? (
                                <Image
                                    src={session.user.image}
                                    alt={session.user.name || 'User'}
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                                    {session.user.name?.[0]?.toUpperCase() || 'U'}
                                </div>
                            )}
                        </button>

                        <div className="absolute top-full right-0 mt-2 w-48 py-1 bg-card border border-border rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            <div className="px-4 py-2 border-b border-border/50">
                                <p className="text-sm font-medium truncate">{session.user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                            </div>
                            <button
                                onClick={() => signOut()}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                            >
                                <SignOut className="w-4 h-4" />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={onLoginClick}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-all duration-200"
                    >
                        <User className="w-4 h-4" weight="bold" />
                        <span>Login</span>
                    </button>
                )}

                {/* Collapse/Expand Toggle */}
                <button
                    onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/80 transition-all duration-200"
                    title={isControlsCollapsed ? "Expand controls" : "Collapse controls"}
                >
                    {isControlsCollapsed ? <CaretLeft className="w-4 h-4" weight="bold" /> : <CaretRight className="w-4 h-4" weight="bold" />}
                </button>
            </div>

            <BranchWarningModal
                isOpen={showBranchWarning}
                onClose={handleBranchWarningCancel}
                onConfirm={handleBranchWarningConfirm}
                onCancel={handleBranchWarningCancel}
                messageText={pendingBranchData?.messageText}
                existingBranchesCount={pendingBranchData?.existingBranchesCount}
                isMultiBranch={pendingBranchData?.isMultiBranch || false}
                limitReached={pendingBranchData?.limitReached}
                maxBranches={MAX_DUPLICATE_BRANCHES}
            />

            <Sidebar
                branches={savedBranches.map(branch => ({
                    ...branch,
                    children: branch.children ?? []
                }))}
                currentBranchId={activeBranchId}
                onSelectBranch={handleSelectBranch}
                onDeleteBranch={handleDeleteBranch}
                conversationNodes={conversationNodes}
                conversations={allConversations}
                currentConversationId={currentConversationIdRef.current}
                onSelectConversation={handleSelectConversation}
                onCreateNewConversation={handleCreateNewConversation}
                messageCount={tier === 'free' ? userProfile.dailyFreeUsage : messages.length}
                onUpgrade={() => setShowPricingModal(true)}
                onDeleteConversation={handleDeleteConversation}
                isOpen={sidebarOpen}
                onOpenChange={setSidebarOpen}
                activeTab={sidebarTab}
                onTabChange={setSidebarTab}
                onExportData={() => setShowExportImport(true)}
                tier={tier}
                credits={credits}
                checkLimit={checkLimit}
            />

            <PricingModal
                isOpen={showPricingModal}
                onClose={() => setShowPricingModal(false)}
                currentPlan="free"
            />

            <OnboardingTour
                isOpen={showOnboarding}
                onClose={() => {
                    setShowOnboarding(false)
                    localStorage.setItem('hasSeenOnboarding', 'true')
                }}
                onComplete={() => {
                    setShowOnboarding(false)
                    localStorage.setItem('hasSeenOnboarding', 'true')
                }}
            />

            {
                state.isLoading ? (
                    <LoadingScreen statusText={state.loadingStatus} />
                ) : viewMode === 'comparison' ? (
                    // Comparison view - show on top, FlowCanvas stays mounted but hidden below
                    <>
                        <ComparisonView
                            branches={
                                selectedMessageIds.length >= 2
                                    ? conversationNodes.filter(n => n.id !== 'main' && !n.data?.isMain && n.data?.messages?.some((m: any) => selectedMessageIds.includes(m.id)))
                                    : conversationNodes.filter(n => n.id !== 'main' && !n.data?.isMain)
                            }
                            initialSelectedBranchIds={selectedBranchIds}
                            initialFocusedMessageIds={selectedMessageIds}
                            onClose={() => setViewMode('map')}
                            onSendMessage={sendMessage}
                        />
                        {/* Keep FlowCanvas mounted but hidden to preserve state */}
                        <div className="hidden">
                            <FlowCanvas
                                selectedAIs={selectedAIs}
                                onAddAI={addAI}
                                onRemoveAI={removeAI}
                                mainMessages={messages}
                                onSendMainMessage={sendMessage}
                                onBranchFromMain={branchFromMessage}
                                pendingBranchMessageId={pendingBranchMessageId}
                                pendingBranchData={pendingBranchData}
                                onPendingBranchProcessed={() => {
                                    setPendingBranchMessageId(null)
                                    setPendingBranchData(null)
                                }}
                                onNodesUpdate={updateConversationNodes}
                                onNodeDoubleClick={(nodeId) => {
                                    console.log('Node double-clicked:', nodeId)
                                }}
                                onPillClick={(aiId) => {
                                    console.log('Pill clicked:', aiId)
                                }}
                                getBestAvailableModel={getBestAvailableModel}
                                onSelectSingle={selectSingleAIById}
                                onExportImport={() => setShowExportImport(true)}
                                restoredConversationNodes={conversationNodes}
                                selectedBranchId={activeBranchId}
                                onBranchWarning={handleBranchWarning}
                                onMinimizeAllRef={(fn) => { minimizeAllRef.current = fn }}
                                onMaximizeAllRef={(fn) => { maximizeAllRef.current = fn }}
                                onAllNodesMinimizedChange={(minimized) => setAllNodesMinimized(minimized)}
                                onSelectionChange={setSelectedBranchIds}
                                onMessageSelectionChange={setSelectedMessageIds}
                                conversationId={currentConversationId}
                                onActiveNodeChange={(nodeId) => {
                                    if (nodeId && nodeId !== activeBranchId) {
                                        setActiveBranchId(nodeId)
                                        if (nodeId === 'main') {
                                            setCurrentBranch(null)
                                        } else {
                                            setCurrentBranch(nodeId)
                                        }
                                    }
                                }}
                                onEditMessage={editMessage}
                                checkLimit={checkLimit}
                            />
                        </div>
                    </>
                ) : (
                    // Unified View: Always render FlowCanvas, overlay EmptyState if empty
                    <>
                        <div className="absolute inset-0 z-0">
                            <FlowCanvas
                                selectedAIs={selectedAIs}
                                onAddAI={addAI}
                                onRemoveAI={removeAI}
                                mainMessages={messages}
                                onSendMainMessage={sendMessage}
                                onBranchFromMain={branchFromMessage}
                                pendingBranchMessageId={pendingBranchMessageId}
                                pendingBranchData={pendingBranchData}
                                onPendingBranchProcessed={() => {
                                    setPendingBranchMessageId(null)
                                    setPendingBranchData(null)
                                }}
                                onNodesUpdate={updateConversationNodes}
                                onNodeDoubleClick={(nodeId) => {
                                    console.log('Node double-clicked:', nodeId)
                                }}
                                onPillClick={(aiId) => {
                                    console.log('Pill clicked:', aiId)
                                }}
                                getBestAvailableModel={getBestAvailableModel}
                                onSelectSingle={selectSingleAIById}
                                onExportImport={() => setShowExportImport(true)}
                                restoredConversationNodes={conversationNodes}
                                selectedBranchId={activeBranchId}
                                onBranchWarning={handleBranchWarning}
                                onMinimizeAllRef={(fn) => { minimizeAllRef.current = fn }}
                                onMaximizeAllRef={(fn) => { maximizeAllRef.current = fn }}
                                onAllNodesMinimizedChange={(minimized) => setAllNodesMinimized(minimized)}
                                onSelectionChange={setSelectedBranchIds}
                                onMessageSelectionChange={setSelectedMessageIds}
                                conversationId={currentConversationId}
                                onActiveNodeChange={(nodeId) => {
                                    // Update active branch ID when node focus changes in canvas
                                    // This ensures persistence works correctly
                                    if (nodeId && nodeId !== activeBranchId) {
                                        setActiveBranchId(nodeId)
                                        if (nodeId === 'main') {
                                            setCurrentBranch(null)
                                        } else {
                                            setCurrentBranch(nodeId)
                                        }
                                    }
                                }}
                                onEditMessage={editMessage}
                                activeNodeId={state.activeNodeId} // Pass navigation target
                                checkLimit={checkLimit}
                            />
                        </div>


                    </>
                )
            }

            {
                (selectedBranchIds.filter(id => id !== 'main').length >= 2 || selectedMessageIds.length >= 2) && viewMode === 'map' && (
                    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
                        <div className="flex items-center gap-2 p-2 bg-card/95 backdrop-blur-md rounded-full border border-border shadow-lg">
                            {/* Compare Button */}
                            <button
                                onClick={() => {
                                    if (selectedMessageIds.length >= 2) {
                                        setViewMode('comparison')
                                    } else {
                                        const branchesToCompare = selectedBranchIds.filter(id => id !== 'main')
                                        if (branchesToCompare.length >= 2) {
                                            setViewMode('comparison')
                                        }
                                    }
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all duration-200 font-medium"
                            >
                                <ArrowsLeftRight className="w-4 h-4" />
                                <span>
                                    {selectedMessageIds.length >= 2
                                        ? `Compare ${selectedMessageIds.length}`
                                        : `Compare ${selectedBranchIds.filter(id => id !== 'main').length}`
                                    }
                                </span>
                            </button>

                            {/* Synthesize Button */}
                            <button
                                onClick={() => {
                                    if (checkLimit && !checkLimit('branch')) return
                                    setShowSynthesizeModal(true)
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-full hover:bg-amber-600 transition-all duration-200 font-medium"
                            >
                                <GitMerge className="w-4 h-4" />
                                <span>Synthesize</span>
                            </button>

                            {/* Clear Selection */}
                            <button
                                onClick={() => {
                                    setSelectedBranchIds([])
                                    setSelectedMessageIds([])
                                }}
                                className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                                title="Clear selection"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )
            }

            <ExportImportModal
                isOpen={showExportImport}
                onClose={() => setShowExportImport(false)}
                messages={messages}
                branches={branches}
                nodes={conversationNodes}
                edges={[]}
                onImport={handleImportConversation}
            />

            <CommandPalette
                commands={commandPaletteCommands}
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
            />

            <GlobalSearch
                isOpen={showGlobalSearch}
                onClose={() => setShowGlobalSearch(false)}
                nodes={conversationNodes}
                onNavigate={handleNavigateToSearchResult}
            />

            <SynthesizeModal
                isOpen={showSynthesizeModal}
                onClose={() => setShowSynthesizeModal(false)}
                selectedNodes={conversationNodes
                    .filter(n => selectedBranchIds.includes(n.id))
                    .map(n => ({
                        id: n.id,
                        label: n.data?.label || n.title || 'Branch',
                        messages: (n.data?.messages || n.messages || []).map((m: any) => ({
                            id: m.id,
                            text: m.text,
                            isUser: m.isUser
                        }))
                    }))}
                onSynthesize={(result) => {
                    console.log('Synthesis complete:', result)
                    // TODO: Create a new synthesized node with the result
                    // For now, just close the modal and clear selection
                    setShowSynthesizeModal(false)
                    setSelectedBranchIds([])
                    setSelectedMessageIds([])
                }}
            />
        </div >
    )
}

