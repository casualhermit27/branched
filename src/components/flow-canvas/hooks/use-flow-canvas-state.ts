'use client'

import { useState, useRef, useCallback } from 'react'
import { Node, Edge, ReactFlowInstance } from 'reactflow'
import type { AI, Message, ChatNodeData } from '../types'

export function useFlowCanvasState() {
	const [nodes, setNodes] = useState<Node<ChatNodeData>[]>([])
	const [edges, setEdges] = useState<Edge[]>([])
	const [minimizedNodes, setMinimizedNodes] = useState<Set<string>>(new Set())
	const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
	const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
	const [generatingNodeIds, setGeneratingNodeIds] = useState<Set<string>>(new Set())
	const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)

	// Branch-level state
	const [branchMultiModelMode, setBranchMultiModelMode] = useState<Map<string, boolean>>(new Map())
	const [branchSelectedAIs, setBranchSelectedAIs] = useState<Map<string, AI[]>>(new Map())

	// Refs
	const nodesRef = useRef<Node<ChatNodeData>[]>([])
	const edgesRef = useRef<Edge[]>([])
	const nodeIdCounterRef = useRef<number>(0)
	const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

	// Update refs when state changes
	const updateNodes = useCallback((newNodes: Node<ChatNodeData>[] | ((prev: Node<ChatNodeData>[]) => Node<ChatNodeData>[])) => {
		setNodes((prev) => {
			const updated = typeof newNodes === 'function' ? newNodes(prev) : newNodes
			nodesRef.current = updated
			return updated
		})
	}, [])

	const updateEdges = useCallback((newEdges: Edge[] | ((prev: Edge[]) => Edge[])) => {
		setEdges((prev) => {
			const updated = typeof newEdges === 'function' ? newEdges(prev) : newEdges
			edgesRef.current = updated
			return updated
		})
	}, [])

	// Node state management
	const toggleNodeMinimize = useCallback((nodeId: string) => {
		setMinimizedNodes((prev) => {
			const updated = new Set(prev)
			if (updated.has(nodeId)) {
				updated.delete(nodeId)
			} else {
				updated.add(nodeId)
			}
			return updated
		})
	}, [])

	const minimizeAllNodes = useCallback(() => {
		setMinimizedNodes(new Set(nodesRef.current.map((n) => n.id)))
	}, [])

	const maximizeAllNodes = useCallback(() => {
		setMinimizedNodes(new Set())
	}, [])

	const setNodeActive = useCallback((nodeId: string | null) => {
		setActiveNodeId(nodeId)
	}, [])

	const setNodeHighlighted = useCallback((nodeId: string | null) => {
		setHighlightedNodeId(nodeId)
	}, [])

	const setNodeGenerating = useCallback((nodeId: string, isGenerating: boolean) => {
		setGeneratingNodeIds((prev) => {
			const updated = new Set(prev)
			if (isGenerating) {
				updated.add(nodeId)
			} else {
				updated.delete(nodeId)
			}
			return updated
		})
	}, [])

	// Selection state management
	const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())

	const toggleNodeSelection = useCallback((nodeId: string, multi: boolean) => {
		setSelectedNodeIds((prev) => {
			const updated = new Set(multi ? prev : [])
			if (updated.has(nodeId)) {
				updated.delete(nodeId)
			} else {
				updated.add(nodeId)
			}
			return updated
		})
	}, [])

	const clearSelection = useCallback(() => {
		setSelectedNodeIds(new Set())
	}, [])

	// Branch-level state management
	const setBranchMultiModel = useCallback((nodeId: string, enabled: boolean) => {
		setBranchMultiModelMode((prev) => {
			const updated = new Map(prev)
			updated.set(nodeId, enabled)
			return updated
		})
	}, [])

	const getBranchMultiModel = useCallback((nodeId: string): boolean => {
		return branchMultiModelMode.get(nodeId) ?? false
	}, [branchMultiModelMode])

	const setBranchAIs = useCallback((nodeId: string, ais: AI[]) => {
		setBranchSelectedAIs((prev) => {
			const updated = new Map(prev)
			updated.set(nodeId, ais)
			return updated
		})
	}, [])

	const getBranchAIs = useCallback((nodeId: string, defaultAIs: AI[]): AI[] => {
		return branchSelectedAIs.get(nodeId) ?? defaultAIs
	}, [branchSelectedAIs])

	// Abort controller management
	const setAbortController = useCallback((nodeId: string, controller: AbortController | null) => {
		if (controller) {
			abortControllersRef.current.set(nodeId, controller)
		} else {
			abortControllersRef.current.delete(nodeId)
		}
	}, [])

	const getAbortController = useCallback((nodeId: string): AbortController | null => {
		return abortControllersRef.current.get(nodeId) ?? null
	}, [])

	const abortGeneration = useCallback((nodeId: string) => {
		const controller = abortControllersRef.current.get(nodeId)
		if (controller) {
			controller.abort()
			abortControllersRef.current.delete(nodeId)
			setNodeGenerating(nodeId, false)
		}
	}, [setNodeGenerating])

	return {
		// State
		nodes,
		edges,
		minimizedNodes,
		activeNodeId,
		highlightedNodeId,
		generatingNodeIds,
		reactFlowInstance,
		branchMultiModelMode,
		branchSelectedAIs,

		// Refs
		nodesRef,
		edgesRef,
		nodeIdCounterRef,
		abortControllersRef,

		// Setters
		setNodes: updateNodes,
		setEdges: updateEdges,
		setReactFlowInstance,

		// Node state
		toggleNodeMinimize,
		minimizeAllNodes,
		maximizeAllNodes,
		setNodeActive,
		setNodeHighlighted,
		setNodeGenerating,

		// Branch state
		setBranchMultiModel,
		getBranchMultiModel,
		setBranchAIs,
		getBranchAIs,

		// Abort controllers
		setAbortController,
		getAbortController,
		abortGeneration,

		// Selection
		selectedNodeIds,
		toggleNodeSelection,
		clearSelection
	}
}

