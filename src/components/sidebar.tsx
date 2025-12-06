'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { List, X, ArrowsOut, ArrowsIn, Clock, GitBranch, Trash, Gear, Sparkle as SparklesIcon, Eye, EyeSlash, Key, CheckCircle, XCircle, Warning, ArrowsLeftRight, CaretDown } from '@phosphor-icons/react'
import ConversationHistory from './conversation-history'
import { aiService } from '@/services/ai-api'
import { detectProviderFromKey, discoverModels, validateApiKey, type DiscoveredModel } from '@/services/model-discovery'

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

interface Branch {
  id: string
  title: string
  messages: Message[]
  timestamp: number
  parentId?: string
  children: string[]
}

interface ConversationNode {
  id: string
  type: 'main' | 'branch'
  title: string
  messages: Message[]
  timestamp: number
  parentId?: string
  children: ConversationNode[]
  isActive?: boolean
}

interface Conversation {
  _id: string
  title: string
  updatedAt: string
  mainMessages: any[]
  branches: any[]
}

interface SidebarProps {
  branches: Branch[]
  currentBranchId: string | null
  onSelectBranch: (branchId: string) => void
  onDeleteBranch?: (branchId: string) => void
  onDeleteConversation?: (conversationId: string) => void
  conversationNodes?: ConversationNode[]
  conversations?: Conversation[]
  currentConversationId?: string | null
  onSelectConversation?: (conversationId: string) => void
  onCreateNewConversation?: () => void
  messageCount?: number
  onUpgrade?: () => void
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  activeTab?: 'history' | 'settings'
  onTabChange?: (tab: 'history' | 'settings') => void
  onExportData?: () => void
  onClearData?: () => void
  pushContent?: boolean // New prop to enable push layout
}

const ProviderIcon = ({ id, className = "w-5 h-5" }: { id: string, className?: string }) => {
  switch (id) {
    case 'openai':
      return (
        <Image
          src="/logos/openai.svg"
          alt="OpenAI"
          width={20}
          height={20}
          className={`dark:invert ${className}`}
        />
      )
    case 'claude':
      return (
        <Image
          src="/logos/claude-ai-icon.svg"
          alt="Claude"
          width={20}
          height={20}
          className={className}
        />
      )
    case 'gemini':
      return (
        <Image
          src="/logos/gemini.svg"
          alt="Gemini"
          width={20}
          height={20}
          className={className}
        />
      )
    case 'mistral':
      return (
        <Image
          src="/logos/mistral-ai_logo.svg"
          alt="Mistral"
          width={20}
          height={20}
          className={`dark:invert ${className}`}
        />
      )
    case 'grok':
      return (
        <Image
          src="/logos/xai_light.svg"
          alt="Grok"
          width={20}
          height={20}
          className={`dark:invert ${className}`}
        />
      )
    default:
      return <div className={`bg-muted rounded-sm ${className}`} />
  }
}

