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
}

const nodeTypes = { chatNode: ChatNode }

type CustomNode = Node<CustomNodeData>

// Dagre layout function
const getLayoutedElements = (nodes: any[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ 
    rankdir: direction,
    ranksep: 600, // Vertical spacing between levels
    nodesep: 500, // Horizontal spacing between nodes
    marginx: 150, // Margins for containers
    marginy: 150
  })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: 1000, 
      height: 750 
    })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      targetPosition: 'top' as const,
      sourcePosition: 'bottom' as const,
      position: {
        x: nodeWithPosition.x - 500, // Center the node (width/2)
        y: nodeWithPosition.y - 375, // Center the node (height/2)
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

// Inner component that uses useReactFlow
function FlowCanvasInner({ selectedAIs, onAddAI, onRemoveAI, mainMessages, onSendMainMessage, onBranchFromMain, initialBranchMessageId, pendingBranchMessageId, onPendingBranchProcessed, onNodesUpdate, onNodeDoubleClick, onPillClick, getBestAvailableModel, onSelectSingle, multiModelMode, onExportImport, restoredConversationNodes, selectedBranchId }: FlowCanvasProps) {
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
    return nodeList.map(node => ({
      ...node,
      position: {
        x: isNaN(node.position?.x) ? 0 : node.position.x,
        y: isNaN(node.position?.y) ? 0 : node.position.y
      }
    }))
  }, [])
  
  // Notify parent of node updates (with debouncing to prevent infinite loops)
  const nodesStringRef = useRef<string>('')
  
  useEffect(() => {
    if (onNodesUpdate && nodes.length > 0) {
      // Create a stable string representation to detect actual changes
      const nodesString = JSON.stringify(nodes.map(n => ({
        id: n.id,
        messagesLength: n.data.messages?.length || 0,
        position: n.position
      })))
      
      // Only update if the string representation changed
      if (nodesString !== nodesStringRef.current) {
        nodesStringRef.current = nodesString
        prevNodesRef.current = [...nodes] // Create a copy
        
        const timeoutId = setTimeout(() => {
          console.log('📤 Calling onNodesUpdate with', nodes.length, 'nodes:', nodes.map(n => n.id))
          onNodesUpdate(nodes)
        }, 100) // Increased debounce to prevent rapid updates
        
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
      
      // Try to find the branch node - with retry logic
      const findBranchNode = () => {
        return nodes.find(n => n.id === targetBranchId)
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

  // Update nodes when minimize state changes
  useEffect(() => {
    setNodes(nds => 
      validateNodePositions(nds.map(n => {
        const isMinimized = minimizedNodes.has(n.id)
        return {
        ...n,
          style: {
            ...n.style,
            width: isMinimized ? 280 : 1000,
            height: isMinimized ? 'auto' : 750,
            minHeight: isMinimized ? 'auto' : 750
          },
        data: {
          ...n.data,
            isMinimized: isMinimized
        }
        }
      }))
    )
  }, [minimizedNodes, validateNodePositions, setNodes])

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
    
    // Add visible edges
    edgesRef.current.forEach(edge => {
      if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
        visibleEdges.push(edge)
      }
    })
    
    return {
      nodes: nodesRef.current.filter(node => visibleNodeIds.has(node.id)),
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
  const deduplicateMessages = useCallback((msgs: any[]): any[] => {
    const seen = new Set<string>()
    return msgs.filter(m => {
      const key = m.id || `${m.parentId}-${m.aiModel}-${m.timestamp}`
      if (seen.has(key)) {
        console.warn('⚠️ Duplicate message removed:', key)
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
  
  // ✅ NEW: Get messages till a specific message ID (for inherited context)
  const getMessagesTill = useCallback((messageId: string, allMsgs: any[]): any[] => {
    const result: any[] = []
    for (const msg of allMsgs) {
      result.push(msg)
      if (msg.id === messageId) break
    }
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
  
  // ✅ NEW: Create branch node helper
  const createBranchNode = useCallback((
    parentNodeId: string,
    inheritedMessages: any[],
    aiResponse: any,
    branchIndex: number,
    totalBranches: number
  ): Node => {
    const ai = selectedAIs.find(a => a.id === aiResponse.aiModel) || selectedAIs[0]
    const newId = generateBranchId()
    const position = getBranchPosition(parentNodeId, branchIndex, totalBranches)
    
    return {
      id: newId,
      type: 'chatNode',
      position,
      data: {
        label: ai?.name || 'Branch',
        inheritedMessages: [...inheritedMessages],
        branchMessages: [{ ...aiResponse, isUser: false }],
        parentMessageId: aiResponse.parentId || aiResponse.id,
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
    
    // ✅ Check if branch already exists
    if (branchExistsForMessage(parentNodeId, messageId)) {
      console.log('⚠️ Branch already exists for:', { parentNodeId, messageId })
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
    const allMessages = parentNodeId === 'main' 
      ? mainMessages 
      : (parentNode.data.messages || [])
    
    // ✅ Deduplicate messages FIRST
    const deduplicatedMessages = deduplicateMessages(allMessages)
    
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
      const allAIResponses = deduplicatedMessages.filter(m => 
        !m.isUser && m.parentId === messageId && m.aiModel
      )
      aiResponses = deduplicateByModel(allAIResponses)
      console.log('✅ Creating branches for all AI models:', aiResponses.map(r => r.aiModel))
    } else if (!targetMessage.isUser) {
      // AI message → single branch
      aiResponses = [targetMessage]
      console.log('✅ Creating single branch for AI response:', targetMessage.aiModel)
    } else {
      // USER message but NOT isMultiBranch → invalid (shouldn't happen)
      console.warn('⚠️ User message clicked but isMultiBranch=false, skipping')
      branchCreationLockRef.current.delete(messageId)
      return
    }
    
    if (aiResponses.length === 0) {
      console.warn('⚠️ No AI responses found to create branches from')
      branchCreationLockRef.current.delete(messageId)
      return
    }
    
    // ✅ Get inherited messages (all messages till the target message)
    const inheritedMessages = getMessagesTill(messageId, deduplicatedMessages)
    console.log('🌿 Inherited messages count:', inheritedMessages.length)
    
    // ✅ Create branch nodes
    const newNodes: Node[] = []
    const newEdges: Edge[] = []
    
    aiResponses.forEach((response, idx) => {
      // Check if branch already exists for this specific response
      if (branchExistsForMessage(parentNodeId, response.id)) {
        console.warn('⚠️ Branch already exists for response:', response.id)
        return
      }
      
      const branchNode = createBranchNode(
        parentNodeId,
        inheritedMessages,
        response,
        idx,
        aiResponses.length
      )
      
      newNodes.push(branchNode)
      
      // Create edge
      const newEdge: Edge = {
        id: `edge-${parentNodeId}-${branchNode.id}-${Date.now()}`,
        source: parentNodeId,
        target: branchNode.id,
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
    setNodeId(prev => {
      const currentNodesInState = nodesRef.current
      const currentEdges = edgesRef.current
      
      // Merge new nodes with existing
      const updatedNodes = [...currentNodesInState, ...newNodes]
      const updatedEdges = [...currentEdges, ...newEdges]
      
      // Apply layout
      const { nodes: layoutedNodes } = getLayoutedElements(updatedNodes, updatedEdges)
      
      // Preserve main node messages
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
        return node
      })
      
      // Update React Flow
      setNodes(finalLayoutedNodes)
      setEdges(updatedEdges)
      
      // ✅ Call onNodesUpdate to trigger save
      if (onNodesUpdate) {
        setTimeout(() => {
          onNodesUpdate(finalLayoutedNodes)
        }, 50)
      }
      
      // ✅ Clear lock after delay
      setTimeout(() => {
        branchCreationLockRef.current.delete(messageId)
      }, 1000)
      
      // Fit view to show new branches
      requestAnimationFrame(() => {
        setTimeout(() => {
          const nodeIds = [parentNodeId, ...newNodes.map(n => n.id)]
          fitViewportToNodes(nodeIds, 0.15)
        }, 100)
      })
      
      return prev + newNodes.length
    })
  }
  
  // ✅ Wrapper for handleBranch
  const handleBranch = useCallback((parentNodeId: string, messageId?: string, isMultiBranch?: boolean) => {
    if (handleBranchRef.current) {
      handleBranchRef.current(parentNodeId, messageId, isMultiBranch)
    }
  }, [])
  
  // ✅ Connect onBranchFromMain to handleBranch
  useEffect(() => {
    if (onBranchFromMain) {
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
    // Don't handle main node here - it's handled by onSendMainMessage
    if (parentId === 'main') return
    
    // Find the branch node
    const branchNode = nodes.find(n => n.id === parentId)
    if (!branchNode) return
    
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
        : [{ id: 'best', name: 'Best', color: 'bg-purple-100 text-purple-800 border-purple-200', functional: true, logo: <span>B</span> }])
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
          return {
            ...node,
            data: {
              ...node.data,
              messages: [...currentMessages, userMsg]
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
      const context = {
        messages: finalMessages,
        currentBranch: parentId,
        parentMessages: parentChainMessages,
        linkedContext: contextLinkedMessages
      }
      
      if (branchMultiModelMode && selectedAIs.length > 1) {
        // Multi-model response for branch
        console.log('🔄 Generating multi-model response for branch:', parentId)
        
        // Create streaming placeholders for each AI
        const streamingMessages = selectedAIs.map(ai => ({
          id: `msg-${Date.now()}-${ai.id}-streaming`,
          text: '',
          isUser: false,
          children: [],
          timestamp: Date.now(),
          aiModel: ai.id,
          groupId: `group-${Date.now()}`,
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
          selectedAIs.map(async (ai) => {
            // Check if aborted before starting
            if (abortController.signal.aborted) {
              throw new Error('Generation aborted')
            }
            
            const modelName = ai.id === 'gemini-2.5-pro' ? 'gemini' : 
                             ai.id === 'mistral-large' ? 'mistral' : 
                             'gpt-4'
            
            return {
              ai,
              response: await aiService.generateResponse(
        modelName,
        message,
        context,
        (chunk: string) => {
                  // Check if aborted during streaming
                  if (abortController.signal.aborted) {
                    return
                  }
                  
                  // Handle streaming for this specific AI
                  console.log(`Streaming from ${ai.name} in branch:`, chunk)
                  setNodes((nds) => {
                    const updatedNodes = nds.map((node) => {
                      if (node.id === parentId) {
                        const currentMessages = node.data.messages || []
                        return {
                          ...node,
                          data: {
                            ...node.data,
                            messages: currentMessages.map((msg: any) => 
                              msg.id === `msg-${Date.now()}-${ai.id}-streaming` 
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
                },
                abortController.signal
              )
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
                groupId: `group-${Date.now()}`,
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
        
        const response = await aiService.generateResponse(
          modelName,
          message,
          context,
          (chunk: string) => {
            // Check if aborted during streaming
            if (abortController.signal.aborted) {
              return
            }
            
            // Handle streaming response - update the streaming message in branch
            console.log(`Streaming from ${selectedAI.name} in branch:`, chunk)
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
          },
          abortController.signal
        )
        
        // Finalize the streaming message
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
                      ? { 
                          ...msg, 
                          text: response.text, 
                          isStreaming: false, 
                          streamingText: undefined,
                          timestamp: response.timestamp
                        }
                      : msg
                  )
                }
              }
            }
            return node
          })
          return updatedNodes
        })
      }
      
      // Clear generating state and force UI update after AI response
      setGeneratingBranchId(null)
      // Clean up abort controller
      abortControllersRef.current.delete(parentId)
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
                  messages: [...filteredMessages, errorMsg]
                }
              }
            }
            return node
          })
          return updatedNodes
        })
      }
      
      // Clear generating state
      setGeneratingBranchId(null)
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

  // Initialize main node on mount
  useEffect(() => {
    if (nodes.length === 0) {
      console.log('🎬 Initializing main node')
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
    }
  }, [nodes.length])

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
          
          return {
            ...node,
            data: {
              ...node.data,
              selectedAIs: branchSelectedAIs.length > 0 ? branchSelectedAIs : [selectedAIs[0] || { id: 'best', name: 'Best', color: 'green', logo: <span>B</span> }],
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
            if (JSON.stringify(currentBranchAIs) !== JSON.stringify(node.data.selectedAIs)) {
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
            
            // Create node from restored data
            const restoredNode: any = {
              id: nodeData.id,
              type: 'chatNode',
              position: nodeData.position || { x: 0, y: 0 },
              data: {
                label: nodeData.title || nodeData.data?.label || 'Untitled',
                messages: nodeData.messages || [],
                selectedAIs: nodeData.selectedAIs || [],
                multiModelMode: nodeData.multiModelMode || false,
                isMain: nodeData.isMain || nodeData.id === 'main',
                isMinimized: nodeData.isMinimized || false,
                showAIPill: nodeData.showAIPill || false,
                parentId: nodeData.parentId || (nodeData.id === 'main' ? undefined : 'main'),
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
              parentId: restoredNode.data.parentId
            })
            
            // Create edge for non-main nodes
            if (nodeData.id !== 'main' && !nodeData.isMain) {
              const parentId = nodeData.parentId || 'main'
              restoredEdges.push({
                id: `edge-${parentId}-${nodeData.id}`,
                source: parentId,
                target: nodeData.id,
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
          
          console.log('📐 Layout calculation:', {
            restoredNodes: restoredNodes.length,
            layoutedNodes: layoutedNodes.length,
            layoutedEdges: layoutedEdges.length
          })
          
          console.log('🔄 Setting restored nodes directly:', {
            nodes: layoutedNodes.length,
            edges: layoutedEdges.length,
            nodeIds: layoutedNodes.map(n => n.id)
          })
          
          // Set nodes and edges directly - we've already cleared nodes when switching conversations
          setNodes(layoutedNodes)
          setEdges(layoutedEdges)
          
          console.log('✅ Restored and set nodes on canvas:', {
            nodes: layoutedNodes.length,
            edges: layoutedEdges.length,
            nodeIds: layoutedNodes.map(n => n.id)
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

  // Handle pending branch messages (for subsequent branches)
  useEffect(() => {
    if (pendingBranchMessageId) {
      console.log('🎯 Creating pending branch for message:', pendingBranchMessageId)
      console.log('🎯 Current nodes:', nodesRef.current.map(n => ({ id: n.id, messageIds: n.data.messages.map((m: any) => m.id) })))
      
      // Check if we already have a branch for this message to prevent duplicates
      const existingBranch = nodesRef.current.find(node => 
        node.id !== 'main' && 
        node.data.messages.some((msg: any) => msg.id === pendingBranchMessageId)
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
  }, [pendingBranchMessageId, mainMessages, handleBranch, onPendingBranchProcessed])

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
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
          nodeColor={(node) => {
            if (node.id === 'main') return '#8b5cf6' // Purple for main
            if (collapsedNodes.has(node.id)) return '#f59e0b' // Orange for collapsed
            return '#10b981' // Green for expanded
          }}
          nodeStrokeWidth={2}
          nodeBorderRadius={4}
          maskColor="rgba(0, 0, 0, 0.1)"
          position="bottom-right"
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
