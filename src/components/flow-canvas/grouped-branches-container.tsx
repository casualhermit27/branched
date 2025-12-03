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
      const fallbackWidth = node.data?.isMinimized ? 280 : 1300
      const fallbackHeight = node.data?.isMinimized ? 200 : 450
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

  // We are now handling differentiation via ChatNode styling directly.
  // Returning null here to remove the container box as requested.
  return null
}
