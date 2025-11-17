'use client'

import dagre from 'dagre'
import { Node, Edge } from 'reactflow'
import type { LayoutConfig } from './types'

const DEFAULT_CONFIG: LayoutConfig = {
	direction: 'TB',
	nodeWidth: 1200,
	nodeHeight: 400,
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
	const baseHeight = 300
	// Height per message (approximate)
	const messageHeight = 60
	// Maximum height before scrolling
	const maxHeight = 850

	const calculatedHeight = baseHeight + messageCount * messageHeight
	const finalHeight = Math.min(calculatedHeight, maxHeight)

	return {
		width: 1200,
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
					targetPosition: 'top' as const,
					sourcePosition: 'bottom' as const
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

	// Group branches by branchGroupId before applying positions
	const groupedBranches = new Map<string, Node[]>()
	const ungroupedNodes: Node[] = []
	
	nodes.forEach((node) => {
		if (node.id === 'main') {
			ungroupedNodes.push(node)
		} else if (node.data?.branchGroupId) {
			const groupId = node.data.branchGroupId
			if (!groupedBranches.has(groupId)) {
				groupedBranches.set(groupId, [])
			}
			groupedBranches.get(groupId)!.push(node)
		} else {
			ungroupedNodes.push(node)
		}
	})

	// Apply calculated positions to nodes
	const layoutedNodes = nodes.map((node) => {
		try {
			const nodeWithPosition = dagreGraph.node(node.id)

			if (!nodeWithPosition || isNaN(nodeWithPosition.x) || isNaN(nodeWithPosition.y)) {
				console.warn('Invalid position for node:', node.id)
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
					position: node.position || { x: 400, y: 50 },
					targetPosition: 'top' as const,
					sourcePosition: 'bottom' as const
				}
			}

			const dims = calculateNodeDimensions(
				node.data?.messages?.length || 0,
				node.data?.isMinimized || false
			)

			// Calculate centered position
			let x = nodeWithPosition.x - dims.width / 2
			let y = nodeWithPosition.y - dims.height / 2

			// Find parent node to position relative to
			const parentNode = nodes.find(n => n.id === node.data?.parentId)
			
			// If this is a branch (not main), ensure it's aligned with other branches from the same parent
			if (parentNode && node.id !== 'main' && !node.data?.isMain) {
				// Get all branches from the same parent
				const siblingBranches = nodes.filter(n => 
					n.data?.parentId === parentNode.id && 
					n.id !== 'main' && 
					!n.data?.isMain
				)
				
				if (siblingBranches.length > 1) {
					// Multiple branches from same parent - align them all at the same Y
					const parentDims = calculateNodeDimensions(
						parentNode.data?.messages?.length || 0,
						parentNode.data?.isMinimized || false
					)
					
					// Get parent position from Dagre layout
					const parentPosition = dagreGraph.node(parentNode.id)
					const parentX = parentPosition ? parentPosition.x : (parentNode.position?.x || 400)
					const parentY = parentPosition ? parentPosition.y : (parentNode.position?.y || 50)
					
					// Calculate the top Y position for all branches from this parent
					const topEdgeY = parentY + (parentDims.height / 2) + rankSpacing
					
					// Build ordered list of branch units (groups + individual branches)
					// Each group is treated as a single unit for positioning
					const branchUnits: Array<{ type: 'group' | 'single', nodes: Node[], groupId?: string }> = []
					const processedNodes = new Set<string>()
					
					// First, add all grouped branches as units
					groupedBranches.forEach((group, groupId) => {
						const groupNodes = group.filter(n => siblingBranches.some(s => s.id === n.id))
						if (groupNodes.length > 0) {
							branchUnits.push({ type: 'group', nodes: groupNodes, groupId })
							groupNodes.forEach(n => processedNodes.add(n.id))
						}
					})
					
					// Then, add ungrouped branches as individual units
					siblingBranches.forEach(branch => {
						if (!processedNodes.has(branch.id)) {
							branchUnits.push({ type: 'single', nodes: [branch] })
						}
					})
					
					// Sort units by group ID or node ID for consistent ordering
					branchUnits.sort((a, b) => {
						if (a.groupId && b.groupId) return a.groupId.localeCompare(b.groupId)
						if (a.groupId) return -1
						if (b.groupId) return 1
						return a.nodes[0].id.localeCompare(b.nodes[0].id)
					})
					
					// Find which unit this node belongs to and its position within that unit
					let unitIndex = -1
					let positionInUnit = 0
					for (let i = 0; i < branchUnits.length; i++) {
						const unit = branchUnits[i]
						const nodeIndex = unit.nodes.findIndex(n => n.id === node.id)
						if (nodeIndex >= 0) {
							unitIndex = i
							positionInUnit = nodeIndex
							break
						}
					}
					
					if (unitIndex === -1) {
						// Fallback to simple positioning
						const sortedSiblings = siblingBranches.sort((a, b) => a.id.localeCompare(b.id))
						const branchIndex = sortedSiblings.findIndex(n => n.id === node.id)
						const totalWidth = siblingBranches.length > 1 
							? (siblingBranches.length - 1) * (dims.width + nodeSpacing)
							: 0
						const startX = parentX - totalWidth / 2
						x = startX + branchIndex * (dims.width + nodeSpacing)
						y = topEdgeY
					} else {
						// Calculate total width of all units
						// Total width = sum of (nodeWidth * nodeCount + spacing * (nodeCount - 1)) for each unit
						// Plus spacing between units
						let totalUnitsWidth = 0
						branchUnits.forEach((unit, idx) => {
							// Width of this unit = nodeWidth * nodeCount + spacing * (nodeCount - 1)
							// For single node: nodeWidth
							// For multiple nodes: nodeWidth * N + spacing * (N-1)
							if (unit.nodes.length === 1) {
								totalUnitsWidth += dims.width
							} else {
								totalUnitsWidth += unit.nodes.length * dims.width + (unit.nodes.length - 1) * nodeSpacing
							}
							// Add spacing between units (not after the last one)
							if (idx < branchUnits.length - 1) {
								totalUnitsWidth += nodeSpacing
							}
						})
						
						// Center all units around parent
						// startX is the left edge of the first unit
						const startX = parentX - totalUnitsWidth / 2
						
						// Calculate position for each unit
						let currentX = 0
						branchUnits.forEach((unit, idx) => {
							if (idx === unitIndex) {
								// This is our unit - calculate position within it
								const unitStartX = startX + currentX
								if (unit.nodes.length > 1) {
									// Multiple nodes in unit - spread them horizontally
									x = unitStartX + positionInUnit * (dims.width + nodeSpacing)
								} else {
									// Single node in unit - position at unit start
									x = unitStartX
								}
								y = topEdgeY
							}
							
							// Move to next unit position
							if (unit.nodes.length === 1) {
								currentX += dims.width
							} else {
								currentX += unit.nodes.length * dims.width + (unit.nodes.length - 1) * nodeSpacing
							}
							if (idx < branchUnits.length - 1) {
								currentX += nodeSpacing
							}
						})
					}
				}
			} else if (node.data?.branchGroupId && groupedBranches.has(node.data.branchGroupId)) {
				// Fallback: if parent not found but node is grouped, use group positioning
				const group = groupedBranches.get(node.data.branchGroupId)!
				const groupIndex = group.findIndex(n => n.id === node.id)
				const groupSize = group.length
				
				const parentNode = nodes.find(n => n.id === node.data?.parentId)
				if (parentNode) {
					const parentDims = calculateNodeDimensions(
						parentNode.data?.messages?.length || 0,
						parentNode.data?.isMinimized || false
					)
					
					const parentPosition = dagreGraph.node(parentNode.id)
					const parentX = parentPosition ? parentPosition.x : (parentNode.position?.x || 400)
					const parentY = parentPosition ? parentPosition.y : (parentNode.position?.y || 50)
					
					const groupWidth = (groupSize - 1) * (dims.width + nodeSpacing)
					const startX = parentX - groupWidth / 2
					const topEdgeY = parentY + (parentDims.height / 2) + rankSpacing
					
					x = startX + groupIndex * (dims.width + nodeSpacing)
					y = topEdgeY
				}
			}

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
				targetPosition: 'top' as const,
				sourcePosition: 'bottom' as const
			}
		} catch (error) {
			console.warn('Error processing node:', node.id, error)
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
				position: node.position || { x: 400, y: 50 },
				targetPosition: 'top' as const,
				sourcePosition: 'bottom' as const
			}
		}
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
	const centerY = (minY + maxY) / 2

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
	const nodeWidth = 1200
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
