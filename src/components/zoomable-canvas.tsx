'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, ArrowLeft, MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsIn } from '@phosphor-icons/react'
import ChatInterface from './chat-interface'
import AIPills from './ai-pills'

interface Message {
  id: string
  text: string
  isUser: boolean
  ai?: string
  parentId?: string
  children: string[]
  timestamp: number
  responses?: { [aiId: string]: string }
}

interface AI {
  id: string
  name: string
  color: string
  logo: React.JSX.Element
}

interface ConversationBranch {
  id: string
  name: string
  messages: Message[]
  parentMessageId: string
  parentMessageText: string
  position: { x: number; y: number }
  isActive: boolean
  parentPosition: { x: number; y: number }
  parentBranchId?: string
}

interface ZoomableCanvasProps {
  selectedAIs: AI[]
  onAddAI: (ai: AI) => void
  onRemoveAI: (aiId: string) => void
  onSendMessage: (text: string, branchId?: string) => void
  onSendMultiModelMessage: (text: string) => void
  onBranchFromMessage: (messageId: string) => void
  currentBranch: string
  multiModelMode: boolean
  onToggleMultiModel: () => void
  mainMessages: Message[]
}

export default function ZoomableCanvas({ 
  selectedAIs, 
  onAddAI, 
  onRemoveAI, 
  onSendMessage, 
  onSendMultiModelMessage, 
  onBranchFromMessage, 
  currentBranch, 
  multiModelMode, 
  onToggleMultiModel,
  mainMessages
}: ZoomableCanvasProps) {
  const [branches, setBranches] = useState<ConversationBranch[]>([])
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  // Guard to avoid duplicate branch creation from StrictMode double effects
  const creatingBranchRef = useRef<Set<string>>(new Set())
  
  // Create branches when currentBranch changes (single-shot, no duplicates)
  useEffect(() => {
    if (!currentBranch) return
    const message = mainMessages.find(m => m.id === currentBranch)
    if (!message) return
    // Prevent duplicates when effect runs twice in StrictMode
    if (creatingBranchRef.current.has(currentBranch)) return
    // Also skip if already exists
    if (branches.some(b => b.parentMessageId === currentBranch)) return
    creatingBranchRef.current.add(currentBranch)
    createBranch(currentBranch, message.text)
  // Intentionally exclude `branches` from deps to avoid re-trigger on add
  }, [currentBranch, mainMessages])
  // Enable panning/dragging state for canvas navigation
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  // Compute a clean, non-moveable hierarchical tree layout
  const layoutBranches = (list: ConversationBranch[]): ConversationBranch[] => {
    const levelGap = 320 // vertical distance between levels
    const siblingGap = 640 // horizontal distance between siblings
    const rootOffsetY = 240 // push first level below main panel to avoid overlap

    // Group by parentBranchId (root = 'root')
    const byParent: Record<string, ConversationBranch[]> = {}
    list.forEach(b => {
      const key = b.parentBranchId || 'root'
      if (!byParent[key]) byParent[key] = []
      byParent[key].push(b)
    })

    const idToPosition: Record<string, { x: number; y: number }> = {}

    const placeLevel = (parentKey: string, parentPos: { x: number; y: number }) => {
      const siblings = byParent[parentKey] || []
      const n = siblings.length
      if (n === 0) return
      // Alternate left, right, further left, further right ... around center
      const ordered = [...siblings]
      ordered.forEach((b, i) => {
        const k = Math.floor((i + 1) / 2)
        const dir = i % 2 === 0 ? -1 : 1 // first left, then right
        const x = parentPos.x + dir * k * siblingGap
        const y = parentPos.y + levelGap
        idToPosition[b.id] = { x, y }
        placeLevel(b.id, { x, y })
      })
    }

    // Root is the main conversation panel at (0, 0); start first level beneath
    placeLevel('root', { x: 0, y: rootOffsetY })

    // Apply positions and parent positions
    const idToBranch = Object.fromEntries(list.map(b => [b.id, b]))
    return list.map(b => {
      const parentPos = b.parentBranchId ? (idToPosition[b.parentBranchId] || { x: 0, y: 0 }) : { x: 0, y: 0 }
      const pos = idToPosition[b.id] || b.position
      return { ...b, position: pos, parentPosition: parentPos }
    })
  }

  const addAI = (ai: AI) => {
    if (!selectedAIs.find(selected => selected.id === ai.id)) {
      onAddAI(ai)
    }
  }

  const removeAI = (aiId: string) => {
    onRemoveAI(aiId)
  }

  const sendMessage = (messageText: string, parentId?: string, branchId?: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      parentId,
      children: [],
      timestamp: Date.now(),
    }

    if (branchId) {
      setBranches(prev => prev.map(branch => 
        branch.id === branchId 
          ? { ...branch, messages: [...branch.messages, newMessage] }
          : branch
      ))
    } else {
      // For main conversation, use the passed onSendMessage function
      onSendMessage(messageText)
    }

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: `This is a simulated response from ${selectedAIs[0]?.name || 'AI'}. In a real implementation, this would call the actual AI API with the full conversation context.`,
        isUser: false,
        ai: selectedAIs[0]?.id,
        parentId: newMessage.id,
        children: [],
        timestamp: Date.now() + 1,
      }

      if (branchId) {
        setBranches(prev => prev.map(branch => 
          branch.id === branchId 
            ? { ...branch, messages: [...branch.messages, aiResponse] }
            : branch
        ))
      } else {
        // For main conversation, the parent will handle this
      }
    }, 1000)
  }

  const sendMultiModelMessage = (messageText: string, branchId?: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      children: [],
      timestamp: Date.now(),
      responses: {}
    }

    if (branchId) {
      setBranches(prev => prev.map(branch => 
        branch.id === branchId 
          ? { ...branch, messages: [...branch.messages, newMessage] }
          : branch
      ))
    } else {
      // For main conversation, use the passed onSendMultiModelMessage function
      onSendMultiModelMessage(messageText)
    }

    selectedAIs.forEach((ai, index) => {
      setTimeout(() => {
        const response = `Response from ${ai.name}: This is a simulated response. In reality, this would call ${ai.name}'s API with the message context.`
        
        if (branchId) {
          setBranches(prev => prev.map(branch => 
            branch.id === branchId 
              ? { 
                  ...branch, 
                  messages: branch.messages.map(msg => 
                    msg.id === newMessage.id 
                      ? { 
                          ...msg, 
                          responses: { 
                            ...msg.responses, 
                            [ai.id]: response 
                          } 
                        }
                      : msg
                  )
                }
              : branch
          ))
        } else {
          // For main conversation, the parent will handle this
        }
      }, (index + 1) * 500)
    })
  }

  const createBranch = (parentMessageId: string, parentMessageText: string, parentBranchId?: string) => {
    // Check if branch already exists for this message
    const existingBranch = branches.find(b => b.parentMessageId === parentMessageId)
    if (existingBranch) {
      setActiveBranchId(existingBranch.id)
      return
    }
    
    const branchId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Get existing branches to analyze the structure
    const mainBranches = branches.filter(b => b.parentPosition.x === 0 && b.parentPosition.y === 0)
    
    let finalPosition = { x: 0, y: 0 }
    
    // For main branches (direct from main conversation) - Create a natural tree structure
    if (!parentBranchId) {
      // Natural tree-like structure similar to the third image
      const branchCount = mainBranches.length
      
      // Base vertical distance from main conversation
      const baseVerticalDistance = 300
      
      // Calculate angle based on branch count to create a fan-like distribution
      // This creates a natural tree-like structure where branches fan out from the trunk
      let angle = 0
      
      if (branchCount === 0) {
        // First branch - straight down
        angle = Math.PI / 2 // 90 degrees (down)
      } else if (branchCount % 2 === 1) {
        // Odd numbered branches go to the right side with increasing angle
        const fanIndex = Math.floor(branchCount / 2) + 1
        angle = (Math.PI / 2) - (fanIndex * Math.PI / 10) // Fan right (72°, 54°, 36°...)
      } else {
        // Even numbered branches go to the left side with increasing angle
        const fanIndex = Math.floor(branchCount / 2)
        angle = (Math.PI / 2) + (fanIndex * Math.PI / 10) // Fan left (108°, 126°, 144°...)
      }
      
      // Calculate distance based on branch count (branches further from center are further away)
      // This creates a more natural tree shape
      const distance = baseVerticalDistance + (Math.abs(Math.floor(branchCount / 2)) * 50)
      
      // Convert polar coordinates (angle, distance) to cartesian (x, y)
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance
      
      // For branches that are more to the sides, add extra vertical distance
      // This creates a more natural tree shape where side branches are lower
      const extraVerticalOffset = Math.abs(x) * 0.5
      
      finalPosition = { 
        x: Math.round(x), 
        y: Math.round(y + extraVerticalOffset) 
      }
    } 
    // For sub-branches (branching from another branch)
    else {
      const parentBranch = branches.find(b => b.id === parentBranchId)
      if (parentBranch) {
        // Find existing sub-branches of this parent
        const subBranches = branches.filter(b => 
          b.parentPosition.x === parentBranch.position.x && 
          b.parentPosition.y === parentBranch.position.y
        )
        
        // Sub-branch count for this parent
        const subBranchCount = subBranches.length
        
        // Calculate angle for this sub-branch to create a fan-like pattern from the parent
        // First sub-branch continues in the same general direction as parent
        // Others fan out in a 90° arc
        
        // Get parent's angle from main conversation (or its own parent)
        const parentX = parentBranch.position.x
        const parentY = parentBranch.position.y
        const parentAngle = Math.atan2(parentY, parentX)
        
        // Calculate angle for this sub-branch
        let branchAngle = 0
        
        if (subBranchCount === 0) {
          // First sub-branch - continue in same general direction as parent
          branchAngle = parentAngle
        } else if (subBranchCount % 2 === 1) {
          // Odd numbered branches - fan right of parent's direction
          const fanIndex = Math.floor(subBranchCount / 2) + 1
          branchAngle = parentAngle - (fanIndex * Math.PI / 10)
        } else {
          // Even numbered branches - fan left of parent's direction
          const fanIndex = Math.floor(subBranchCount / 2)
          branchAngle = parentAngle + (fanIndex * Math.PI / 10)
        }
        
        // Distance from parent increases with sub-branch count
        const distance = 250 + (subBranchCount * 30)
        
        // Convert polar coordinates to cartesian, relative to parent position
        const relativeX = Math.cos(branchAngle) * distance
        const relativeY = Math.sin(branchAngle) * distance
        
        // Position relative to parent branch
        finalPosition = {
          x: parentBranch.position.x + Math.round(relativeX),
          y: parentBranch.position.y + Math.round(relativeY)
        }
      }
    }
    
    const newBranch: ConversationBranch = {
      id: branchId,
      name: `Branch from: ${parentMessageText.substring(0, 30)}...`,
      messages: [],
      parentMessageId,
      parentMessageText, // Store the full text for context
      position: finalPosition,
      parentPosition: parentBranchId ? 
        branches.find(b => b.id === parentBranchId)?.position || { x: 0, y: 0 } : 
        { x: 0, y: 0 }, // Main conversation is at center
      isActive: true,
      parentBranchId
    }

    setBranches(prev => layoutBranches([...prev, newBranch]))
    setActiveBranchId(branchId)
  }

  const closeBranch = (branchId: string) => {
    setBranches(prev => layoutBranches(prev.filter(branch => branch.id !== branchId)))
    if (activeBranchId === branchId) {
      setActiveBranchId(null)
    }
    // Also clear currentBranch if it matches
    if (currentBranch && branches.find(b => b.id === branchId)?.parentMessageId === currentBranch) {
      onBranchFromMessage('')
    }
  }

  const switchToBranch = (branchId: string) => {
    setActiveBranchId(branchId)
  }

  const getCurrentMessages = () => {
    // This function is used for branch switching, not main conversation
    if (activeBranchId) {
      const branch = branches.find(b => b.id === activeBranchId)
      return branch ? branch.messages : []
    }
    return []
  }

  const getCurrentBranch = () => {
    if (activeBranchId) {
      return branches.find(b => b.id === activeBranchId) || null
    }
    return null
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.3))
  }

  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Canvas navigation: enable pan/drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    // Ctrl+scroll for zoom
    if (e.ctrlKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(prev => Math.max(0.5, Math.min(2, prev + delta)))
    }
  }

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gray-50">
      {/* Non-moveable simplified tree: no zoom controls */}

      {/* Canvas Container */}
      <div
        ref={canvasRef}
        className="w-full h-full relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center'
        }}
      >
        {/* Connection Lines - Smart border-to-border connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          {branches.map((branch) => {
            // Main conversation center (aligned to fixed top panel)
            const mainWidth = 520
            const mainHeight = 160
            const mainCenterX = window.innerWidth / 2
            const mainCenterY = 120 + mainHeight / 2
            
            // Branch panel dimensions
            const branchWidth = 420
            const branchHeight = 120
            
            // Determine if this is a sub-branch (has parentPosition other than center)
            const isSubBranch = branch.parentPosition.x !== 0 || branch.parentPosition.y !== 0
            
            let x1, y1, x2, y2
            
            if (isSubBranch) {
              // Sub-branch: connect to parent branch
              const parentX = mainCenterX + branch.parentPosition.x
              const parentY = mainCenterY + branch.parentPosition.y
              const currentX = mainCenterX + branch.position.x
              const currentY = mainCenterY + branch.position.y
              
              // Calculate angle to determine which border to use
              const dx = currentX - parentX
              const dy = currentY - parentY
              const angle = Math.atan2(dy, dx) * (180 / Math.PI)
              
              // Determine connection points based on angle - guaranteed connection to parent branch
              // orthogonal connectors (down + across + down)
              x1 = parentX
              y1 = parentY + branchHeight / 2
              x2 = currentX
              y2 = currentY - branchHeight / 2
            } else {
              // Main branch: connect to main conversation
              const currentX = mainCenterX + branch.position.x
              const currentY = mainCenterY + branch.position.y
              
              // Calculate angle to determine which border to use
              const dx = currentX - mainCenterX
              const dy = currentY - mainCenterY
              const angle = Math.atan2(dy, dx) * (180 / Math.PI)
              
              // Determine connection points based on angle - guaranteed connection to main window
              // orthogonal connectors (down + across + down)
              x1 = mainCenterX
              y1 = mainCenterY + mainHeight / 2
              x2 = currentX
              y2 = currentY - branchHeight / 2
            }
            
            // Orthogonal path: down to mid, across, then down
            const yMid = y1 + (y2 - y1) * 0.6
            const path = `M ${x1} ${y1} L ${x1} ${yMid} L ${x2} ${yMid} L ${x2} ${y2}`
            
            return (
              <g key={`connection-${branch.id}-${branch.parentMessageId}`}>
                {/* Main connection line - minimal */}
                <motion.path
                  d={path}
                  stroke="#CBD5E1"
                  strokeWidth="2"
                  strokeDasharray="0"
                  strokeOpacity="1"
                  strokeLinecap="square"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                />

              </g>
            )
          })}
        </svg>

        {/* Main Conversation (Center) */}
        <motion.div
            className="absolute bg-white border border-gray-200 rounded-xl p-4"
          style={{
              left: '50%',
              top: '120px',
              transform: 'translateX(-50%)',
            width: '500px',
            minHeight: '160px',
            zIndex: 10,
            boxShadow: '0 8px 30px -8px rgba(0, 0, 0, 0.12), 0 4px 10px -3px rgba(0, 0, 0, 0.06)',
            background: 'linear-gradient(to bottom, #ffffff, #fafafa)'
          }}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* AI Pills */}
          <AIPills 
            selectedAIs={selectedAIs}
            onAddAI={addAI}
            onRemoveAI={removeAI}
          />

          {/* Multi-Model Toggle - Minimal */}
          {selectedAIs.length > 1 && (
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={onToggleMultiModel}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  multiModelMode 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {multiModelMode ? 'Multi' : 'Single'}
              </button>
            </div>
          )}

          {/* Current Branch Indicator */}
          {getCurrentBranch() && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <ArrowLeft size={16} className="text-blue-600" />
                <span className="text-sm text-blue-600 font-medium">
                  Branch: {getCurrentBranch()?.name}
                </span>
                <button
                  onClick={() => setActiveBranchId(null)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline ml-auto"
                >
                  Back to main
                </button>
              </div>
            </div>
          )}

          {/* Chat Interface - Always shows main messages only */}
          <ChatInterface 
            messages={mainMessages}
            onSendMessage={multiModelMode ? onSendMultiModelMessage : onSendMessage}
            selectedAIs={selectedAIs}
            onBranchFromMessage={onBranchFromMessage}
            currentBranch={currentBranch}
            multiModelMode={multiModelMode}
          />
          
          {/* Connection Point Indicator */}
          {branches.length > 0 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full opacity-60"></div>
          )}
        </motion.div>

        {/* Branch Panels */}
        <AnimatePresence>
          {branches.map((branch) => (
              <motion.div
                key={branch.id}
                initial={{ 
                  x: branch.position.x,
                  y: branch.position.y,
                  opacity: 0,
                  scale: 0.8
                }}
                animate={{ 
                  x: branch.position.x,
                  y: branch.position.y,
                  opacity: 1,
                  scale: 1,
                  transition: { 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 25,
                    mass: 1
                  }
                }}
                exit={{ 
                  x: branch.position.x,
                  y: branch.position.y,
                  opacity: 0,
                  scale: 0.8,
                  transition: { duration: 0.3 }
                }}
                className="absolute bg-white border border-gray-200 rounded-xl p-4"
                style={{
                  width: '560px',
                  minHeight: '140px',
                  zIndex: 10,
                  left: '50%',
                  transformOrigin: 'center center',
                  boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.1), 0 2px 8px -2px rgba(0, 0, 0, 0.05)',
                  background: 'linear-gradient(to bottom, #ffffff, #fafafa)'
                }}
                whileHover={{
                  boxShadow: '0 6px 24px -6px rgba(0, 0, 0, 0.12), 0 4px 10px -3px rgba(0, 0, 0, 0.07)',
                  scale: 1.01,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.99 }}
              >
              {/* Branch Header - Polished */}
              <div className="mb-3 pb-2 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <motion.span 
                      className="text-xs font-medium text-gray-700 truncate"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      {branch.name}
                    </motion.span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={() => switchToBranch(branch.id)}
                      className={`p-1.5 rounded-full text-xs transition-all ${
                        activeBranchId === branch.id 
                          ? 'bg-blue-100 text-blue-600 shadow-sm' 
                          : 'hover:bg-gray-100 text-gray-500'
                      }`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.button>
                    <motion.button
                      onClick={() => closeBranch(branch.id)}
                      className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 text-xs transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Branch Text Bar - Same as Main */}
              <div className="w-full">
                <ChatInterface 
                  messages={branch.messages}
                  onSendMessage={(message) => {
                    console.log(`🌿 Branch ${branch.id} sending message:`, message)
                    
                    // Handle branch message sending - ONLY affects this specific branch
                    const newMessage = {
                      id: `msg-${Date.now()}`,
                      text: message,
                      isUser: true,
                      timestamp: Date.now(),
                      children: []
                    }
                    
                    // Add user message ONLY to this specific branch
                    setBranches(prev => prev.map(b => 
                      b.id === branch.id 
                        ? { ...b, messages: [...b.messages, newMessage] }
                        : b
                    ))
                    
                    // Simulate AI response for THIS branch only
                    setTimeout(() => {
                      const aiResponse = {
                        id: `msg-${Date.now()}`,
                        text: `AI response in branch to: "${message}"`,
                        isUser: false,
                        timestamp: Date.now(),
                        children: []
                      }
                      
                      // Add AI response ONLY to this specific branch
                      setBranches(prev => prev.map(b => 
                        b.id === branch.id 
                          ? { ...b, messages: [...b.messages, aiResponse] }
                          : b
                      ))
                    }, 1000)
                  }}
                  selectedAIs={selectedAIs}
                  onBranchFromMessage={(messageId) => {
                    const message = branch.messages.find(m => m.id === messageId)
                    if (message && !message.isUser) {
                      createBranch(messageId, message.text, branch.id)
                    }
                  }}
                  currentBranch={null}
                  multiModelMode={multiModelMode}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
