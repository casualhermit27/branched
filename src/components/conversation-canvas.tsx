'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, ArrowLeft } from '@phosphor-icons/react'
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
  position: 'left' | 'right'
  isActive: boolean
}

interface ConversationCanvasProps {
  selectedAIs: AI[]
  onAddAI: (ai: AI) => void
  onRemoveAI: (aiId: string) => void
}

export default function ConversationCanvas({ selectedAIs, onAddAI, onRemoveAI }: ConversationCanvasProps) {
  const [mainMessages, setMainMessages] = useState<Message[]>([])
  const [branches, setBranches] = useState<ConversationBranch[]>([])
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)
  const [multiModelMode, setMultiModelMode] = useState(false)

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
      // Add to specific branch
      setBranches(prev => prev.map(branch => 
        branch.id === branchId 
          ? { ...branch, messages: [...branch.messages, newMessage] }
          : branch
      ))
    } else {
      // Add to main conversation
      setMainMessages(prev => [...prev, newMessage])
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
        setMainMessages(prev => [...prev, aiResponse])
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
      setMainMessages(prev => [...prev, newMessage])
    }

    // Simulate responses from all selected AIs
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
          setMainMessages(prev => prev.map(msg => 
            msg.id === newMessage.id 
              ? { 
                  ...msg, 
                  responses: { 
                    ...msg.responses, 
                    [ai.id]: response 
                  } 
                }
              : msg
          ))
        }
      }, (index + 1) * 500)
    })
  }

  const createBranch = (parentMessageId: string, parentMessageText: string) => {
    const branchId = `branch-${Date.now()}`
    const position = branches.length % 2 === 0 ? 'left' : 'right'
    
    const newBranch: ConversationBranch = {
      id: branchId,
      name: `Branch from: ${parentMessageText.substring(0, 30)}...`,
      messages: [],
      parentMessageId,
      position,
      isActive: true
    }

    setBranches(prev => [...prev, newBranch])
    setActiveBranchId(branchId)
  }

  const closeBranch = (branchId: string) => {
    setBranches(prev => prev.filter(branch => branch.id !== branchId))
    if (activeBranchId === branchId) {
      setActiveBranchId(null)
    }
  }

  const switchToBranch = (branchId: string) => {
    setActiveBranchId(branchId)
  }

  const getCurrentMessages = () => {
    if (activeBranchId) {
      const branch = branches.find(b => b.id === activeBranchId)
      return branch ? branch.messages : mainMessages
    }
    return mainMessages
  }

  const getCurrentBranch = () => {
    if (activeBranchId) {
      return branches.find(b => b.id === activeBranchId) || null
    }
    return null
  }

  return (
    <div className="w-full h-full relative">
      {/* Main Conversation Area */}
      <div className={`transition-all duration-300 ${
        branches.length > 0 
          ? branches.some(b => b.position === 'left') 
            ? 'ml-80' 
            : 'mr-80'
          : ''
      }`}>
        <div className="bg-white border border-gray-200 p-6 relative" style={{ borderRadius: '24px' }}>
          {/* AI Pills */}
          <AIPills 
            selectedAIs={selectedAIs}
            onAddAI={addAI}
            onRemoveAI={removeAI}
          />

          {/* Multi-Model Toggle */}
          {selectedAIs.length > 1 && (
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => setMultiModelMode(!multiModelMode)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  multiModelMode 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                {multiModelMode ? 'Multi-Model Mode' : 'Single Model Mode'}
              </button>
              {multiModelMode && (
                <span className="text-xs text-gray-500">
                  Send one message, get responses from all selected AIs
                </span>
              )}
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

          {/* Chat Interface */}
          <ChatInterface 
            messages={getCurrentMessages()}
            onSendMessage={multiModelMode ? sendMultiModelMessage : sendMessage}
            selectedAIs={selectedAIs}
            onBranchFromMessage={(messageId) => {
              const message = getCurrentMessages().find(m => m.id === messageId)
              if (message && !message.isUser) {
                createBranch(messageId, message.text)
              }
            }}
            currentBranch={null}
            multiModelMode={multiModelMode}
          />
        </div>
      </div>

      {/* Side Panels for Branches */}
      <AnimatePresence>
        {branches.map((branch) => (
          <motion.div
            key={branch.id}
            initial={{ 
              x: branch.position === 'left' ? -400 : 400,
              opacity: 0 
            }}
            animate={{ 
              x: 0, 
              opacity: 1 
            }}
            exit={{ 
              x: branch.position === 'left' ? -400 : 400,
              opacity: 0 
            }}
            className={`absolute top-0 ${branch.position}-0 w-80 h-full bg-white border-l border-gray-200 shadow-lg z-10`}
            style={{ borderRadius: branch.position === 'left' ? '0 24px 24px 0' : '24px 0 0 24px' }}
          >
            {/* Branch Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {branch.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => switchToBranch(branch.id)}
                    className={`p-1 rounded transition-colors ${
                      activeBranchId === branch.id 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'hover:bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => closeBranch(branch.id)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Branch Chat */}
            <div className="h-full overflow-hidden">
              <ChatInterface 
                messages={branch.messages}
                onSendMessage={(message, parentId) => sendMessage(message, parentId, branch.id)}
                selectedAIs={selectedAIs}
                onBranchFromMessage={() => {}}
                currentBranch={null}
                multiModelMode={multiModelMode}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
