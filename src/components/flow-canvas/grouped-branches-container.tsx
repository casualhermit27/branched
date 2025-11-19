'use client'

import { useMemo } from 'react'
import { Node, useViewport } from 'reactflow'

interface GroupedBranchesContainerProps {
  nodes: Node[]
}

export function GroupedBranchesContainer({ nodes }: GroupedBranchesContainerProps) {
  const { x: viewportX, y: viewportY, zoom } = useViewport()

  // Group nodes by branchGroupId
  const groupedNodes = useMemo(() => {
    const groups = new Map<string, Node[]>()
    
    nodes.forEach((node) => {
      const groupId = node.data?.branchGroupId
      if (groupId && !node.data?.isMain) {
        if (!groups.has(groupId)) {
          groups.set(groupId, [])
        }
        groups.get(groupId)!.push(node)
      }
    })

    return groups
  }, [nodes])

  // Calculate bounding boxes for each group in flow coordinates
  const groupBounds = useMemo(() => {
    const bounds = new Map<
      string,
      { x: number; y: number; width: number; height: number; branchCount: number }
    >()

    const getNodeDimensions = (node: Node) => {
      const fallbackWidth = node.data?.isMinimized ? 280 : 1200
      const fallbackHeight = node.data?.isMinimized ? 200 : 600
      const width =
        typeof node.width === 'number'
          ? node.width
          : typeof (node as any).measured?.width === 'number'
            ? (node as any).measured.width
            : fallbackWidth

      const height =
        typeof node.height === 'number'
          ? node.height
          : typeof (node as any).measured?.height === 'number'
            ? (node as any).measured.height
            : (() => {
                if (node.data?.isMinimized) return fallbackHeight
                const messageCount = node.data?.messages?.length || 0
                return Math.max(400, Math.min(900, 220 + messageCount * 68))
              })()

      return { width, height }
    }

    groupedNodes.forEach((groupNodes, groupId) => {
      if (groupNodes.length === 0) return

      // Calculate bounding box in flow coordinates
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      groupNodes.forEach((node) => {
        const x = node.position.x
        const y = node.position.y
        const { width, height } = getNodeDimensions(node)

        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x + width)
        maxY = Math.max(maxY, y + height)
      })

      // Add padding around the group
      const padding = 24
      bounds.set(groupId, {
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
        branchCount: groupNodes.length
      })
    })

    return bounds
  }, [groupedNodes])

  if (groupBounds.size === 0) return null

  // Use SVG for better coordinate system integration with ReactFlow
  return (
    <svg
      className="react-flow__edges"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'visible'
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'visible',
        transform: `translate(${viewportX}px, ${viewportY}px) scale(${zoom})`,
        transformOrigin: '0 0'
      }}
    >
      {Array.from(groupBounds.entries()).map(([groupId, bounds]) => {
        const padding = 24
        const cornerRadius = 12

        return (
          <g key={groupId}>
            {/* Background rectangle with rounded corners */}
            <rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              rx={cornerRadius}
              ry={cornerRadius}
              fill="rgba(59, 130, 246, 0.1)"
              className="dark:fill-blue-900/25"
              stroke="rgba(96, 165, 250, 0.6)"
              strokeWidth="2"
              className="dark:stroke-blue-500/60"
              style={{ pointerEvents: 'none' }}
            />
            {/* Inner border for depth */}
            <rect
              x={bounds.x + 1}
              y={bounds.y + 1}
              width={bounds.width - 2}
              height={bounds.height - 2}
              rx={cornerRadius - 1}
              ry={cornerRadius - 1}
              fill="none"
              stroke="rgba(59, 130, 246, 0.15)"
              strokeWidth="1"
              style={{ pointerEvents: 'none' }}
            />
            <text
              x={bounds.x + 16}
              y={bounds.y + 28}
              fill="rgba(59, 130, 246, 0.8)"
              className="dark:fill-blue-300"
              fontSize={14}
              fontWeight={600}
            >
              Multi-model · {bounds.branchCount} {bounds.branchCount === 1 ? 'branch' : 'branches'}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

