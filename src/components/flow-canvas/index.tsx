'use client'

import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
import ReactFlow, {
	Background,
	Controls,
	MiniMap,
	NodeTypes,
	ReactFlowProvider,
	OnNodesChange,
	OnEdgesChange,
	type Node as ReactFlowNode,
	type Edge as ReactFlowEdge,
	type BackgroundVariant,
	applyNodeChanges,
	applyEdgeChanges
} from 'reactflow'
import 'reactflow/dist/style.css'
import ChatNode from '../chat-node'
import { useFlowCanvasState } from './hooks/use-flow-canvas-state'
import { useBranchManagement } from '@/hooks/use-branch-management'
import {
	getLayoutedElements,
	validateNodePositions,
	calculateViewportFit,
	calculateNodeDimensions
} from './layout-engine'
import { createMainNode, restoreNodesFromState } from './node-management'
import { focusOnNode, focusOnBranchWithZoom } from './viewport-navigation'
import { getParentChainMessages, buildConversationContext } from './message-handling'
import { createEdge } from './edge-management'
import { messageStore } from './message-store'
import { branchStore } from './branch-store'
import type { FlowCanvasProps, Message, AI } from './types'
import { aiService } from '@/services/ai-api'
import { GroupedBranchesContainer } from './grouped-branches-container'
import { BranchLinkModal, type LinkType } from '../branch-link-modal'
import { BranchCompareViewer } from '../branch-compare-viewer'
import type { ComparisonResult } from '@/services/branch-comparator'


const nodeTypes: NodeTypes = {
	chatNode: ChatNode
}

