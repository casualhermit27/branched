'use client'

import { ReactFlowInstance } from 'reactflow'
import type { ViewportState } from './types'
import { calculateViewportFit } from './layout-engine'
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

	const targetNode = nodes.find((n) => n.id === nodeId)
	if (!targetNode) return

	const viewport = calculateViewportFit(nodes, [nodeId], padding)

	reactFlowInstance.setViewport(
		{
			x: viewport.x,
			y: viewport.y,
			zoom: viewport.zoom
		},
		{
			duration: 800,
			easing: (t: number) => t * (2 - t) // ease-out
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

	const viewport = calculateViewportFit(nodes, nodeIds, padding)

	reactFlowInstance.setViewport(
		{
			x: viewport.x,
			y: viewport.y,
			zoom: viewport.zoom
		},
		{
			duration: 800,
			easing: (t: number) => t * (2 - t)
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
		duration: 300
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
		duration: 300
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
		{ duration: 500 }
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
	zoomMultiplier: number = 1.15 // Slight zoom-in (15% more zoomed than fit)
): void {
	if (!reactFlowInstance) return

	const targetNode = nodes.find((n) => n.id === nodeId)
	if (!targetNode) return

	// Calculate viewport to fit the branch
	const viewport = calculateViewportFit(nodes, [nodeId], padding)

	// Apply zoom multiplier for slight zoom-in effect
	// Cap at reasonable max zoom (1.5x) to avoid zooming too much
	const targetZoom = Math.min(viewport.zoom * zoomMultiplier, 1.5)

	// Smooth ease-in-out easing for natural animation
	const easing = (t: number) => {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
	}

	reactFlowInstance.setViewport(
		{
			x: viewport.x,
			y: viewport.y,
			zoom: targetZoom
		},
		{
			duration: 1200, // Slower, smoother animation
			easing
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

