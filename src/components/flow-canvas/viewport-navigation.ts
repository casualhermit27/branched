'use client'

import { ReactFlowInstance } from 'reactflow'
import type { ViewportState } from './types'
import { calculateViewportFit, calculateNodeDimensions } from './layout-engine'
import type { Node } from 'reactflow'

/**
 * Focus on a specific node with smooth animation
 */
export function focusOnNode(
	reactFlowInstance: ReactFlowInstance | null,
	nodeId: string,
	nodes: Node[],
	padding: number = 0.15
): void {
	if (!reactFlowInstance) return

	// Try to find node in instance first (most up to date positions)
	const instanceNodes = reactFlowInstance.getNodes()
	let targetNode = instanceNodes.find((n) => n.id === nodeId)
	let nodesToUse = instanceNodes

	// If not found in instance, try passed nodes (might be newer state not yet in instance)
	if (!targetNode) {
		targetNode = nodes.find((n) => n.id === nodeId)
		if (targetNode) {
			nodesToUse = nodes
		}
	}

	if (!targetNode) return

	const viewport = calculateViewportFit(nodesToUse, [nodeId], padding)

	reactFlowInstance.setViewport(
		{
			x: viewport.x,
			y: viewport.y,
			zoom: viewport.zoom
		},
		{
			duration: 350
		}
	)
}

/**
 * Focus on multiple nodes (fit viewport to show all)
 */
export function focusOnNodes(
	reactFlowInstance: ReactFlowInstance | null,
	nodeIds: string[],
	nodes: Node[],
	padding: number = 0.15
): void {
	if (!reactFlowInstance || nodeIds.length === 0) return

	// Use instance nodes to ensure we have latest positions
	const instanceNodes = reactFlowInstance.getNodes()
	// Fallback to passed nodes if instance is empty (unlikely)
	const nodesToUse = instanceNodes.length > 0 ? instanceNodes : nodes

	const viewport = calculateViewportFit(nodesToUse, nodeIds, padding)

	reactFlowInstance.setViewport(
		{
			x: viewport.x,
			y: viewport.y,
			zoom: viewport.zoom
		},
		{
			duration: 250
		}
	)
}

/**
 * Zoom in
 */
export function zoomIn(
	reactFlowInstance: ReactFlowInstance | null,
	step: number = 0.2
): void {
	if (!reactFlowInstance) return

	const currentZoom = reactFlowInstance.getZoom()
	const newZoom = Math.min(currentZoom + step, 3)

	reactFlowInstance.zoomTo(newZoom, {
		duration: 150
	})
}

/**
 * Zoom out
 */
export function zoomOut(
	reactFlowInstance: ReactFlowInstance | null,
	step: number = 0.2
): void {
	if (!reactFlowInstance) return

	const currentZoom = reactFlowInstance.getZoom()
	const newZoom = Math.max(currentZoom - step, 0.3)

	reactFlowInstance.zoomTo(newZoom, {
		duration: 150
	})
}

/**
 * Reset zoom and center
 */
export function resetViewport(
	reactFlowInstance: ReactFlowInstance | null
): void {
	if (!reactFlowInstance) return

	reactFlowInstance.setViewport(
		{ x: 0, y: 0, zoom: 1 },
		{ duration: 250 }
	)
}

/**
 * Get current viewport state
 */
export function getViewportState(
	reactFlowInstance: ReactFlowInstance | null
): ViewportState {
	if (!reactFlowInstance) {
		return { x: 0, y: 0, zoom: 1 }
	}

	const viewport = reactFlowInstance.getViewport()
	return {
		x: viewport.x,
		y: viewport.y,
		zoom: viewport.zoom
	}
}

/**
 * Focus on a newly created branch with smooth zoom-in animation
 * Centers the branch and zooms in slightly for better focus
 */
export function focusOnBranchWithZoom(
	reactFlowInstance: ReactFlowInstance | null,
	nodeId: string,
	nodes: Node[],
	padding: number = 0.25,
	zoomMultiplier: number = 1.3, // Increased zoom (30% more zoomed than fit)
	parentNodeId?: string
): void {
	if (!reactFlowInstance) return

	// Try to find node in instance first (most up to date positions)
	const instanceNodes = reactFlowInstance.getNodes()
	let targetNode = instanceNodes.find((n) => n.id === nodeId)
	let nodesToUse = instanceNodes

	// If not found in instance, try passed nodes (might be newer state not yet in instance)
	if (!targetNode) {
		targetNode = nodes.find((n) => n.id === nodeId)
		if (targetNode) {
			nodesToUse = nodes
		}
	}

	if (!targetNode) return

	// Calculate viewport to fit the branch
	const viewport = calculateViewportFit(nodesToUse, [nodeId], padding)

	// Apply zoom multiplier for slight zoom-in effect
	// Cap at reasonable max zoom (1.5x) to avoid zooming too much
	const targetZoom = Math.min(viewport.zoom * zoomMultiplier, 1.5)

	// Calculate custom center
	const targetDims = calculateNodeDimensions(
		targetNode.data?.messages?.length || 0,
		targetNode.data?.isMinimized || false
	)

	let centerX = targetNode.position.x + targetDims.width / 2
	let centerY = targetNode.position.y + targetDims.height / 2

	// If parent provided, use parent's X to keep vertical alignment stable
	// This prevents the "bottom left" jump feeling when branches spread horizontally
	if (parentNodeId) {
		const parentNode = nodesToUse.find(n => n.id === parentNodeId)
		if (parentNode) {
			const parentDims = calculateNodeDimensions(
				parentNode.data?.messages?.length || 0,
				parentNode.data?.isMinimized || false
			)
			// Use Parent's X center
			centerX = parentNode.position.x + parentDims.width / 2

			// Adjust Y to be slightly higher than the child center (closer to parent)
			// This helps show the connection and "moves the node a little top"
			// We bias 20% towards the parent
			const parentCenterY = parentNode.position.y + parentDims.height / 2
			centerY = centerY * 0.8 + parentCenterY * 0.2
		}
	}

	const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
	const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080

	const newX = viewportWidth / 2 - centerX * targetZoom
	const newY = viewportHeight / 2 - centerY * targetZoom

	reactFlowInstance.setViewport(
		{
			x: newX,
			y: newY,
			zoom: targetZoom
		},
		{
			duration: 400
		}
	)
}

/**
 * Highlight path from root to target node
 */
export function highlightPath(
	nodeId: string,
	nodes: Node[],
	edges: any[]
): { nodeIds: string[]; edgeIds: string[] } {
	const pathNodeIds: string[] = []
	const pathEdgeIds: string[] = []

	// Find path from main to target
	const findPath = (currentId: string, visited: Set<string>) => {
		if (visited.has(currentId)) return
		visited.add(currentId)
		pathNodeIds.push(currentId)

		if (currentId === 'main') return

		// Find parent edge
		const parentEdge = edges.find((e) => e.target === currentId)
		if (parentEdge) {
			pathEdgeIds.push(parentEdge.id)
			findPath(parentEdge.source, visited)
		}
	}

	findPath(nodeId, new Set())

	return {
		nodeIds: pathNodeIds.reverse(),
		edgeIds: pathEdgeIds.reverse()
	}
}

