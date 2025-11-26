'use client'

import FlowCanvas from '@/components/flow-canvas/index'
import AIPills from '@/components/ai-pills'
import ChatInterface from '@/components/chat-interface'
import ChatBranchesView from '@/components/chat-branches-view'
import { ComparisonView } from '@/components/comparison-view'
import { PricingModal } from '@/components/pricing-modal'
import { OnboardingTour } from '@/components/onboarding-tour'
import Sidebar from '@/components/sidebar'
import ExportImportModal from '@/components/export-import-modal'
import { CommandPalette } from '@/components/command-palette'
import { ThemeToggle } from '@/components/theme-toggle'
import { BranchWarningModal } from '@/components/branch-warning-modal'
import { BranchNavigation } from '@/components/branch-navigation'
import { ArrowsIn, ArrowsOut, DotsThree, ArrowsLeftRight } from '@phosphor-icons/react'
import type { ConversationState } from '@/hooks/use-conversation-state'
import type { ConversationActions } from '@/hooks/use-conversation-actions'

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

	return (
		<div className="h-screen bg-background overflow-hidden">
			<div className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
				<div className="flex items-center justify-between px-4 py-3">
					<div className="w-10"></div>

					{viewMode === 'chat' && conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length > 0 && (
						<h1 className="text-lg font-semibold text-foreground">Conversation Branches</h1>
					)}

					<div className="flex items-center gap-2">
						{viewMode === 'map' && conversationNodes.length > 0 && (
							<div className="relative" ref={menuRef}>
								<button
									onClick={() => setShowMenu(!showMenu)}
									className="p-2 rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/80"
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
							<div className="bg-card border border-border/60 dark:border-border/40 rounded-xl shadow-lg p-1 flex items-center gap-1">
								<button
									onClick={() => setViewMode('map')}
									className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'map'
										? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm'
										: 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80'
										}`}
									title="Map View - Visual graph of all branches"
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M3 3h18v18H3zM3 9h18M9 3v18" />
									</svg>
								</button>
								<button
									onClick={() => setViewMode('comparison')}
									className={`p-2 rounded-lg transition-colors ${viewMode === 'comparison'
										? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
										: 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80'
										}`}
									title="Comparison View"
								>
									<ArrowsLeftRight className="w-5 h-5" />
								</button>
								<button
									onClick={() => setViewMode('chat')}
									className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'chat'
										? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm'
										: 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80'
										}`}
									title="Chat View - Focused conversation threads"
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
									</svg>
								</button>
							</div>
						)}
						<ThemeToggle />
					</div>
				</div>
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

			{branches.length === 0 && conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length === 0 && !pendingBranchMessageId ? (
				<div className="flex items-center justify-center h-screen p-4">
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
							<AIPills
								selectedAIs={selectedAIs}
								onAddAI={addAI}
								onRemoveAI={removeAI}
								onSelectSingle={selectSingleAI}
								showAddButton={true}
								getBestAvailableModel={getBestAvailableModel}
							/>

							<button
								onClick={() => setShowExportImport(true)}
								className="px-4 py-2 bg-muted hover:bg-accent text-foreground rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
								</svg>
								Export/Import
							</button>
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
						/>
					</div>
				</div>
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
					/>
				) : conversationNodes.filter(n => n.id !== 'main' && !n.isMain).length > 0 && viewMode === 'chat' ? (
					<ChatBranchesView
						mainMessages={messages}
						branches={conversationNodes}
						selectedAIs={selectedAIs}
						onAddAI={addAI}
						onRemoveAI={removeAI}
						onSelectSingle={selectSingleAI}
						getBestAvailableModel={getBestAvailableModel}
						onSendMessage={sendMessage}
						onBranchFromMessage={branchFromMessage}
						isGenerating={isGenerating}
						onStopGeneration={stopGeneration}
						activeBranchId={activeBranchId}
						onSelectBranch={handleSelectBranch}
						onDeleteBranch={handleDeleteBranch}
					/>
				) : (
					<FlowCanvas
						selectedAIs={selectedAIs}
						onAddAI={addAI}
						onRemoveAI={removeAI}
						mainMessages={messages}
						onSendMainMessage={sendMessage}
						onBranchFromMain={branchFromMessage}
						initialBranchMessageId={currentBranch}
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
					/>
				)
			)}

			{(selectedBranchIds.filter(id => id !== 'main').length >= 2 || selectedMessageIds.length >= 2) && viewMode === 'map' && (
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
			)}

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
		</div>
	)
}

