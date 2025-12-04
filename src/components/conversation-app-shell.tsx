'use client'

import { useState } from 'react'
import Image from 'next/image'

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
import { ArrowsIn, ArrowsOut, DotsThree, ArrowsLeftRight, MagnifyingGlass, Gear } from '@phosphor-icons/react'
import { GlobalSearch } from '@/components/global-search'
import type { ConversationState } from '@/hooks/use-conversation-state'
import type { ConversationActions } from '@/hooks/use-conversation-actions'
import { EmptyState } from '@/components/empty-state'

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
}

const MAX_DUPLICATE_BRANCHES = 6

export default function ConversationAppShell({
	state,
	actions,
	commandPaletteCommands
}: ConversationAppShellProps) {
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
	const [sidebarTab, setSidebarTab] = useState<'history' | 'settings'>('history')

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
		getBestAvailableModel
	} = actions

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
		<div className="h-screen bg-background overflow-hidden">
			{/* Floating Controls */}
			<div className="fixed top-4 right-4 z-50 flex items-center gap-2 p-1.5 bg-card/80 backdrop-blur-md border border-border/60 shadow-lg rounded-2xl">
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
							<div className="absolute top-full right-0 mt-2 bg-card dark:bg-card border border-border dark:border-border/60 shadow-lg z-50 min-w-[180px] rounded-xl backdrop-blur-sm overflow-hidden">
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
					<div className="flex items-center gap-1 pl-2 border-l border-border/50">
						<button
							onClick={() => setViewMode('map')}
							className={`p-2 rounded-xl transition-all duration-200 ${viewMode === 'map'
								? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm'
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

				<div className="w-px h-4 bg-border/50 mx-1"></div>

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
				messageCount={messages.length}
				onUpgrade={() => setShowPricingModal(true)}
				onDeleteConversation={handleDeleteConversation}
				isOpen={sidebarOpen}
				onOpenChange={setSidebarOpen}
				activeTab={sidebarTab}
				onTabChange={setSidebarTab}
				onExportData={() => setShowExportImport(true)}
			/>

			<PricingModal
				isOpen={showPricingModal}
				onClose={() => setShowPricingModal(false)}
				currentPlan="free"
			/>

			<OnboardingTour
				isOpen={showOnboarding}
				onClose={() => setShowOnboarding(false)}
				onComplete={() => {
					setShowOnboarding(false)
					localStorage.setItem('hasSeenOnboarding', 'true')
				}}
			/>

			{
				state.isLoading ? (
					<div className="flex items-center justify-center h-screen bg-background">
						<div className="flex flex-col items-center gap-4">
							<div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
							<p className="text-muted-foreground text-sm font-medium">Loading conversation...</p>
						</div>
					</div>
				) : (
					// Show empty state or content
					branches.length === 0 && conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length === 0 && !pendingBranchMessageId ? (
						messages.length === 0 ? (
							<EmptyState
								onSendMessage={sendMessage}
								selectedAIs={selectedAIs}
								onAddAI={addAI}
								onRemoveAI={removeAI}
								onSelectSingle={selectSingleAI}
								getBestAvailableModel={getBestAvailableModel}
							/>
						) : (
							<div className="flex items-center justify-center h-screen p-4">
								{/* Optional: Add a loading spinner here if needed */}
								<div className="w-full max-w-4xl border border-border rounded-2xl bg-card shadow-lg p-6">
									{conversationNodes.length > 0 && (
										<BranchNavigation
											branches={conversationNodes.filter(n => n.id !== 'main' && !n.isMain).map(n => ({
												id: n.id,
												label: n.title || 'Branch',
												parentId: n.parentId,
												parentMessageId: n.parentMessageId
											}))}
											currentBranchId={activeBranchId}
											onNavigateToBranch={handleSelectBranch}
											onNavigateToMain={() => {
												setActiveBranchId('main')
												setCurrentBranch(null)
											}}
										/>
									)}

									<div className="flex items-center justify-between mb-6">
										{/* AIPills moved to ChatInterface */}
									</div>

									<ChatInterface
										messages={messages}
										onSendMessage={sendMessage}
										selectedAIs={selectedAIs}
										onBranchFromMessage={branchFromMessage}
										currentBranch={currentBranch}
										isGenerating={isGenerating}
										onStopGeneration={stopGeneration}
										existingBranchesCount={conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length}
										isMain={true}
										onExportImport={() => setShowExportImport(true)}
										onAddAI={addAI}
										onRemoveAI={removeAI}
										onSelectSingle={selectSingleAIById}
										getBestAvailableModel={getBestAvailableModel}
									/>
								</div>
							</div>
						)
					) : (
						viewMode === 'comparison' ? (
							<ComparisonView
								branches={
									selectedMessageIds.length >= 2
										? conversationNodes.filter(n => n.id !== 'main' && !n.isMain && n.data?.messages?.some((m: any) => selectedMessageIds.includes(m.id)))
										: conversationNodes.filter(n => n.id !== 'main' && !n.isMain)
								}
								initialSelectedBranchIds={selectedBranchIds}
								initialFocusedMessageIds={selectedMessageIds}
								onClose={() => setViewMode('map')}
								onSendMessage={sendMessage}
							/>
						) : (
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
								conversationId={currentConversationIdRef.current}
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
							/>
						)
					)
				)
			}

			{
				(selectedBranchIds.filter(id => id !== 'main').length >= 2 || selectedMessageIds.length >= 2) && viewMode === 'map' && (
					<div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
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
							className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all duration-200 font-medium"
						>
							<ArrowsLeftRight className="w-5 h-5" />
							<span>
								{selectedMessageIds.length >= 2
									? `Compare ${selectedMessageIds.length} Messages`
									: `Compare ${selectedBranchIds.length} Branches`
								}
							</span>
						</button>
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
		</div >
	)
}