export default function Sidebar({
  branches,
  currentBranchId,
  onSelectBranch,
  onDeleteBranch,
  onDeleteConversation,
  conversationNodes = [],
  conversations = [],
  currentConversationId = null,
  onSelectConversation = () => { },
  onCreateNewConversation = () => { },
  messageCount = 0,
  onUpgrade = () => { },
  isOpen: externalIsOpen,
  onOpenChange,
  activeTab: externalActiveTab,
  onTabChange,
  onExportData,
  onClearData,
  pushContent = true // Default to push layout
}: SidebarProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [internalActiveTab, setInternalActiveTab] = useState<'history' | 'settings'>('history')

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const setIsOpen = onOpenChange || setInternalIsOpen

  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab
  const setActiveTab = onTabChange || setInternalActiveTab

  // Always use fixed width, no expand/collapse functionality
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['main']))

  // API Key State
  const [apiKeys, setApiKeys] = useState({
    mistral: '',
    openai: '',
    claude: '',
    gemini: '',
    grok: ''
  })
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  // Smart BYOK state
  const [selectedProvider, setSelectedProvider] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [showNewKey, setShowNewKey] = useState(false)
  const [keyValidation, setKeyValidation] = useState<{ valid: boolean | null, message: string }>({ valid: null, message: '' })
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [discoveredModels, setDiscoveredModels] = useState<Record<string, DiscoveredModel[]>>({})

  // Load keys and discovered models on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setApiKeys({
        mistral: aiService.getKey('mistral'),
        openai: aiService.getKey('openai'),
        claude: aiService.getKey('claude'),
        gemini: aiService.getKey('gemini'),
        grok: aiService.getKey('grok')
      })

      // Load previously discovered models from localStorage
      const loadedModels: Record<string, DiscoveredModel[]> = {}
      const providers = ['openai', 'claude', 'gemini', 'mistral', 'grok']
      providers.forEach(provider => {
        const stored = localStorage.getItem(`models_${provider}`)
        if (stored) {
          try {
            loadedModels[provider] = JSON.parse(stored)
          } catch (e) {
            console.error(`Failed to parse models for ${provider}:`, e)
          }
        }
      })
      if (Object.keys(loadedModels).length > 0) {
        setDiscoveredModels(loadedModels)
      }
    }
  }, [])

  const handleKeyChange = (provider: string, value: string) => {
    setApiKeys((prev: any) => ({ ...prev, [provider]: value }))
    aiService.updateKey(provider, value)
  }

  const toggleKeyVisibility = (provider: string) => {
    setShowKeys((prev: any) => ({ ...prev, [provider]: !prev[provider] }))
  }

  // Build conversation tree from nodes with proper hierarchy
  const buildConversationTree = (nodes: ConversationNode[]): ConversationNode[] => {
    if (nodes.length === 0) return []

    const nodeMap = new Map<string, ConversationNode>()
    const rootNodes: ConversationNode[] = []

    // Create a map of all nodes with empty children arrays
    nodes.forEach(node => {
      nodeMap.set(node.id, {
        ...node,
        children: [],
        isActive: node.id === currentBranchId
      })
    })

    // Build the tree structure based on parent-child relationships
    nodes.forEach(node => {
      const treeNode = nodeMap.get(node.id)!

      // Find parent based on edges or parentId
      let parentId = node.parentId

      // If no direct parentId, try to find parent through message relationships
      if (!parentId && node.type === 'branch') {
        // Look for a parent node that this branch was created from
        const parentNode = nodes.find(n =>
          n.id !== node.id &&
          n.type === 'main' &&
          n.messages.some(m => m.children.includes(node.messages[0]?.id || ''))
        )
        parentId = parentNode?.id
      }

      if (parentId && nodeMap.has(parentId)) {
        const parent = nodeMap.get(parentId)!
        parent.children.push(treeNode)
      } else {
        // This is a root node (main conversation or orphaned branch)
        rootNodes.push(treeNode)
      }
    })

    // Sort children by timestamp (newest first)
    const sortChildren = (node: ConversationNode) => {
      node.children.sort((a, b) => b.timestamp - a.timestamp)
      node.children.forEach(sortChildren)
    }

    rootNodes.forEach(sortChildren)
    rootNodes.sort((a, b) => b.timestamp - a.timestamp)

    return rootNodes
  }

  // Get conversation tree
  const conversationTree = buildConversationTree(conversationNodes)

  // Sort branches by timestamp (newest first) for history tab
  const sortedBranches = [...branches].sort((a, b) => b.timestamp - a.timestamp)

  // Group branches by date
  const groupedBranches = sortedBranches.reduce((groups: Record<string, Branch[]>, branch) => {
    const date = new Date(branch.timestamp)
    const dateKey = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })

    if (!groups[dateKey]) {
      groups[dateKey] = []
    }

    groups[dateKey].push(branch)
    return groups
  }, {})

  // Get first user message from branch (for title display)
  const getBranchTitle = (branch: Branch) => {
    const userMessage = branch.messages.find(m => m.isUser)
    if (userMessage) {
      // Truncate to reasonable length
      return userMessage.text.length > 40
        ? userMessage.text.substring(0, 40) + '...'
        : userMessage.text
    }
    return 'Untitled branch'
  }

  // Get title for conversation node
  const getNodeTitle = (node: ConversationNode) => {
    const userMessage = node.messages.find(m => m.isUser)
    if (userMessage) {
      return userMessage.text.length > 30
        ? userMessage.text.substring(0, 30) + '...'
        : userMessage.text
    }
    return node.type === 'main' ? 'Main Conversation' : 'Branch'
  }

  // Toggle node expansion
  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes((prev: Set<string>) => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  // Render conversation tree node with better hierarchy
  const renderTreeNode = (node: ConversationNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children.length > 0
    const isActive = currentBranchId === node.id

    return (
      <div key={node.id} className="mb-2">
        <div className="flex items-center min-w-0 gap-1.5">
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                toggleNodeExpansion(node.id)
              }}
              className="p-1 text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80 rounded transition-colors flex-shrink-0"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <div className="w-7 flex-shrink-0"></div>
          )}

          {/* Node Content */}
          <motion.button
            onClick={() => onSelectBranch(node.id)}
            className={`flex-1 text-left p-3 rounded-lg text-sm transition-all duration-200 min-w-0 ${isActive
              ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/50 shadow-sm dark:shadow-purple-500/10'
              : 'hover:bg-muted dark:hover:bg-muted/80 text-foreground border border-transparent hover:border-border/60 dark:hover:border-border/40'
              }`}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="flex items-center min-w-0 gap-2.5">
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${node.type === 'main' ? 'bg-blue-500 dark:bg-blue-400' : 'bg-emerald-500 dark:bg-emerald-400'
                  }`}
              />
              <span className="font-medium truncate min-w-0 flex-1 text-sm leading-snug" title={getNodeTitle(node)}>
                {getNodeTitle(node)}
              </span>
              {isActive && (
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 flex-shrink-0"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500 }}
                />
              )}
            </div>
            <div className="text-xs text-muted-foreground dark:text-muted-foreground/80 mt-1.5 flex items-center justify-between min-w-0 gap-2">
              <span className="truncate min-w-0">{node.messages.length} {node.messages.length === 1 ? 'message' : 'messages'}</span>
              {node.type === 'branch' && (
                <span className="text-xs text-muted-foreground dark:text-muted-foreground/70 flex-shrink-0 px-1.5 py-0.5 bg-muted dark:bg-muted/60 rounded">Branch</span>
              )}
            </div>
          </motion.button>
        </div>

        {/* Children with proper indentation */}
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="ml-7 border-l border-border/50 dark:border-border/30 pl-3 mt-2 space-y-2"
            >
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <>
      {/* Toggle Button - Positioned in top bar area */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsOpen(!isOpen)}
            className="fixed top-7 left-4 z-50 p-2.5 bg-card dark:bg-card border border-border/80 dark:border-border/60 rounded-xl shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl transition-all duration-200 hover:bg-muted dark:hover:bg-muted/80"
            aria-label="Open sidebar"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <List size={18} className="text-foreground dark:text-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop - only show when not pushing content */}
            {!pushContent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/5 dark:bg-black/40 backdrop-blur-sm z-30"
                onClick={() => setIsOpen(false)}
              />
            )}

            {/* Sidebar Panel */}
            <motion.div
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed top-0 left-0 z-40 h-full bg-card dark:bg-card border-r border-border/60 dark:border-border/40 shadow-2xl w-80 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/80 dark:border-border/60 bg-card dark:bg-card">
                <div className="flex items-center gap-3">
                  {/* Light Mode Logo */}
                  <div className="dark:hidden">
                    <Image
                      src="/branched logo black.svg"
                      alt="Branched Logo"
                      width={180}
                      height={64}
                      className="h-16 w-auto object-contain"
                    />
                  </div>
                  {/* Dark Mode Logo */}
                  <div className="hidden dark:block">
                    <Image
                      src="/branched logo.svg"
                      alt="Branched Logo"
                      width={240}
                      height={96}
                      className="h-16 w-auto object-contain"
                    />
                  </div>
                </div>
                <motion.button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted/80 transition-all duration-200 flex-shrink-0"
                  aria-label="Close sidebar"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={18} weight="bold" />
                </motion.button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border/80 dark:border-border/60 bg-card">
                <motion.button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-3.5 text-sm font-medium relative transition-colors duration-200 ${activeTab === 'history'
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground'
                    }`}
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex items-center justify-center gap-2 relative z-10">
                    <Clock size={16} weight={activeTab === 'history' ? 'fill' : 'regular'} />
                    History
                  </span>
                  {activeTab === 'history' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
                <motion.button
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 py-3.5 text-sm font-medium relative transition-colors duration-200 ${activeTab === 'settings'
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-muted-foreground dark:text-muted-foreground/80 hover:text-foreground dark:hover:text-foreground'
                    }`}
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="flex items-center justify-center gap-2 relative z-10">
                    <Gear size={16} weight={activeTab === 'settings' ? 'fill' : 'regular'} />
                    Settings
                  </span>
                  {activeTab === 'settings' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'history' ? (
                  <ConversationHistory
                    conversations={conversations}
                    currentConversationId={currentConversationId}
                    onSelectConversation={onSelectConversation}
                    onCreateNewConversation={() => {
                      onCreateNewConversation()
                      setIsOpen(false) // Only close sidebar after creating new conversation
                    }}
                    onDeleteConversation={(id) => onDeleteConversation?.(id)}
                  />
                ) : (
                  <div className="p-6 space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground dark:text-foreground mb-4">General</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 dark:border-border/40 bg-card dark:bg-card">
                          <div>
                            <p className="text-sm font-medium text-foreground dark:text-foreground">Auto-save</p>
                            <p className="text-xs text-muted-foreground dark:text-muted-foreground/70 mt-0.5">Automatically save conversations</p>
                          </div>
                          <div className="w-10 h-6 bg-purple-500 dark:bg-purple-500 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 dark:border-border/40 bg-card dark:bg-card">
                          <div>
                            <p className="text-sm font-medium text-foreground dark:text-foreground">Notifications</p>
                            <p className="text-xs text-muted-foreground dark:text-muted-foreground/70 mt-0.5">Show notifications for new messages</p>
                          </div>
                          <div className="w-10 h-6 bg-muted dark:bg-muted rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-foreground dark:text-foreground mb-4">Appearance</h3>
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border border-border/60 dark:border-border/40 bg-card dark:bg-card">
                          <p className="text-sm font-medium text-foreground dark:text-foreground mb-1">Theme</p>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground/70">Use the theme toggle in the top bar</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-foreground dark:text-foreground mb-4">API Keys (BYOK)</h3>

                      {/* Smart Key Input */}
                      <div className="mb-4 p-4 rounded-xl border border-purple-500/30 bg-purple-500/5">
                        <p className="text-xs font-medium text-foreground mb-3">Add API Key</p>
                        <div className="space-y-3">
                          {/* Provider Selection */}
                          <div className="relative">
                            <button
                              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                              className="w-full flex items-center justify-between bg-muted/50 dark:bg-muted/30 border border-border/50 rounded-lg py-2.5 px-3 text-sm text-foreground hover:bg-muted/70 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {selectedProvider ? (
                                  <>
                                    <ProviderIcon id={selectedProvider} className="w-4 h-4 rounded-sm" />
                                    <span className="capitalize">{[
                                      { id: 'openai', label: 'OpenAI (GPT-4)' },
                                      { id: 'claude', label: 'Anthropic (Claude)' },
                                      { id: 'gemini', label: 'Google Gemini' },
                                      { id: 'mistral', label: 'Mistral AI' },
                                      { id: 'grok', label: 'xAI (Grok)' }
                                    ].find(p => p.id === selectedProvider)?.label || selectedProvider}</span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">Select Provider...</span>
                                )}
                              </div>
                              <CaretDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                              {isDropdownOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute top-full left-0 right-0 mt-1 bg-card dark:bg-card border border-border/60 rounded-xl shadow-lg z-50 overflow-hidden py-1"
                                >
                                  {[
                                    { id: 'openai', label: 'OpenAI (GPT-4)' },
                                    { id: 'claude', label: 'Anthropic (Claude)' },
                                    { id: 'gemini', label: 'Google Gemini' },
                                    { id: 'mistral', label: 'Mistral AI' },
                                    { id: 'grok', label: 'xAI (Grok)' }
                                  ].map((provider) => (
                                    <button
                                      key={provider.id}
                                      onClick={() => {
                                        setSelectedProvider(provider.id)
                                        setIsDropdownOpen(false)
                                      }}
                                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${selectedProvider === provider.id
                                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                        : 'text-foreground hover:bg-muted dark:hover:bg-muted/80'
                                        }`}
                                    >
                                      <ProviderIcon id={provider.id} className="w-5 h-5 rounded-sm" />
                                      <span>{provider.label}</span>
                                      {selectedProvider === provider.id && (
                                        <CheckCircle size={14} className="ml-auto" weight="fill" />
                                      )}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="relative">
                            <input
                              type={showNewKey ? 'text' : 'password'}
                              value={newApiKey}
                              onChange={(e) => {
                                const key = e.target.value
                                setNewApiKey(key)
                                // Auto-detect provider from key format using model-discovery service
                                const detectedProvider = detectProviderFromKey(key)
                                if (detectedProvider) {
                                  setSelectedProvider(detectedProvider)
                                  const providerNames: Record<string, string> = {
                                    openai: 'OpenAI',
                                    claude: 'Anthropic',
                                    gemini: 'Google Gemini',
                                    mistral: 'Mistral AI',
                                    grok: 'xAI'
                                  }
                                  setKeyValidation({ valid: true, message: `${providerNames[detectedProvider]} key detected` })
                                } else if (key.length > 20 && selectedProvider) {
                                  setKeyValidation({ valid: null, message: 'Key format unknown - will validate on save' })
                                } else {
                                  setKeyValidation({ valid: null, message: '' })
                                }
                              }}
                              placeholder="Paste your API key here..."
                              className="w-full bg-muted/50 dark:bg-muted/30 border border-border/50 rounded-lg py-2 pl-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-mono"
                            />
                            <button
                              onClick={() => setShowNewKey(!showNewKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showNewKey ? <EyeSlash size={16} /> : <Eye size={16} />}
                            </button>
                          </div>

                          {/* Validation Feedback */}
                          {keyValidation.message && (
                            <div className={`flex items-center gap-2 text-xs ${keyValidation.valid === true ? 'text-emerald-500' :
                              keyValidation.valid === false ? 'text-red-500' : 'text-amber-500'
                              }`}>
                              {keyValidation.valid === true ? (
                                <CheckCircle size={14} weight="fill" />
                              ) : keyValidation.valid === false ? (
                                <XCircle size={14} weight="fill" />
                              ) : (
                                <Warning size={14} weight="fill" />
                              )}
                              {keyValidation.message}
                            </div>
                          )}

                          <button
                            onClick={async () => {
                              if (selectedProvider && newApiKey.trim()) {
                                setIsValidating(true)
                                setKeyValidation({ valid: null, message: 'Validating key and discovering models...' })

                                try {
                                  // Validate and discover models
                                  const result = await validateApiKey(newApiKey.trim())

                                  if (result.valid && result.models.length > 0) {
                                    handleKeyChange(selectedProvider, newApiKey.trim())
                                    setDiscoveredModels(prev => ({
                                      ...prev,
                                      [selectedProvider]: result.models
                                    }))
                                    // Store models in localStorage for persistence
                                    localStorage.setItem(`models_${selectedProvider}`, JSON.stringify(result.models))
                                    setKeyValidation({ valid: true, message: `Key saved! Found ${result.models.length} models` })
                                    setTimeout(() => {
                                      setNewApiKey('')
                                      setSelectedProvider('')
                                      setKeyValidation({ valid: null, message: '' })
                                    }, 2000)
                                  } else {
                                    // Still save the key but show warning
                                    handleKeyChange(selectedProvider, newApiKey.trim())
                                    setKeyValidation({ valid: true, message: 'Key saved (using default models)' })
                                    setTimeout(() => {
                                      setNewApiKey('')
                                      setSelectedProvider('')
                                      setKeyValidation({ valid: null, message: '' })
                                    }, 1500)
                                  }
                                } catch (error) {
                                  console.error('Validation error:', error)
                                  // Save anyway but warn
                                  handleKeyChange(selectedProvider, newApiKey.trim())
                                  setKeyValidation({ valid: true, message: 'Key saved (could not validate)' })
                                  setTimeout(() => {
                                    setNewApiKey('')
                                    setSelectedProvider('')
                                    setKeyValidation({ valid: null, message: '' })
                                  }, 1500)
                                } finally {
                                  setIsValidating(false)
                                }
                              }
                            }}
                            disabled={!selectedProvider || !newApiKey.trim() || isValidating}
                            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-muted disabled:text-muted-foreground text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isValidating ? (
                              <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Validating...
                              </>
                            ) : (
                              'Save API Key'
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Saved Keys List - Only show if any keys exist */}
                      {Object.values(apiKeys).some(key => !!key) && (
                        <>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Configured Keys</p>
                          <div className="space-y-2">
                            {[
                              { id: 'openai', label: 'OpenAI' },
                              { id: 'claude', label: 'Claude' },
                              { id: 'gemini', label: 'Gemini' },
                              { id: 'mistral', label: 'Mistral' },
                              { id: 'grok', label: 'Grok' }
                            ].filter(provider => !!apiKeys[provider.id as keyof typeof apiKeys]).map((provider) => (
                              <div key={provider.id} className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <ProviderIcon id={provider.id} className="w-4 h-4 rounded-sm" />
                                    <span className="text-sm font-medium text-foreground">{provider.label}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-500 rounded font-medium">Active</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      handleKeyChange(provider.id, '')
                                      setDiscoveredModels(prev => {
                                        const updated = { ...prev }
                                        delete updated[provider.id]
                                        return updated
                                      })
                                      localStorage.removeItem(`models_${provider.id}`)
                                    }}
                                    className="text-xs text-red-400 hover:text-red-500 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                                {/* Show discovered models */}
                                {discoveredModels[provider.id] && discoveredModels[provider.id].length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-emerald-500/20">
                                    <p className="text-[10px] text-muted-foreground mb-1">Available models:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {discoveredModels[provider.id].slice(0, 4).map(model => (
                                        <span key={model.id} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-foreground">
                                          {model.name}
                                        </span>
                                      ))}
                                      {discoveredModels[provider.id].length > 4 && (
                                        <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                                          +{discoveredModels[provider.id].length - 4} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-foreground dark:text-foreground mb-4">Data</h3>
                      <div className="space-y-3">
                        <button
                          onClick={onExportData}
                          className="w-full p-3 rounded-lg border border-border/60 dark:border-border/40 bg-card dark:bg-card hover:bg-muted dark:hover:bg-muted/80 transition-colors text-left"
                        >
                          <p className="text-sm font-medium text-foreground dark:text-foreground">Export all conversations</p>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground/70 mt-0.5">Download your data as JSON</p>
                        </button>
                        <button
                          onClick={onClearData}
                          className="w-full p-3 rounded-lg border border-destructive/30 dark:border-destructive/30 bg-card dark:bg-card hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-colors text-left"
                        >
                          <p className="text-sm font-medium text-destructive">Clear all data</p>
                          <p className="text-xs text-muted-foreground dark:text-muted-foreground/70 mt-0.5">Permanently delete all conversations</p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {activeTab !== 'settings' && (
                <div className="px-6 py-4 border-t border-border/80 dark:border-border/60 bg-muted/30 dark:bg-muted/20">
                  {/* Usage Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-foreground dark:text-foreground">Free Plan</span>
                      <span className="text-muted-foreground dark:text-muted-foreground/70">{messageCount}/50 msgs</span>
                    </div>
                    <div className="h-1.5 bg-muted dark:bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${messageCount >= 50 ? 'bg-red-500' : 'bg-gradient-to-r from-zinc-600 to-zinc-400 dark:from-zinc-400 dark:to-zinc-300'
                          }`}
                        style={{ width: `${Math.min((messageCount / 50) * 100, 100)}%` }}
                      />
                    </div>
                    {messageCount >= 40 && (
                      <p className="text-[10px] text-destructive mt-1 font-medium">
                        {messageCount >= 50 ? 'Limit reached' : 'Approaching limit'}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={onUpgrade}
                    className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900 text-xs font-medium tracking-wide rounded-xl shadow-sm hover:shadow-md transition-all duration-200 mb-3 flex items-center justify-center gap-2"
                  >
                    <SparklesIcon className="w-3.5 h-3.5" />
                    Upgrade to Pro
                  </button>

                  <div className="text-xs text-muted-foreground dark:text-muted-foreground/70 flex justify-between items-center">
                    <span className="font-medium text-foreground dark:text-foreground">
                      {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
