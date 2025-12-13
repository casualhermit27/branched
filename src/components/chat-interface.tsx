'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MarkdownRenderer } from './markdown-renderer'
import { ArrowsOut, ArrowsIn, GitBranch, PaperPlaneRight, Stop, Plus, Copy, PencilSimple, Check, X, Sparkle as SparklesIcon } from '@phosphor-icons/react'
import AIPills, { allAIOptions } from './ai-pills'
import { SideBySideComparison } from './side-by-side-comparison'

interface Message {
    id: string
    text: string
    isUser: boolean
    ai?: string
    parentId?: string
    children: string[]
    timestamp: number
    responses?: { [aiId: string]: string }
    aiModel?: string    // AI that generated this
    groupId?: string    // Link related multi-model responses
    isStreaming?: boolean  // Whether this message is currently streaming
    streamingText?: string // Current streaming text content
    role?: string // Added to satisfy linter, though we use isUser
}

interface AI {
    id: string
    name: string
    color: string
    logo: React.JSX.Element
}

interface ChatInterfaceProps {
    messages: Message[]
    onSendMessage: (message: string, parentId?: string) => void
    selectedAIs: AI[]
    onBranchFromMessage: (messageId: string, isMultiBranch?: boolean) => void
    currentBranch: string | null
    isGenerating?: boolean
    onStopGeneration?: () => void
    existingBranchesCount?: number
    // Branch-level multi-model props
    onAddAI?: (ai: AI) => void
    onRemoveAI?: (aiId: string) => void
    onSelectSingle?: (aiId: string) => void
    getBestAvailableModel?: () => string
    isMain?: boolean
    nodeId?: string
    onExportImport?: () => void
    readOnly?: boolean
    onMessageSelect?: (messageId: string, isMultiSelect: boolean) => void
    selectedMessageIds?: Set<string>
    tier?: 'free' | 'pro'
    onEditMessage?: (messageId: string, newText: string) => void
    checkLimit?: (type: 'branch' | 'message') => boolean
}

