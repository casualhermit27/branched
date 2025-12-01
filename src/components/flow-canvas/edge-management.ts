'use client'

import { Edge, MarkerType } from 'reactflow'

export interface EdgeStyle {
	stroke: string
	strokeWidth: number
	strokeDasharray?: string
	animated?: boolean
}

/**
 * Color palette for different branch levels
 * Each level gets a subtly different color
 */
const LEVEL_COLORS = [
	'#8b5cf6', // Level 0 (main -> first level): Purple
	'#06b6d4', // Level 1 (first -> second level): Cyan
	'#10b981', // Level 2 (second -> third level): Emerald
	'#f59e0b', // Level 3 (third -> fourth level): Amber
	'#ef4444', // Level 4 (fourth -> fifth level): Red
	'#ec4899', // Level 5 (fifth -> sixth level): Pink
	'#6366f1', // Level 6 (sixth -> seventh level): Indigo
	'#14b8a6', // Level 7 (seventh -> eighth level): Teal
]

/**
 * Calculate branch level (depth from main node)
 */
export function calculateBranchLevel(
	parentNodeId: string,
	nodes: Array<{ id: string; data?: { parentId?: string; isMain?: boolean } }>
): number {
	if (parentNodeId === 'main') {
		return 0 // Main node is level 0
	}

	// Find parent node
	const parentNode = nodes.find((n) => n.id === parentNodeId)
	if (!parentNode) {
		return 0 // Fallback to level 0 if parent not found
	}

	// If parent is main, this is level 1
	if (parentNode.data?.isMain || parentNode.id === 'main') {
		return 1
	}

	// Recursively calculate parent's level + 1
	const parentLevel = calculateBranchLevel(
		parentNode.data?.parentId || 'main',
		nodes
	)
	return parentLevel + 1
}

/**
 * Get color for branch level
 */
export function getColorForLevel(level: number): string {
	// Use modulo to cycle through colors if level exceeds palette
	return LEVEL_COLORS[level % LEVEL_COLORS.length]
}

/**
 * Create an edge between two nodes with dotted connector
 */
export function createEdge(
	sourceId: string,
	targetId: string,
	options: {
		animated?: boolean
		type?: string
		style?: React.CSSProperties
		level?: number // Branch level for color calculation
		nodes?: Array<{ id: string; data?: { parentId?: string; isMain?: boolean } }> // Nodes for level calculation
	} = {}
): Edge {
	const { animated = false, type = 'bezier', style = {}, level, nodes } = options

	// Calculate level if not provided
	let edgeLevel = level
	if (edgeLevel === undefined && nodes) {
		edgeLevel = calculateBranchLevel(sourceId, nodes)
	}

	// Get color based on level (default to gray if level can't be determined)
	const strokeColor = edgeLevel !== undefined
		? getColorForLevel(edgeLevel)
		: (style.stroke as string) || '#cbd5e1'

	return {
		id: `edge-${sourceId}-${targetId}-${Date.now()}`,
		source: sourceId,
		target: targetId,
		type: 'default', // SmoothStep
		animated,
		style: {
			stroke: strokeColor || '#52525B', // Zinc 600
			strokeWidth: 2,
			strokeDasharray: '0', // Solid line
			...style
		},
		markerEnd: {
			type: MarkerType.ArrowClosed,
			width: 20,
			height: 20,
			color: strokeColor || '#52525B'
		}
	}
}

/**
 * Style edge based on relationship type
 */
export function styleEdgeForRelationship(
	edge: Edge,
	relationship: 'parent-child' | 'sibling' | 'context-link'
): Edge {
	const styles: Record<string, React.CSSProperties> = {
		'parent-child': {
			stroke: '#8b5cf6', // Purple for main branches
			strokeWidth: 2,
			strokeDasharray: '6 4'
		},
		sibling: {
			stroke: '#06b6d4', // Cyan for sibling branches
			strokeWidth: 2,
			strokeDasharray: '6 4'
		},
		'context-link': {
			stroke: '#f59e0b', // Amber for context links
			strokeWidth: 2.5,
			strokeDasharray: '8 4'
		}
	}

	return {
		...edge,
		style: {
			...edge.style,
			...styles[relationship]
		}
	}
}

/**
 * Create context link edge (amber colored)
 */
export function createContextLinkEdge(
	source: string,
	target: string
): Edge {
	return createEdge(source, target, {
		animated: false,
		type: 'default',
		style: {
			stroke: '#3B82F6', // Blue 500
			strokeWidth: 2.5,
			strokeDasharray: '8 4'
		}
	})
}

/**
 * Create edges for all branches from parent
 */
export function createBranchEdges(
	parentId: string,
	branchIds: string[],
	animated: boolean = false
): Edge[] {
	return branchIds.map((branchId) =>
		createEdge(parentId, branchId, {
			animated,
			type: 'default'
		})
	)
}

/**
 * Get edge style for hover/highlight state
 */
export function getEdgeStyleForState(
	edge: Edge,
	state: {
		isHovered?: boolean
		isHighlighted?: boolean
		isActive?: boolean
	}
): React.CSSProperties {
	const { isHovered, isHighlighted, isActive } = state

	if (isHighlighted) {
		return {
			stroke: '#3b82f6',
			strokeWidth: 3,
			strokeDasharray: '0',
			transition: 'all 0.3s ease-in-out'
		}
	}

	if (isHovered) {
		return {
			stroke: edge.style?.stroke || '#cbd5e1',
			strokeWidth: 3,
			strokeDasharray: '6 4',
			transition: 'all 0.2s ease-in-out',
			filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.3))'
		}
	}

	if (isActive) {
		return {
			stroke: '#8b5cf6',
			strokeWidth: 2.5,
			strokeDasharray: '6 4'
		}
	}

	return edge.style || {}
}

/**
 * Highlight edge (for path highlighting)
 */
export function highlightEdge(edge: Edge): Edge {
	return {
		...edge,
		style: {
			...edge.style,
			stroke: '#3b82f6', // blue-500
			strokeWidth: 3,
			animated: true
		}
	}
}

/**
 * Remove highlight from edge
 */
export function unhighlightEdge(edge: Edge, originalStyle?: EdgeStyle): Edge {
	return {
		...edge,
		style: originalStyle || {
			stroke: '#cbd5e1',
			strokeWidth: 2,
			animated: false
		}
	}
}

/**
 * Update edge style
 */
export function updateEdgeStyle(
	edge: Edge,
	updates: Partial<EdgeStyle>
): Edge {
	return {
		...edge,
		style: {
			...(edge.style as EdgeStyle),
			...updates
		}
	}
}

/**
 * Filter edges by source or target
 */
export function filterEdgesByNode(
	edges: Edge[],
	nodeId: string,
	direction: 'source' | 'target' | 'both' = 'both'
): Edge[] {
	return edges.filter((edge) => {
		if (direction === 'source') {
			return edge.source === nodeId
		}
		if (direction === 'target') {
			return edge.target === nodeId
		}
		return edge.source === nodeId || edge.target === nodeId
	})
}

/**
 * Remove edges connected to a node
 */
export function removeNodeEdges(edges: Edge[], nodeId: string): Edge[] {
	return edges.filter(
		(edge) => edge.source !== nodeId && edge.target !== nodeId
	)
}
