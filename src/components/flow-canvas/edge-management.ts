'use client'

import { Edge, MarkerType } from 'reactflow'

export interface EdgeStyle {
	stroke: string
	strokeWidth: number
	strokeDasharray?: string
	animated?: boolean
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
	} = {}
): Edge {
	const { animated = false, type = 'smoothstep', style = {} } = options

	return {
		id: `edge-${sourceId}-${targetId}-${Date.now()}`,
		source: sourceId,
		target: targetId,
		type,
		animated,
		style: {
			stroke: '#cbd5e1',
			strokeWidth: 2,
			strokeDasharray: '6 4', // Dotted line
			...style
		},
		markerEnd: {
			type: MarkerType.ArrowClosed,
			width: 20,
			height: 20,
			color: '#cbd5e1'
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
		type: 'smoothstep',
		style: {
			stroke: '#f59e0b', // amber-500
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
			type: 'smoothstep'
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