function ChatInterface({
    messages,
    onSendMessage,
    selectedAIs,
    onBranchFromMessage,
    currentBranch,
    isGenerating = false,
    onStopGeneration,
    existingBranchesCount = 0,
    // Branch-level multi-model props
    onAddAI,
    onRemoveAI,
    onSelectSingle,
    getBestAvailableModel,
    isMain = false,
    nodeId,
    onExportImport,
    readOnly = false,
    onMessageSelect,
    selectedMessageIds,
    tier = 'free',
    onEditMessage,
    checkLimit
}: ChatInterfaceProps) {

    const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

    const [message, setMessage] = useState('')
    const [isUserScrolling, setIsUserScrolling] = useState(false)
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
    const [showBranchWarning, setShowBranchWarning] = useState(false)
    const [comparisonViewGroupId, setComparisonViewGroupId] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const lastBranchIdRef = useRef<string | null | undefined>(currentBranch)
    const hasScrolledRef = useRef<boolean>(false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!message.trim()) return

        if (checkLimit && !checkLimit('message')) {
            return
        }

        onSendMessage(message, currentBranch || undefined)
        setMessage('')
        // Enable auto-scroll when user sends a message
        setShouldAutoScroll(true)

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
        }
    }

    // Handle scroll events to detect user scrolling
    const handleScroll = useCallback(() => {
        if (!messagesContainerRef.current) return

        const container = messagesContainerRef.current
        const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50

        if (isAtBottom) {
            setIsUserScrolling(false)
            setShouldAutoScroll(true)
        } else {
            setIsUserScrolling(true)
            setShouldAutoScroll(false)
        }
    }, [])

    // Handle branch change - reset scroll state and focus
    useEffect(() => {
        if (currentBranch !== lastBranchIdRef.current) {
            // Branch changed - reset scroll state
            setShouldAutoScroll(true)
            hasScrolledRef.current = false
            lastBranchIdRef.current = currentBranch

            // Auto-focus if it's a new empty branch (UX improvement)
            if (messages.length === 0) {
                setTimeout(() => {
                    // Check limit before focusing if we want to be strict, but usually programmatic focus is OK.
                    // However, we want to block interactions.
                    // If we just focus, onFocus will trigger.
                    textareaRef.current?.focus()
                }, 100)
            }

            // Use scrollTop instead of scrollIntoView to avoid layout shifts
            setTimeout(() => {
                if (messagesContainerRef.current) {
                    const container = messagesContainerRef.current
                    container.scrollTop = container.scrollHeight
                }
            }, 100)
        }
    }, [currentBranch, messages.length])

    // Auto-scroll to bottom when new messages arrive (only if should auto-scroll)
    useEffect(() => {
        if (shouldAutoScroll && messagesContainerRef.current && messages.length > 0) {
            const container = messagesContainerRef.current
            const isNewMessage = !hasScrolledRef.current

            if (isNewMessage) {
                requestAnimationFrame(() => {
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: 'smooth'
                    })
                })
            } else {
                container.scrollTop = container.scrollHeight
            }

            hasScrolledRef.current = true
        }
    }, [messages, shouldAutoScroll])

    // Reset auto-scroll when user starts typing
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value)
        setShouldAutoScroll(true)
    }

    // Handle multi-branch creation
    const handleCreateBranches = () => {
        if (checkLimit && !checkLimit('branch')) return
        const lastUserMessage = [...messages].reverse().find(m => m.isUser)
        if (!lastUserMessage) return
        onBranchFromMessage(lastUserMessage.id, true)
    }

    const handleCopy = (text: string, messageId: string) => {
        navigator.clipboard.writeText(text)
        setCopiedMessageId(messageId)
        setTimeout(() => setCopiedMessageId(null), 2000)
    }

    // Handle synthesis of multiple responses
    const handleSynthesize = (groupId: string) => {
        const groupMessages = messages.filter(m => m.groupId === groupId && !m.isUser)
        if (groupMessages.length === 0) return

        // Construct synthesis prompt
        const prompt = `Please synthesize the following ${groupMessages.length} AI responses into a single, comprehensive answer. Identify the best parts of each, resolve any conflicts, and provide the most accurate summary.

${groupMessages.map((m, i) => `[Response ${i + 1} from ${m.aiModel || 'AI'}]:\n${m.text}\n`).join('\n')}

Synthesized Answer:`

        if (checkLimit && !checkLimit('message')) return
        setComparisonViewGroupId(null)
        onSendMessage(prompt)
    }

    const { startEditing, cancelEditing, saveEdit } = {
        startEditing: (msg: Message) => {
            if (checkLimit && !checkLimit('message')) return
            setEditingMessageId(msg.id)
            setEditValue(msg.text)
        },
        cancelEditing: () => {
            setEditingMessageId(null)
            setEditValue('')
        },
        saveEdit: () => {
            if (checkLimit && !checkLimit('message')) return
            if (editingMessageId && editValue.trim() && onEditMessage) {
                onEditMessage(editingMessageId, editValue)
                setEditingMessageId(null)
                setEditValue('')
            }
        }
    }

    const getAIColor = (aiId: string) => {
        const freshAI = allAIOptions.find(a => a.id === aiId)
        if (freshAI) return freshAI.color

        const ai = selectedAIs.find(a => a.id === aiId)
        return ai?.color || 'bg-muted text-foreground border-border'
    }

    const getAILogo = (aiId: string) => {
        const freshAI = allAIOptions.find(a => a.id === aiId)
        if (freshAI) return freshAI.logo

        const ai = selectedAIs.find(a => a.id === aiId)
        return ai?.logo || null
    }

    // Normalize messages
    const validatedMessages = messages.map((msg) => {
        const hasAIModel = !!(msg.aiModel || msg.ai)
        if (hasAIModel && msg.isUser !== false) return { ...msg, isUser: false }
        if (!hasAIModel && msg.isUser !== true && !msg.text?.startsWith('[Branched from:')) return { ...msg, isUser: true }
        return msg
    })

    const normalizedMessages = validatedMessages.map(msg => {
        const isAI = Boolean(msg.aiModel || msg.ai || msg.role === 'assistant')
        const forcedIsUser = !isAI
        return { ...msg, isUser: forcedIsUser }
    })

    // Group messages
    const groupedMessages = normalizedMessages.reduce((groups, msg) => {
        if (msg.groupId) {
            if (!groups[msg.groupId]) groups[msg.groupId] = []
            // Prevent duplicates in the same group
            if (!groups[msg.groupId].some(m => m.id === msg.id)) {
                groups[msg.groupId].push(msg)
            }
        } else {
            groups[`single-${msg.id}`] = [msg]
        }
        return groups
    }, {} as Record<string, Message[]>)

    const getAIModelsFromGroup = (groupMessages: Message[]) => {
        return groupMessages
            .filter(msg => msg.aiModel)
            .map(msg => selectedAIs.find(ai => ai.id === msg.aiModel))
            .filter(Boolean) as AI[]
    }

    const handlePillClick = (aiId: string, groupId?: string) => {
        if (groupId) {
            const targetMessage = messages.find(msg => msg.groupId === groupId && msg.aiModel === aiId)
            if (targetMessage) {
                const element = document.getElementById(`message-${targetMessage.id}`)
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    element.classList.add('ring-2', 'ring-primary', 'ring-opacity-50')
                    setTimeout(() => element.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50'), 2000)
                }
            }
        }
    }

    return (
        <div
            className="w-full h-full flex flex-col relative overflow-hidden nodrag"
            data-scrollable
            onWheel={(e) => e.stopPropagation()}
        >


            {/* Messages Area */}
            <div
                className="flex-1 overflow-y-auto overflow-x-hidden space-y-8 px-6 pb-4 pt-6 overscroll-contain"
                ref={messagesContainerRef}
                onScroll={handleScroll}
                data-scrollable
                style={{
                    scrollBehavior: 'smooth',
                }}
            >
                {Object.entries(groupedMessages).map(([groupId, groupMessages], index, array) => {
                    const isMultiModel = groupMessages.length > 1
                    const aiModels = getAIModelsFromGroup(groupMessages)
                    const isComparisonView = comparisonViewGroupId === groupId

                    return (
                        <div key={groupId} className="space-y-4">
                            {/* Multi-model Group Header */}
                            {isMultiModel && (
                                <div className="flex items-center justify-center gap-3 py-2 opacity-80 hover:opacity-100 transition-opacity">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-transparent rounded-full text-[10px] text-muted-foreground font-medium border border-border">
                                        <span>{groupMessages.length} Responses</span>
                                    </div>
                                    <button
                                        onClick={() => setComparisonViewGroupId(isComparisonView ? null : groupId)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-transparent hover:bg-muted border border-border rounded-full text-[10px] font-medium text-foreground transition-all"
                                    >
                                        {isComparisonView ? (
                                            <>
                                                <ArrowsIn className="w-3 h-3" />
                                                <span>Stack View</span>
                                            </>
                                        ) : (
                                            <>
                                                <ArrowsOut className="w-3 h-3" />
                                                <span>Compare View</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleSynthesize(groupId)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-full text-[10px] font-medium text-purple-500 transition-all shadow-sm hover:shadow-purple-500/10"
                                    >
                                        <SparklesIcon className="w-3 h-3" />
                                        <span>Synthesize</span>
                                    </button>
                                </div>
                            )}

                            {/* Comparison View */}
                            {isMultiModel && isComparisonView ? (
                                <SideBySideComparison
                                    messages={normalizedMessages}
                                    selectedAIs={selectedAIs}
                                    groupId={groupId}
                                    onClose={() => setComparisonViewGroupId(null)}
                                    onSynthesize={() => handleSynthesize(groupId)}
                                    getAIColor={getAIColor}
                                    getAILogo={getAILogo}
                                />
                            ) : (
                                /* Standard Stack View */
                                <div className={`${isMultiModel ? 'bg-muted/10 rounded-3xl p-4 space-y-8 border border-border/10' : 'space-y-8'}`}>
                                    {groupMessages
                                        .filter((msg) => {
                                            // Keep streaming messages, user messages, and AI messages with content
                                            if (msg.isStreaming) return true
                                            if (msg.isUser) return true
                                            return msg.text && msg.text.trim().length > 0
                                        })
                                        .map((msg) => (
                                            <motion.div
                                                key={msg.id}
                                                id={`message-${msg.id}`}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} relative`}
                                            >
                                                {/* User Message */}
                                                {msg.isUser ? (
                                                    <div className="flex flex-col items-end max-w-[85%] overflow-hidden relative group/message">
                                                        {editingMessageId === msg.id ? (
                                                            <div className="w-full bg-primary/5 border border-primary/20 rounded-2xl p-3 min-w-[300px]">
                                                                <textarea
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    className="w-full bg-transparent border-none outline-none text-foreground resize-none text-sm p-1"
                                                                    rows={3}
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                            e.preventDefault()
                                                                            saveEdit()
                                                                        }
                                                                        if (e.key === 'Escape') cancelEditing()
                                                                    }}
                                                                />
                                                                <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-primary/10">
                                                                    <button
                                                                        onClick={cancelEditing}
                                                                        className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={saveEdit}
                                                                        className="px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                                                    >
                                                                        Save & Regenerate
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="relative group/user-message">
                                                                    <div
                                                                        onClick={(e) => {
                                                                            if (e.ctrlKey || e.metaKey || e.altKey) {
                                                                                e.preventDefault()
                                                                                e.stopPropagation()
                                                                                onMessageSelect?.(msg.id, true)
                                                                            }
                                                                        }}
                                                                        className={`relative pl-4 border-l-2 border-primary/20 hover:border-primary/50 transition-colors ${selectedMessageIds?.has(msg.id)
                                                                            ? 'ring-2 ring-zinc-400 dark:ring-zinc-500 ring-offset-4 ring-offset-background rounded-sm'
                                                                            : ''
                                                                            }`}
                                                                    >
                                                                        <div className="text-base text-foreground whitespace-pre-wrap break-words leading-relaxed font-normal">
                                                                            {msg.text}
                                                                        </div>
                                                                    </div>

                                                                    {/* Minimal Hover Toolbar */}
                                                                    <div className="absolute top-0 right-0 -translate-y-full pb-1 opacity-0 group-hover/user-message:opacity-100 transition-opacity duration-200 z-10">
                                                                        <div className="flex items-center gap-1 p-1 bg-background/80 backdrop-blur border border-border/50 rounded-lg shadow-sm">
                                                                            {onEditMessage && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault(); e.stopPropagation();
                                                                                        startEditing(msg)
                                                                                    }}
                                                                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                                                    title="Edit"
                                                                                >
                                                                                    <PencilSimple className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.preventDefault(); e.stopPropagation();
                                                                                    handleCopy(msg.text, msg.id)
                                                                                }}
                                                                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                                                title="Copy"
                                                                            >
                                                                                {copiedMessageId === msg.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                                            </button>
                                                                            <div className="w-px h-3 bg-border mx-0.5" />
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.preventDefault(); e.stopPropagation();
                                                                                    if (checkLimit && !checkLimit('branch')) return;
                                                                                    onBranchFromMessage(msg.id, true)
                                                                                }}
                                                                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                                                                title="Branch from here"
                                                                            >
                                                                                <GitBranch className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    /* AI Message */
                                                    <div className="flex gap-4 max-w-[95%] overflow-hidden group/message">
                                                        {/* AI Logo */}
                                                        <div className="flex-shrink-0 mt-1">
                                                            {msg.aiModel && (
                                                                <div className="w-8 h-8 flex items-center justify-center bg-background rounded-full border border-border/10">
                                                                    {getAILogo(msg.aiModel)}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-semibold text-foreground">
                                                                        {msg.aiModel ? selectedAIs.find(ai => ai.id === msg.aiModel)?.name || msg.aiModel : 'AI'}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground/60">
                                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>

                                                                {/* Toolbar in header - always accessible */}
                                                                <div className="flex items-center gap-0.5 opacity-0 group-hover/message:opacity-100 transition-all duration-200">
                                                                    <div className="flex items-center gap-0.5 p-1 rounded-full bg-background border border-border/50 text-muted-foreground backdrop-blur-sm">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.preventDefault(); e.stopPropagation();
                                                                                handleCopy(msg.text, msg.id)
                                                                            }}
                                                                            className="p-1.5 rounded-full hover:bg-muted hover:text-foreground transition-colors"
                                                                            title="Copy"
                                                                        >
                                                                            {copiedMessageId === msg.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                                        </button>
                                                                        <div className="w-px h-4 bg-border/50 mx-0.5" />
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.preventDefault(); e.stopPropagation();
                                                                                if (checkLimit && !checkLimit('branch')) return;
                                                                                onBranchFromMessage(msg.id, false)
                                                                            }}
                                                                            className="p-1.5 rounded-full hover:bg-muted hover:text-primary transition-colors"
                                                                            title="Branch from here"
                                                                        >
                                                                            <GitBranch className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Message bubble + Toolbar row */}
                                                            <div className="relative">
                                                                <div
                                                                    onClick={(e) => {
                                                                        if (e.ctrlKey || e.metaKey || e.altKey) {
                                                                            e.preventDefault()
                                                                            e.stopPropagation()
                                                                            onMessageSelect?.(msg.id, true)
                                                                        }
                                                                    }}
                                                                    className={`leading-relaxed bg-white dark:bg-zinc-800/70 text-zinc-800 dark:text-zinc-100 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700/50 shadow-sm overflow-hidden ${selectedMessageIds?.has(msg.id)
                                                                        ? 'ring-2 ring-zinc-400 dark:ring-zinc-500 ring-offset-2 ring-offset-background'
                                                                        : ''
                                                                        }`}
                                                                    title="Ctrl + Click to select"
                                                                >
                                                                    {msg.isStreaming ? (
                                                                        (!msg.streamingText || msg.streamingText.trim() === '') ? (
                                                                            <div className="flex items-center gap-3 py-2 pl-1">
                                                                                <div className="flex space-x-1">
                                                                                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                                                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                                                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></div>
                                                                                </div>
                                                                                <span className="text-sm text-muted-foreground/80 font-medium animate-pulse">Thinking...</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="space-y-2">
                                                                                <MarkdownRenderer content={msg.streamingText} />
                                                                                <div className="flex items-center gap-1.5 text-muted-foreground/70 pt-1">
                                                                                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-pulse" />
                                                                                    <span className="text-xs font-medium">Generating...</span>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    ) : (
                                                                        <MarkdownRenderer content={msg.text} />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}

                                    {/* Multi-model Actions */}
                                    {/* Multi-model Actions - Only show for the last group */}
                                    {isMultiModel && aiModels.length > 1 && index === array.length - 1 && (
                                        <div className="flex justify-center pt-2 pb-4">
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={handleCreateBranches}
                                                className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium rounded-full transition-colors"
                                            >
                                                <GitBranch className="w-3.5 h-3.5" />
                                                Create Branches for All
                                            </motion.button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Fixed Footer Input Area */}
            {!readOnly && (
                <div className="flex-shrink-0 z-30 bg-card/50 backdrop-blur-sm border-t border-border/40">
                    <div className="max-w-4xl mx-auto relative group">
                        <div className="relative transition-all duration-300">
                            <form
                                onSubmit={handleSubmit}
                                className="flex flex-col"
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={message}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleSubmit(e)
                                        }
                                    }}
                                    onFocus={() => {
                                        if (checkLimit && !checkLimit('message')) {
                                            textareaRef.current?.blur()
                                            return
                                        }
                                        setShouldAutoScroll(true)
                                        setTimeout(() => {
                                            if (messagesContainerRef.current) {
                                                messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: 'smooth' })
                                            }
                                        }, 100)
                                    }}
                                    placeholder={selectedAIs.length > 1 ? `Message ${selectedAIs.length} models...` : "Type a message..."}
                                    className="w-full bg-transparent border-none outline-none px-6 py-5 text-base placeholder:text-muted-foreground/40 min-h-[60px] resize-none focus:ring-0"
                                    style={{ maxHeight: '300px' }}
                                    onInput={(e) => {
                                        const target = e.target as HTMLTextAreaElement
                                        target.style.height = 'auto'
                                        target.style.height = Math.min(target.scrollHeight, 300) + 'px'
                                    }}
                                />

                                {/* Bottom Actions */}
                                <div className="flex items-center justify-between px-4 pb-4 bg-transparent">
                                    <div className="flex items-center gap-3">
                                        {/* AI Pills */}
                                        {onAddAI && onRemoveAI && (
                                            <AIPills
                                                selectedAIs={selectedAIs}
                                                onAddAI={(ai) => {
                                                    if (checkLimit && !checkLimit('branch')) return
                                                    onAddAI(ai)
                                                }}
                                                onRemoveAI={(id) => {
                                                    if (checkLimit && !checkLimit('branch')) return
                                                    onRemoveAI(id)
                                                }}
                                                onSelectSingle={onSelectSingle ? (ai) => {
                                                    if (checkLimit && !checkLimit('branch')) return
                                                    onSelectSingle(ai.id)
                                                } : undefined}
                                                showAddButton={true}
                                                tier={tier}
                                                checkLimit={checkLimit}
                                            />
                                        )}

                                        <div className="h-5 w-px bg-border/50 mx-1"></div>

                                        {/* Attachment Button */}
                                        <button
                                            type="button"
                                            onClick={() => alert('Attachments coming soon!')}
                                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                        >
                                            <Plus weight="bold" className="w-3.5 h-3.5" />
                                            <span>Add Files</span>
                                        </button>
                                    </div>

                                    <div className="flex-shrink-0 ml-4">
                                        {isGenerating ? (
                                            <button
                                                type="button"
                                                onClick={onStopGeneration}
                                                className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors shadow-sm"
                                                title="Stop generation"
                                            >
                                                <Stop weight="fill" className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                disabled={!message.trim()}
                                                className={`p-2.5 rounded-xl transition-all duration-200 ${message.trim()
                                                    ? 'bg-primary text-primary-foreground shadow-md hover:scale-105 hover:shadow-lg'
                                                    : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                                                    }`}
                                            >
                                                <PaperPlaneRight weight="fill" className="w-4 h-4 translate-x-px translate-y-px" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Branch Context Indicator (Floating above input) */}
                        {currentBranch && (
                            <div className="absolute -top-12 left-6 flex items-center gap-2 px-3 py-1.5 bg-background/95 backdrop-blur border border-border/50 rounded-full shadow-sm text-xs text-muted-foreground z-40">
                                <GitBranch className="w-3.5 h-3.5" />
                                <span className="max-w-[200px] truncate">
                                    Branch from: {messages.find(m => m.id === currentBranch)?.text || '...'}
                                </span>
                                <button
                                    onClick={() => onBranchFromMessage('')}
                                    className="ml-1 hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// Memoize ChatInterface to prevent unnecessary re-renders
export default React.memo(ChatInterface)
