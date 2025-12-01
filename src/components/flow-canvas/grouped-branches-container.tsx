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
      const rawGroupId = node.data?.branchGroupId || (node as any).branchGroupId
      const groupId = typeof rawGroupId === 'string' ? rawGroupId : undefined

      // Log for debugging
      if (node.id !== 'main' && rawGroupId && typeof rawGroupId !== 'string') {
        console.warn('⚠️ Container found node with INVALID group ID (Object):', {
          id: node.id,
          rawGroupId,
          type: typeof rawGroupId
        })
      }

      if (groupId && (!node.data || !node.data.isMain)) {
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
            {/* Glassmorphic Panel */}
            <rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              rx={32}
              ry={32}
              fill="currentColor"
              className="text-slate-100/50 dark:text-slate-900/20 transition-colors duration-300"
              stroke="currentColor"
              strokeWidth="1.5"
            // Use a secondary class for the stroke color to handle it via CSS variables if needed, 
            // or just use the text color utility on a wrapper group if this fails. 
            // For now, explicit classes on elements is safer for SVG in React.
            />
            {/* Separate rect for stroke to ensure distinct color from fill if needed, 
                  but here we can use the same element if we manage colors right. 
                  Actually, let's use a separate rect for the border to have full control over stroke color independent of fill.
              */}
            <rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              rx={32}
              ry={32}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-slate-300 dark:text-slate-700"
              style={{ pointerEvents: 'none' }}
            />

            {/* Label Badge */}
            <g transform={`translate(${bounds.x + 24}, ${bounds.y - 14})`}>
              <rect
                x="0"
                y="0"
                width="140"
                height="28"
                rx="14"
                fill="currentColor"
                className="text-white dark:text-slate-800 shadow-sm text-slate-200 dark:text-slate-700"
                stroke="currentColor"
                strokeWidth="1"
              />
              {/* Re-apply the stroke class separately or merge? 
                     React duplicate props issue. Let's merge.
                 */}
            </g>

            {/* Label Text */}
            <text
              x={bounds.x + 40}
              y={bounds.y + 4}
              className="fill-slate-600 dark:fill-slate-300 text-[12px] font-semibold tracking-wide uppercase"
              style={{ pointerEvents: 'none' }}
            >
              Compare · {bounds.branchCount} Models
            </text>
          </g>
        )
      })}
    </svg>
  )
}
