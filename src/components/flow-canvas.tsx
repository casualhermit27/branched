'use client'

import React, { useCallback, useState, useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  useReactFlow,
  ReactFlowProvider,
  PanOnScrollMode,
  BackgroundVariant,
  MarkerType,
} from 'reactflow'
import dagre from 'dagre'
import 'reactflow/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus, ArrowCounterClockwise, MagnifyingGlass, GitBranch, Eye, EyeSlash, Link } from '@phosphor-icons/react'
import ChatNode from './chat-node'
import FocusModeModal from './focus-mode-modal'
import AIPills from './ai-pills'

interface AI {
  id: string
  name: string
  color: string
  logo: React.JSX.Element
}

interface Message {
  id: string
  text: string
  isUser: boolean
  ai?: string
  parentId?: string
  children: string[]
  timestamp: number
  responses?: { [aiId: string]: string }
  aiModel?: string
  groupId?: string
}

interface CustomNodeData {
  label: string
  messages: Message[]
  selectedAIs: AI[]
  onBranch?: (nodeId: string, messageId?: string) => void
  onSendMessage?: (nodeId: string, message: string) => void
  onAddAI?: (ai: AI) => void
  onRemoveAI?: (aiId: string) => void
  isMain?: boolean
  showAIPill?: boolean
  isMinimized?: boolean
  onToggleMinimize?: (nodeId: string) => void
  isActive?: boolean
  isGenerating?: boolean
  parentId?: string
}

interface FlowCanvasProps {
  selectedAIs: AI[]
  onAddAI: (ai: AI) => void
  onRemoveAI: (aiId: string) => void
  mainMessages: Message[]
  onSendMainMessage: (text: string) => void
  onBranchFromMain: (messageId: string, isMultiBranch?: boolean) => void
  initialBranchMessageId?: string
  pendingBranchMessageId?: string
  onPendingBranchProcessed?: () => void
  onNodesUpdate?: (nodes: any[]) => void
  onNodeDoubleClick?: (nodeId: string) => void
  onPillClick?: (aiId: string) => void
  getBestAvailableModel?: () => string
  onSelectSingle?: (aiId: string) => void
  multiModelMode?: boolean
  onExportImport?: () => void
  restoredConversationNodes?: any[] // Restored nodes from MongoDB
  selectedBranchId?: string | null // Branch ID to navigate to from sidebar
  onBranchWarning?: (data: { messageId: string; messageText?: string; existingBranchId: string; isMultiBranch: boolean }) => void // Warning handler for duplicate branches
  onMinimizeAllRef?: (fn: () => void) => void // Callback to expose minimize all function
  onAllNodesMinimizedChange?: (minimized: boolean) => void // Callback to notify when all nodes are minimized/maximized
}

// Memoize nodeTypes to prevent React Flow warning
const nodeTypes = { chatNode: ChatNode } as const

type CustomNode = Node<CustomNodeData>

// Dagre layout function
const getLayoutedElements = (nodes: any[], edges: Edge[], direction = 'TB') => {
  try {
    // If no nodes, return empty
    if (nodes.length === 0) {
      return { nodes: [], edges }
    }
    
    // If only one node, return it with default position
    if (nodes.length === 1) {
      return {
        nodes: nodes.map(node => ({
          ...node,
          targetPosition: 'top' as const,
          sourcePosition: 'bottom' as const,
          position: node.position || { x: 400, y: 50 }
        })),
        edges
      }
    }
    
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))
    // Check if all nodes are minimized to adjust spacing
    const allMinimized = nodes.length > 0 && nodes.every(n => n.data?.isMinimized)
    
    dagreGraph.setGraph({ 
      rankdir: direction,
      ranksep: allMinimized ? 250 : 600, // Reduced vertical spacing when minimized to keep branches straight
      nodesep: allMinimized ? 200 : 500, // Reduced horizontal spacing when minimized
      marginx: 150, // Margins for containers
      marginy: 150
    })

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { 
        width: node.data?.isMinimized ? 280 : 1000, 
        height: node.data?.isMinimized ? 200 : 750 
      })
    })

    edges.forEach((edge) => {
      try {
        dagreGraph.setEdge(edge.source, edge.target)
      } catch (edgeError) {
        console.warn('⚠️ Error adding edge to dagre:', edgeError, edge)
      }
    })

    dagre.layout(dagreGraph)

    const layoutedNodes = nodes.map((node) => {
      try {
        const nodeWithPosition = dagreGraph.node(node.id)
        if (!nodeWithPosition || typeof nodeWithPosition.x !== 'number' || typeof nodeWithPosition.y !== 'number' || isNaN(nodeWithPosition.x) || isNaN(nodeWithPosition.y)) {
          console.warn('⚠️ No valid position found for node:', node.id, 'using existing position or default')
          return {
            ...node,
            targetPosition: 'top' as const,
            sourcePosition: 'bottom' as const,
            position: node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number' && !isNaN(node.position.x) && !isNaN(node.position.y)
              ? node.position
              : { x: 400, y: 50 }
          }
        }
        
        const calculatedX = nodeWithPosition.x - (node.data?.isMinimized ? 140 : 500)
        const calculatedY = nodeWithPosition.y - (node.data?.isMinimized ? 100 : 375)
        
        // Ensure we have valid numbers
        const finalX = isNaN(calculatedX) ? (node.position?.x || 400) : calculatedX
        const finalY = isNaN(calculatedY) ? (node.position?.y || 50) : calculatedY
        
        return {
          ...node,
          targetPosition: 'top' as const,
          sourcePosition: 'bottom' as const,
          position: {
            x: finalX,
            y: finalY,
          },
        }
      } catch (nodeError) {
        console.warn('⚠️ Error processing node in dagre:', nodeError, node.id)
        return {
          ...node,
          targetPosition: 'top' as const,
          sourcePosition: 'bottom' as const,
          position: node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number' && !isNaN(node.position.x) && !isNaN(node.position.y)
            ? node.position
            : { x: 400, y: 50 }
        }
      }
    })

    return { nodes: layoutedNodes, edges }
  } catch (error) {
    console.error('❌ Dagre layout error:', error)
    // Fallback: return nodes with existing positions or default positions
    return {
      nodes: nodes.map(node => {
        const position = node.position || { x: 400, y: 50 }
        const x = typeof position.x === 'number' && !isNaN(position.x) && isFinite(position.x) ? position.x : 400
        const y = typeof position.y === 'number' && !isNaN(position.y) && isFinite(position.y) ? position.y : 50
        
        return {
          ...node,
          targetPosition: 'top' as const,
          sourcePosition: 'bottom' as const,
          position: { x, y }
        }
      }),
      edges
    }
  }
}