export default function FlowCanvas(props: FlowCanvasProps) {
	const {
		selectedAIs,
		onAddAI,
		onRemoveAI,
		mainMessages,
		onSendMainMessage,
		onBranchFromMain,
		initialBranchMessageId,
		pendingBranchMessageId,
		pendingBranchData,
		onPendingBranchProcessed,
		onNodesUpdate,
		onNodeDoubleClick,
		onPillClick,
		getBestAvailableModel,
		onSelectSingle,
		onExportImport,
		restoredConversationNodes,
		selectedBranchId,
		onBranchWarning,
		onMinimizeAllRef,
		onMaximizeAllRef,
		onAllNodesMinimizedChange,
		onSelectionChange,
		onMessageSelectionChange,
		conversationId
	} = props

	const state = useFlowCanvasState()
	const {
		nodes,
		edges,
		minimizedNodes,
		activeNodeId,
		generatingNodeIds,
		reactFlowInstance,
		nodesRef,
		edgesRef,
		setNodes,
		setEdges,
		setReactFlowInstance,
		toggleNodeMinimize,
		minimizeAllNodes,
		maximizeAllNodes,
		setNodeActive,
		selectedNodeIds,
		toggleNodeSelection,
		clearSelection,
		setNodeGenerating,
		setBranchAIs,
		getBranchAIs,
		branchSelectedAIs,
		setAbortController,
		abortGeneration,
		selectedMessageIds,
		toggleMessageSelection,
		clearMessageSelection
	} = state

	// Track initialization to prevent multiple triggers
	const isInitializedRef = useRef(false)
	const isRestoringRef = useRef(false)
	const layoutInProgressRef = useRef(false)
	const restoreFocusBranchIdRef = useRef<string | null>(null)

	// Branch link and compare state
	const [isReady, setIsReady] = useState(false)
	const [linkModalOpen, setLinkModalOpen] = useState(false)
	const [linkSourceBranchId, setLinkSourceBranchId] = useState<string | null>(null)
	const [compareModalOpen, setCompareModalOpen] = useState(false)
	const [compareBranchId, setCompareBranchId] = useState<string | null>(null)
	const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)


	// ============================================
	// BRANCH MANAGEMENT HOOKS & HANDLERS
	// ============================================

	const handleSendMessageRef = useRef<
		((nodeId: string, message: string) => Promise<void>) | undefined
	>(undefined)

	const handleBranchAddAI = useCallback(
		(nodeId: string, ai: AI) => {
			const currentAIs = getBranchAIs(nodeId, selectedAIs)
			if (!currentAIs.some((a) => a.id === ai.id)) {
				setBranchAIs(nodeId, [...currentAIs, ai])
			}
		},
		[getBranchAIs, selectedAIs, setBranchAIs]
	)

	const handleBranchRemoveAI = useCallback(
		(nodeId: string, aiId: string) => {
			const currentAIs = getBranchAIs(nodeId, selectedAIs)
			setBranchAIs(
				nodeId,
				currentAIs.filter((a) => a.id !== aiId)
			)
		},
		[getBranchAIs, selectedAIs, setBranchAIs]
	)

	const handleBranchSelectSingle = useCallback(
		(nodeId: string, aiId: string) => {
			const ai = selectedAIs.find((a) => a.id === aiId)
			if (ai) {
				setBranchAIs(nodeId, [ai])
			}
		},
		[selectedAIs, setBranchAIs]
	)

	const fitViewportToNodes = useCallback(
		(nodeIds: string[], padding = 0.2, useZoomAnimation = true) => {
			if (!reactFlowInstance) return

			// If focusing on a single node with animation, use our smooth custom transition
			// This prevents the "zoom out then zoom in" bounce effect of fitView
			if (nodeIds.length === 1 && useZoomAnimation) {
				focusOnBranchWithZoom(reactFlowInstance, nodeIds[0], nodes, padding, 1.1)
				return
			}

			reactFlowInstance.fitView({
				nodes: nodeIds.map((id) => ({ id })),
				padding,
				duration: useZoomAnimation ? 500 : 0
			})
		},
		[reactFlowInstance, nodes]
	)

	const getLayoutedElementsWrapper = useCallback(
		(nodes: any[], edges: any[], direction?: string) => {
			return getLayoutedElements(nodes, edges, { direction: direction as 'TB' | 'LR' })
		},
		[]
	)

	const handleDeleteBranch = useCallback(
		(branchId: string) => {
			if (branchId === 'main') return

			setNodes((prevNodes) => {
				const nodeToDelete = prevNodes.find((n) => n.id === branchId)
				if (!nodeToDelete) return prevNodes

				// Recursively find all children
				const findChildren = (parentId: string): string[] => {
					const children = prevNodes.filter((n) => n.data?.parentId === parentId)
					return [
						...children.map((c) => c.id),
						...children.flatMap((c) => findChildren(c.id))
					]
				}

				const childrenIds = findChildren(branchId)
				const idsToDelete = new Set([branchId, ...childrenIds])

				const updatedNodes = prevNodes.filter((n) => !idsToDelete.has(n.id))

				if (onNodesUpdate) {
					onNodesUpdate(updatedNodes)
				}

				return updatedNodes
			})

			setEdges((prevEdges) => {
				const updatedEdges = prevEdges.filter(
					(e) => e.source !== branchId && e.target !== branchId
				)
				return updatedEdges
			})

			// Remove from stores
			branchStore.delete(branchId)
		},
		[setNodes, setEdges, onNodesUpdate]
	)

	const handleLinkBranch = useCallback((branchId: string) => {
		setLinkSourceBranchId(branchId)
		setLinkModalOpen(true)
	}, [])

	const handleCreateLink = useCallback(
		(params: {
			sourceBranchId: string
			targetBranchId: string
			linkType: LinkType
			description?: string
			weight?: number
		}) => {
			const { targetBranchId, linkType } = params
			if (!linkSourceBranchId || !targetBranchId) return

			const newEdge = createEdge(linkSourceBranchId, targetBranchId, {
				animated: true,
				style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5 5' }
			})

			const labelMap: Record<LinkType, string> = {
				merge: 'Merge',
				reference: 'Reference',
				continuation: 'Continuation',
				alternative: 'Alternative'
			}

			const edgeWithData = {
				...newEdge,
				label: labelMap[linkType],
				data: { linkType }
			}

			setEdges((prev) => [...prev, edgeWithData])
			setLinkModalOpen(false)
			setLinkSourceBranchId(null)
		},
		[linkSourceBranchId, setEdges]
	)

	const handleCompareBranch = useCallback(
		async (branchId: string) => {
			if (!conversationId) {
				console.error('No conversation ID available')
				return
			}

			try {
				const response = await fetch('/api/branches/compare', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						branchIds: ['main', branchId],
						conversationId,
						includeSummary: true
					})
				})

				if (!response.ok) {
					const error = await response.json()
					throw new Error(error.error || 'Failed to compare branches')
				}

				const data = await response.json()
				setComparisonResult(data.comparison)
				setCompareModalOpen(true)
			} catch (error) {
				console.error('Error comparing branches:', error)
				alert(error instanceof Error ? error.message : 'Failed to compare branches')
			}
		},
		[conversationId]
	)

	const { handleBranch } = useBranchManagement({
		nodesRef,
		edgesRef,
		setNodes,
		setEdges,
		selectedAIs,
		mainMessages,
		onNodesUpdate,
		onBranchWarning,
		onNodeDoubleClick,
		handleBranchAddAI,
		handleBranchRemoveAI,
		handleBranchSelectSingle,
		getBestAvailableModel,
		validateNodePositions,
		getLayoutedElements: getLayoutedElementsWrapper,
		fitViewportToNodes,
		handleSendMessageRef,
		minimizedNodes,
		activeNodeId,
		toggleNodeMinimize,
		onDeleteBranch: handleDeleteBranch
	})

	// ============================================
	// HANDLERS (Stable References with useCallback)
	// ============================================

	const handleSendMainMessage = useCallback(
		async (nodeId: string, message: string) => {
			if (nodeId !== 'main') return
			await onSendMainMessage(message)
		},
		[onSendMainMessage]
	)

	const handleSendBranchMessage = useCallback(
		async (nodeId: string, message: string) => {
			if (nodeId === 'main') return

			const node = nodes.find((n) => n.id === nodeId)
			if (!node || !node.data) return

			const branchAIs = getBranchAIs(nodeId, selectedAIs)
			const contextMessages = getParentChainMessages(nodeId, nodes, mainMessages)

			setNodeGenerating(nodeId, true)
			const abortController = new AbortController()
			setAbortController(nodeId, abortController)

			const mapAIModel = (
				ai: AI
			): { modelName: string; supported: boolean; reason?: string; displayName: string } => {
				const supportedModels = new Set(['mistral', 'gemini'])
				const normalizedMap: Record<string, string> = {
					'mistral-large': 'mistral',
					mistral: 'mistral',
					'gemini-2.5-pro': 'gemini',
					gemini: 'gemini'
				}

				const displayName = ai.name || ai.id.toUpperCase()

				if (ai.id === 'best' && getBestAvailableModel) {
					const bestModel = getBestAvailableModel()
					const normalizedBest = normalizedMap[bestModel] || bestModel
					return {
						modelName: normalizedBest,
						supported: supportedModels.has(normalizedBest),
						displayName: `Best (${normalizedBest})`,
						reason: supportedModels.has(normalizedBest)
							? undefined
							: `Best model fallback (${normalizedBest}) is not connected yet.`
					}
				}

				const normalized =
					normalizedMap[ai.id] || normalizedMap[ai.id.toLowerCase()] || ai.id.toLowerCase()

				return {
					modelName: normalized,
					supported: supportedModels.has(normalized),
					displayName,
					reason: supportedModels.has(normalized)
						? undefined
						: `${displayName} isn't connected yet.`
				}
			}

			const buildMockResponse = (aiLabel: string, prompt: string) =>
				`This is a mock response from ${aiLabel} to: "${prompt}". (Replace this by wiring ${aiLabel} to your preferred provider.)`

			const userMessage: Message = {
				id: `msg-${Date.now()}-user`,
				text: message,
				isUser: true,
				timestamp: Date.now(),
				children: [],
				nodeId
			}

			setNodes((prev) => {
				const updated = prev.map((n) => {
					if (n.id === nodeId) {
						return {
							...n,
							data: {
								...n.data,
								messages: [...(n.data.messages || []), userMessage],
								metadata: {
									...(n.data.metadata || {}),
									lastActivity: Date.now()
								}
							}
						}
					}
					return n
				})
				// Trigger persistence after adding user message
				if (onNodesUpdate) {
					onNodesUpdate(updated)
				}
				return updated
			})

			messageStore.set(userMessage)
			if (nodeId !== 'main') {
				branchStore.addMessage(nodeId, userMessage.id)
			}

			try {
				const effectiveAIs = branchAIs.length > 0 ? branchAIs : selectedAIs
				console.log('🤖 handleSendBranchMessage - AI check:', {
					nodeId,
					branchAIs,
					selectedAIs,
					effectiveAIs,
					effectiveAIsLength: effectiveAIs.length
				})

				if (effectiveAIs.length === 0) {
					console.error('❌ No AI models selected for this branch')
					throw new Error('No AI models selected for this branch')
				}

				const groupId = effectiveAIs.length > 1 ? `group-${Date.now()}` : undefined
				const responseContext = [...contextMessages, userMessage]

				for (const ai of effectiveAIs) {
					const { modelName, supported, reason, displayName } = mapAIModel(ai)
					const streamingMessageId = `msg-${Date.now()}-${ai.id}`
					const streamingMessage: Message = {
						id: streamingMessageId,
						text: '',
						isUser: false,
						ai: ai.id,
						aiModel: ai.id,
						timestamp: Date.now(),
						children: [],
						nodeId,
						groupId,
						isStreaming: true,
						streamingText: ''
					}

					const finalizeStreamingMessage = (text: string) => {
						const finalizedMessage: Message = {
							...streamingMessage,
							text,
							isStreaming: false,
							streamingText: undefined
						}

						setNodes((prev) => {
							const updated = prev.map((n) => {
								if (n.id === nodeId) {
									const currentMessages = n.data.messages || []
									const messageExists = currentMessages.some((msg: Message) => msg.id === streamingMessageId)

									const newMessages = messageExists
										? currentMessages.map((msg: Message) => msg.id === streamingMessageId ? finalizedMessage : msg)
										: [...currentMessages, finalizedMessage]

									return {
										...n,
										data: {
											...n.data,
											messages: newMessages
										}
									}
								}
								return n
							})
							// Trigger persistence after finalizing AI response
							if (onNodesUpdate) {
								onNodesUpdate(updated)
							}
							return updated
						})

						messageStore.set(finalizedMessage)
						if (nodeId !== 'main') {
							branchStore.addMessage(nodeId, finalizedMessage.id)
						}
					}

					// ENFORCE MOCK MODE: Always use mock responses for development
					// This prevents calling real AI APIs and incurring costs
					const isSupported = false // Force mock mode

					if (!isSupported) {
						finalizeStreamingMessage(
							buildMockResponse(displayName, message)
						)
						continue
					}

					setNodes((prev) =>
						prev.map((n) => {
							if (n.id === nodeId) {
								return {
									...n,
									data: {
										...n.data,
										messages: [...(n.data.messages || []), streamingMessage]
									}
								}
							}
							return n
						})
					)

					try {
						const response = await aiService.generateResponse(
							modelName,
							message,
							{ messages: responseContext, currentBranch: nodeId, memoryContext: '' },
							(chunk: string) => {
								setNodes((prev) =>
									prev.map((n) => {
										if (n.id === nodeId) {
											return {
												...n,
												data: {
													...n.data,
													messages: (n.data.messages || []).map((msg: Message) =>
														msg.id === streamingMessageId
															? { ...msg, streamingText: (msg.streamingText || '') + chunk }
															: msg
													)
												}
											}
										}
										return n
									})
								)
							},
							abortController.signal
						)

						finalizeStreamingMessage(response.text)
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : 'Unknown model error'
						console.error(`Error generating response for ${ai.name}:`, error)
						finalizeStreamingMessage(
							buildMockResponse(displayName, message) + `\n\n⚠️ ${errorMessage}`
						)
					}
				}
			} catch (error) {
				if (error instanceof Error && error.name === 'AbortError') {
					console.log('Generation aborted')
				} else {
					console.error('Error generating response:', error)
				}
			} finally {
				setNodeGenerating(nodeId, false)
				setAbortController(nodeId, null)
			}
		},
		[
			nodes,
			selectedAIs,
			mainMessages,
			getBranchAIs,
			setNodeGenerating,
			setAbortController,
			setNodes,
			getBestAvailableModel
		]
	)

	// Update ref for hook usage
	useEffect(() => {
		handleSendMessageRef.current = handleSendBranchMessage
	}, [handleSendBranchMessage])

	const handleGenerateSummary = useCallback(async (): Promise<string> => {
		if (!comparisonResult || !conversationId) {
			return 'Unable to generate summary'
		}

		try {
			const response = await fetch('/api/branches/compare', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					branchIds: [comparisonResult.branch1Id, comparisonResult.branch2Id],
					conversationId,
					includeSummary: true
				})
			})

			if (!response.ok) {
				throw new Error('Failed to generate summary')
			}

			const data = await response.json()
			return data.comparison.summary || 'Summary generation failed'
		} catch (error) {
			console.error('Error generating summary:', error)
			return 'Failed to generate summary'
		}
	}, [comparisonResult, conversationId])

	// ============================================
	// MESSAGE SELECTION HANDLER
	// ============================================

	const handleMessageSelect = useCallback((messageId: string, isMulti: boolean) => {
		// If multi-select (Ctrl/Cmd click)
		if (isMulti) {
			const currentSelected = Array.from(state.selectedMessageIds)

			// If already selected, toggle it off (remove it)
			if (state.selectedMessageIds.has(messageId)) {
				state.toggleMessageSelection(messageId, true)
				return
			}

			// If trying to select more messages
			if (currentSelected.length >= 4) {
				console.warn("Maximum 4 messages can be selected for comparison")
				return
			}

			// Add to selection
			state.toggleMessageSelection(messageId, true)
		} else {
			// Single click - just select this one (clear others)
			state.toggleMessageSelection(messageId, false)
		}
	}, [state.selectedMessageIds, state.toggleMessageSelection])

	// ============================================
	// MEMOIZED NODE DATA (Prevent Unnecessary Updates)
	// ============================================

	const nodesWithHandlers = useMemo(() => {
		return nodes.map((node) => {
			// For branch nodes, initialize AIs from node data if not set in state map
			if (node.id !== 'main' && node.data?.selectedAIs) {
				const stateAIs = branchSelectedAIs.get(node.id)
				if (!stateAIs || stateAIs.length === 0) {
					// Initialize branch AIs from node data (set when branch was created)
					setBranchAIs(node.id, node.data.selectedAIs)
				}
			}

			const branchAIs = getBranchAIs(node.id, selectedAIs)

			return {
				...node,
				data: {
					...node.data,
					selectedAIs: node.id === 'main' ? selectedAIs : branchAIs,
					onSendMessage: node.id === 'main' ? handleSendMainMessage : handleSendBranchMessage,
					onToggleMinimize: toggleNodeMinimize,
					onDeleteBranch: node.id === 'main' ? undefined : handleDeleteBranch,
					onLinkBranch: node.id === 'main' ? undefined : handleLinkBranch,
					onCompareBranch: node.id === 'main' ? undefined : handleCompareBranch,
					onStopGeneration: () => abortGeneration(node.id),
					isMinimized: minimizedNodes.has(node.id),
					isSelected: selectedNodeIds.has(node.id),
					onToggleSelection: toggleNodeSelection,
					isActive: activeNodeId === node.id,
					isGenerating: generatingNodeIds.has(node.id),
					onMessageSelect: handleMessageSelect,
					selectedMessageIds: state.selectedMessageIds
				}
			}
		})
	}, [
		nodes,
		selectedAIs,
		minimizedNodes,
		activeNodeId,
		generatingNodeIds,
		getBranchAIs,
		setBranchAIs,
		branchSelectedAIs,
		handleSendMainMessage,
		handleSendBranchMessage,
		toggleNodeMinimize,
		handleDeleteBranch,
		handleLinkBranch,
		handleCompareBranch,
		abortGeneration,
		handleMessageSelect,
		state.selectedMessageIds,
		selectedNodeIds
	])

	// ============================================
	// INITIALIZATION
	// ============================================

	useEffect(() => {
		if (!isInitializedRef.current && nodes.length === 0) {
			isInitializedRef.current = true
			const mainNode = createMainNode(
				mainMessages,
				selectedAIs,
				{
					onAddAI,
					onRemoveAI,
					onSendMessage: handleSendMainMessage,
					onBranch: handleBranch,
					onExportImport,
					getBestAvailableModel,
					onSelectSingle
				},
				{
					isMinimized: minimizedNodes.has('main'),
					isActive: activeNodeId === 'main',
					isGenerating: generatingNodeIds.has('main'),
					onToggleMinimize: toggleNodeMinimize
				}
			)
			setNodes([mainNode])
		}
	}, []) // Run once on mount

	// ============================================
	// RESTORE NODES
	// ============================================

	useEffect(() => {
		if (
			restoredConversationNodes &&
			restoredConversationNodes.length > 0 &&
			nodes.length <= 1 &&
			!isRestoringRef.current
		) {
			isRestoringRef.current = true

			// Populate stores before restoring nodes
			// 1. Populate messageStore with all messages from nodes
			if (restoredConversationNodes) {
				restoredConversationNodes.forEach((node: any) => {
					// Check both node.messages (flat) and node.data.messages (nested)
					const messages = node.data?.messages || node.messages || []
					const inheritedMessages = node.data?.inheritedMessages || node.inheritedMessages || []
					const branchMessages = node.data?.branchMessages || node.branchMessages || []

					// Add all messages to store
					const allMessages = [...messages, ...inheritedMessages, ...branchMessages]
					allMessages.forEach((msg: Message) => {
						if (msg && msg.id) {
							messageStore.set(msg)
						}
					})
				})
			}

			// 2. Populate branchStore with branch contexts
			if (restoredConversationNodes) {
				restoredConversationNodes.forEach((node: any) => {
					if (node.id !== 'main' && (node.data?.contextSnapshot || node.contextSnapshot)) {
						const contextSnapshot = node.data?.contextSnapshot || node.contextSnapshot
						const branchContext = {
							branchId: node.id,
							parentBranchId: node.data?.parentId || node.parentId || 'main',
							contextSnapshot: contextSnapshot,
							branchMessageIds: (node.data?.branchMessages || node.branchMessages || []).map((m: Message) => m.id),
							metadata: {
								selectedAIs: node.data?.selectedAIs || node.selectedAIs || selectedAIs
							}
						}
						branchStore.set(branchContext)
					}
				})
			}

			const restored = restoreNodesFromState(
				restoredConversationNodes || [],
				mainMessages,
				selectedAIs,
				{
					onAddAI,
					onRemoveAI,
					onSendMessage: handleSendMainMessage,
					onBranch: handleBranch,
					onExportImport,
					getBestAvailableModel,
					onSelectSingle
				},
				{
					isMinimized: false,
					isActive: false,
					isGenerating: false
				}
			)

			// Reconstruct edges from node relationships
			const restoredEdges: ReactFlowEdge[] = []
			restored.forEach((node) => {
				if (node.id !== 'main' && (node as any).data?.parentId) {
					const parentId = (node as any).data.parentId
					const edge = createEdge(
						parentId,
						node.id,
						{
							animated: false,
							type: 'bezier',
							nodes: restored, // Pass nodes for level calculation
							style: {
								strokeWidth: 2,
								strokeDasharray: '6 4'
								// stroke color will be calculated based on level
							}
						}
					)
					restoredEdges.push(edge)
				}
			})

			// Check if nodes have valid positions, otherwise apply layout
			const hasValidPositions = restored.every((node) =>
				node.position &&
				typeof node.position.x === 'number' &&
				typeof node.position.y === 'number' &&
				!isNaN(node.position.x) &&
				!isNaN(node.position.y) &&
				isFinite(node.position.x) &&
				isFinite(node.position.y)
			)

			let finalNodes: ReactFlowNode[]
			if (hasValidPositions && restored.length > 0) {
				// Use saved positions
				finalNodes = restored
				setNodes(restored)
				setEdges(restoredEdges)
			} else {
				// Recalculate layout
				const layouted = getLayoutedElements(restored, restoredEdges, {
					direction: 'TB',
					minimized: false
				})
				const validated = validateNodePositions(layouted.nodes)
				finalNodes = validated
				setNodes(validated)
				setEdges(layouted.edges)
			}

			// Find latest branch worked on to focus after restoration
			// Priority: selectedBranchId prop > latest activity branch > active branch > last branch
			let branchToFocus: string | null = null

			if (selectedBranchId) {
				// Use selectedBranchId if provided
				const branchExists = finalNodes.find(n => n.id === selectedBranchId && n.id !== 'main')
				if (branchExists) {
					branchToFocus = selectedBranchId
				}
			}

			if (!branchToFocus) {
				// Find branch with latest activity (most recently worked on)
				const branches: ReactFlowNode[] = finalNodes.filter(n => n.id !== 'main')

				if (branches.length > 0) {
					// Find branch with most recent activity
					let latestBranch: ReactFlowNode | null = null
					let latestActivity = 0

					branches.forEach((branch: ReactFlowNode) => {
						// Check multiple sources for activity timestamp
						const branchData = branch.data || branch
						const messages = branchData.messages || branchData.branchMessages || []

						// Get latest activity from:
						// 1. metadata.lastActivity (from branch-service)
						// 2. updatedAt timestamp (from conversation model)
						// 3. Latest message timestamp
						// 4. createdAt as fallback
						let activityTime = 0

						if (branchData.metadata?.lastActivity) {
							activityTime = branchData.metadata.lastActivity
						} else if (branchData.updatedAt) {
							activityTime = new Date(branchData.updatedAt).getTime()
						} else if (messages.length > 0) {
							// Get latest message timestamp
							const latestMessage = messages[messages.length - 1]
							activityTime = latestMessage.timestamp || latestMessage.createdAt || 0
							if (typeof activityTime === 'string') {
								activityTime = new Date(activityTime).getTime()
							}
						} else if (branchData.createdAt) {
							activityTime = new Date(branchData.createdAt).getTime()
						}

						if (activityTime > latestActivity) {
							latestActivity = activityTime
							latestBranch = branch
						}
					})

					if (latestBranch) {
						branchToFocus = (latestBranch as ReactFlowNode).id
						console.log('🎯 Found latest branch by activity:', {
							id: branchToFocus,
							activity: latestActivity,
							label: (latestBranch as any).data?.label
						})
					}

					// Fallback: use active branch if no activity data found
					if (!branchToFocus) {
						const activeBranch = branches.find(
							n => n.data?.isActive || (n as any).data?.isActive
						)
						if (activeBranch) {
							branchToFocus = activeBranch.id
							console.log('🎯 Found active branch (fallback):', branchToFocus)
						} else if (branches.length > 0) {
							// Final fallback: last branch
							branchToFocus = branches[branches.length - 1].id
							console.log('🎯 Found last branch (fallback):', branchToFocus)
						}
					}
				}
			}

			// Store branch to focus for separate effect
			if (branchToFocus) {
				// Use a ref to track the branch we want to focus on after restoration
				restoreFocusBranchIdRef.current = branchToFocus
				console.log('🎯 Setting restoreFocusBranchIdRef:', branchToFocus)
			} else {
				console.log('⚠️ No branch found to focus on restoration')
			}

			setTimeout(() => {
				isRestoringRef.current = false
				// Fade in the canvas after restoration is complete
				setIsReady(true)
			}, 300) // Slight delay to allow layout to settle
		} else if (nodes.length === 0 && !restoredConversationNodes) {
			// If no nodes to restore (new conversation), just show it
			setIsReady(true)
		}
	}, [restoredConversationNodes, selectedBranchId, reactFlowInstance])

	// ============================================
	// FOCUS ON RESTORED BRANCH
	// ============================================

	// Focus on restored branch - use state instead of ref to trigger effect
	const [focusBranchId, setFocusBranchId] = useState<string | null>(null)

	useEffect(() => {
		console.log('🔍 Focus effect triggered:', {
			focusBranchId,
			hasInstance: !!reactFlowInstance,
			nodesLength: nodes.length,
			isRestoring: isRestoringRef.current,
			restoreFocusRef: restoreFocusBranchIdRef.current
		})

		// Sync ref to state when ref changes
		if (restoreFocusBranchIdRef.current && !focusBranchId) {
			console.log('🎯 Setting focusBranchId from ref:', restoreFocusBranchIdRef.current)
			setFocusBranchId(restoreFocusBranchIdRef.current)
			return
		}

		// Relaxed check: nodes.length > 0 is enough (main node + potentially others)
		if (focusBranchId && reactFlowInstance && nodes.length > 0 && !isRestoringRef.current) {
			console.log('🎯 Attempting to focus on branch:', focusBranchId)

			// Use getNodes() to ensure we have the latest nodes state
			const currentNodes = reactFlowInstance.getNodes()
			console.log('🔍 Current nodes:', currentNodes.map(n => ({ id: n.id, type: n.type })))
			const branchNode = currentNodes.find(n => n.id === focusBranchId)

			if (branchNode) {
				console.log('🎯 Branch node found, executing simple focus')
				// Wait for layout to settle
				requestAnimationFrame(() => {
					setTimeout(() => {
						console.log('🎯 Executing simple focus for:', focusBranchId)

						// Calculate viewport to center the node with 0.8x zoom
						// We can use fitView with specific node ID and maxZoom
						// Use focusOnBranchWithZoom for consistent animation
						focusOnBranchWithZoom(reactFlowInstance, focusBranchId, currentNodes, 0.25, 1.1)

						// Mark that we just performed a programmatic focus
						lastProgrammaticFocusRef.current = Date.now()

						setNodeActive(focusBranchId)
						setFocusBranchId(null) // Clear after focusing
						restoreFocusBranchIdRef.current = null
					}, 100) // Reduced delay
				})
			} else {
				console.log('⚠️ Branch node not found in current nodes:', focusBranchId)
				console.log('⚠️ Available node IDs:', currentNodes.map(n => n.id))
			}
		} else if (focusBranchId) {
			console.log('⏳ Waiting to focus...', {
				hasFocusId: !!focusBranchId,
				hasInstance: !!reactFlowInstance,
				nodesLength: nodes.length,
				isRestoring: isRestoringRef.current
			})
		}
	}, [focusBranchId, nodes.length, reactFlowInstance, setNodeActive])

	// ============================================
	// UPDATE MAIN NODE MESSAGES (Stable)
	// ============================================

	const mainMessagesString = JSON.stringify(mainMessages.map((m) => m.id))
	useEffect(() => {
		setNodes((prev) =>
			prev.map((node) => {
				if (node.id === 'main') {
					return {
						...node,
						data: {
							...node.data,
							messages: mainMessages
						}
					}
				}
				return node
			})
		)
	}, [mainMessagesString]) // Only update when message IDs change

	// ============================================
	// BRANCH CREATION TRIGGERS
	// ============================================

	const hasTriggeredInitialBranch = useRef(false)
	useEffect(() => {
		if (initialBranchMessageId && nodes.length > 0 && !hasTriggeredInitialBranch.current) {
			hasTriggeredInitialBranch.current = true
			handleBranch('main', initialBranchMessageId, false)
		}
	}, [initialBranchMessageId, nodes.length])

	// Track the last processed messageId to prevent duplicate processing of the same messageId
	const lastProcessedMessageIdRef = useRef<string | null>(null)
	const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		if (!pendingBranchMessageId) {
			lastProcessedMessageIdRef.current = null
			if (processingTimeoutRef.current) {
				clearTimeout(processingTimeoutRef.current)
				processingTimeoutRef.current = null
			}
			return
		}

		// If we already successfully processed this exact messageId, skip
		// But allow retries if messages weren't ready before
		if (lastProcessedMessageIdRef.current === pendingBranchMessageId && processingTimeoutRef.current) {
			console.log('⚠️ Already processing this messageId, skipping duplicate trigger:', pendingBranchMessageId)
			return
		}

		// Mark as processing (will be cleared after successful creation or failure)
		lastProcessedMessageIdRef.current = pendingBranchMessageId

		// Wait for nodes to be initialized (main node should exist)
		// Check if main node exists, or wait a bit for it to be created
		let timeoutId: NodeJS.Timeout | null = null
		let retryCount = 0
		const maxRetries = 20 // Increased retries to 1 second total

		const checkAndCreateBranch = () => {
			// Use nodesRef for always-fresh node data
			const currentNodes = nodesRef.current
			const mainNode = currentNodes.find(n => n.id === 'main')

			// Check both mainMessages prop AND mainNode.data.messages
			// mainMessages is the source of truth from page.tsx
			const hasMainMessages = mainMessages.length > 0
			const mainNodeHasMessages = mainNode?.data?.messages && mainNode.data.messages.length > 0
			const messageExists = mainMessages.some(m => m.id === pendingBranchMessageId)

			if (mainNode && hasMainMessages && messageExists) {
				// Main node exists, messages are available, and target message exists
				console.log('✅ Ready to create branch - main node, messages, and target message all found:', {
					mainNode: !!mainNode,
					mainMessagesCount: mainMessages.length,
					targetMessageId: pendingBranchMessageId,
					messageExists
				})

				// Get isMultiBranch from pendingBranchData if available
				const isMultiBranch = pendingBranchData?.isMultiBranch ?? false
				const parentNodeForBranch = pendingBranchData?.parentNodeId || 'main'
				const allowDuplicate = pendingBranchData?.allowDuplicate ?? false
				const branchGroupId = pendingBranchData?.branchGroupId

				console.log('🔍 Creating branch with isMultiBranch:', {
					isMultiBranch,
					fromPendingBranchData: pendingBranchData?.isMultiBranch,
					selectedAIsCount: selectedAIs.length
				})

				// Create branch
				handleBranch(parentNodeForBranch, pendingBranchMessageId, isMultiBranch, {
					allowDuplicate,
					branchGroupId
				})

				// Clear processing timeout
				if (processingTimeoutRef.current) {
					clearTimeout(processingTimeoutRef.current)
					processingTimeoutRef.current = null
				}

				// Mark as processed and clear pending after a delay to allow branch creation to complete
				processingTimeoutRef.current = setTimeout(() => {
					lastProcessedMessageIdRef.current = null
					processingTimeoutRef.current = null
					onPendingBranchProcessed?.()
				}, 300) // Increased delay to ensure branch is created
			} else if (retryCount < maxRetries) {
				// Wait a bit more for main node to be created or messages to be loaded
				retryCount++
				if (!mainNode) {
					console.log(`⏳ Waiting for main node... (retry ${retryCount}/${maxRetries})`)
				} else if (!hasMainMessages) {
					console.log(`⏳ Waiting for main messages... (retry ${retryCount}/${maxRetries})`)
				} else if (!messageExists) {
					console.log(`⏳ Waiting for target message ${pendingBranchMessageId} to be available... (retry ${retryCount}/${maxRetries})`)
				}
				timeoutId = setTimeout(checkAndCreateBranch, 50)
			} else {
				// Give up after max retries
				console.error('❌ Failed to create branch after retries:', {
					mainNode: !!mainNode,
					hasMainMessages,
					messageExists,
					targetMessageId: pendingBranchMessageId,
					availableMessageIds: mainMessages.map(m => m.id)
				})
				// Reset processing flag so user can try again
				lastProcessedMessageIdRef.current = null
				if (processingTimeoutRef.current) {
					clearTimeout(processingTimeoutRef.current)
					processingTimeoutRef.current = null
				}
				// Don't clear pendingBranchMessageId - let user retry or wait for messages to load
			}
		}

		// Start checking after a small delay to allow React Flow to initialize
		timeoutId = setTimeout(checkAndCreateBranch, 100)

		return () => {
			if (timeoutId) clearTimeout(timeoutId)
		}
	}, [pendingBranchMessageId, mainMessages, handleBranch, onPendingBranchProcessed]) // Removed nodes from dependencies to prevent excessive re-runs

	// ============================================
	// NAVIGATION
	// ============================================

	useEffect(() => {
		if (selectedBranchId && reactFlowInstance && nodes.length > 0) {
			const branchNode = nodes.find(n => n.id === selectedBranchId && n.id !== 'main')
			if (branchNode) {
				// Use zoom animation for branch focus
				setTimeout(() => {
					focusOnBranchWithZoom(reactFlowInstance, selectedBranchId, nodes, 0.25, 1.1)
					setNodeActive(selectedBranchId)
				}, 100)
			}
		}
	}, [selectedBranchId, reactFlowInstance, nodes.length])

	// Center viewport on active node when it changes (only for branches, not main)
	useEffect(() => {
		if (activeNodeId && reactFlowInstance && nodes.length > 0 && activeNodeId !== 'main') {
			// Only center if the active node exists in the nodes array and is a branch
			const activeNode = nodes.find(n => n.id === activeNodeId && n.id !== 'main')
			if (activeNode) {
				// Only auto-focus if we haven't just done a programmatic focus (within last 1s)
				const timeSinceProgrammaticFocus = Date.now() - (lastProgrammaticFocusRef.current || 0)

				if (timeSinceProgrammaticFocus > 1000) {
					// Use a small delay to ensure layout is complete, then focus with zoom
					const timeoutId = setTimeout(() => {
						focusOnBranchWithZoom(reactFlowInstance, activeNodeId, nodes, 0.25, 1.1)
					}, 300)
					return () => clearTimeout(timeoutId)
				}
			}
		}
	}, [activeNodeId, reactFlowInstance, nodes.length])

	// ============================================
	// LAYOUT ON MINIMIZE CHANGE (Debounced)
	// ============================================

	const previousNodesRef = useRef<ReactFlowNode[]>([])
	const lastProgrammaticFocusRef = useRef<number>(0)

	// Helper to determine if layout should be applied
	const shouldApplyLayout = useCallback(
		(currentNodes: ReactFlowNode[], currentEdges: ReactFlowEdge[]): boolean => {
			// Only apply layout if:
			// 1. Node count changed (branch added/removed)
			// 2. Minimize state changed
			// 3. Messages changed significantly

			if (currentNodes.length !== previousNodesRef.current.length) return true

			const minimizeStateChanged = currentNodes.some((node, i) => {
				const prev = previousNodesRef.current[i]
				const nodeData = (node as any).data
				const prevData = (prev as any)?.data
				return nodeData?.isMinimized !== prevData?.isMinimized
			})

			if (minimizeStateChanged) return true

			const messageCountChanged = currentNodes.some((node, i) => {
				const prev = previousNodesRef.current[i]
				const nodeData = (node as any).data
				const prevData = (prev as any)?.data
				return nodeData?.messages?.length !== prevData?.messages?.length
			})

			return messageCountChanged
		},
		[]
	)

	useEffect(() => {
		if (
			nodes.length > 0 &&
			!layoutInProgressRef.current &&
			shouldApplyLayout(nodes, edges)
		) {
			layoutInProgressRef.current = true

			const timeoutId = setTimeout(() => {
				const allMinimized = nodes.every((n) => n.data?.isMinimized)
				const layouted = getLayoutedElements(nodes, edges, {
					direction: 'TB',
					minimized: allMinimized
				})
				const validated = validateNodePositions(layouted.nodes)
				setNodes(validated)
				setEdges(layouted.edges)
				previousNodesRef.current = validated

				setTimeout(() => {
					layoutInProgressRef.current = false
				}, 100)
			}, 150)

			return () => clearTimeout(timeoutId)
		}
	}, [nodes.length, minimizedNodes.size, nodes.map((n) => n.data?.messages?.length).join(',')])

	// ============================================
	// EXPOSE FUNCTIONS
	// ============================================

	useEffect(() => {
		if (onMinimizeAllRef) {
			onMinimizeAllRef(minimizeAllNodes)
		}
	}, [onMinimizeAllRef, minimizeAllNodes])

	useEffect(() => {
		if (onMaximizeAllRef) {
			onMaximizeAllRef(maximizeAllNodes)
		}
	}, [onMaximizeAllRef, maximizeAllNodes])

	useEffect(() => {
		if (onAllNodesMinimizedChange) {
			const allMinimized = nodes.length > 0 && nodes.every((n) => minimizedNodes.has(n.id))
			onAllNodesMinimizedChange(allMinimized)
		}
	}, [nodes.length, minimizedNodes.size])

	useEffect(() => {
		if (onSelectionChange) {
			onSelectionChange(Array.from(selectedNodeIds))
		}
	}, [selectedNodeIds, onSelectionChange])

	useEffect(() => {
		if (onMessageSelectionChange) {
			onMessageSelectionChange(Array.from(selectedMessageIds))
		}
	}, [selectedMessageIds, onMessageSelectionChange])

	// ============================================
	// EVENT HANDLERS
	// ============================================

	const onNodeClick = useCallback(
		(_event: React.MouseEvent, node: any) => {
			// Handle multi-selection with Command/Ctrl key
			if (_event.metaKey || _event.ctrlKey) {
				toggleNodeSelection(node.id, true)
				return
			}

			// Clear selection if clicking without modifier
			if (selectedNodeIds.size > 0) {
				clearSelection()
			}

			setNodeActive(node.id)
			// Update lastActivity when node is clicked/selected
			if (node.id !== 'main') {
				setNodes((prev) =>
					prev.map((n) => {
						if (n.id === node.id) {
							return {
								...n,
								data: {
									...n.data,
									metadata: {
										...n.data.metadata,
										lastActivity: Date.now()
									}
								}
							}
						}
						return n
					})
				)
			}
		},
		[toggleNodeSelection, selectedNodeIds, clearSelection, setNodeActive, setNodes]
	)



	const onNodeDoubleClickHandler = useCallback(
		(_event: React.MouseEvent, node: any) => {
			if (onNodeDoubleClick) {
				onNodeDoubleClick(node.id)
			}
			if (reactFlowInstance) {
				focusOnNode(reactFlowInstance, node.id, nodes)
			}
		},
		[onNodeDoubleClick, reactFlowInstance, nodes]
	)

	const onNodesChangeHandler: OnNodesChange = useCallback(
		(changes) => {
			// DON'T trigger layout here - it causes infinite loop
			// ============================================
			setNodes((nds) => applyNodeChanges(changes, nds))
		},
		[setNodes]
	)

	const onEdgesChangeHandler: OnEdgesChange = useCallback((changes) => {
		setEdges((eds) => applyEdgeChanges(changes, eds))
	}, [setEdges])

	return (
		<ReactFlowProvider>
			<div className={`w-full h-screen transition-opacity duration-700 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
				<ReactFlow
					nodes={nodesWithHandlers}
					edges={edges}
					nodeTypes={nodeTypes}
					onNodesChange={onNodesChangeHandler}
					onEdgesChange={onEdgesChangeHandler}
					onNodeClick={onNodeClick}
					onNodeDoubleClick={onNodeDoubleClickHandler}
					onInit={setReactFlowInstance}
					fitView
					fitViewOptions={{
						padding: 0.2,
						maxZoom: 1.2, // Prevent zooming in too much - keeps background visible
						minZoom: 0.1
					}}
					defaultViewport={{ x: 0, y: 0, zoom: 0.8 }} // Default zoom that shows background
					attributionPosition="bottom-left"
					proOptions={{ hideAttribution: true }}
				>
					<Background variant={"dots" as BackgroundVariant} gap={20} size={1} />
					<Controls />
					<MiniMap
						nodeColor={(node) => {
							if (node.id === 'main') return '#8b5cf6'
							if (node.data?.isActive) return '#3b82f6'
							if (node.data?.isMinimized) return '#94a3b8'
							return '#64748b'
						}}
						maskColor="rgba(0, 0, 0, 0.1)"
					/>
					<GroupedBranchesContainer nodes={nodesWithHandlers} />
				</ReactFlow>

				{/* Branch Link Modal */}
				<BranchLinkModal
					isOpen={linkModalOpen}
					onClose={() => {
						setLinkModalOpen(false)
						setLinkSourceBranchId(null)
					}}
					onConfirm={handleCreateLink}
					sourceBranchId={linkSourceBranchId || ''}
					availableBranches={nodes
						.filter(n => n.id !== 'main' && n.id !== linkSourceBranchId)
						.map(n => ({
							id: n.id,
							label: n.data?.label || `Branch ${n.id.slice(-6)}`
						}))}
				/>

				{/* Branch Compare Viewer */}
				<BranchCompareViewer
					isOpen={compareModalOpen}
					onClose={() => {
						setCompareModalOpen(false)
						setCompareBranchId(null)
						setComparisonResult(null)
					}}
					comparison={comparisonResult}
					onGenerateSummary={handleGenerateSummary}
				/>

				{/* Side-by-Side Compare View */}

			</div>
		</ReactFlowProvider>
	)
}
