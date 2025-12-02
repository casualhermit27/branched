'use client'

import dagre from 'dagre'
import { Node, Edge, Position } from 'reactflow'
import type { LayoutConfig } from './types'

const DEFAULT_CONFIG: LayoutConfig = {
	direction: 'TB',
	nodeWidth: 1300,
	nodeHeight: 450,
	nodeSpacing: {
		horizontal: 400,
		vertical: 200
	}
}

export interface LayoutOptions {
	direction?: 'TB' | 'LR'
	nodeSpacing?: number
	rankSpacing?: number
	minimized?: boolean
}

/**
 * Calculate node dimensions based on message count and minimize state
 */
export function calculateNodeDimensions(
	messageCount: number,
	isMinimized: boolean
): { width: number; height: number } {
	if (isMinimized) {
		return { width: 280, height: 200 }
	}

	// Base height for header + input
	const baseHeight = 450
	// Height per message (approximate)
	const messageHeight = 100
	// Maximum height before scrolling
	const maxHeight = 1200

	const calculatedHeight = baseHeight + messageCount * messageHeight
	const finalHeight = Math.min(calculatedHeight, maxHeight)

	return {
		width: 1300,
		height: finalHeight
	}
}

/**
 * Apply Dagre layout to nodes
 */
export function getLayoutedElements(
	nodes: Node[],
	edges: Edge[],
	options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
	const { direction = 'TB', minimized = false } = options

	// Handle empty case
	if (nodes.length === 0) {
		return { nodes: [], edges }
	}

	// Single node - just center it
	if (nodes.length === 1) {
		const node = nodes[0]
		const dims = calculateNodeDimensions(
			node.data?.messages?.length || 0,
			node.data?.isMinimized || false
		)

		return {
			nodes: [
				{
					...node,
					position: { x: 400, y: 50 },
					width: dims.width,
					height: dims.height,
					targetPosition: Position.Top,
					sourcePosition: Position.Bottom
				}
			],
			edges
		}
	}

	// Check if all nodes are minimized
	const allMinimized = nodes.every((n) => n.data?.isMinimized)

	// Calculate spacing based on minimize state
	const nodeSpacing = allMinimized ? 200 : 500
	const rankSpacing = allMinimized ? 250 : 600

	// Create dagre graph
	const dagreGraph = new dagre.graphlib.Graph()
	dagreGraph.setDefaultEdgeLabel(() => ({}))
	dagreGraph.setGraph({
		rankdir: direction,
		ranksep: rankSpacing, // Vertical spacing
		nodesep: nodeSpacing, // Horizontal spacing
		marginx: 150,
		marginy: 150
	})

	// Add nodes to dagre
	nodes.forEach((node) => {
		const dims = calculateNodeDimensions(
			node.data?.messages?.length || 0,
			node.data?.isMinimized || false
		)

		dagreGraph.setNode(node.id, {
			width: dims.width,
			height: dims.height
		})
	})

	// Add edges to dagre
	edges.forEach((edge) => {
		try {
			dagreGraph.setEdge(edge.source, edge.target)
		} catch (error) {
			console.warn('Error adding edge to dagre:', error)
		}
	})

	// Run dagre layout
	try {
		dagre.layout(dagreGraph)
	} catch (error) {
		console.error('Dagre layout error:', error)
		return { nodes, edges }
	}

	type PositionedNode = {
		node: Node
		dims: { width: number; height: number }
		x: number
		y: number
		centerY: number
		parentId?: string
	}

	// First pass: Calculate all node positions and dimensions
	const nodePositions: PositionedNode[] = []
	const invalidNodes: Node[] = []

	nodes.forEach((node) => {
		try {
			const nodeWithPosition = dagreGraph.node(node.id)

			if (!nodeWithPosition || isNaN(nodeWithPosition.x) || isNaN(nodeWithPosition.y)) {
				console.warn('Invalid position for node:', node.id)
				invalidNodes.push(node)
				return
			}

			const dims = calculateNodeDimensions(
				node.data?.messages?.length || 0,
				node.data?.isMinimized || false
			)

			// Calculate centered position (Dagre's default)
			const x = nodeWithPosition.x - dims.width / 2
			const y = nodeWithPosition.y - dims.height / 2

			nodePositions.push({
				node,
				dims,
				x,
				y,
				centerY: nodeWithPosition.y, // Dagre's center Y position
				parentId: node.data?.parentId
			})

			// Special handling for main node to prevent jumping
			if (node.id === 'main' || node.data?.isMain) {
				// Pin main node to a fixed position or its current position if valid
				// We override the dagre calculated position for the main node to keep it stable
				const pinnedX = 400
				const pinnedY = 50

				// Adjust the offset for all other nodes based on how much main moved
				const offsetX = pinnedX - x
				const offsetY = pinnedY - y

				// We'll apply this offset after collecting all positions
				// For now, just mark this as the anchor
				// (This logic is simplified; a full implementation would shift everything relative to main)
			}
		} catch (error) {
			console.warn('Error processing node:', node.id, error)
			invalidNodes.push(node)
		}
	})

	// Group nodes by their parent to identify branches at the same level
	const nodesByParent = new Map<string, PositionedNode[]>()

	nodePositions.forEach((item) => {
		// Skip main node - only align branch nodes
		if (item.node.id === 'main' || item.node.data?.isMain) {
			return
		}

		const parentId = item.parentId || 'main'
		if (!nodesByParent.has(parentId)) {
			nodesByParent.set(parentId, [])
		}
		nodesByParent.get(parentId)!.push(item)
	})

	// Align branches at the same level by their top edge and group units
	nodesByParent.forEach((siblingNodes, parentId) => {
		if (siblingNodes.length <= 1) return // No alignment needed for single branch

		const parentNode = nodes.find((n) => n.id === parentId)
		const parentDims = calculateNodeDimensions(
			parentNode?.data?.messages?.length || 0,
			parentNode?.data?.isMinimized || false
		)
		const parentPosition = dagreGraph.node(parentId)
		const parentX = parentPosition?.x ?? parentNode?.position?.x ?? 400
		const parentY = parentPosition?.y ?? parentNode?.position?.y ?? 50
		const topEdgeY = parentY + parentDims.height / 2 + rankSpacing

		type BranchUnit = {
			type: 'group' | 'single'
			items: PositionedNode[]
			groupId?: string
		}

		const branchUnits: BranchUnit[] = []
		const groupMap = new Map<string, PositionedNode[]>()

		// Collect grouped branches
		siblingNodes.forEach((item) => {
			const groupId = item.node.data?.branchGroupId
			if (groupId) {
				if (!groupMap.has(groupId)) {
					groupMap.set(groupId, [])
				}
				groupMap.get(groupId)!.push(item)
			}
		})

		// Add grouped units first for consistent ordering
		Array.from(groupMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.forEach(([groupId, items]) => {
				// Sort items within group by node ID to ensure consistent order
				items.sort((a, b) => a.node.id.localeCompare(b.node.id))
				branchUnits.push({ type: 'group', items, groupId })
			})

		// Add remaining single branches sorted by node ID
		siblingNodes
			.filter((item) => !item.node.data?.branchGroupId)
			.sort((a, b) => a.node.id.localeCompare(b.node.id))
			.forEach((item) => {
				branchUnits.push({ type: 'single', items: [item] })
			})

		if (branchUnits.length === 0) {
			// Fallback to simple vertical alignment
			const minTopY = Math.min(...siblingNodes.map((item) => item.y))
			siblingNodes.forEach((item) => {
				item.y = minTopY
			})
			return
		}

		const getUnitWidth = (unit: BranchUnit) =>
			unit.items.reduce((sum, item, idx) => {
				const spacing = idx > 0 ? nodeSpacing : 0
				return sum + item.dims.width + spacing
			}, 0)

		// Total width = sum of unit widths + spacing between units
		const totalUnitsWidth = branchUnits.reduce((sum, unit, idx) => {
			const unitWidth = getUnitWidth(unit)
			const spacing = idx < branchUnits.length - 1 ? nodeSpacing : 0
			return sum + unitWidth + spacing
		}, 0)

		const startX = parentX - totalUnitsWidth / 2
		let currentX = 0

		branchUnits.forEach((unit, unitIndex) => {
			const unitStartX = startX + currentX
			let offsetWithinUnit = 0

			unit.items.forEach((item, itemIndex) => {
				item.x = unitStartX + offsetWithinUnit
				item.y = topEdgeY

				offsetWithinUnit += item.dims.width
				if (itemIndex < unit.items.length - 1) {
					offsetWithinUnit += nodeSpacing
				}
			})

			currentX += getUnitWidth(unit)
			if (unitIndex < branchUnits.length - 1) {
				currentX += nodeSpacing
			}
		})
	})

	// Apply calculated positions to nodes
	const layoutedNodes = nodePositions.map((item) => {
		const { node, dims, x, y } = item

		return {
			...node,
			// Preserve all node data, especially parentId
			data: {
				...node.data,
				// Ensure parentId is never the node's own ID
				parentId: node.data?.parentId && node.data.parentId !== node.id
					? node.data.parentId
					: node.data?.parentId || (node.id === 'main' ? undefined : 'main')
			},
			position: { x, y },
			width: dims.width,
			height: dims.height,
			targetPosition: Position.Top,
			sourcePosition: Position.Bottom
		}
	})

	// Re-center the entire graph around the main node
	const mainNode = layoutedNodes.find(n => n.id === 'main' || n.data?.isMain)
	if (mainNode) {
		const targetMainX = 400
		const targetMainY = 50
		const offsetX = targetMainX - mainNode.position.x
		const offsetY = targetMainY - mainNode.position.y

		if (offsetX !== 0 || offsetY !== 0) {
			layoutedNodes.forEach(node => {
				node.position.x += offsetX
				node.position.y += offsetY
			})
		}
	}

	// Add invalid nodes with fallback positions
	invalidNodes.forEach((node) => {
		const dims = calculateNodeDimensions(
			node.data?.messages?.length || 0,
			node.data?.isMinimized || false
		)
		layoutedNodes.push({
			...node,
			data: {
				...node.data,
				parentId: node.data?.parentId && node.data.parentId !== node.id
					? node.data.parentId
					: node.data?.parentId || (node.id === 'main' ? undefined : 'main')
			},
			position: node.position || { x: 400, y: 50 },
			width: dims.width,
			height: dims.height,
			targetPosition: Position.Top,
			sourcePosition: Position.Bottom
		})
	})

	// Validate positions
	const validatedNodes = validateNodePositions(layoutedNodes)

	return { nodes: validatedNodes, edges }
}

/**
 * Validate node positions to prevent NaN/Infinity
 */
export function validateNodePositions(nodes: Node[]): Node[] {
	return nodes.map((node) => {
		const position = node.position || { x: 400, y: 50 }
		const x =
			typeof position.x === 'number' && isFinite(position.x) && !isNaN(position.x)
				? position.x
				: 400
		const y =
			typeof position.y === 'number' && isFinite(position.y) && !isNaN(position.y)
				? position.y
				: 50

		const dims = calculateNodeDimensions(
			node.data?.messages?.length || 0,
			node.data?.isMinimized || false
		)

		return {
			...node,
			// Preserve all node data, especially parentId
			data: {
				...node.data,
				// Ensure parentId is never the node's own ID
				parentId: node.data?.parentId && node.data.parentId !== node.id
					? node.data.parentId
					: node.data?.parentId || (node.id === 'main' ? undefined : 'main')
			},
			position: { x, y },
			width: dims.width,
			height: dims.height
		}
	})
}

/**
 * Calculate viewport to fit specific nodes
 */
export function calculateViewportFit(
	nodes: Node[],
	nodeIds: string[],
	padding: number = 0.2
): { x: number; y: number; zoom: number } {
	const targetNodes = nodes.filter((n) => nodeIds.includes(n.id))

	if (targetNodes.length === 0) {
		return { x: 0, y: 0, zoom: 1 }
	}

	// Calculate bounds
	let minX = Infinity
	let maxX = -Infinity
	let minY = Infinity
	let maxY = -Infinity

	targetNodes.forEach((node) => {
		const dims = calculateNodeDimensions(
			node.data?.messages?.length || 0,
			node.data?.isMinimized || false
		)

		minX = Math.min(minX, node.position.x)
		maxX = Math.max(maxX, node.position.x + dims.width)
		minY = Math.min(minY, node.position.y)
		maxY = Math.max(maxY, node.position.y + dims.height)
	})

	const contentWidth = maxX - minX
	const contentHeight = maxY - minY
	const centerX = (minX + maxX) / 2
	// Add visual offset to move content up (camera down)
	// User reported focus was "off little down" (content too low)
	const centerY = (minY + maxY) / 2 + 50

	// Calculate zoom to fit
	const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
	const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080
	const availableWidth = viewportWidth * (1 - padding * 2)
	const availableHeight = viewportHeight * (1 - padding * 2)

	const zoomX = availableWidth / contentWidth
	const zoomY = availableHeight / contentHeight
	const zoom = Math.min(zoomX, zoomY, 1.0)

	return {
		x: viewportWidth / 2 - centerX * zoom,
		y: viewportHeight / 2 - centerY * zoom,
		zoom
	}
}

/**
 * Calculate position for a single branch below parent
 */
export function calculateSingleBranchPosition(
	parentNode: Node,
	parentNodeHeight: number
): { x: number; y: number } {
	return {
		x: parentNode.position.x,
		y: parentNode.position.y + parentNodeHeight + 100 // Gap below parent
	}
}

/**
 * Calculate positions for multiple branches (spread horizontally)
 */
export function calculateMultiBranchPositions(
	parentNode: Node,
	parentNodeHeight: number,
	branchCount: number
): Array<{ x: number; y: number }> {
	const nodeWidth = 1300
	const spacing = nodeWidth + 150 // Gap between branches

	// Calculate total width needed
	const totalWidth = (branchCount - 1) * spacing

	// Start X position (centered relative to parent)
	const startX = parentNode.position.x - totalWidth / 2

	// Y position (below parent)
	const yPosition = parentNode.position.y + parentNodeHeight + 100

	// Generate positions
	return Array.from({ length: branchCount }, (_, i) => ({
		x: startX + i * spacing,
		y: yPosition
	}))
}

/**
 * Calculate branch position relative to parent (legacy support)
 */
export function calculateBranchPosition(
	parentNode: Node,
	branchIndex: number,
	totalBranches: number,
	config: Partial<LayoutConfig> = {}
): { x: number; y: number } {
	const layoutConfig = { ...DEFAULT_CONFIG, ...config }
	const baseX = parentNode.position.x + layoutConfig.nodeSpacing.horizontal
	const baseY = parentNode.position.y

	if (totalBranches === 1) {
		return { x: baseX, y: baseY }
	}

	// Spread branches vertically
	const spacing = layoutConfig.nodeSpacing.vertical
	const startY = baseY - ((totalBranches - 1) * spacing) / 2
	return {
		x: baseX,
		y: startY + (branchIndex * spacing)
	}
}