// Inner component that uses useReactFlow
function FlowCanvasInner({ selectedAIs, onAddAI, onRemoveAI, mainMessages, onSendMainMessage, onBranchFromMain, initialBranchMessageId, pendingBranchMessageId, onPendingBranchProcessed, onNodesUpdate, onNodeDoubleClick, onPillClick, getBestAvailableModel, onSelectSingle, multiModelMode, onExportImport, restoredConversationNodes, selectedBranchId, onBranchWarning, onMinimizeAllRef, onAllNodesMinimizedChange }: FlowCanvasProps) {
  // Use a counter for triggering re-renders
  const [updateCounter, setUpdateCounter] = useState(0);
  const forceUpdate = useCallback(() => {
    // Schedule the update for the next tick to avoid render phase updates
    setTimeout(() => {
      setUpdateCounter(prev => prev + 1);
    }, 0);
  }, []);
  const [nodeId, setNodeId] = useState(2)
  const [hasCreatedInitialBranch, setHasCreatedInitialBranch] = useState(false)
  const hasInitializedRestoredNodes = useRef(false)
  const lastRestoredConversationId = useRef<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [highlightedPath, setHighlightedPath] = useState<string[]>([])
  const [generatingBranchId, setGeneratingBranchId] = useState<string | null>(null)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map()) // Track abort controllers for each node
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const [focusModeNode, setFocusModeNode] = useState<any>(null)
  const [minimizedNodes, setMinimizedNodes] = useState<Set<string>>(new Set())
  const [mainNodeHeight, setMainNodeHeight] = useState<number>(400) // Default height
  const [contextLinks, setContextLinks] = useState<Set<string>>(new Set()) // Track context links between branches
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [showContextMenu, setShowContextMenu] = useState<{x: number, y: number, nodeId: string} | null>(null)
  const [searchQuery, setMagnifyingGlassQuery] = useState<string>('')
  const [searchResults, setMagnifyingGlassResults] = useState<string[]>([])
  const { fitView, getNode, getViewport, setCenter } = useReactFlow()
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })
  
  // Branch-level multi-model state management
  const [branchMultiModelModes, setBranchMultiModelModes] = useState<Record<string, boolean>>({})
  const [branchSelectedAIs, setBranchSelectedAIs] = useState<Record<string, AI[]>>({})
  
  // Focus mode state
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [interactionMode, setInteractionMode] = useState<'pan' | 'focus'>('pan')
  
  // Branch-level multi-model functions
  const handleBranchAddAI = useCallback((nodeId: string, ai: AI) => {
    let newAIs: AI[] = []
    setBranchSelectedAIs(prev => {
      newAIs = [...(prev[nodeId] || []), ai]
      return {
        ...prev,
        [nodeId]: newAIs
      }
    })
    
    // Also update the node's data to persist the change
    setNodes((nds) => {
      return nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              selectedAIs: newAIs
            }
          }
        }
        return node
      })
    })
  }, [])
  
  const handleBranchRemoveAI = useCallback((nodeId: string, aiId: string) => {
    let newAIs: AI[] = []
    setBranchSelectedAIs(prev => {
      newAIs = (prev[nodeId] || []).filter(ai => ai.id !== aiId)
      return {
        ...prev,
        [nodeId]: newAIs
      }
    })
    
    // Also update the node's data to persist the change
    setNodes((nds) => {
      return nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              selectedAIs: newAIs
            }
          }
        }
        return node
      })
    })
  }, [])
  
  const handleBranchSelectSingle = useCallback((nodeId: string, aiId: string) => {
    const ai = selectedAIs.find(a => a.id === aiId)
    if (ai) {
      setBranchSelectedAIs(prev => ({
        ...prev,
        [nodeId]: [ai]
      }))
      setBranchMultiModelModes(prev => ({
        ...prev,
        [nodeId]: false
      }))
      
      // Also update the node's data to persist the change
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                selectedAIs: [ai],
                multiModelMode: false
              }
            }
          }
          return node
        })
      })
    }
  }, [selectedAIs])
  
  const handleBranchToggleMultiModel = useCallback((nodeId: string) => {
    let newMode = false
    setBranchMultiModelModes(prev => {
      newMode = !prev[nodeId]
      return {
        ...prev,
        [nodeId]: newMode
      }
    })
    
    // Also update the node's data to persist the change
    setNodes((nds) => {
      return nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              multiModelMode: newMode
            }
          }
        }
        return node
      })
    })
  }, [])
  
  const getBranchSelectedAIs = useCallback((nodeId: string) => {
    return branchSelectedAIs[nodeId] || []
  }, [branchSelectedAIs])
  
  const getBranchMultiModelMode = useCallback((nodeId: string) => {
    return branchMultiModelModes[nodeId] || false
  }, [branchMultiModelModes])
  
  // Keyboard shortcuts for interaction modes
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && interactionMode === 'focus') {
        setFocusedNodeId(null)
        setInteractionMode('pan')
        console.log('🎯 Escaped focus mode - switching to pan mode')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [interactionMode])
  
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  
  // Keep refs updated
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  // Track previous nodes to prevent unnecessary updates
  const prevNodesRef = useRef<any[]>([])

  // Path highlighting functions
  const getPathToRoot = useCallback((nodeId: string): string[] => {
    const path: string[] = [nodeId]
    let currentNode = nodes.find(n => n.id === nodeId)
    
    while (currentNode && currentNode.data.parentId) {
      const parent = nodes.find(n => n.id === currentNode?.data.parentId)
      if (parent) {
        path.unshift(parent.id)
        currentNode = parent
      } else {
        break
      }
    }
    
    return path
  }, [nodes])

  const highlightPathToRoot = useCallback((nodeId: string) => {
    const path = getPathToRoot(nodeId)
    setHighlightedPath(path)
    
    // Auto-clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedPath([])
    }, 3000)
  }, [getPathToRoot])

  const resetEdgeStyles = useCallback(() => {
    setHighlightedPath([])
  }, [])

  // Handle edge hover
  const handleEdgeMouseEnter = useCallback((event: React.MouseEvent, edge: any) => {
    setHoveredEdgeId(edge.id)
  }, [])

  const handleEdgeMouseLeave = useCallback((event: React.MouseEvent, edge: any) => {
    setHoveredEdgeId(null)
  }, [])

  // Remove context link between two branches
  const removeContextLink = useCallback((sourceId: string, targetId: string) => {
    const linkId = `${sourceId}-${targetId}`
    setContextLinks(prev => {
      const newSet = new Set(prev)
      newSet.delete(linkId)
      return newSet
    })
    
    // Remove context link edge
    setEdges(prev => prev.filter(edge => edge.id !== `context-${linkId}`))
  }, [])

  // Handle edge click for context linking
  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: any) => {
    if (edge.id.startsWith('context-')) {
      // Remove context link
      const [sourceId, targetId] = edge.id.replace('context-', '').split('-')
      removeContextLink(sourceId, targetId)
    }
  }, [removeContextLink])

  // Get edge style based on connection type
  const getEdgeStyle = useCallback((edge: any) => {
    const isHighlighted = highlightedPath.includes(edge.id)
    const isHovered = hoveredEdgeId === edge.id
    const isContextLink = edge.id.startsWith('context-')
    
    // Color coding for different branch sets
    const getBranchColor = (edgeId: string) => {
      // Extract branch group from edge ID or source/target
      const source = edge.source
      const target = edge.target
      
      // If it's a main branch (from main node)
      if (source === 'main') {
        return '#8b5cf6' // Purple for main branches
      }
      
      // If it's a sub-branch (from another branch)
      if (source !== 'main' && target !== 'main') {
        return '#06b6d4' // Cyan for sub-branches
      }
      
      // Context links
      if (isContextLink) {
        return '#f59e0b' // Amber for context links
      }
      
      return '#6b7280' // Gray for other connections
    }
    
    const baseColor = getBranchColor(edge.id)
    
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
        stroke: baseColor,
        strokeWidth: 3,
        strokeDasharray: '6,4',
        transition: 'all 0.2s ease-in-out',
        filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.3))'
      }
    }
    
    if (isContextLink) {
      return {
        stroke: '#f59e0b',
        strokeWidth: 2.5,
        strokeDasharray: '8,4',
        transition: 'all 0.2s ease-in-out'
      }
    }
    
    // Clean dotted lines for all connections with color coding
    return {
      stroke: baseColor,
      strokeWidth: 1.5,
      strokeDasharray: '6,4',
      transition: 'all 0.3s ease-in-out'
    }
  }, [highlightedPath, hoveredEdgeId])

  // Get parent messages for focus mode context
  const getParentMessages = useCallback((nodeId: string): Message[] => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node || !node.data.parentId) return []
    
    const parentNode = nodes.find(n => n.id === node.data.parentId)
    return parentNode?.data.messages || []
  }, [nodes])

  // Get child branches for focus mode
  const getChildBranches = useCallback((nodeId: string) => {
    return nodes
      .filter(n => n.data.parentId === nodeId)
      .map(n => ({
        id: n.id,
        title: n.data.label,
        messages: n.data.messages || [],
        timestamp: n.data.messages?.[0]?.timestamp || Date.now()
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [nodes])

  // Calculate main node height based on message count
  const calculateMainNodeHeight = useCallback((messageCount: number) => {
    const baseHeight = 300 // Base height for input area and header
    const messageHeight = 60 // Approximate height per message (reduced)
    const maxHeight = 800 // Maximum height before scrolling (increased)
    const calculatedHeight = baseHeight + (messageCount * messageHeight)
    return Math.min(calculatedHeight, maxHeight)
  }, [])

  // Reposition branches when main node height changes
  const repositionBranches = useCallback((newMainHeight: number) => {
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === 'main') {
          return node // Don't modify main node here
        }
        
        // Check if this is a branch node (has parentId or is connected to main)
        const isBranch = node.data.parentId === 'main' || 
                        (node.data.parentId && nds.find(n => n.id === node.data.parentId)?.id === 'main')
        
        if (isBranch) {
          // Calculate new Y position based on main node height
          const mainNode = nds.find(n => n.id === 'main')
          if (mainNode) {
            const newY = mainNode.position.y + newMainHeight + 50 // 50px gap
            return {
              ...node,
              position: {
                ...node.position,
                y: newY
              }
            }
          }
        }
        
        return node
      })
      
      return updatedNodes
    })
  }, [])

  // Create context link between two branches
  const createContextLink = useCallback((sourceId: string, targetId: string) => {
    const linkId = `${sourceId}-${targetId}`
    setContextLinks(prev => new Set([...prev, linkId]))
    
    // Add context link edge
    const newEdge = {
      id: `context-${linkId}`,
      source: sourceId,
      target: targetId,
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: '#f59e0b',
        strokeWidth: 2,
        strokeDasharray: '8,4'
      },
      label: 'context link',
      labelStyle: {
        fontSize: 12,
        fill: '#f59e0b',
        fontWeight: 500
      },
      labelBgStyle: {
        fill: 'rgba(255, 255, 255, 0.8)',
        fillOpacity: 0.8,
        stroke: 'none'
      }
    }
    
    setEdges(prev => [...prev, newEdge])
  }, [])

  // Handle model pill click for zooming to node
  const handlePillClick = useCallback((aiId: string) => {
    // Find node with this AI model
    const targetNode = nodes.find(node => 
      node.data.messages?.some((msg: Message) => msg.aiModel === aiId)
    )
    
    if (targetNode) {
      // Zoom to node with path highlighting
      setCenter(targetNode.position.x + 500, targetNode.position.y + 375, {
        zoom: 1.2,
        duration: 800
      })
      highlightPathToRoot(targetNode.id)
      setActiveNodeId(targetNode.id)
    }
  }, [nodes, setCenter, highlightPathToRoot])

  // Branch positioning functions
  const calculateMultiModelPositions = useCallback((
    parentPos: {x: number, y: number},
    aiCount: number
  ): Array<{x: number, y: number}> => {
    // Dynamic spacing based on viewport and node count
    const nodeWidth = 1000
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Calculate optimal spacing for better centering
    const minSpacing = nodeWidth + 150 // Increased minimum spacing
    const maxSpacing = Math.max(minSpacing, viewportWidth * 0.5) // Max 50% of viewport width
    
    // For 2 models, use wider spacing for better visual separation
    let spacing = minSpacing
    if (aiCount === 2) {
      spacing = Math.min(maxSpacing, viewportWidth * 0.6) // 60% of viewport for 2 models
    } else if (aiCount > 2) {
      spacing = Math.min(maxSpacing, (viewportWidth * 0.8) / (aiCount - 1))
    }
    
    // Center the nodes horizontally relative to parent
    const totalWidth = (aiCount - 1) * spacing
    const startX = parentPos.x - (totalWidth / 2)
    
    // Vertical spacing - ensure good separation from parent
    const verticalSpacing = Math.max(600, viewportHeight * 0.3)
    
    console.log('🎯 Multi-model positioning:', {
      aiCount,
      spacing,
      startX,
      parentPos,
      viewportWidth,
      viewportHeight,
      totalWidth,
      verticalSpacing
    })
    
    return Array.from({length: aiCount}, (_, i) => ({
      x: startX + (i * spacing),
      y: parentPos.y + verticalSpacing
    }))
  }, [])

  const calculateSingleBranchPosition = useCallback((
    parentPos: {x: number, y: number}
  ): {x: number, y: number} => {
    return {
      x: parentPos.x,
      y: parentPos.y + 500 // Increased vertical spacing for bigger containers
    }
  }, [])

  const calculateChildBranchPosition = useCallback((
    parentPos: {x: number, y: number},
    siblingCount: number,
    index: number
  ): {x: number, y: number} => {
    const spacing = 450 // Increased spacing for bigger containers
    const startX = parentPos.x - ((siblingCount - 1) * spacing) / 2
    
    return {
      x: startX + (index * spacing),
      y: parentPos.y + 500 // Increased vertical spacing for bigger containers
    }
  }, [])

  // Intelligent single node centering
  const centerOnNode = useCallback((nodeId: string, zoomLevel?: number) => {
    const node = getNode(nodeId)
    if (!node) return

    const nodeWidth = 1000
    const nodeHeight = 750
    const centerX = node.position.x + nodeWidth / 2
    const centerY = node.position.y + nodeHeight / 2

    // Calculate optimal zoom if not provided
    let optimalZoom = zoomLevel
    if (!optimalZoom) {
      const viewport = getViewport()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Calculate zoom to fit node nicely in viewport
      const zoomX = (viewportWidth * 0.8) / nodeWidth
      const zoomY = (viewportHeight * 0.8) / nodeHeight
      optimalZoom = Math.min(zoomX, zoomY, 1.0)
    }

    console.log('🎯 Centering on node:', {
      nodeId,
      position: node.position,
      center: { x: centerX, y: centerY },
      zoom: optimalZoom
    })

    setCenter(centerX, centerY, { 
      zoom: optimalZoom, 
      duration: 600 
    })
  }, [getNode, setCenter, getViewport])

  // Dynamic viewport centering with intelligent zoom
  const fitViewportToNodes = useCallback((nodeIds: string[], padding = 0.1) => {
    const targetNodes = nodes.filter(n => nodeIds.includes(n.id))
    
    console.log('🎯 fitViewportToNodes called:', {
      requestedNodeIds: nodeIds,
      foundNodes: targetNodes.length,
      availableNodes: nodes.map(n => n.id)
    })
    
    if (targetNodes.length === 0) {
      console.warn('⚠️ No target nodes found for centering')
      return
    }

    // Get current viewport dimensions
    const viewport = getViewport()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Current node dimensions
    const nodeWidth = 1000
    const nodeHeight = 750
    
    // Calculate content bounds including node dimensions
    const minX = Math.min(...targetNodes.map(n => n.position.x))
    const maxX = Math.max(...targetNodes.map(n => n.position.x + nodeWidth))
    const minY = Math.min(...targetNodes.map(n => n.position.y))
    const maxY = Math.max(...targetNodes.map(n => n.position.y + nodeHeight))

    // Calculate center point
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    // Calculate content dimensions
    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    // Calculate optimal zoom level
    const availableWidth = viewportWidth * (1 - padding * 2)
    const availableHeight = viewportHeight * (1 - padding * 2)
    
    const zoomX = availableWidth / contentWidth
    const zoomY = availableHeight / contentHeight
    const optimalZoom = Math.min(zoomX, zoomY, 1.0) // Cap at 1.0x for better readability

    console.log('🎯 Fitting viewport to nodes:', {
      nodeCount: targetNodes.length,
      nodeIds: targetNodes.map(n => n.id),
      contentBounds: { minX, maxX, minY, maxY },
      contentSize: { width: contentWidth, height: contentHeight },
      center: { x: centerX, y: centerY },
      optimalZoom,
      viewport: { width: viewportWidth, height: viewportHeight }
    })

    setCenter(centerX, centerY, { 
      zoom: optimalZoom, 
      duration: 800 
    })
  }, [nodes, setCenter, getViewport])

  // Validate and fix node positions to prevent NaN errors
  const validateNodePositions = useCallback((nodeList: any[]) => {
    return nodeList.map(node => {
      // Ensure position exists and has valid numbers
      const position = node.position || { x: 400, y: 50 }
      const x = typeof position.x === 'number' && !isNaN(position.x) && isFinite(position.x) ? position.x : 400
      const y = typeof position.y === 'number' && !isNaN(position.y) && isFinite(position.y) ? position.y : 50
      
      return {
        ...node,
        position: { x, y }
      }
    })
  }, [])
  
  // Notify parent of node updates (with debouncing to prevent infinite loops)
  const nodesStringRef = useRef<string>('')
  
  useEffect(() => {
    if (onNodesUpdate && nodes.length > 0) {
      // Create a stable string representation to detect actual changes
      // Include node IDs and message counts to detect branch creation
      const nodesString = JSON.stringify(nodes.map(n => ({
        id: n.id,
        messagesLength: n.data.messages?.length || 0,
        position: n.position,
        parentId: n.data.parentId,
        parentMessageId: n.data.parentMessageId
      })))
      
      // Only update if the string representation changed
      if (nodesString !== nodesStringRef.current) {
        nodesStringRef.current = nodesString
        prevNodesRef.current = [...nodes] // Create a copy
        
        const timeoutId = setTimeout(() => {
          console.log('📤 Calling onNodesUpdate with', nodes.length, 'nodes:', nodes.map(n => ({ 
            id: n.id, 
            type: n.type,
            parentId: n.data.parentId,
            parentMessageId: n.data.parentMessageId,
            messagesCount: n.data.messages?.length || 0
          })))
          onNodesUpdate(nodes)
        }, 150) // Increased debounce to ensure React Flow state is stable
        
        return () => clearTimeout(timeoutId)
      }
    }
  }, [nodes, onNodesUpdate]) // Depend on full nodes array, but use string comparison

  // Auto-center on active node and ensure proper updates
  useEffect(() => {
    if (activeNodeId) {
      const node = getNode(activeNodeId)
      if (node) {
        // Use intelligent centering for better overview
        centerOnNode(activeNodeId, 0.6)
        
        // Update node data to reflect active state
        setNodes(nds => 
          validateNodePositions(nds.map(n => ({
            ...n,
            data: {
              ...n.data,
              isActive: n.id === activeNodeId,
              isMinimized: minimizedNodes.has(n.id)
            }
          })))
        )
        
        // Force update to ensure UI reflects the change
        setTimeout(() => {
          forceUpdate()
        }, 100)
      }
    }
  }, [activeNodeId, getNode, setCenter, setNodes, validateNodePositions, minimizedNodes, forceUpdate])

  // Toggle collapse/expand for a node
  const toggleNodeCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }, [])

  // Toggle minimize/restore for a node
  const toggleNodeMinimize = useCallback((nodeId: string) => {
    setMinimizedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }, [])

  // Minimize/Maximize all nodes
  const minimizeAllNodes = useCallback(() => {
    const allNodeIds = nodes.map(n => n.id)
    const allMinimized = allNodeIds.length > 0 && allNodeIds.every(id => minimizedNodes.has(id))
    
    if (allMinimized) {
      // Maximize all
      setMinimizedNodes(new Set())
      if (onAllNodesMinimizedChange) {
        onAllNodesMinimizedChange(false)
      }
    } else {
      // Minimize all
      setMinimizedNodes(new Set(allNodeIds))
      if (onAllNodesMinimizedChange) {
        onAllNodesMinimizedChange(true)
      }
    }
    
    // Trigger layout update and fit view after a short delay to allow state to update
    setTimeout(() => {
      setNodes(nds => {
        const isMinimized = !allMinimized // Toggle state
        const updatedNodes = validateNodePositions(nds.map(n => ({
          ...n,
          style: {
            ...n.style,
            width: isMinimized ? 280 : 1000,
            height: isMinimized ? 'auto' : 750,
            minHeight: isMinimized ? 'auto' : 750,
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          },
          data: {
            ...n.data,
            isMinimized: isMinimized
          }
        })))
        
        // Re-create edges for proper branch connectors
        const edges = updatedNodes.flatMap(n => {
          const edges: Edge[] = []
          const parentId = n.parentId || n.data?.parentId
          
          // Only create edges if both source and target nodes exist in updatedNodes
          const sourceExists = parentId && updatedNodes.some(node => node.id === parentId)
          const targetExists = updatedNodes.some(node => node.id === n.id)
          
          if (parentId && parentId !== 'main' && sourceExists && targetExists) {
            edges.push({
              id: `e${parentId}-${n.id}`,
              source: parentId,
              target: n.id,
              type: 'step',
              animated: false,
              style: { stroke: 'hsl(var(--border))', strokeWidth: 2 }
            })
          } else if (n.id !== 'main' && updatedNodes.some(node => node.id === 'main') && targetExists) {
            edges.push({
              id: `e-main-${n.id}`,
              source: 'main',
              target: n.id,
              type: 'step',
              animated: false,
              style: { stroke: 'hsl(var(--border))', strokeWidth: 2 }
            })
          }
          return edges
        })
        
        // Update edges immediately
        setEdges(edges)
        
        // Re-layout with adjusted spacing
        const { nodes: layoutedNodes } = getLayoutedElements(updatedNodes, edges, 'TB')
        
        // Validate layouted nodes to prevent NaN values
        const validatedLayoutedNodes = validateNodePositions(layoutedNodes)
        
        // Fit view with smooth animation after layout
        setTimeout(() => {
          fitView({ 
            padding: 0.2, 
            duration: 600
          })
        }, 100)
        
        return validatedLayoutedNodes
      })
    }, 50)
  }, [nodes, minimizedNodes, onAllNodesMinimizedChange, setNodes, setEdges, fitView, validateNodePositions])

  // Expose minimize all function to parent
  useEffect(() => {
    if (onMinimizeAllRef) {
      onMinimizeAllRef(minimizeAllNodes)
    }
  }, [onMinimizeAllRef, minimizeAllNodes])

  // Track when all nodes are minimized and notify parent
  useEffect(() => {
    if (onAllNodesMinimizedChange && nodes.length > 0) {
      const allMinimized = nodes.every(n => minimizedNodes.has(n.id))
      onAllNodesMinimizedChange(allMinimized)
    }
  }, [minimizedNodes, nodes, onAllNodesMinimizedChange])

  // Navigate to branch when selected from sidebar
  const lastSelectedBranchIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== lastSelectedBranchIdRef.current && nodes.length > 0) {
      console.log('🎯 Sidebar branch selection detected:', {
        selectedBranchId,
        nodesCount: nodes.length,
        nodeIds: nodes.map(n => n.id),
        lastSelected: lastSelectedBranchIdRef.current
      })
      
      const targetBranchId = selectedBranchId
      
      // Skip navigation for main node - it's not a branch
      if (targetBranchId === 'main') {
        console.log('⏭️ Skipping navigation for main node')
        return
      }
      
      // Try to find the branch node - with retry logic
      const findBranchNode = () => {
        return nodes.find(n => n.id === targetBranchId && n.id !== 'main')
      }
      
      let branchNode = findBranchNode()
      
      // If not found immediately, wait a bit and retry (nodes might still be updating)
      if (!branchNode) {
        console.log('⏳ Branch node not found immediately, retrying...')
        setTimeout(() => {
          branchNode = findBranchNode()
          if (branchNode) {
            navigateToBranch(branchNode, targetBranchId)
          } else {
            console.warn('⚠️ Branch node still not found after retry:', targetBranchId)
          }
        }, 200)
        return
      }
      
      navigateToBranch(branchNode, targetBranchId)
    } else if (!selectedBranchId) {
      lastSelectedBranchIdRef.current = null
    }
    
    function navigateToBranch(branchNode: any, branchId: string) {
      if (!branchNode) return
      
      console.log('🎯 Navigating to branch:', {
        branchId: branchId,
        position: branchNode.position,
        found: true
      })
      
      lastSelectedBranchIdRef.current = branchId
      
      // Set as active node
      setActiveNodeId(branchId)
      
      // Center on the branch node with multiple retry attempts
      const attemptNavigation = (attempt = 0) => {
        const maxAttempts = 5
        const node = getNode(branchId)
        
        if (node) {
          console.log('✅ Node found, centering:', branchId)
          centerOnNode(branchId, 0.7)
          
          // Add highlight effect
          setNodes(nds => 
            validateNodePositions(nds.map(n => 
              n.id === branchId 
                ? { ...n, data: { ...n.data, isHighlighted: true, isActive: true } }
                : { ...n, data: { ...n.data, isHighlighted: false, isActive: n.id === activeNodeId } }
            ))
          )
          
          // Remove highlight after animation
          setTimeout(() => {
            setNodes(nds => 
              validateNodePositions(nds.map(n => 
                n.id === branchId 
                  ? { ...n, data: { ...n.data, isHighlighted: false } }
                  : n
              ))
            )
          }, 2000)
        } else if (attempt < maxAttempts) {
          console.log(`⏳ Node not ready, retrying (${attempt + 1}/${maxAttempts})...`)
          setTimeout(() => attemptNavigation(attempt + 1), 100 * (attempt + 1))
        } else {
          console.warn('⚠️ Failed to navigate to branch after', maxAttempts, 'attempts:', branchId)
        }
      }
      
      // Start navigation attempts
      requestAnimationFrame(() => {
        attemptNavigation(0)
      })
    }
  }, [selectedBranchId, nodes, centerOnNode, setActiveNodeId, setNodes, activeNodeId, validateNodePositions, getNode])

  // Update nodes when minimize state changes - with smooth layout animation
  useEffect(() => {
    // Use requestAnimationFrame to ensure smooth animation
    requestAnimationFrame(() => {
      setNodes(nds => {
        const updatedNodes = validateNodePositions(nds.map(n => {
          const isMinimized = minimizedNodes.has(n.id)
          return {
            ...n,
            style: {
              ...n.style,
              width: isMinimized ? 280 : 1000,
              height: isMinimized ? 'auto' : 750,
              minHeight: isMinimized ? 'auto' : 750,
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            },
            data: {
              ...n.data,
              isMinimized: isMinimized
            }
          }
        }))
        
        // Re-layout with adjusted spacing to preserve branch alignment
        const edges = updatedNodes.flatMap(n => {
          const edges: Edge[] = []
          const parentId = n.parentId || n.data?.parentId
          
          // Only create edges if both source and target nodes exist in updatedNodes
          const sourceExists = parentId && updatedNodes.some(node => node.id === parentId)
          const targetExists = updatedNodes.some(node => node.id === n.id)
          
          if (parentId && parentId !== 'main' && sourceExists && targetExists) {
            edges.push({
              id: `e${parentId}-${n.id}`,
              source: parentId,
              target: n.id,
              type: 'step',
              animated: false,
              style: { stroke: 'hsl(var(--border))', strokeWidth: 2 }
            })
          } else if (n.id !== 'main' && updatedNodes.some(node => node.id === 'main') && targetExists) {
            edges.push({
              id: `e-main-${n.id}`,
              source: 'main',
              target: n.id,
              type: 'step',
              animated: false,
              style: { stroke: 'hsl(var(--border))', strokeWidth: 2 }
            })
          }
          return edges
        })
        
        // Update edges to ensure connectors are visible
        setEdges(edges)
        
        const { nodes: layoutedNodes } = getLayoutedElements(updatedNodes, edges, 'TB')
        
        // Validate layouted nodes to prevent NaN values
        const validatedLayoutedNodes = validateNodePositions(layoutedNodes)
        
        return validatedLayoutedNodes
      })
      
      // Fit view after layout with smooth animation
      setTimeout(() => {
        fitView({ 
          padding: 0.2, 
          duration: 500
        })
      }, 150)
    })
  }, [minimizedNodes, validateNodePositions, setNodes, setEdges, fitView])

  // MagnifyingGlass functionality
  const performMagnifyingGlass = useCallback((query: string) => {
    if (!query.trim()) {
      setMagnifyingGlassResults([])
      return
    }

    const results: string[] = []
    const lowerQuery = query.toLowerCase()

    nodesRef.current.forEach(node => {
      const messages = node.data.messages || []
      const hasMatch = messages.some((message: any) => 
        message.text.toLowerCase().includes(lowerQuery)
      )
      
      if (hasMatch) {
        results.push(node.id)
      }
    })

    setMagnifyingGlassResults(results)
  }, [])

  // Handle search input
  const handleMagnifyingGlassChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setMagnifyingGlassQuery(query)
    performMagnifyingGlass(query)
  }, [performMagnifyingGlass])

  // Navigate to search result
  const navigateToResult = useCallback((nodeId: string) => {
    const node = getNode(nodeId)
    if (node) {
      // Use intelligent centering
      centerOnNode(nodeId, 1.0)
      setActiveNodeId(nodeId)
    }
  }, [centerOnNode])

  // Get all children of a node (recursive)
  const getNodeChildren = useCallback((nodeId: string): string[] => {
    const children: string[] = []
    const directChildren = edgesRef.current
      .filter(edge => edge.source === nodeId)
      .map(edge => edge.target)
    
    children.push(...directChildren)
    
    // Recursively get children of children
    directChildren.forEach(childId => {
      children.push(...getNodeChildren(childId))
    })
    
    return children
  }, [])

  // Filter nodes and edges based on collapsed state
  const getVisibleNodesAndEdges = useCallback(() => {
    const visibleNodeIds = new Set<string>()
    const visibleEdges: Edge[] = []
    
    // Always show main node
    visibleNodeIds.add('main')
    
    // Add visible nodes (not collapsed and not children of collapsed nodes)
    nodesRef.current.forEach(node => {
      if (node.id === 'main') return
      
      // Check if any parent is collapsed
      let isHidden = false
      let currentParent = edgesRef.current.find(edge => edge.target === node.id)?.source
      
      while (currentParent) {
        if (collapsedNodes.has(currentParent)) {
          isHidden = true
          break
        }
        currentParent = edgesRef.current.find(edge => edge.target === currentParent)?.source
      }
      
      if (!isHidden) {
        visibleNodeIds.add(node.id)
      }
    })
    
    // Filter visible nodes and validate their positions
    const visibleNodes = nodesRef.current.filter(node => {
      if (!visibleNodeIds.has(node.id)) return false
      
      // Validate node position to prevent NaN errors
      const position = node.position || { x: 400, y: 50 }
      const x = typeof position.x === 'number' && !isNaN(position.x) && isFinite(position.x) ? position.x : 400
      const y = typeof position.y === 'number' && !isNaN(position.y) && isFinite(position.y) ? position.y : 50
      
      // Update node position if it was invalid
      if (position.x !== x || position.y !== y) {
        node.position = { x, y }
      }
      
      return true
    })
    
    // Add visible edges - only include edges where both nodes exist and have valid positions
    edgesRef.current.forEach(edge => {
      const sourceNode = visibleNodes.find(n => n.id === edge.source)
      const targetNode = visibleNodes.find(n => n.id === edge.target)
      
      if (sourceNode && targetNode && 
          visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target) &&
          sourceNode.position && targetNode.position &&
          typeof sourceNode.position.x === 'number' && !isNaN(sourceNode.position.x) && isFinite(sourceNode.position.x) &&
          typeof sourceNode.position.y === 'number' && !isNaN(sourceNode.position.y) && isFinite(sourceNode.position.y) &&
          typeof targetNode.position.x === 'number' && !isNaN(targetNode.position.x) && isFinite(targetNode.position.x) &&
          typeof targetNode.position.y === 'number' && !isNaN(targetNode.position.y) && isFinite(targetNode.position.y)) {
        visibleEdges.push(edge)
      }
    })
    
    return {
      nodes: visibleNodes,
      edges: visibleEdges
    }
  }, [collapsedNodes])
  
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  // Node event handlers
  const onNodeMouseEnter = useCallback((event: React.MouseEvent, node: any) => {
    setHoveredNodeId(node.id)
    highlightPathToRoot(node.id)
  }, [highlightPathToRoot])

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null)
    resetEdgeStyles()
  }, [resetEdgeStyles])

  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: any) => {
    // Open focus mode for the double-clicked node
    setFocusModeNode(node)
    
    if (onNodeDoubleClick) {
      onNodeDoubleClick(node.id)
    }
  }, [onNodeDoubleClick])

  // Define handleBranch with stable reference - NEW SIMPLIFIED SIGNATURE
  const handleBranchRef = useRef<(parentNodeId: string, messageId?: string, isMultiBranch?: boolean) => void | undefined>(undefined)
  
  // Clean duplicate prevention: Single source of truth
  const branchCreationLockRef = useRef<Map<string, boolean>>(new Map()) // Maps messageId -> isLocked
  const branchIdCounterRef = useRef<number>(0) // Counter for unique branch IDs
  
  // Helper function to check if branch exists for a messageId from a parent
  const branchExistsForMessage = useCallback((parentNodeId: string, messageId: string): boolean => {
    const currentNodes = nodesRef.current
    return currentNodes.some(node => {
      // Skip main node and parent node itself
      if (node.id === 'main' || node.id === parentNodeId) return false
      
      // Check if this is a branch from the parent
      if (node.data?.parentId !== parentNodeId) return false
      
      // Check if this branch's parentMessageId matches
      return node.data?.parentMessageId === messageId
    })
  }, [])
  
  // Helper function to generate unique branch ID
  const generateBranchId = useCallback((): string => {
    branchIdCounterRef.current += 1
    return `branch-${Date.now()}-${branchIdCounterRef.current}-${Math.random().toString(36).substr(2, 9)}`
  }, [])
  
  // ✅ NEW: Deduplicate messages helper
  // Only deduplicate by message ID, not by other fields
  // This prevents false positives when messages legitimately share properties
  // Silently deduplicate without warnings (React StrictMode causes double-invocation)
  const deduplicateMessages = useCallback((msgs: any[]): any[] => {
    const seen = new Set<string>()
    return msgs.filter(m => {
      // Only deduplicate by actual message ID, not by composite keys
      // This ensures we don't remove legitimate messages
      const key = m.id
      if (!key) {
        // If no ID, include it (might be a new message)
        return true
      }
      if (seen.has(key)) {
        // Silently remove duplicates - don't warn (React StrictMode causes this)
        return false
      }
      seen.add(key)
      return true
    })
  }, [])
  
  // ✅ NEW: Deduplicate by AI model helper
  const deduplicateByModel = useCallback((msgs: any[]): any[] => {
    const seen = new Set<string>()
    return msgs.filter(m => {
      if (!m.aiModel) return false
      if (seen.has(m.aiModel)) {
        console.warn('⚠️ Duplicate AI model removed:', m.aiModel)
        return false
      }
      seen.add(m.aiModel)
      return true
    })
  }, [])
  
  // ✅ Enhanced: Get messages till a specific message ID (for inherited context)
  // This includes all messages up to and including the target message
  // If branching from a user message, also includes the paired AI reply if it exists
  const getMessagesTill = useCallback((messageId: string, allMsgs: any[], includePairedAI: boolean = false): any[] => {
    const result: any[] = []
    const targetIndex = allMsgs.findIndex(msg => msg.id === messageId)
    
    if (targetIndex === -1) {
      console.warn('⚠️ Target message not found in messages:', messageId)
      // If message not found, return all messages up to the end
      return [...allMsgs]
    }
    
    // Include all messages up to and including the target message
    for (let i = 0; i <= targetIndex; i++) {
      result.push(allMsgs[i])
    }
    
    // If branching from a user message and includePairedAI is true,
    // check if there's an AI reply right after it
    if (includePairedAI && targetIndex >= 0) {
      const targetMessage = allMsgs[targetIndex]
      if (targetMessage.isUser && targetIndex + 1 < allMsgs.length) {
        const nextMessage = allMsgs[targetIndex + 1]
        // If next message is an AI reply (not a user message), include it
        if (!nextMessage.isUser && (nextMessage.aiModel || nextMessage.ai || nextMessage.role === 'assistant')) {
          // Check if it's a direct child or part of the same group
          const isPairedReply = nextMessage.parentId === messageId || 
                                (targetMessage.groupId && nextMessage.groupId === targetMessage.groupId)
          
          if (isPairedReply || targetIndex + 1 === targetIndex + 1) {
            result.push(nextMessage)
            console.log('✅ Including paired AI reply:', {
              aiMessageId: nextMessage.id,
              aiModel: nextMessage.aiModel || nextMessage.ai,
              text: nextMessage.text?.substring(0, 50)
            })
          }
        }
      }
    }
    
    console.log('📋 getMessagesTill:', {
      targetMessageId: messageId,
      targetIndex,
      includePairedAI,
      totalMessages: allMsgs.length,
      inheritedCount: result.length,
      inheritedIds: result.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
    })
    
    return result
  }, [])
  
  // ✅ NEW: Calculate branch position
  const getBranchPosition = useCallback((parentNodeId: string, branchIndex: number, totalBranches: number): { x: number, y: number } => {
    const parentNode = nodesRef.current.find(n => n.id === parentNodeId)
    if (!parentNode) return { x: 0, y: 0 }
    
    const baseX = parentNode.position.x + 400 // Offset to the right
    const baseY = parentNode.position.y
    
    if (totalBranches === 1) {
      return { x: baseX, y: baseY }
    }
    
    // Spread branches vertically
    const spacing = 200
    const startY = baseY - ((totalBranches - 1) * spacing) / 2
    return {
      x: baseX,
      y: startY + (branchIndex * spacing)
    }
  }, [])
  
  // ✅ Enhanced: Create branch node helper with improved context preservation
  const createBranchNode = useCallback((
    parentNodeId: string,
    inheritedMessages: any[],
    aiResponse: any,
    branchIndex: number,
    totalBranches: number,
    targetMessageId?: string, // The message ID that triggered this branch creation
    streamingMessage?: any // Optional: streaming message to duplicate if branching during generation
  ): Node => {
    const ai = selectedAIs.find(a => a.id === aiResponse.aiModel || a.id === aiResponse.ai) || selectedAIs[0]
    const newId = generateBranchId()
    const position = getBranchPosition(parentNodeId, branchIndex, totalBranches)
    
    // parentMessageId should be the message that triggered branch creation
    // If targetMessageId is provided, use it; otherwise use aiResponse.id (the AI message itself)
    const parentMessageId = targetMessageId || aiResponse.id
    
    // Generate auto-name for branch based on messages
    const generateBranchName = (): string => {
      if (targetMessageId) {
        const targetMsg = inheritedMessages.find((m: any) => m.id === targetMessageId)
        if (targetMsg) {
          const previewText = targetMsg.text?.substring(0, 40) || 'message'
          if (targetMsg.isUser) {
            return `Branch from "${previewText}..."`
          } else {
            return `Branch from AI response`
          }
        }
      }
      return ai?.name ? `Branch: ${ai.name}` : 'New Branch'
    }
    
    // CRITICAL FIX: Always include the AI response in branchMessages
    // The AI response should ALWAYS be the first message in the branch
    // This ensures branches always start with the AI response that triggered them
    // Only skip if it's a placeholder (empty response)
    const isPlaceholder = aiResponse.id?.startsWith('placeholder-') || !aiResponse.text || aiResponse.text === ''
    
    // Check if AI response is already in inheritedMessages (from paired AI reply logic)
    const aiResponseInInherited = inheritedMessages.some((m: any) => m.id === aiResponse.id)
    
    // CRITICAL FIX: When branching from an AI message, we explicitly excluded it from inheritedMessages
    // So we MUST include it in branchMessages, regardless of aiResponseInInherited check
    // The aiResponseInInherited check is only relevant when branching from user messages
    // When branching from AI message, aiResponseInInherited will be false (because we excluded it),
    // so branchMessagesArray will contain the AI response - this is correct behavior
    
    // CRITICAL: When branching from an AI message (parentMessageId === aiResponse.id),
    // we MUST include the AI response even if aiResponseInInherited is true (shouldn't happen, but safety check)
    // Also check if targetMessageId matches aiResponse.id (another way to detect branching from AI)
    const isBranchingFromAI = parentMessageId === aiResponse.id || targetMessageId === aiResponse.id
    
    console.log('🔍 Branch detection:', {
      parentMessageId,
      targetMessageId,
      aiResponseId: aiResponse.id,
      isBranchingFromAI,
      aiResponseInInherited,
      inheritedMessageIds: inheritedMessages.map(m => m.id)
    })
    
    // CRITICAL: Ensure aiResponse has required properties
    if (!aiResponse || !aiResponse.id) {
      console.error('❌ CRITICAL: aiResponse is invalid:', aiResponse)
      // Return empty branch messages if aiResponse is invalid
      return {
        id: newId,
        type: 'chatNode',
        position,
        data: {
          label: 'Invalid Branch',
          messages: inheritedMessages,
          inheritedMessages: inheritedMessages,
          branchMessages: [],
          parentMessageId: parentMessageId,
          selectedAIs: [ai],
          onBranch: (nodeId: string, msgId?: string) => handleBranchRef.current?.(nodeId, msgId, false),
          onSendMessage: (nodeId: string, msg: string) => handleSendMessageRef.current?.(nodeId, msg),
          isMain: false,
          showAIPill: true,
          parentId: parentNodeId,
          onAddAI: (ai: AI) => handleBranchAddAI(newId, ai),
          onRemoveAI: (aiId: string) => handleBranchRemoveAI(newId, aiId),
          onSelectSingle: (aiId: string) => handleBranchSelectSingle(newId, aiId),
          onToggleMultiModel: (nodeId: string) => handleBranchToggleMultiModel(nodeId),
          getBestAvailableModel: getBestAvailableModel,
          multiModelMode: false,
          nodeId: newId,
          isMinimized: minimizedNodes.has(newId),
          isActive: activeNodeId === newId,
          onToggleMinimize: toggleNodeMinimize
        }
      }
    }
    
    // CRITICAL FIX: When branching from an AI message, ALWAYS include it in branchMessages
    // Even if aiResponseInInherited is somehow true, we still want it in branchMessages
    // because we explicitly excluded it from inheritedMessages
    const shouldIncludeAIResponse = !isPlaceholder && (!aiResponseInInherited || isBranchingFromAI)
    
    // 🔥 NEW: If branching during generation, include the streaming message in branchMessages
    // This allows generation to continue in the branch
    let branchMessagesArray: any[] = []
    
    if (shouldIncludeAIResponse) {
      branchMessagesArray = [{ 
        ...aiResponse, 
        isUser: false,
        parentId: parentMessageId,
        branchId: newId
      }]
    }
    
    // 🔥 NEW: If streaming message is provided (branching during generation), add it to branchMessages
    if (streamingMessage) {
      // Create a duplicate streaming message for the branch with a new ID
      const branchStreamingMessage = {
        ...streamingMessage,
        id: `branch-${streamingMessage.id}-${newId}`, // Unique ID for branch
        parentId: parentMessageId,
        branchId: newId,
        isStreaming: true,
        streamingText: streamingMessage.streamingText || ''
      }
      branchMessagesArray.push(branchStreamingMessage)
      console.log('🔥 Added streaming message to branch:', {
        originalId: streamingMessage.id,
        branchId: branchStreamingMessage.id,
        aiModel: streamingMessage.aiModel,
        streamingText: streamingMessage.streamingText?.substring(0, 50)
      })
    }
    
    console.log('🔧 createBranchNode - AI response handling:', {
      aiResponseId: aiResponse.id,
      aiResponseText: aiResponse.text?.substring(0, 50),
      isPlaceholder,
      aiResponseInInherited,
      isBranchingFromAI,
      shouldIncludeAIResponse,
      branchMessagesCount: branchMessagesArray.length,
      inheritedCount: inheritedMessages.length,
      willIncludeAIResponse: shouldIncludeAIResponse,
      parentMessageId,
      inheritedMessageIds: inheritedMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 20) }))
    })
    
    // DEBUG: Log what will be in the branch
    console.log('📋 BRANCH CONTENT DEBUG:', {
      branchId: newId,
      inheritedMessages: inheritedMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) })),
      branchMessagesArray: branchMessagesArray.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) })),
      willHaveMessages: inheritedMessages.length > 0 || branchMessagesArray.length > 0,
      aiResponseId: aiResponse.id,
      aiResponseWillBeIncluded: branchMessagesArray.length > 0
    })
    
    // Combine inheritedMessages and branchMessages into a single messages array
    // This is what ChatNode expects in node.data.messages
    // Inherited messages already include all messages up to and including the branch point
    // Ensure all messages have correct isUser flag before combining
    // CRITICAL: Force isUser flags - be very strict
    const validatedInherited = inheritedMessages.map((m: any) => {
      const hasAIModel = !!(m.aiModel || m.ai)
      // If message has aiModel or ai, it MUST be isUser: false
      if (hasAIModel) {
        return { ...m, isUser: false }
      }
      // If message doesn't have aiModel or ai, it MUST be isUser: true
      return { ...m, isUser: true }
    })
    
    const validatedBranch = branchMessagesArray.map((m: any) => {
      const hasAIModel = !!(m.aiModel || m.ai)
      // If message has aiModel or ai, it MUST be isUser: false
      if (hasAIModel) {
        return { ...m, isUser: false }
      }
      // If message doesn't have aiModel or ai, it MUST be isUser: true
      return { ...m, isUser: true }
    })
    
    console.log('🔧 Validated branch messages:', {
      branchId: newId,
      branchMessagesArrayCount: branchMessagesArray.length,
      validatedBranchCount: validatedBranch.length,
      validatedBranchIds: validatedBranch.map((m: any) => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
    })
    
    // CRITICAL FIX: When AI response is already in inheritedMessages (from paired AI logic),
    // we should NOT filter it out, because it's part of the context we want to preserve
    // Only filter if we're adding it separately to branchMessages
    const shouldFilterAIResponse = !aiResponseInInherited && !isPlaceholder
    const filteredInherited = shouldFilterAIResponse 
      ? validatedInherited.filter((m: any) => m.id !== aiResponse.id)
      : validatedInherited // Keep all inherited messages if AI response is already there
    
    console.log('🔧 Filtering logic:', {
      aiResponseId: aiResponse.id,
      aiResponseInInherited,
      isPlaceholder,
      shouldFilterAIResponse,
      inheritedBeforeFilter: validatedInherited.length,
      inheritedAfterFilter: filteredInherited.length
    })
    
    const combinedMessages = [...filteredInherited, ...validatedBranch].map(msg => {
      const isAI = Boolean(msg.aiModel || msg.ai || msg.role === 'assistant')
      const forcedIsUser = !isAI
      
      // Log if we're fixing a misaligned message
      if (msg.isUser !== forcedIsUser) {
        console.warn('🔧 FORCING isUser flag in createBranchNode:', {
          messageId: msg.id,
          oldIsUser: msg.isUser,
          newIsUser: forcedIsUser,
          hasAiModel: !!msg.aiModel,
          hasAi: !!msg.ai,
          role: msg.role
        })
      }
      
      return {
        ...msg,
        isUser: forcedIsUser, // FORCE the correct value
      }
    })
    
    // CRITICAL FIX: Ensure AI response is always in combinedMessages when branching from AI message
    // Double-check that the AI response is included - if it's missing, add it explicitly
    const aiResponseInCombined = combinedMessages.some(m => m.id === aiResponse.id)
    if (!aiResponseInCombined && !isPlaceholder) {
      // AI response should be in validatedBranch, but if it's not in combinedMessages, add it
      console.warn('⚠️ CRITICAL: AI response missing from combinedMessages - adding it explicitly:', {
        aiResponseId: aiResponse.id,
        aiResponseText: aiResponse.text?.substring(0, 50),
        combinedCount: combinedMessages.length,
        validatedBranchCount: validatedBranch.length,
        branchMessagesArrayCount: branchMessagesArray.length
      })
      // Add AI response at the end of inherited messages (before branch messages)
      combinedMessages.splice(filteredInherited.length, 0, {
        ...aiResponse,
        isUser: false,
        parentId: parentMessageId,
        branchId: newId
      })
    }
    
    console.log('📦 Branch node messages FINAL:', {
      branchId: newId,
      inheritedCount: filteredInherited.length,
      branchMessagesCount: branchMessagesArray.length,
      validatedBranchCount: validatedBranch.length,
      totalCount: combinedMessages.length,
      aiResponseId: aiResponse.id,
      aiResponseInBranch: combinedMessages.some(m => m.id === aiResponse.id),
      firstMessage: combinedMessages[0]?.id,
      lastMessage: combinedMessages[combinedMessages.length - 1]?.id,
      allMessageIds: combinedMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 20) }))
    })
    
    return {
      id: newId,
      type: 'chatNode',
      position,
      data: {
        label: generateBranchName(), // Use auto-generated name
        messages: combinedMessages, // Combined messages for ChatNode
        inheritedMessages: filteredInherited, // Keep separate for MongoDB - use filtered version (no AI response duplicate)
        branchMessages: validatedBranch, // Keep separate for MongoDB - use validated version (includes AI response)
        parentMessageId: parentMessageId, // Use the target message ID that triggered branch creation
        selectedAIs: [ai],
        onBranch: (nodeId: string, msgId?: string) => handleBranchRef.current?.(nodeId, msgId, false),
        onSendMessage: (nodeId: string, msg: string) => handleSendMessageRef.current?.(nodeId, msg),
        isMain: false,
        showAIPill: true,
        parentId: parentNodeId,
        onAddAI: (ai: AI) => handleBranchAddAI(newId, ai),
        onRemoveAI: (aiId: string) => handleBranchRemoveAI(newId, aiId),
        onSelectSingle: (aiId: string) => handleBranchSelectSingle(newId, aiId),
        onToggleMultiModel: (nodeId: string) => handleBranchToggleMultiModel(nodeId),
        getBestAvailableModel: getBestAvailableModel,
        multiModelMode: false,
        nodeId: newId,
        isMinimized: minimizedNodes.has(newId),
        isActive: activeNodeId === newId,
        // Store lightweight message ID references for context
        messageIds: combinedMessages.map(m => m.id), // Lightweight reference
        contextSnapshot: {
          messageIds: filteredInherited.map(m => m.id), // Only IDs for lightweight storage
          branchMessageIds: validatedBranch.map(m => m.id),
          timestamp: Date.now()
        },
        onToggleMinimize: toggleNodeMinimize
      }
    }
  }, [selectedAIs, generateBranchId, getBranchPosition, handleBranchAddAI, handleBranchRemoveAI, handleBranchSelectSingle, handleBranchToggleMultiModel, getBestAvailableModel, minimizedNodes, activeNodeId, toggleNodeMinimize])
  
  // ✅ NEW SIMPLIFIED handleBranch - Single entry point
  handleBranchRef.current = (parentNodeId: string, messageId?: string, isMultiBranch: boolean = false) => {
    if (!messageId) {
      console.warn('⚠️ handleBranch called without messageId')
      return
    }
    
    console.log('🌿 handleBranch called:', { parentNodeId, messageId, isMultiBranch })
    
    // ✅ Lock check - prevent double execution
    if (branchCreationLockRef.current.get(messageId)) {
      console.warn('⚠️ Branch creation already in progress for messageId:', messageId)
      return
    }
    
    // ✅ Check if branch already exists - show warning modal
    const existingBranch = nodesRef.current.find(node => 
      node.id !== 'main' && 
      node.id !== parentNodeId &&
      node.data?.parentId === parentNodeId &&
      node.data?.parentMessageId === messageId
    )
    
    if (existingBranch) {
      console.log('⚠️ Branch already exists for:', { parentNodeId, messageId, existingBranchId: existingBranch.id })
      
      // Find the message text for the warning modal
      const targetMessage = (parentNodeId === 'main' ? mainMessages : (nodesRef.current.find(n => n.id === parentNodeId)?.data?.messages || []))
        .find((m: any) => m.id === messageId)
      
      // Call the warning handler if provided
      if (onBranchWarning) {
        onBranchWarning({
          messageId,
          messageText: targetMessage?.text?.substring(0, 100),
          existingBranchId: existingBranch.id,
          isMultiBranch
        })
      } else {
        // Fallback: navigate to existing branch
        console.log('📍 Navigating to existing branch:', existingBranch.id)
        if (onNodeDoubleClick) {
          onNodeDoubleClick(existingBranch.id)
        }
      }
      return
    }
    
    // ✅ Set lock
    branchCreationLockRef.current.set(messageId, true)
    
    // ✅ Get all messages from parent node
    const parentNode = nodesRef.current.find(n => n.id === parentNodeId)
    if (!parentNode) {
      console.error('❌ Parent node not found:', parentNodeId)
      branchCreationLockRef.current.delete(messageId)
      return
    }
    
    // Get messages from parent (main or branch)
    // CRITICAL FIX: When branching from main, ensure we get ALL messages from main
    // This includes all user and AI messages up to the branch point
    const allMessages = parentNodeId === 'main' 
      ? mainMessages 
      : (parentNode.data.messages || [])
    
    // 🔥 NEW: Check if main node is currently generating (has streaming messages)
    // This allows branching during generation
    const isMainGenerating = parentNodeId === 'main' && allMessages.some((m: any) => m.isStreaming || m.streamingText)
    const streamingMessages = isMainGenerating 
      ? allMessages.filter((m: any) => m.isStreaming || m.streamingText)
      : []
    
    console.log('📋 Getting messages for branch:', {
      parentNodeId,
      allMessagesCount: allMessages.length,
      isMain: parentNodeId === 'main',
      isMainGenerating,
      streamingMessagesCount: streamingMessages.length,
      messageIds: allMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, isStreaming: m.isStreaming, text: m.text?.substring(0, 30) }))
    })
    
    // ✅ Deduplicate messages FIRST
    const deduplicatedMessages = deduplicateMessages(allMessages)
    
    console.log('📋 Deduplicated messages:', {
      originalCount: allMessages.length,
      deduplicatedCount: deduplicatedMessages.length,
      messageIds: deduplicatedMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
    })
    
    // ✅ Find target message
    const targetMessage = deduplicatedMessages.find(m => m.id === messageId)
    if (!targetMessage) {
      console.error('❌ Target message not found:', messageId)
      branchCreationLockRef.current.delete(messageId)
      return
    }
    
    console.log('✅ Target message found:', {
      id: targetMessage.id,
      isUser: targetMessage.isUser,
      aiModel: targetMessage.aiModel,
      text: targetMessage.text?.substring(0, 50)
    })
    
    // ✅ Determine AI responses to create branches for
    let aiResponses: any[] = []
    
    if (targetMessage.isUser && isMultiBranch) {
      // USER message + isMultiBranch → create one branch per AI model
      // Find AI responses that come after this user message
      const userMessageIndex = deduplicatedMessages.findIndex(m => m.id === messageId)
      
      if (userMessageIndex === -1) {
        console.error('❌ User message index not found')
        branchCreationLockRef.current.delete(messageId)
        return
      }
      
      // Get the user message's groupId if it exists
      const userGroupId = targetMessage.groupId
      
      // Find all AI responses that come after this user message
      // They should either:
      // 1. Have parentId === messageId (direct child)
      // 2. Have the same groupId (multi-model responses)
      // 3. Be the next non-user messages after the user message
      const allAIResponses = deduplicatedMessages
        .slice(userMessageIndex + 1) // Get messages after the user message
        .filter(m => {
          // Stop at the next user message (we only want responses to THIS user message)
          if (m.isUser) return false
          
          // Must be an AI response
          if (!m.aiModel && !m.ai && m.role !== 'assistant') return false
          
          // Check if it's a response to this user message
          const isDirectChild = m.parentId === messageId
          const isSameGroup = userGroupId && m.groupId === userGroupId
          const isNextResponse = deduplicatedMessages.indexOf(m) === userMessageIndex + 1
          
          return isDirectChild || isSameGroup || isNextResponse
        })
      
      console.log('🔍 Searching for AI responses:', {
        userMessageId: messageId,
        userMessageIndex,
        userGroupId,
        totalMessages: deduplicatedMessages.length,
        messagesAfterUser: deduplicatedMessages.slice(userMessageIndex + 1, userMessageIndex + 5).map(m => ({
          id: m.id,
          isUser: m.isUser,
          aiModel: m.aiModel,
          parentId: m.parentId,
          groupId: m.groupId,
          text: m.text?.substring(0, 30)
        })),
        foundAIResponses: allAIResponses.map(m => ({
          id: m.id,
          aiModel: m.aiModel,
          parentId: m.parentId,
          groupId: m.groupId
        }))
      })
      
      aiResponses = deduplicateByModel(allAIResponses)
      console.log('✅ Creating branches for all AI models:', aiResponses.map(r => r.aiModel || r.ai))
    } else if (targetMessage.isUser && !isMultiBranch) {
      // USER message + single mode → find the AI response and create one branch
      const userMessageIndex = deduplicatedMessages.findIndex(m => m.id === messageId)
      
      if (userMessageIndex === -1) {
        console.error('❌ User message index not found')
        branchCreationLockRef.current.delete(messageId)
        return
      }
      
      // Find the first AI response after this user message
      const aiResponse = deduplicatedMessages
        .slice(userMessageIndex + 1)
        .find(m => {
          if (m.isUser) return false // Stop at next user message
          return !!(m.aiModel || m.ai || m.role === 'assistant')
        })
      
      if (aiResponse) {
        aiResponses = [aiResponse]
        console.log('✅ Found AI response for single branch:', {
          aiModel: aiResponse.aiModel || aiResponse.ai,
          text: aiResponse.text?.substring(0, 50)
        })
      } else {
        console.warn('⚠️ No AI response found after user message for single branch')
        branchCreationLockRef.current.delete(messageId)
        return
      }
    } else if (!targetMessage.isUser) {
      // AI message → single branch
      aiResponses = [targetMessage]
      console.log('✅ Creating single branch for AI response:', targetMessage.aiModel || targetMessage.ai)
    }
    
    // If no AI responses found but we're in multi-mode with a user message,
    // and we didn't create placeholders above, create them now
    if (aiResponses.length === 0 && targetMessage.isUser && isMultiBranch) {
      console.log('📝 No AI responses yet, creating placeholder branches for each selected AI model')
      // Create placeholder branches for each selected AI model
      aiResponses = selectedAIs.map((ai: any) => ({
        id: `placeholder-${messageId}-${ai.id}`,
        text: '',
        isUser: false,
        aiModel: ai.id,
        parentId: messageId,
        timestamp: Date.now(),
        children: [],
        responses: {}
      }))
      console.log('✅ Created placeholder branches for AI models:', aiResponses.map(r => r.aiModel))
    } else if (aiResponses.length === 0) {
      console.warn('⚠️ No AI responses found to create branches from')
      branchCreationLockRef.current.delete(messageId)
      return
    }
    
    // ✅ Get inherited messages (all messages till the target message)
    // CRITICAL FIX: When branching from main, we want ALL messages from main up to and including the branch point
    // This ensures full context preservation (both user and AI messages)
    // 🔥 NEW: When branching during generation, include streaming messages up to the branch point
    // CRITICAL FIX: When branching from a user message in multi-mode, DON'T include AI responses in inheritedMessages
    // Each branch will get its own AI response separately
    const includePairedAI = targetMessage.isUser && !isMultiBranch // Only include paired AI for single-mode
    const inheritedMessages = getMessagesTill(messageId, deduplicatedMessages, includePairedAI)
    
    // 🔥 NEW: If branching during generation, include streaming messages that come after the branch point
    // These will be duplicated to the branch so generation continues there too
    let streamingMessagesForBranch: any[] = []
    if (isMainGenerating && streamingMessages.length > 0) {
      const targetMessageIndex = deduplicatedMessages.findIndex(m => m.id === messageId)
      if (targetMessageIndex !== -1) {
        // Get streaming messages that come after the branch point
        streamingMessagesForBranch = streamingMessages.filter((streamMsg: any) => {
          const streamIndex = deduplicatedMessages.findIndex(m => m.id === streamMsg.id)
          return streamIndex > targetMessageIndex
        })
        console.log('🔥 Branching during generation - including streaming messages:', {
          streamingCount: streamingMessagesForBranch.length,
          streamingMessageIds: streamingMessagesForBranch.map(m => ({ id: m.id, aiModel: m.aiModel, streamingText: m.streamingText?.substring(0, 30) }))
        })
      }
    }
    
    console.log('🌳 Inherited messages for branch:', {
      targetMessageId: messageId,
      targetIsUser: targetMessage.isUser,
      isMultiBranch,
      includePairedAI,
      inheritedCount: inheritedMessages.length,
      isMainGenerating,
      streamingMessagesForBranchCount: streamingMessagesForBranch.length,
      inheritedMessages: inheritedMessages.map(m => ({ 
        id: m.id, 
        isUser: m.isUser, 
        aiModel: m.aiModel || m.ai,
        text: m.text?.substring(0, 40) 
      }))
    })
    
    // CRITICAL FIX: When branching from an AI message, we want to:
    // 1. Include all messages UP TO the AI message in inheritedMessages
    // 2. Start the branch WITH the AI message (so it appears in the branch)
    // So if the target message is an AI response, exclude it from inheritedMessages
    // and ensure it's the first message in branchMessages
    const targetMessageIndex = inheritedMessages.findIndex((m: any) => m.id === messageId)
    let finalInheritedMessages = inheritedMessages
    
    // If we're branching from an AI message (not a user message)
    if (targetMessage && !targetMessage.isUser && targetMessageIndex !== -1) {
      // Exclude the AI message from inheritedMessages (it will be the first branch message)
      finalInheritedMessages = inheritedMessages.slice(0, targetMessageIndex)
      console.log('🔧 Branching from AI message - excluding from inherited, adding to branch:', {
        inheritedCount: finalInheritedMessages.length,
        aiResponseId: targetMessage.id,
        aiResponseText: targetMessage.text?.substring(0, 50)
      })
    }
    
    // CRITICAL FIX: When branching from a user message in multi-mode, we should NOT use aiResponseForBranch
    // Each branch should use its own AI response from aiResponses array
    // aiResponseForBranch is only used for single-mode branching
    
    console.log('🌿 Inherited messages for branch:', {
      count: finalInheritedMessages.length,
      targetMessageId: messageId,
      messages: finalInheritedMessages.map((m: any) => ({
        id: m.id,
        isUser: m.isUser,
        text: m.text?.substring(0, 50),
        aiModel: m.aiModel
      }))
    })
    
    // ✅ Create branch nodes
    const newNodes: Node[] = []
    const newEdges: Edge[] = []
    
    aiResponses.forEach((response, idx) => {
      // Check if branch already exists for this specific response
      if (branchExistsForMessage(parentNodeId, response.id)) {
        console.warn('⚠️ Branch already exists for response:', response.id)
        return
      }
      
      // CRITICAL FIX: For multi-mode branching from user message, each branch should use its own AI response
      // For single-mode or branching from AI message, use the appropriate response
      let branchAiResponse = response // Default: use the response from aiResponses array
      
      if (!targetMessage.isUser && idx === 0) {
        // Branching from AI message - use the target message itself
        branchAiResponse = targetMessage
      } else if (targetMessage.isUser && !isMultiBranch && idx === 0) {
        // Single-mode branching from user message - find the paired AI response
        const pairedAIResponse = inheritedMessages.find((m: any, msgIdx: number) => 
          msgIdx > targetMessageIndex && 
          !m.isUser && 
          (m.aiModel || m.ai || m.role === 'assistant') &&
          (m.parentId === messageId || (targetMessage.groupId && m.groupId === targetMessage.groupId))
        )
        if (pairedAIResponse) {
          branchAiResponse = pairedAIResponse
        }
      }
      // For multi-mode branching from user message, branchAiResponse is already set to response (correct!)
      
      console.log('🔧 Preparing to create branch node:', {
        idx,
        responseId: response.id,
        responseAiModel: response.aiModel || response.ai,
        branchAiResponseId: branchAiResponse.id,
        branchAiResponseAiModel: branchAiResponse.aiModel || branchAiResponse.ai,
        branchAiResponseText: branchAiResponse.text?.substring(0, 50),
        branchAiResponseHasText: !!branchAiResponse.text,
        branchAiResponseIsPlaceholder: branchAiResponse.id?.startsWith('placeholder-'),
        targetMessageIsUser: targetMessage?.isUser,
        isMultiBranch,
        finalInheritedCount: finalInheritedMessages.length,
        inheritedMessageIds: finalInheritedMessages.map(m => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 20) }))
      })
      
      const branchNode = createBranchNode(
        parentNodeId,
        finalInheritedMessages, // Use finalInheritedMessages (excludes AI responses for multi-mode)
        branchAiResponse, // Each branch gets its own AI response
        idx,
        aiResponses.length,
        messageId, // Pass the target messageId that triggered branch creation
        isMainGenerating && streamingMessagesForBranch.length > 0 
          ? streamingMessagesForBranch.find((s: any) => s.aiModel === response.aiModel || s.aiModel === response.ai)
          : undefined // Pass streaming message if branching during generation
      )
      
      newNodes.push(branchNode)
      
      // Create edge with step type for rectangular/straight lines
      const newEdge: Edge = {
        id: `edge-${parentNodeId}-${branchNode.id}-${Date.now()}`,
        source: parentNodeId,
        target: branchNode.id,
        type: 'step', // Use step type for rectangular/straight lines instead of curved
        animated: false,
        style: { stroke: '#cbd5e1', strokeWidth: 2 }
      }
      newEdges.push(newEdge)
    })
    
    if (newNodes.length === 0) {
      console.warn('⚠️ No new branches created (all may already exist)')
      branchCreationLockRef.current.delete(messageId)
      return
    }
    
    console.log('✅ Creating branches:', {
      count: newNodes.length,
      branchIds: newNodes.map(n => n.id),
      aiModels: aiResponses.map(r => r.aiModel)
    })
    
    // ✅ Update state
    try {
      setNodeId(prev => {
        const currentNodesInState = nodesRef.current
        const currentEdges = edgesRef.current
        
        // Merge new nodes with existing
        const updatedNodes = [...currentNodesInState, ...newNodes]
        const updatedEdges = [...currentEdges, ...newEdges]
        
        // Apply layout
        let layoutedNodes: Node[]
        try {
          const layoutResult = getLayoutedElements(updatedNodes, updatedEdges)
          layoutedNodes = validateNodePositions(layoutResult.nodes)
        } catch (layoutError) {
          console.error('❌ Dagre layout error:', layoutError)
          // Fallback: use nodes without layout if dagre fails
          layoutedNodes = updatedNodes
        }
        
        // Preserve main node messages AND branch node data
        const finalLayoutedNodes = layoutedNodes.map(node => {
          if (node.id === 'main') {
            return {
              ...node,
              data: {
                ...node.data,
                messages: mainMessages
              }
            }
          }
          // CRITICAL FIX: Preserve branch node data (inheritedMessages, branchMessages, etc.)
          // The layout function might not preserve all data properties
          const originalNode = newNodes.find(n => n.id === node.id) || updatedNodes.find(n => n.id === node.id)
          if (originalNode) {
            return {
              ...node,
              data: {
                ...originalNode.data, // Preserve ALL original data
                ...node.data, // But allow position updates
                // Ensure messages, inheritedMessages, and branchMessages are preserved
                messages: originalNode.data.messages || node.data.messages || [],
                inheritedMessages: originalNode.data.inheritedMessages || node.data.inheritedMessages || [],
                branchMessages: originalNode.data.branchMessages || node.data.branchMessages || [],
                parentMessageId: originalNode.data.parentMessageId || node.data.parentMessageId
              }
            }
          }
          return node
        })
        
        // Update React Flow
        setNodes(finalLayoutedNodes)
        setEdges(updatedEdges)
        
        // ✅ CRITICAL: Ensure nodes are immediately updated with messages
        // This prevents the useEffect from clearing messages before they're displayed
        requestAnimationFrame(() => {
          setNodes((currentNodes) => {
            return currentNodes.map((node) => {
              const newBranchNode = finalLayoutedNodes.find(n => n.id === node.id)
              if (newBranchNode && newBranchNode.data.messages) {
                // Ensure the branch node has its messages set
                return {
                  ...node,
                  data: {
                    ...node.data,
                    ...newBranchNode.data,
                    messages: newBranchNode.data.messages, // Ensure messages are set
                    inheritedMessages: newBranchNode.data.inheritedMessages,
                    branchMessages: newBranchNode.data.branchMessages
                  }
                }
              }
              return node
            })
          })
        })
        
        // ✅ CRITICAL: Force a re-render to ensure branches get their messages immediately
        // This ensures branches are properly displayed without needing a refresh
        setTimeout(() => {
          forceUpdate()
        }, 0)
        
        // ✅ Clear lock immediately after successful node creation
        branchCreationLockRef.current.delete(messageId)
        console.log('🔓 Lock cleared for messageId:', messageId)
        console.log('✅ Branch nodes created, React Flow will update and trigger onNodesUpdate via useEffect')
        
        // ✅ CRITICAL: Manually trigger onNodesUpdate immediately after setting nodes
        // This ensures conversationNodes is updated before the save effect runs
        // The useEffect will also trigger, but this ensures immediate update
        if (onNodesUpdate) {
          // Use a short delay to ensure React Flow has processed the setNodes call
          setTimeout(() => {
            console.log('📤 Manually calling onNodesUpdate immediately after branch creation with', finalLayoutedNodes.length, 'nodes')
            console.log('📤 Node details:', finalLayoutedNodes.map(n => ({
              id: n.id,
              type: n.type,
              parentId: n.data?.parentId,
              parentMessageId: n.data?.parentMessageId,
              hasMessages: !!(n.data?.messages?.length),
              messagesCount: n.data?.messages?.length || 0
            })))
            try {
              onNodesUpdate(finalLayoutedNodes)
              console.log('✅ onNodesUpdate called successfully')
              console.log('✅ Branch creation complete - nodes will be saved to MongoDB')
              
              // 🧠 Inherit memory for new branches
              const parentBranchId = parentNodeId === 'main' ? 'main' : parentNodeId
              newNodes.forEach(async (node) => {
                if (node.id !== 'main') {
                  try {
                    await fetch('/api/memory/inherit', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        newBranchId: node.id,
                        parentBranchId,
                        userId: undefined // TODO: Get from auth context
                      })
                    })
                    console.log('🧠 Memory inherited for branch:', node.id)
                  } catch (error) {
                    console.error('❌ Error inheriting memory:', error)
                  }
                }
              })
            } catch (error) {
              console.error('❌ Error calling onNodesUpdate:', error)
            }
          }, 50)
        } else {
          console.warn('⚠️ onNodesUpdate is not defined! Branches will not be saved.')
        }
        
        // Fit view to show new branches
        requestAnimationFrame(() => {
          setTimeout(() => {
            const nodeIds = [parentNodeId, ...newNodes.map(n => n.id)]
            fitViewportToNodes(nodeIds, 0.15)
          }, 100)
        })
        
        return prev + newNodes.length
      })
    } catch (error) {
      console.error('❌ Error creating branches:', error)
      // Clear lock on error
      branchCreationLockRef.current.delete(messageId)
    }
  }
  
  // ✅ Wrapper for handleBranch
  const handleBranch = useCallback((parentNodeId: string, messageId?: string, isMultiBranch?: boolean) => {
    if (handleBranchRef.current) {
      handleBranchRef.current(parentNodeId, messageId, isMultiBranch)
    }
  }, [])
  
  // ✅ Connect onBranchFromMain to handleBranch
  useEffect(() => {
    if (typeof onBranchFromMain === 'function') {
      // Store a wrapper function that calls handleBranch
      const wrapper = (messageId: string, isMultiBranch?: boolean) => {
        handleBranch('main', messageId, isMultiBranch)
      }
      // If there's a ref in page.tsx, we'd set it here
      // For now, we'll use the prop directly
    }
  }, [onBranchFromMain, handleBranch])

  const handleSendMessageRef = useRef<(parentId: string, message: string) => Promise<void> | undefined>(undefined)
  
  handleSendMessageRef.current = async (parentId: string, message: string) => {
    console.log('📤 handleSendMessageRef called:', { parentId, message })
    
    // Don't handle main node here - it's handled by onSendMainMessage
    if (parentId === 'main') {
      console.log('⚠️ Main node message sending handled by onSendMainMessage')
      return
    }
    
    // Find the branch node
    const branchNode = nodes.find(n => n.id === parentId)
    if (!branchNode) {
      console.error('❌ Branch node not found:', parentId)
      console.log('Available nodes:', nodes.map(n => n.id))
      return
    }
    
    console.log('✅ Found branch node:', {
      nodeId: branchNode.id,
      hasData: !!branchNode.data,
      currentMessagesCount: branchNode.data?.messages?.length || 0,
      hasOnSendMessage: !!branchNode.data?.onSendMessage
    })
    
    // Get the AI models for this branch (support multi-model)
    // Use node's data first (most up-to-date), then fall back to branch state
    const nodeSelectedAIs = branchNode.data.selectedAIs || []
    const nodeMultiModelMode = branchNode.data.multiModelMode || false
    const branchSelectedAIs = getBranchSelectedAIs(parentId)
    const branchMultiModelMode = getBranchMultiModelMode(parentId)
    
    // Prefer node data over branch state, fall back to default AI if none selected
    const selectedAIs = nodeSelectedAIs.length > 0 
      ? nodeSelectedAIs 
      : (branchSelectedAIs.length > 0 
        ? branchSelectedAIs 
        : [{ 
            id: 'best', 
            name: 'Best', 
            color: 'bg-purple-100 text-purple-800 border-purple-200', 
            functional: true, 
            logo: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                <defs>
                  <linearGradient id="bestGradientFallback1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="50%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
                <path d="M12 2L14.5 8.5L21 9.5L16 14L17.5 20.5L12 17L6.5 20.5L8 14L3 9.5L9.5 8.5L12 2Z" fill="url(#bestGradientFallback1)" opacity="0.9" className="drop-shadow-sm"/>
                <path d="M12 5L13.5 9L17 9.5L14 12L14.5 15.5L12 13.5L9.5 15.5L10 12L7 9.5L10.5 9L12 5Z" fill="white" opacity="0.3"/>
              </svg>
            )
          }])
    const multiModelMode = nodeMultiModelMode || branchMultiModelMode
    
    if (selectedAIs.length === 0) return
    
    // Add user message immediately
    const userMsg = {
      id: `msg-${Date.now()}`,
      text: message,
      isUser: true,
      children: [],
      timestamp: Date.now(),
      aiModel: undefined,
      groupId: undefined
    }
    
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === parentId) {
          const currentMessages = node.data.messages || []
          console.log('📝 Adding user message to branch:', {
            branchId: parentId,
            currentMessagesCount: currentMessages.length,
            newMessageId: userMsg.id,
            newMessageText: userMsg.text
          })
          
          const updatedMessages = [...currentMessages, userMsg]
          
          return {
            ...node,
            data: {
              ...node.data,
              messages: updatedMessages,
              // Also update branchMessages to include the new user message
              branchMessages: [...(node.data.branchMessages || []), userMsg]
            }
          }
        }
        return node
      })
      return updatedNodes
    })
    
    // Set generating state
    setGeneratingBranchId(parentId)
    
    // Force immediate UI update
    setTimeout(() => {
      forceUpdate()
    }, 0)
    
    try {
      // Import aiService dynamically to avoid circular dependencies
      const { aiService } = await import('../services/ai-api')
      
      // Build context by gathering all messages from parent chain (root → current)
      // This ensures proper context inheritance as per the branching system spec
      // Per spec: "Gather all messages from its parent chain (root → current)"
      const gatherParentChainMessages = (nodeId: string): any[] => {
        const allMessages: any[] = []
        let currentNodeId: string | undefined = nodeId
        
        // Build parent chain: collect all parent IDs
        const parentChain: string[] = [nodeId]
        let currentId: string | undefined = nodeId
        
        while (currentId) {
          const node = nodes.find(n => n.id === currentId)
          if (!node || !node.data.parentId) break
          
          parentChain.push(node.data.parentId)
          currentId = node.data.parentId
        }
        
        // Reverse to get order: root → current
        const chainOrder = parentChain.reverse()
        
        // Collect messages from each node in the chain
        for (const chainNodeId of chainOrder) {
          const node = nodes.find(n => n.id === chainNodeId)
          if (!node) continue
          
          const nodeMessages = node.data.messages || []
          // Add messages from this node (excluding the branch init message)
          const validMessages = nodeMessages.filter((m: any) => 
            !m.text?.startsWith('[Branched from:')
          )
          
          allMessages.push(...validMessages)
        }
        
        // Also include main messages if this branch is not directly from main
        const mainNode = nodes.find(n => n.id === 'main')
        if (mainNode && !parentChain.includes('main')) {
          const mainMessages = mainNode.data.messages || []
          const validMainMessages = mainMessages.filter((m: any) => 
            !m.text?.startsWith('[Branched from:')
          )
          // Prepend main messages (root context)
          allMessages.unshift(...validMainMessages)
        }
        
        return allMessages
      }
      
      // Gather all messages from parent chain (root → current)
      const parentChainMessages = gatherParentChainMessages(parentId)
      const currentBranchMessages = branchNode.data.messages || []
      
      // Combine: parent chain messages (context inheritance) + current branch messages
      // Note: currentBranchMessages already includes parent messages, so we need to deduplicate
      const allContextMessages = [...parentChainMessages, ...currentBranchMessages]
      
      // Deduplicate by message ID (in case parent messages are already in current branch)
      const uniqueMessages = allContextMessages.filter((msg, index, self) => 
        index === self.findIndex(m => m.id === msg.id)
      )
      
      console.log('🌳 Context inheritance:', {
        branchId: parentId,
        parentChainLength: parentChainMessages.length,
        currentBranchLength: currentBranchMessages.length,
        totalContextLength: uniqueMessages.length,
        parentChain: parentChainMessages.map(m => ({ id: m.id, text: m.text?.substring(0, 30) }))
      })
      
      // Get context-linked branches (if any) - per spec: "Link another branch's context"
      const getContextLinkedMessages = (): any[] => {
        const linkedMessages: any[] = []
        const linkedBranches = Array.from(contextLinks).filter(link => 
          link.startsWith(`${parentId}-`) || link.endsWith(`-${parentId}`)
        )
        
        for (const link of linkedBranches) {
          const [sourceId, targetId] = link.split('-')
          const linkedBranchId = sourceId === parentId ? targetId : sourceId
          
          const linkedNode = nodes.find(n => n.id === linkedBranchId)
          if (linkedNode) {
            const linkedNodeMessages = linkedNode.data.messages || []
            const validLinkedMessages = linkedNodeMessages.filter((m: any) => 
              !m.text?.startsWith('[Branched from:')
            )
            linkedMessages.push(...validLinkedMessages)
          }
        }
        
        return linkedMessages
      }
      
      // Get context-linked messages
      const contextLinkedMessages = getContextLinkedMessages()
      
      // Combine: parent chain + current branch + linked context
      const allMessagesWithLinks = [...uniqueMessages, ...contextLinkedMessages]
      
      // Deduplicate by message ID
      const finalMessages = allMessagesWithLinks.filter((msg, index, self) => 
        index === self.findIndex(m => m.id === msg.id)
      )
      
      if (contextLinkedMessages.length > 0) {
        console.log('🔗 Context linking:', {
          branchId: parentId,
          linkedBranchesCount: contextLinkedMessages.length,
          linkedMessages: contextLinkedMessages.map(m => ({ id: m.id, text: m.text?.substring(0, 30) }))
        })
      }
      
      // Build context with full parent chain + linked context
      // 🧠 Get memory context for this branch
      let memoryContext = ''
      try {
        const memoryResponse = await fetch(`/api/memory/context?branchId=${parentId}&depth=3&maxMemories=50`)
        if (memoryResponse.ok) {
          const memoryData = await memoryResponse.json()
          if (memoryData.success) {
            memoryContext = memoryData.data.aggregatedContext
          }
        }
      } catch (error) {
        console.error('❌ Error fetching memory context:', error)
      }
      
      const context = {
        messages: finalMessages,
        currentBranch: parentId,
        parentMessages: parentChainMessages,
        linkedContext: contextLinkedMessages,
        memoryContext
      }
      
      if (branchMultiModelMode && selectedAIs.length > 1) {
        // Multi-model response for branch
        console.log('🔄 Generating multi-model response for branch:', parentId)
        
        // Create streaming placeholders for each AI
        const groupId = `group-${Date.now()}`
        const baseTimestamp = Date.now()
        const streamingMessages = selectedAIs.map((ai: any, index: number) => ({
          id: `msg-${baseTimestamp}-${ai.id}-${index}-streaming`,
          text: '',
          isUser: false,
          children: [],
          timestamp: baseTimestamp + index,
          aiModel: ai.id,
          groupId: groupId,
          isStreaming: true,
          streamingText: ''
        }))
        
        // Add streaming placeholders
        setNodes((nds) => {
          const updatedNodes = nds.map((node) => {
            if (node.id === parentId) {
              const currentMessages = node.data.messages || []
              return {
                ...node,
                data: {
                  ...node.data,
                  messages: [...currentMessages, ...streamingMessages]
                }
              }
            }
            return node
          })
          return updatedNodes
        })
        
        // Generate responses from all AIs
        // CRITICAL: Create abort controller for this generation
        const abortController = new AbortController()
        abortControllersRef.current.set(parentId, abortController)
        
        const responses = await Promise.all(
          selectedAIs.map(async (ai: any, index: number) => {
            // Check if aborted before starting
            if (abortController.signal.aborted) {
              throw new Error('Generation aborted')
            }
            
            const modelName = ai.id === 'gemini-2.5-pro' ? 'gemini' : 
                             ai.id === 'mistral-large' ? 'mistral' : 
                             'gpt-4'
            
            // Find the streaming message ID for this AI
            const streamingMsgId = streamingMessages[index]?.id
            
            // 🔥 MOCK MODE: Generate mock response instead of calling API
            const mockResponse = `This is a mock response from ${ai.name} in branch to: "${message}". In a real scenario, this would be generated by the ${modelName} API. This response simulates what the AI would say based on the branch conversation context.`
            
            // 🔥 MOCK STREAMING: Simulate streaming by chunking the mock response
            const words = mockResponse.split(' ')
            const chunkDelay = 50 // ms between chunks
            
            for (let i = 0; i < words.length; i++) {
              if (abortController.signal.aborted) {
                throw new Error('Generation aborted')
              }
              
              const chunk = (i === 0 ? '' : ' ') + words[i]
              
              // Handle streaming for this specific AI
              console.log(`[MOCK] Streaming from ${ai.name} in branch:`, chunk)
              setNodes((nds) => {
                const updatedNodes = nds.map((node) => {
                  if (node.id === parentId) {
                    const currentMessages = node.data.messages || []
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        messages: currentMessages.map((msg: any) => 
                          msg.id === streamingMsgId
                            ? { ...msg, streamingText: (msg.streamingText || '') + chunk }
                            : msg
                        )
                      }
                    }
                  }
                  return node
                })
                return updatedNodes
              })
              
              // Wait before next chunk
              await new Promise(resolve => setTimeout(resolve, chunkDelay))
            }
            
            // Return mock response
            return {
              ai,
              response: {
                text: mockResponse,
                timestamp: Date.now()
              }
            }
          })
        )
        
        // Replace streaming messages with final responses
        setNodes((nds) => {
          const updatedNodes = nds.map((node) => {
            if (node.id === parentId) {
              const currentMessages = node.data.messages || []
              // Remove streaming messages
              const filteredMessages = currentMessages.filter((msg: any) => !msg.isStreaming)
              // Add final responses
              const finalMessages = responses.map(({ ai, response }) => ({
                id: `msg-${Date.now()}-${ai.id}-final`,
        text: response.text,
              isUser: false,
              children: [],
        timestamp: response.timestamp,
                aiModel: ai.id,
                groupId: groupId,
                isStreaming: false,
                streamingText: ''
              }))
              
              return {
                ...node,
                data: {
                  ...node.data,
                  messages: [...filteredMessages, ...finalMessages]
                }
              }
            }
            return node
          })
          return updatedNodes
        })
        
      } else {
        // Single AI response for branch
        const selectedAI = selectedAIs[0]
        const modelName = selectedAI.id === 'gemini-2.5-pro' ? 'gemini' : 
                         selectedAI.id === 'mistral-large' ? 'mistral' : 
                         'gpt-4'
        
        // Create streaming message placeholder for branch
        const streamingMessageId = `msg-${Date.now() + 1}`
        const streamingMessage = {
          id: streamingMessageId,
          text: '',
          isUser: false,
          children: [],
          timestamp: Date.now(),
        aiModel: selectedAI.id,
          groupId: undefined,
          isStreaming: true,
          streamingText: ''
            }
      
        // Add streaming message to branch immediately
      setNodes((nds) => {
        const updatedNodes = nds.map((node) => {
          if (node.id === parentId) {
            const currentMessages = node.data.messages || []
            return {
              ...node,
              data: {
                ...node.data,
                  messages: [...currentMessages, streamingMessage]
              }
            }
          }
          return node
        })
        return updatedNodes
      })
        
        // CRITICAL: Create abort controller for this generation
        const abortController = new AbortController()
        abortControllersRef.current.set(parentId, abortController)
        
        // 🔥 MOCK MODE: Generate mock response instead of calling API
        const mockResponse = `This is a mock response from ${selectedAI.name} in branch to: "${message}". In a real scenario, this would be generated by the ${modelName} API. This response simulates what the AI would say based on the branch conversation context.`
        
        // 🔥 MOCK STREAMING: Simulate streaming by chunking the mock response
        const words = mockResponse.split(' ')
        const chunkDelay = 50 // ms between chunks
        
        for (let i = 0; i < words.length; i++) {
          if (abortController.signal.aborted) {
            throw new Error('Generation aborted')
          }
          
          const chunk = (i === 0 ? '' : ' ') + words[i]
          
          // Handle streaming response - update the streaming message in branch
          console.log(`[MOCK] Streaming from ${selectedAI.name} in branch:`, chunk)
          setNodes((nds) => {
            const updatedNodes = nds.map((node) => {
              if (node.id === parentId) {
                const currentMessages = node.data.messages || []
                return {
                  ...node,
                  data: {
                    ...node.data,
                    messages: currentMessages.map((msg: any) => 
                      msg.id === streamingMessageId 
                        ? { ...msg, streamingText: (msg.streamingText || '') + chunk }
                        : msg
                    )
                  }
                }
              }
              return node
            })
            return updatedNodes
          })
          
          // Wait before next chunk
          await new Promise(resolve => setTimeout(resolve, chunkDelay))
        }
        
        // Create mock response object
        const response = {
          text: mockResponse,
          timestamp: Date.now()
        }
        
        // Finalize the streaming message
        setNodes((nds) => {
          const updatedNodes = nds.map((node) => {
            if (node.id === parentId) {
              const currentMessages = node.data.messages || []
              
              // CRITICAL FIX: Ensure we properly finalize the streaming message
              const finalizedMessages = currentMessages.map((msg: any) => {
                if (msg.id === streamingMessageId) {
                  // Finalize this streaming message with the full response
                  console.log('✅ Finalizing streaming message:', {
                    streamingMessageId,
                    responseText: response.text?.substring(0, 50),
                    hadStreamingText: !!msg.streamingText
                  })
                  return { 
                    ...msg, 
                    text: response.text || msg.streamingText || '[No response]', 
                    isStreaming: false, 
                    streamingText: undefined,
                    timestamp: response.timestamp || Date.now(),
                    aiModel: selectedAI.id
                  }
                }
                return msg
              })
              
              // Remove any other streaming messages that weren't finalized
              const cleanedMessages = finalizedMessages.filter((msg: any) => 
                !(msg.isStreaming && msg.id !== streamingMessageId)
              )
              
              console.log('📝 Finalized branch messages:', {
                branchId: parentId,
                beforeCount: currentMessages.length,
                afterCount: cleanedMessages.length,
                finalizedMessageId: streamingMessageId,
                finalMessageText: cleanedMessages.find((m: any) => m.id === streamingMessageId)?.text?.substring(0, 50)
              })
              
              return {
                ...node,
                data: {
                  ...node.data,
                  messages: cleanedMessages,
                  isGenerating: false
                }
              }
            }
            return node
          })
          return updatedNodes
        })
        
        // 🧠 Extract memories from AI response
        try {
          await fetch('/api/memory/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              responseText: response.text,
              branchId: parentId,
              messageId: streamingMessageId,
              userId: undefined, // TODO: Get from auth context
              topic: selectedAI.name
            })
          })
          console.log('🧠 Memories extracted from AI response')
        } catch (error) {
          console.error('❌ Error extracting memories:', error)
        }
      }
      
      // Clear generating state and force UI update after AI response
      setGeneratingBranchId(null)
      // Clean up abort controller
      abortControllersRef.current.delete(parentId)
      // Ensure node is marked as not generating
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.id === parentId) {
            return {
              ...node,
              data: {
                ...node.data,
                isGenerating: false
              }
            }
          }
          return node
        })
      })
      setTimeout(() => {
        forceUpdate()
      }, 0)
      
    } catch (error) {
      console.error('Error generating AI response in branch:', error)
      
      // Check if it was aborted
      const wasAborted = error instanceof Error && (error.message.includes('aborted') || error.message.includes('AbortError'))
      
      // Clean up abort controller
      abortControllersRef.current.delete(parentId)
      
      // If aborted, finalize with current streaming text
      if (wasAborted) {
        console.log('🛑 Generation aborted by user')
        setNodes((nds) => {
          const updatedNodes = nds.map((node) => {
            if (node.id === parentId) {
              const currentMessages = node.data.messages || []
              return {
                ...node,
                data: {
                  ...node.data,
                  messages: currentMessages.map((msg: any) => {
                    if (msg.isStreaming && msg.streamingText) {
                      // Finalize streaming message with current text
                      return {
                        ...msg,
                        text: msg.streamingText || '[Generation stopped]',
                        isStreaming: false,
                        streamingText: undefined
                      }
                    }
                    return msg
                  }).filter((msg: any) => {
                    // Remove streaming messages that have no text
                    if (msg.isStreaming && !msg.streamingText) {
                      return false
                    }
                    return true
                  })
                }
              }
            }
            return node
          })
          return updatedNodes
        })
      } else {
        // Add error response for non-abort errors
        console.error('❌ Error generating AI response in branch:', error)
        const errorMsg = {
          id: `msg-${Date.now() + 1}`,
          text: `AI error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isUser: false,
          children: [],
          timestamp: Date.now() + 1,
          aiModel: selectedAIs[0]?.id || 'unknown',
          groupId: undefined
        }
        
        setNodes((nds) => {
          const updatedNodes = nds.map((node) => {
            if (node.id === parentId) {
              const currentMessages = node.data.messages || []
              // Remove streaming messages and add error
              const filteredMessages = currentMessages.filter((msg: any) => !msg.isStreaming)
              return {
                ...node,
                data: {
                  ...node.data,
                  messages: [...filteredMessages, errorMsg],
                  isGenerating: false
                }
              }
            }
            return node
          })
          return updatedNodes
        })
      }
      
      // Clear generating state - CRITICAL: Always clear this
      setGeneratingBranchId(null)
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.id === parentId) {
            return {
              ...node,
              data: {
                ...node.data,
                isGenerating: false
              }
            }
          }
          return node
        })
      })
      setTimeout(() => {
        forceUpdate()
      }, 0)
    }
  }
  
  const handleSendMessage = useCallback(async (parentId: string, message: string) => {
    await handleSendMessageRef.current?.(parentId, message)
  }, [])
  
  // Stop generation handler - aborts all ongoing AI generations
  const handleStopGeneration = useCallback((nodeId?: string) => {
    console.log('🛑 Stop generation requested for node:', nodeId || 'all')
    
    if (nodeId) {
      // Stop specific node
      const abortController = abortControllersRef.current.get(nodeId)
      if (abortController) {
        abortController.abort()
        abortControllersRef.current.delete(nodeId)
        console.log('🛑 Aborted generation for node:', nodeId)
      }
      setGeneratingBranchId(null)
    } else {
      // Stop all nodes
      abortControllersRef.current.forEach((controller, id) => {
        controller.abort()
        console.log('🛑 Aborted generation for node:', id)
      })
      abortControllersRef.current.clear()
      setGeneratingBranchId(null)
    }
    
    forceUpdate()
  }, [])

  // Initialize main node on mount (only if not restoring from MongoDB)
  useEffect(() => {
    if (nodes.length === 0 && (!restoredConversationNodes || restoredConversationNodes.length === 0)) {
      console.log('🎬 Initializing main node (no restored nodes)')
      const mainNode: any = {
        id: 'main',
        type: 'chatNode',
        position: { x: 400, y: 50 },
        data: { 
          label: 'Main Chat',
          messages: mainMessages,
          selectedAIs: selectedAIs,
          onBranch: handleBranch,
          onSendMessage: onSendMainMessage,
          onAddAI: onAddAI,
          onRemoveAI: onRemoveAI,
          onToggleMinimize: toggleNodeMinimize,
          isMain: true,
          isMinimized: minimizedNodes.has('main'),
          isActive: activeNodeId === 'main'
        },
      }
      setNodes(validateNodePositions([mainNode]))
      
      // Smooth initial fit view
      setTimeout(() => {
        fitView({ 
          padding: 0.3, 
          duration: 800,
          minZoom: 0.6,
          maxZoom: 1.0
        })
      }, 100)
    } else if (nodes.length === 0 && restoredConversationNodes && restoredConversationNodes.length > 0) {
      console.log('⏭️ Skipping main node initialization - waiting for restored nodes')
    }
  }, [nodes.length, restoredConversationNodes])

  // Update all nodes when main messages change
  useEffect(() => {
    console.log('🔄 Updating nodes with branch count:', nodes.length - 1)
    setNodes((nds) =>
      validateNodePositions(nds.map((node) => {
        if (node.id === 'main') {
          // Update main node with all messages
          return {
            ...node,
            data: {
              ...node.data,
              messages: mainMessages,
              selectedAIs: selectedAIs,
              onAddAI: onAddAI,
              onRemoveAI: onRemoveAI,
              onBranch: handleBranch,
              onSendMessage: onSendMainMessage,
              onSelectSingle: onSelectSingle,
              onToggleMultiModel: () => {
                // Toggle multi-model mode in parent component
                // This will be handled by the parent component
              },
              getBestAvailableModel: getBestAvailableModel,
              multiModelMode: multiModelMode,
              onExportImport: onExportImport,
              isMain: true, // Ensure isMain is always true for main node
              existingBranchesCount: nodes.length - 1, // Exclude main node
              nodeId: 'main',
              onStopGeneration: handleStopGeneration
            }
          }
        } else if (node.data.showAIPill) {
          // This is a multi-model node - update with relevant messages
          const ai = node.data.selectedAIs[0]
          if (ai) {
            return {
              ...node,
              data: {
                ...node.data,
                messages: [
                  // Include all user messages
                  ...mainMessages.filter(m => m.isUser),
                  // Include only this AI's responses
                  ...mainMessages.filter(m => !m.isUser && m.ai === ai.id)
                ],
                onBranch: node.data.onBranch,
                onSendMessage: node.data.onSendMessage,
                selectedAIs: node.data.selectedAIs,
                showAIPill: true,
                isMain: false,
                existingBranchesCount: nodes.length - 1 // Exclude main node
              }
            }
          }
          return node
        } else if (node.id !== 'main') {
          // This is a branch node - add branch-level multi-model functionality
          const branchSelectedAIs = getBranchSelectedAIs(node.id)
          const branchMultiModelMode = getBranchMultiModelMode(node.id)
          const isMultiBranch = branchMultiModelMode || false // Check if this is a multi-mode branch
          
          // Get inherited messages and branch messages from node data
          // CRITICAL: Preserve context from main node to branches
          let inheritedMessages = node.data.inheritedMessages || []
          let branchMessages = node.data.branchMessages || []
          const parentMessageId = node.data.parentMessageId
          
          // CRITICAL FIX: If node.data.messages exists and is more recent than branchMessages,
          // use it as the source of truth for branchMessages. This prevents the useEffect from
          // overwriting messages that were just added (user messages, AI responses, etc.)
          const currentMessages = node.data.messages || []
          const nodeParentId = node.parentId || node.data?.parentId || 'main'
          
          // CRITICAL FIX: If inheritedMessages are already set (from createBranchNode),
          // don't try to reconstruct them - they're already correct!
          // Only reconstruct if they're actually missing AND we have a parentMessageId
          const hasInheritedMessages = inheritedMessages.length > 0
          const shouldReconstructInherited = !hasInheritedMessages && parentMessageId && parentMessageId !== 'unknown'
          
          // CRITICAL FIX: If branchMessages already exist and currentMessages matches them,
          // don't overwrite. This prevents the useEffect from clearing branch messages
          // that were just set during branch creation.
          const hasBranchMessages = branchMessages.length > 0
          // Check if currentMessages contains all branchMessages (they might be at the end)
          const currentMessagesMatchBranch = hasBranchMessages && currentMessages.length > 0 && 
            branchMessages.every((bm: any) => currentMessages.some((cm: any) => cm.id === bm.id))
          
          // If branch was just created and has messages, skip reconstruction
          // This ensures branches display their messages immediately without needing a refresh
          if (hasInheritedMessages && hasBranchMessages) {
            console.log('✅ Branch already initialized - preserving messages:', {
              branchId: node.id,
              inheritedCount: inheritedMessages.length,
              branchCount: branchMessages.length,
              currentCount: currentMessages.length,
              currentMessagesMatchBranch
            })
            // Ensure combinedMessages is correct - use currentMessages if it's more complete
            let combinedMessages = [...inheritedMessages, ...branchMessages]
            if (currentMessages.length > combinedMessages.length) {
              // currentMessages might have more recent messages (user input, AI responses)
              // Use it as the source of truth
              combinedMessages = currentMessages
              console.log('📝 Using currentMessages as source of truth (more complete):', {
                branchId: node.id,
                combinedCount: combinedMessages.length,
                currentCount: currentMessages.length
              })
            }
            return {
              ...node,
              data: {
                ...node.data,
                messages: combinedMessages, // Ensure messages are set
                inheritedMessages: inheritedMessages, // Preserve inherited
                branchMessages: branchMessages, // Preserve branch messages
                selectedAIs: branchSelectedAIs.length > 0 ? branchSelectedAIs : [selectedAIs[0] || { 
                  id: 'best', 
                  name: 'Best', 
                  color: 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border-purple-200', 
                  functional: true,
                  logo: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                      <defs>
                        <linearGradient id="bestGradientFallback2" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="50%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                      </defs>
                      <path d="M12 2L14.5 8.5L21 9.5L16 14L17.5 20.5L12 17L6.5 20.5L8 14L3 9.5L9.5 8.5L12 2Z" fill="url(#bestGradientFallback2)" opacity="0.9" className="drop-shadow-sm"/>
                      <path d="M12 5L13.5 9L17 9.5L14 12L14.5 15.5L12 13.5L9.5 15.5L10 12L7 9.5L10.5 9L12 5Z" fill="white" opacity="0.3"/>
                    </svg>
                  )
                }],
                onAddAI: (ai: AI) => handleBranchAddAI(node.id, ai),
                onRemoveAI: (aiId: string) => handleBranchRemoveAI(node.id, aiId),
                onSelectSingle: (aiId: string) => handleBranchSelectSingle(node.id, aiId),
                onToggleMultiModel: (nodeId: string) => handleBranchToggleMultiModel(nodeId),
                getBestAvailableModel: getBestAvailableModel,
                multiModelMode: branchMultiModelMode,
                nodeId: node.id,
                isMain: false,
                existingBranchesCount: nodes.length - 1,
                onStopGeneration: handleStopGeneration
              }
            }
          }
          
          console.log('🔍 Branch context check:', {
            branchId: node.id,
            hasInheritedMessages,
            inheritedCount: inheritedMessages.length,
            parentMessageId,
            shouldReconstructInherited,
            mainMessagesCount: mainMessages.length
          })
          
          // CRITICAL FIX: Only reconstruct inheritedMessages if they're missing AND we have parentMessageId
          // If they're already set (from createBranchNode), preserve them!
          if (shouldReconstructInherited && nodeParentId === 'main') {
            // Try to reconstruct from parentMessageId
            const parentMessage = mainMessages.find((m: any) => m.id === parentMessageId)
            if (parentMessage) {
              const parentIndex = mainMessages.findIndex((m: any) => m.id === parentMessageId)
              if (parentIndex !== -1) {
                // Get all messages up to and including the parent message
                inheritedMessages = mainMessages.slice(0, parentIndex + 1).map((m: any) => ({
                  ...m,
                  // Ensure isUser flag is correct
                  isUser: (m.aiModel || m.ai) ? false : (m.isUser !== undefined ? m.isUser : true)
                }))
                console.log('🔄 Reconstructed inherited messages from mainMessages (via parentMessageId):', {
                  branchId: node.id,
                  parentMessageId,
                  inheritedCount: inheritedMessages.length,
                  messages: inheritedMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
                })
              }
            }
            
            // If still empty, try to infer from currentMessages
            if (inheritedMessages.length === 0 && currentMessages.length > 0) {
              const mainMessageIds = new Set(mainMessages.map((m: any) => m.id))
              const inferredInherited = currentMessages.filter((m: any) => mainMessageIds.has(m.id))
              
              if (inferredInherited.length > 0) {
                // Sort by their order in mainMessages
                inheritedMessages = mainMessages.filter((m: any) => 
                  inferredInherited.some((im: any) => im.id === m.id)
                )
                console.log('🔄 Reconstructed inherited messages from currentMessages (inferred):', {
                  branchId: node.id,
                  inheritedCount: inheritedMessages.length,
                  messages: inheritedMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
                })
              }
            }
          } else if (hasInheritedMessages) {
            // InheritedMessages are already set - preserve them!
            console.log('✅ Preserving existing inheritedMessages:', {
              branchId: node.id,
              inheritedCount: inheritedMessages.length,
              messageIds: inheritedMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 20) }))
            })
          }
          
          // CRITICAL FIX: When branching from an AI message, ensure the AI response is always included
          // Check if parentMessageId points to an AI message in mainMessages
          // If so, and if that AI message is not in currentMessages, we need to add it
          if (parentMessageId && parentMessageId !== 'unknown' && nodeParentId === 'main') {
            const parentMessage = mainMessages.find((m: any) => m.id === parentMessageId)
            if (parentMessage && !parentMessage.isUser) {
              // This is branching from an AI message
              const aiResponseInCurrent = currentMessages.some((m: any) => m.id === parentMessageId)
              if (!aiResponseInCurrent && !branchMessages.some((m: any) => m.id === parentMessageId)) {
                // AI response is missing - add it to branchMessages
                console.log('🔧 CRITICAL: AI response missing from branch - adding it:', {
                  branchId: node.id,
                  parentMessageId,
                  aiResponseText: parentMessage.text?.substring(0, 50)
                })
                branchMessages = [parentMessage, ...branchMessages]
              }
            }
          }
          
          if (currentMessages.length > 0) {
            // Extract branch messages from currentMessages (messages that aren't in inheritedMessages)
            const inheritedIds = new Set(inheritedMessages.map((m: any) => m.id))
            const extractedBranchMessages = currentMessages.filter((m: any) => !inheritedIds.has(m.id))
            
            // If extracted branch messages are more recent than stored branchMessages, use them
            // This ensures that messages added directly to node.data.messages (like user messages or AI responses)
            // are preserved when the useEffect reconstructs combinedMessages
            const storedBranchCount = branchMessages.length
            if (extractedBranchMessages.length >= storedBranchCount) {
              branchMessages = extractedBranchMessages
              console.log('✅ Using currentMessages as source of truth for branchMessages:', {
                branchId: node.id,
                extractedCount: extractedBranchMessages.length,
                storedCount: storedBranchCount,
                messageIds: extractedBranchMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, text: m.text?.substring(0, 30) }))
              })
            }
          }
          
          // CRITICAL: Force isUser flags - be very strict
          inheritedMessages = inheritedMessages.map((m: any) => {
            const hasAIModel = !!(m.aiModel || m.ai)
            // If message has aiModel or ai, it MUST be isUser: false
            if (hasAIModel) {
              return { ...m, isUser: false }
            }
            // If message doesn't have aiModel or ai, it MUST be isUser: true
            return { ...m, isUser: true }
          })
          
          // If this branch was created from a user message (has parentMessageId),
          // check if there are AI responses in mainMessages that should be added
          // CRITICAL FIX: For multi-mode branches, we should NOT add AI responses here
          // Each branch already has its own AI response in branchMessages
          // Only add AI responses for single-mode branches that don't have one yet
          let updatedBranchMessages = [...branchMessages]
          if (parentMessageId && branchMessages.length === 0 && !isMultiBranch) {
            // Find the user message in mainMessages
            const userMessage = mainMessages.find((m: any) => m.id === parentMessageId && m.isUser)
            if (userMessage) {
              // Find AI responses that come after this user message
              const userMessageIndex = mainMessages.findIndex((m: any) => m.id === parentMessageId)
              if (userMessageIndex !== -1) {
                // Get AI responses that are children of this user message
                const aiResponses = mainMessages
                  .slice(userMessageIndex + 1)
                  .filter((m: any) => 
                    !m.isUser && 
                    (m.parentId === parentMessageId || m.groupId === userMessage.groupId) &&
                    !inheritedMessages.some((im: any) => im.id === m.id) &&
                    !branchMessages.some((bm: any) => bm.id === m.id)
                  )
                
                // Add AI responses that match this branch's AI model (single-mode only)
                const branchAI = branchSelectedAIs[0] || selectedAIs[0]
                if (branchAI) {
                  const matchingResponses = aiResponses
                    .filter((m: any) => 
                      m.aiModel === branchAI.id || m.ai === branchAI.id
                    )
                    .map((m: any) => ({
                      ...m,
                      isUser: false // Ensure AI responses have isUser: false
                    }))
                  
                  if (matchingResponses.length > 0) {
                    updatedBranchMessages = [...branchMessages, ...matchingResponses]
                    console.log('✅ Adding AI responses to branch (single-mode):', {
                      branchId: node.id,
                      parentMessageId,
                      aiModel: branchAI.id,
                      responsesCount: matchingResponses.length,
                      responseIds: matchingResponses.map((r: any) => r.id),
                      isUserFlags: matchingResponses.map((r: any) => ({ id: r.id, isUser: r.isUser }))
                    })
                  }
                }
              }
            }
          }
          
          // CRITICAL: Force isUser flags - be very strict
          const validatedBranchMessages = updatedBranchMessages.map((m: any) => {
            const hasAIModel = !!(m.aiModel || m.ai)
            // If message has aiModel or ai, it MUST be isUser: false
            if (hasAIModel) {
              return { ...m, isUser: false }
            }
            // If message doesn't have aiModel or ai, it MUST be isUser: true
            return { ...m, isUser: true }
          })
          
          // Combine inherited messages and updated branch messages
          // Both arrays are already validated, so just combine them
          // CRITICAL: Force isUser flag - this is the source of truth for alignment
          const combinedMessages = [...inheritedMessages, ...validatedBranchMessages].map(msg => {
            const isAI = Boolean(msg.aiModel || msg.ai || msg.role === 'assistant')
            const forcedIsUser = !isAI
            
            // Log if we're fixing a misaligned message
            if (msg.isUser !== forcedIsUser) {
              console.warn('🔧 FORCING isUser flag in useEffect update:', {
                messageId: msg.id,
                oldIsUser: msg.isUser,
                newIsUser: forcedIsUser,
                hasAiModel: !!msg.aiModel,
                hasAi: !!msg.ai,
                role: msg.role
              })
            }
            
            return {
              ...msg,
              isUser: forcedIsUser, // FORCE the correct value
            }
          })
          
          console.log('🔄 Branch messages validation:', {
            branchId: node.id,
            inheritedCount: inheritedMessages.length,
            branchCount: validatedBranchMessages.length,
            totalCount: combinedMessages.length,
            inheritedIsUserFlags: inheritedMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, hasAiModel: !!(m.aiModel || m.ai), text: m.text?.substring(0, 20) })),
            branchIsUserFlags: validatedBranchMessages.map((m: any) => ({ id: m.id, isUser: m.isUser, hasAiModel: !!(m.aiModel || m.ai), text: m.text?.substring(0, 20) }))
          })
          
          return {
            ...node,
            data: {
              ...node.data,
              messages: combinedMessages, // Update combined messages
              inheritedMessages: inheritedMessages, // Preserve inherited messages
              branchMessages: validatedBranchMessages, // Update branch messages with validated version
              selectedAIs: branchSelectedAIs.length > 0 ? branchSelectedAIs : [selectedAIs[0] || { 
                id: 'best', 
                name: 'Best', 
                color: 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border-purple-200', 
                functional: true,
                logo: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                    <defs>
                      <linearGradient id="bestGradientFallback2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#8B5CF6" />
                        <stop offset="50%" stopColor="#6366F1" />
                        <stop offset="100%" stopColor="#3B82F6" />
                      </linearGradient>
                    </defs>
                    <path d="M12 2L14.5 8.5L21 9.5L16 14L17.5 20.5L12 17L6.5 20.5L8 14L3 9.5L9.5 8.5L12 2Z" fill="url(#bestGradientFallback2)" opacity="0.9" className="drop-shadow-sm"/>
                    <path d="M12 5L13.5 9L17 9.5L14 12L14.5 15.5L12 13.5L9.5 15.5L10 12L7 9.5L10.5 9L12 5Z" fill="white" opacity="0.3"/>
                  </svg>
                )
              }],
              onAddAI: (ai: AI) => handleBranchAddAI(node.id, ai),
              onRemoveAI: (aiId: string) => handleBranchRemoveAI(node.id, aiId),
              onSelectSingle: (aiId: string) => handleBranchSelectSingle(node.id, aiId),
              onToggleMultiModel: (nodeId: string) => handleBranchToggleMultiModel(nodeId),
              getBestAvailableModel: getBestAvailableModel,
              multiModelMode: branchMultiModelMode,
              nodeId: node.id,
              isMain: false,
              existingBranchesCount: nodes.length - 1,
              onStopGeneration: handleStopGeneration
            }
          }
        }
        return node
      }))
    )
  }, [mainMessages, selectedAIs, getBranchSelectedAIs, getBranchMultiModelMode, handleBranchAddAI, handleBranchRemoveAI, handleBranchSelectSingle, handleBranchToggleMultiModel, getBestAvailableModel, handleStopGeneration])

  // Update generating state for all nodes
  useEffect(() => {
    setNodes((nds) =>
      validateNodePositions(nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isGenerating: generatingBranchId === node.id
        }
      })))
    )
  }, [generatingBranchId])
  
  // Sync branch state with node data when nodes are restored or updated
  // Use a stable string representation to avoid dependency array size changes
  const nodesSyncKey = useRef<string>('')
  useEffect(() => {
    // Create a stable key from node IDs and their data
    const currentKey = JSON.stringify(nodes.map(n => ({
      id: n.id,
      selectedAIsCount: n.data.selectedAIs?.length || 0,
      multiModelMode: n.data.multiModelMode || false
    })))
    
    // Only sync if the key changed
    if (currentKey === nodesSyncKey.current) return
    nodesSyncKey.current = currentKey
    
    nodes.forEach((node) => {
      if (node.id !== 'main' && !node.data.isMain) {
        // Sync selectedAIs from node data (only if different)
        if (node.data.selectedAIs && node.data.selectedAIs.length > 0) {
          setBranchSelectedAIs(prev => {
            const currentBranchAIs = prev[node.id] || []
            // Compare by IDs only, not full objects (avoids circular reference issues with React components)
            const currentIds = currentBranchAIs.map((ai: any) => ai.id).sort().join(',')
            const nodeIds = (node.data.selectedAIs || []).map((ai: any) => ai.id).sort().join(',')
            
            if (currentIds !== nodeIds) {
              return {
                ...prev,
                [node.id]: node.data.selectedAIs || []
              }
            }
            return prev
          })
        }
        
        // Sync multiModelMode from node data (only if different)
        if (node.data.multiModelMode !== undefined) {
          setBranchMultiModelModes(prev => {
            const currentMode = prev[node.id] || false
            if (currentMode !== node.data.multiModelMode) {
              return {
                ...prev,
                [node.id]: node.data.multiModelMode || false
              }
            }
            return prev
          })
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]) // Only depend on length to avoid array reference issues

  // Monitor main node height changes and reposition branches
  // DISABLED: Using fixed height instead of dynamic height
  // useEffect(() => {
  //   const mainNode = nodes.find(n => n.id === 'main')
  //   if (mainNode && mainNode.data.messages) {
  //     const newHeight = calculateMainNodeHeight(mainNode.data.messages.length)
  //     
  //     if (Math.abs(newHeight - mainNodeHeight) > 20) { // Only reposition if significant change
  //       setMainNodeHeight(newHeight)
  //       repositionBranches(newHeight)
  //     }
  //   }
  // }, [mainMessages.length, calculateMainNodeHeight, mainNodeHeight, repositionBranches, nodes])

  // Reset initialization ref when restored nodes change (new conversation loaded or initial load)
  useEffect(() => {
    if (restoredConversationNodes && restoredConversationNodes.length > 0) {
      // Create a unique identifier for this set of restored nodes
      const currentNodeIds = restoredConversationNodes.map((n: any) => n.id).sort().join(',')
      const lastNodeIds = lastRestoredConversationId.current
      
      // If this is a different set of nodes, or it's the first time (null), reset the initialization flag
      if (currentNodeIds !== lastNodeIds || lastNodeIds === null) {
        console.log('🔄 New conversation detected - resetting initialization flag')
        console.log('🔄 Previous node IDs:', lastNodeIds || 'none (initial load)')
        console.log('🔄 New node IDs:', currentNodeIds)
        hasInitializedRestoredNodes.current = false
        lastRestoredConversationId.current = currentNodeIds
        
        // Always clear existing nodes when switching conversations or on initial load
        // This ensures clean state for the new conversation
        console.log('🔄 Clearing nodes for new conversation or initial load')
        setNodes([])
        setEdges([])
      }
    } else if (!restoredConversationNodes || restoredConversationNodes.length === 0) {
      // Reset if no restored nodes
      hasInitializedRestoredNodes.current = false
      lastRestoredConversationId.current = null
    }
  }, [restoredConversationNodes])
  
  // Initialize nodes from restored conversationNodes (MongoDB restore)
  useEffect(() => {
    if (restoredConversationNodes && restoredConversationNodes.length > 0 && !hasInitializedRestoredNodes.current && !pendingBranchMessageId) {
      // Wait a bit for nodes to be cleared (in case of initial load or conversation switch)
      // This ensures we restore after the clearing effect completes
      const timeoutId = setTimeout(() => {
        // Check if we already have nodes that match restored nodes
        const existingNodeIds = new Set(nodes.map(n => n.id))
        const restoredNodeIds = new Set(restoredConversationNodes.map((n: any) => n.id))
        
        // Check if we need to restore any nodes
        // Since we've cleared nodes when switching conversations or on initial load, we should restore all nodes
        const needsRestore = restoredConversationNodes.some((n: any) => !existingNodeIds.has(n.id))
        
        // Always restore if we have restored nodes and no existing nodes, or if any nodes are missing
        if (needsRestore || nodes.length === 0) {
          console.log('🔄 Initializing nodes from restored conversationNodes:', restoredConversationNodes.length)
          console.log('🔄 Restored node IDs:', restoredConversationNodes.map((n: any) => ({ id: n.id, type: n.type, isMain: n.isMain })))
          console.log('🔄 Current nodes in FlowCanvas:', nodes.map(n => n.id))
          hasInitializedRestoredNodes.current = true
          
          const restoredNodes: any[] = []
          const restoredEdges: Edge[] = []
          
          restoredConversationNodes.forEach((nodeData: any) => {
            // Restore all nodes - we've already cleared nodes when switching conversations
            const isMainNode = nodeData.isMain || nodeData.id === 'main'
            
            // CRITICAL FIX: Restore inheritedMessages and branchMessages for branch nodes
            // These are needed for the useEffect to properly reconstruct combinedMessages
            let inheritedMessages = nodeData.inheritedMessages || nodeData.data?.inheritedMessages || []
            let branchMessages = nodeData.branchMessages || nodeData.data?.branchMessages || []
            
            // If messages exist but inheritedMessages/branchMessages don't, try to reconstruct them
            const allMessages = nodeData.messages || nodeData.data?.messages || []
            if (!isMainNode && allMessages.length > 0 && (inheritedMessages.length === 0 || branchMessages.length === 0)) {
              // Try to infer inheritedMessages and branchMessages from messages
              // This is a fallback for branches saved before we started storing them separately
              const parentMessageId = nodeData.parentMessageId || nodeData.data?.parentMessageId
              
              if (parentMessageId && parentMessageId !== 'unknown') {
                // Find the parent message index in mainMessages
                const parentIndex = mainMessages.findIndex((m: any) => m.id === parentMessageId)
                if (parentIndex !== -1) {
                  // Inherited messages are all messages from main up to and including parent
                  inheritedMessages = mainMessages.slice(0, parentIndex + 1)
                  
                  // Branch messages are messages in allMessages that aren't in inheritedMessages
                  const inheritedIds = new Set(inheritedMessages.map((m: any) => m.id))
                  branchMessages = allMessages.filter((m: any) => !inheritedIds.has(m.id))
                  
                  console.log('🔄 Reconstructed inheritedMessages and branchMessages from messages:', {
                    branchId: nodeData.id,
                    inheritedCount: inheritedMessages.length,
                    branchCount: branchMessages.length,
                    totalCount: allMessages.length
                  })
                }
              }
            }
            
            // Combine inheritedMessages and branchMessages for the messages array
            // This ensures the node has all messages when restored
            const combinedMessages = isMainNode 
              ? allMessages 
              : [...inheritedMessages, ...branchMessages]
            
            // Create node from restored data
            const restoredNode: any = {
              id: nodeData.id,
              type: 'chatNode',
              position: nodeData.position || { x: 0, y: 0 },
              data: {
                label: nodeData.title || nodeData.data?.label || nodeData.label || 'Untitled',
                messages: combinedMessages, // Use combined messages
                inheritedMessages: inheritedMessages, // Store separately for useEffect
                branchMessages: branchMessages, // Store separately for useEffect
                parentMessageId: nodeData.parentMessageId || nodeData.data?.parentMessageId,
                selectedAIs: nodeData.selectedAIs || nodeData.data?.selectedAIs || [],
                multiModelMode: nodeData.multiModelMode || nodeData.data?.multiModelMode || false,
                isMain: nodeData.isMain || nodeData.id === 'main',
                isMinimized: nodeData.isMinimized || nodeData.data?.isMinimized || false,
                showAIPill: nodeData.showAIPill || nodeData.data?.showAIPill || false,
                parentId: nodeData.parentId || nodeData.data?.parentId || (nodeData.id === 'main' ? undefined : 'main'),
                onBranch: (nodeId: string, msgId?: string) => handleBranchRef.current?.(nodeId, msgId),
                onSendMessage: (nodeId: string, msg: string) => handleSendMessageRef.current?.(nodeId, msg),
                onToggleMinimize: toggleNodeMinimize,
                onAddAI: (ai: AI) => handleBranchAddAI(nodeData.id, ai),
                onRemoveAI: (aiId: string) => handleBranchRemoveAI(nodeData.id, aiId),
                onSelectSingle: (aiId: string) => handleBranchSelectSingle(nodeData.id, aiId),
                onToggleMultiModel: (nodeId: string) => handleBranchToggleMultiModel(nodeId),
                getBestAvailableModel: getBestAvailableModel,
                nodeId: nodeData.id
              }
            }
            
            restoredNodes.push(restoredNode)
            console.log('✅ Created restored node:', {
              id: restoredNode.id,
              isMain: restoredNode.data.isMain,
              parentId: restoredNode.data.parentId,
              messagesCount: restoredNode.data.messages.length,
              inheritedCount: inheritedMessages.length,
              branchCount: branchMessages.length
            })
            
            // Create edge for non-main nodes
            if (nodeData.id !== 'main' && !nodeData.isMain) {
              const parentId = nodeData.parentId || 'main'
              restoredEdges.push({
                id: `edge-${parentId}-${nodeData.id}`,
                source: parentId,
                target: nodeData.id,
                type: 'step', // Use step type for rectangular/straight lines
                animated: false,
                style: { stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '4 2' }
              })
              console.log('✅ Created restored edge:', {
                source: parentId,
                target: nodeData.id
              })
            }
          })
          
          console.log('✅ Restored nodes:', restoredNodes.length, 'edges:', restoredEdges.length)
          
          // Apply layout to all restored nodes
          const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(restoredNodes, restoredEdges)
          
          // Validate layouted nodes to prevent NaN values
          const validatedLayoutedNodes = validateNodePositions(layoutedNodes)
          
          console.log('📐 Layout calculation:', {
            restoredNodes: restoredNodes.length,
            layoutedNodes: validatedLayoutedNodes.length,
            layoutedEdges: layoutedEdges.length
          })
          
          console.log('🔄 Setting restored nodes directly:', {
            nodes: validatedLayoutedNodes.length,
            edges: layoutedEdges.length,
            nodeIds: validatedLayoutedNodes.map(n => n.id)
          })
          
          // Set nodes and edges directly - we've already cleared nodes when switching conversations
          setNodes(validatedLayoutedNodes)
          setEdges(layoutedEdges)
          
          console.log('✅ Restored and set nodes on canvas:', {
            nodes: validatedLayoutedNodes.length,
            edges: layoutedEdges.length,
            nodeIds: validatedLayoutedNodes.map(n => n.id)
          })
        }
      }, 100) // Small delay to ensure clearing effect completes
      
      return () => clearTimeout(timeoutId)
    }
  }, [restoredConversationNodes, nodes.length, getBestAvailableModel, pendingBranchMessageId])

  // Automatically create initial branch when canvas first loads
  useEffect(() => {
    if (initialBranchMessageId && !hasCreatedInitialBranch && nodes.length === 1) {
      console.log('🎯 Creating initial branch automatically for message:', initialBranchMessageId)
      setHasCreatedInitialBranch(true)
      
      // Check if we already have a branch for this message to prevent duplicates
      const existingBranch = nodesRef.current.find(node => 
        node.id !== 'main' && 
        node.data.messages.some((msg: any) => msg.id === initialBranchMessageId)
      )
      
      if (!existingBranch) {
        console.log('🎯 Creating initial branch for message:', initialBranchMessageId)
      handleBranch('main', initialBranchMessageId)
      } else {
        console.log('🎯 Initial branch already exists for message:', initialBranchMessageId)
      }
    }
  }, [initialBranchMessageId, hasCreatedInitialBranch, nodes.length])

  // Track processed pending branch messages to prevent re-processing
  const processedPendingBranchesRef = useRef<Set<string>>(new Set())
  
  // Handle pending branch messages (for subsequent branches)
  useEffect(() => {
    if (pendingBranchMessageId && !processedPendingBranchesRef.current.has(pendingBranchMessageId)) {
      console.log('🎯 Creating pending branch for message:', pendingBranchMessageId)
      console.log('🎯 Current nodes:', nodesRef.current.map(n => ({ id: n.id, messageIds: n.data.messages?.map((m: any) => m.id) || [] })))
      
      // Mark as processed immediately to prevent re-processing
      processedPendingBranchesRef.current.add(pendingBranchMessageId)
      
      // ✅ CRITICAL: Ensure main node exists before creating branches
      const mainNode = nodesRef.current.find(n => n.id === 'main')
      if (!mainNode) {
        console.warn('⚠️ Main node not found yet, waiting for initialization...')
        // Wait a bit for main node to be created
        setTimeout(() => {
          const retryMainNode = nodesRef.current.find(n => n.id === 'main')
          if (!retryMainNode) {
            console.error('❌ Main node still not found after retry, aborting branch creation')
            // Clear lock if it exists
            branchCreationLockRef.current.delete(pendingBranchMessageId)
            processedPendingBranchesRef.current.delete(pendingBranchMessageId) // Allow retry
            if (onPendingBranchProcessed) {
              onPendingBranchProcessed()
            }
            return
          }
          // Retry branch creation - clear lock first
          branchCreationLockRef.current.delete(pendingBranchMessageId)
          const existingBranch = nodesRef.current.find(node => 
            node.id !== 'main' && 
            node.data.messages?.some((msg: any) => msg.id === pendingBranchMessageId)
          )
          
          if (!existingBranch) {
            const targetMessage = mainMessages.find(m => m.id === pendingBranchMessageId)
            const isMultiBranch = targetMessage?.isUser === true
            console.log('🎯 Retrying branch creation for message:', pendingBranchMessageId, 'isMultiBranch:', isMultiBranch)
            handleBranch('main', pendingBranchMessageId, isMultiBranch)
          } else {
            console.log('🎯 Branch already exists for message:', pendingBranchMessageId)
          }
          
          if (onPendingBranchProcessed) {
            onPendingBranchProcessed()
          }
        }, 100)
        return
      }
      
      // Check if we already have a branch for this message to prevent duplicates
      const existingBranch = nodesRef.current.find(node => 
        node.id !== 'main' && 
        node.data.messages?.some((msg: any) => msg.id === pendingBranchMessageId)
      )
      
      if (!existingBranch) {
        // Determine if this is multi-branch by checking if the message is a user message
        const targetMessage = mainMessages.find(m => m.id === pendingBranchMessageId)
        const isMultiBranch = targetMessage?.isUser === true
        
        console.log('🎯 Branching from main node for message:', pendingBranchMessageId, 'isMultiBranch:', isMultiBranch)
        handleBranch('main', pendingBranchMessageId, isMultiBranch)
      } else {
        console.log('🎯 Branch already exists for message:', pendingBranchMessageId)
      }
      
      // Clear the pending branch message after processing
      if (onPendingBranchProcessed) {
        onPendingBranchProcessed()
      }
    }
  }, [pendingBranchMessageId, mainMessages, handleBranch, onPendingBranchProcessed]) // Removed 'nodes' from dependencies to prevent re-running

  // Track which AI responses we've already created nodes for
  const createdResponseNodesRef = useRef<Set<string>>(new Set())
  
  // DISABLED: Auto-detection of multi-model responses
  // This was causing automatic canvas mode switching
  // Users should manually choose when to create branches via the "Create Branches" button
  // useEffect(() => {
  //   // Multi-model response detection logic removed
  //   // Users now manually create branches via the "Create Branches" button
  // }, [mainMessages, selectedAIs, nodeId, nodes, edges])

  // Get visible nodes and edges
  const { nodes: visibleNodes, edges: visibleEdges } = getVisibleNodesAndEdges()

  // Handle node click for focus mode and activation
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Don't stop propagation here - let the node handle it
    // This allows panning to work when clicking on node background
    
    // Set this node as active and focused (for visual feedback)
    setActiveNodeId(node.id)
    setFocusedNodeId(node.id)
    // Keep pan mode active - don't switch to focus mode
    // setInteractionMode('pan') // Keep panning enabled
    
    // Use intelligent centering
    centerOnNode(node.id, 0.6)
    
    // Add highlight effect by temporarily updating the node
    setNodes(nds => 
      nds.map(n => 
        n.id === node.id 
          ? { ...n, data: { ...n.data, isHighlighted: true } }
          : n
      )
    )
    
    // Remove highlight after animation
    setTimeout(() => {
      setNodes(nds => 
        nds.map(n => 
          n.id === node.id 
            ? { ...n, data: { ...n.data, isHighlighted: false } }
            : n
        )
      )
    }, 1000)
    
    console.log('🎯 Node focused:', node.id, 'Mode:', 'pan (panning still enabled)')
    
    // Force update to ensure UI reflects the change
    forceUpdate()
  }, [centerOnNode])

  // Handle right-click context menu
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    
    const hasChildren = edgesRef.current.some(edge => edge.source === node.id)
    if (!hasChildren) return
    
    const isCollapsed = collapsedNodes.has(node.id)
    
    // Create context menu
    const contextMenu = document.createElement('div')
    contextMenu.className = 'fixed bg-card border border-border rounded-lg shadow-lg p-2 z-50'
    contextMenu.style.left = `${event.clientX}px`
    contextMenu.style.top = `${event.clientY}px`
    
    const button = document.createElement('button')
    button.className = 'px-3 py-2 text-sm hover:bg-muted rounded flex items-center gap-2 text-foreground'
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      ${isCollapsed ? 'Expand' : 'Collapse'} Branch
    `
    button.onclick = () => {
      toggleNodeCollapse(node.id)
      document.body.removeChild(contextMenu)
    }
    
    contextMenu.appendChild(button)
    document.body.appendChild(contextMenu)
    
    // Remove context menu when clicking elsewhere
    const removeMenu = () => {
      if (document.body.contains(contextMenu)) {
        document.body.removeChild(contextMenu)
      }
      document.removeEventListener('click', removeMenu)
    }
    
    setTimeout(() => {
      document.addEventListener('click', removeMenu)
    }, 100)
  }, [collapsedNodes, toggleNodeCollapse])

  return (
    <div className="w-full h-screen relative bg-background touch-pan-x touch-pan-y">
      
      {/* Search Bar - Centered at top */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-card border border-border rounded-lg shadow-sm max-w-md relative">
          <div className="flex items-center p-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground mr-2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              className="flex-1 text-sm border-none outline-none bg-transparent text-foreground placeholder-muted-foreground"
              onChange={handleMagnifyingGlassChange}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setMagnifyingGlassQuery('')
                  setMagnifyingGlassResults([])
                }}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
          
          {/* MagnifyingGlass Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-b-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((nodeId) => {
                const node = nodesRef.current.find(n => n.id === nodeId)
                if (!node) return null
                
                const matchingMessage = node.data.messages.find((msg: any) => 
                  msg.text.toLowerCase().includes(searchQuery.toLowerCase())
                )
                
                return (
                  <button
                    key={nodeId}
                    onClick={() => navigateToResult(nodeId)}
                    className="w-full px-4 py-3 text-left hover:bg-muted border-b border-border last:border-b-0 text-foreground"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {node.data.label}
                      </span>
                      <span className="text-xs text-muted-foreground/70">
                        ({node.data.messages.length} messages)
                      </span>
                    </div>
                    <div className="text-sm text-foreground truncate">
                      {matchingMessage?.text.substring(0, 80)}...
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges.map(edge => ({
          ...edge,
          style: getEdgeStyle(edge)
        }))}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeMouseEnter={handleEdgeMouseEnter}
        onEdgeMouseLeave={handleEdgeMouseLeave}
        onEdgeClick={handleEdgeClick}
        onPaneClick={(event) => {
          // Clear focus when clicking on empty canvas
          setFocusedNodeId(null)
          setActiveNodeId(null)
          // Keep pan mode active (it's always active now)
          console.log('🖱️ Canvas clicked - clearing focus')
        }}
        onMove={(event, viewport) => {
          setViewport(viewport)
        }}
        defaultEdgeOptions={{
          type: 'step', // Use step type for rectangular/straight lines instead of curved
          style: { 
            stroke: '#d1d5db', 
            strokeWidth: 1.5,
            strokeDasharray: '6,4'
          },
        }}
        minZoom={0.1}
        maxZoom={3.0}
        fitView={false}
        panOnDrag={true} // Always allow panning - nodes will prevent it when needed
        panOnScroll={false} // Disable scroll to pan - use drag only
        panOnScrollMode={PanOnScrollMode.Free}
        selectNodesOnDrag={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false} // Disable scroll to zoom - use pinch/buttons only
        zoomOnPinch={true} // Keep pinch to zoom for mobile
        preventScrolling={false} // Allow page scrolling when not over canvas
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.1,
          maxZoom: 3.0,
          duration: 800
        }}
      >
        <MiniMap 
          style={{ 
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border)/0.5)',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            opacity: 0.98,
            backdropFilter: 'blur(12px)',
            width: '180px',
            height: '140px'
          }}
          nodeColor={(node) => {
            if (node.id === 'main') return '#8b5cf6' // Purple for main
            if (node.id === activeNodeId) return '#3b82f6' // Blue for active
            if (collapsedNodes.has(node.id)) return '#f59e0b' // Orange for collapsed
            if (minimizedNodes.has(node.id)) return '#6b7280' // Gray for minimized
            return '#10b981' // Green for expanded
          }}
          nodeStrokeColor={(node) => {
            if (node.id === activeNodeId) return '#2563eb' // Darker blue for active stroke
            if (node.id === 'main') return '#7c3aed' // Purple stroke for main
            return 'rgba(0, 0, 0, 0.08)'
          }}
          nodeStrokeWidth={2.5}
          nodeBorderRadius={8}
          maskColor="rgba(0, 0, 0, 0.2)"
          position="bottom-right"
          pannable={true}
          zoomable={true}
          className="dark:border-border/30 cursor-pointer hover:shadow-xl transition-shadow duration-300"
          ariaLabel="MiniMap - Click to navigate"
        />
        <Controls 
          style={{ 
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
          showZoom={true}
          showFitView={true}
          showInteractive={true}
        />
        <Background 
          color="hsl(var(--border))" 
          gap={20}
          style={{ backgroundColor: 'hsl(var(--background))' }}
          variant={BackgroundVariant.Dots}
        />
        
        
      </ReactFlow>

      {/* Context Menu for creating context links */}
      {showContextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-2 min-w-[200px]"
          style={{
            left: showContextMenu.x,
            top: showContextMenu.y
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-sm font-medium text-foreground border-b border-border">
            Branch Actions
    </div>
          <button
            onClick={() => {
              // Find other branches to link with
              const otherBranches = nodes.filter(n => 
                n.id !== showContextMenu.nodeId && 
                n.id !== 'main' && 
                !contextLinks.has(`${showContextMenu.nodeId}-${n.id}`)
              )
              
              if (otherBranches.length > 0) {
                // For now, link with the first available branch
                const targetBranch = otherBranches[0]
                createContextLink(showContextMenu.nodeId, targetBranch.id)
              }
              
              setShowContextMenu(null)
            }}
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
          >
            <Link size={16} className="text-orange-500" />
            Create Context Link
          </button>
          <button
            onClick={() => setShowContextMenu(null)}
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
          >
            <X size={16} />
            Cancel
          </button>
        </motion.div>
      )}

      {/* Click outside to close context menu */}
      {showContextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowContextMenu(null)}
        />
      )}

      {/* Focus Mode Modal */}
      {focusModeNode && (
        <FocusModeModal
          isOpen={!!focusModeNode}
          onClose={() => setFocusModeNode(null)}
          nodeId={focusModeNode.id}
          nodeTitle={focusModeNode.data.label}
          messages={focusModeNode.data.messages || []}
          selectedAIs={focusModeNode.data.selectedAIs || selectedAIs}
          onSendMessage={handleSendMessageRef.current}
          onBranchFromMessage={(messageId) => {
            if (handleBranchRef.current) {
              handleBranchRef.current(focusModeNode.id, messageId)
            }
          }}
          parentMessages={getParentMessages(focusModeNode.id)}
          childBranches={getChildBranches(focusModeNode.id)}
          onNavigateToBranch={(branchId) => {
            // Find and focus on the branch node
            const branchNode = nodes.find(n => n.id === branchId)
            if (branchNode) {
              setCenter(branchNode.position.x + 500, branchNode.position.y + 375, {
                zoom: 1.0,
                duration: 600
              })
              setActiveNodeId(branchId)
            }
          }}
        />
      )}
    </div>
  )
}

// Wrapper component that provides ReactFlow context
// Use a simple counter for triggering re-renders
export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
