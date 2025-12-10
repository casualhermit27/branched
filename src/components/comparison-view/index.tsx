import React, { useState, useEffect, useRef } from 'react'
import { motion, Reorder } from 'framer-motion'
import { XMarkIcon, ArrowDownTrayIcon, ArrowsRightLeftIcon, ArrowPathIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { ReactFlowNode } from '@/components/flow-canvas/types'
import { IMessage } from '@/models/conversation'
import { allAIOptions } from '@/components/ai-pills'

interface ComparisonViewProps {
    branches: ReactFlowNode[]
    onClose: () => void
    initialSelectedBranchIds?: string[]
    initialFocusedMessageIds?: string[]
    className?: string
    onSendMessage?: (text: string, branchId: string) => void
}

export function ComparisonView({
    branches,
    onClose,
    className = '',
    initialSelectedBranchIds = [],
    initialFocusedMessageIds = [],
    onSendMessage
}: ComparisonViewProps) {
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(initialSelectedBranchIds)
    const [orderedBranchIds, setOrderedBranchIds] = useState<string[]>([])
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Initialize with first 3 branches if available
    useEffect(() => {
        if (selectedBranchIds.length === 0 && branches.length > 0) {
            const validBranches = branches.filter(b => b.id !== 'main' && !b.data?.isMain)
            if (validBranches.length > 0) {
                const initialIds = validBranches.slice(0, 3).map(b => b.id)
                setSelectedBranchIds(initialIds)
                setOrderedBranchIds(initialIds)
            }
        }
    }, [branches, selectedBranchIds.length])

    // Update ordered list when selection changes
    useEffect(() => {
        setOrderedBranchIds(prev => {
            const newIds = selectedBranchIds.filter(id => !prev.includes(id))
            const existingIds = prev.filter(id => selectedBranchIds.includes(id))
            return [...existingIds, ...newIds]
        })
    }, [selectedBranchIds])

    const toggleBranchSelection = (branchId: string) => {
        if (selectedBranchIds.includes(branchId)) {
            setSelectedBranchIds(prev => prev.filter(id => id !== branchId))
        } else {
            setSelectedBranchIds(prev => [...prev, branchId])
        }
    }

    const handleReset = () => {
        const validBranches = branches.filter(b => b.id !== 'main' && !b.data?.isMain)
        if (validBranches.length > 0) {
            const initialIds = validBranches.slice(0, 3).map(b => b.id)
            setSelectedBranchIds(initialIds)
            setOrderedBranchIds(initialIds)
        }
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = 0
        }
    }

    const getBranchData = (branchId: string) => {
        const node = branches.find(b => b.id === branchId) as any
        if (!node) return null

        // Handle both structures: node.data.messages OR node.messages directly
        return {
            label: node.data?.label || node.title || node.label || 'Untitled',
            messages: node.data?.messages || node.messages || [],
            selectedAIs: node.data?.selectedAIs || node.selectedAIs || [],
            branchMessages: node.data?.branchMessages || node.branchMessages || [],
            inheritedMessages: node.data?.inheritedMessages || node.inheritedMessages || []
        }
    }

    const handleExport = () => {
        const markdown = orderedBranchIds.map(branchId => {
            const data = getBranchData(branchId)
            if (!data) return ''
            const messages = data.messages?.map((msg: IMessage) => {
                const role = msg.isUser ? 'User' : (msg.aiModel || 'AI')
                return `**${role}:**\n${msg.text}\n`
            }).join('\n') || ''
            return `# ${data.label || 'Untitled Branch'}\n\n${messages}`
        }).join('\n\n---\n\n')

        const blob = new Blob([markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `comparison-${new Date().toISOString().slice(0, 10)}.md`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const removeBranch = (branchId: string) => {
        setSelectedBranchIds(prev => prev.filter(id => id !== branchId))
    }

    const validBranches = branches.filter(b => {
        const node = b as any
        return b.id !== 'main' && !node.data?.isMain && !node.isMain
    })

    return (
        <div className={`flex flex-col h-full bg-background ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between pl-20 pr-6 py-6 border-b border-border bg-card/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <ArrowsRightLeftIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Model Comparison</h2>
                        <p className="text-sm text-muted-foreground">
                            {selectedBranchIds.length} of {validBranches.length} branches selected
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        title="Reset to default"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Reset
                    </button>
                    <button
                        onClick={() => {
                            // Synthesize logic to be implemented
                            alert("Synthesize feature: Coming soon! This will combine the active branches into a final response.")
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30 rounded-lg transition-colors border border-purple-200 dark:border-purple-800"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        Synthesize
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Sidebar - Branch Selection */}
                <div className="w-72 flex-shrink-0 border-r border-border/50 bg-muted/20 overflow-y-auto">
                    <div className="p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
                            Select Branches
                        </p>
                        <div className="space-y-1">
                            {validBranches.map(branch => {
                                const node = branch as any
                                const isSelected = selectedBranchIds.includes(branch.id)
                                const branchAIs = node.data?.selectedAIs || node.selectedAIs || []
                                const branchAI = branchAIs[0]
                                const freshAI = branchAI ? allAIOptions.find(o => o.id === branchAI.id) || branchAI : null
                                const branchMessages = node.data?.messages || node.messages || []
                                const branchLabel = node.data?.label || node.title || node.label || 'Untitled'

                                return (
                                    <button
                                        key={branch.id}
                                        onClick={() => toggleBranchSelection(branch.id)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${isSelected
                                            ? 'bg-primary/10 ring-1 ring-primary/30'
                                            : 'hover:bg-muted/50'
                                            }`}
                                    >
                                        {/* Checkbox */}
                                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted/50 border border-border'
                                            }`}>
                                            {isSelected && <CheckIcon className="w-3 h-3" />}
                                        </div>

                                        {/* AI Logo */}
                                        {freshAI && (
                                            <div className="w-6 h-6 rounded-md bg-background flex items-center justify-center flex-shrink-0">
                                                {freshAI.logo}
                                            </div>
                                        )}

                                        {/* Branch Info */}
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
                                                {branchLabel}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {branchMessages.length} messages
                                            </p>
                                        </div>
                                    </button>
                                )
                            })}

                            {validBranches.length === 0 && (
                                <div className="px-3 py-6 text-center">
                                    <p className="text-sm text-muted-foreground">No branches yet</p>
                                    <p className="text-xs text-muted-foreground/70 mt-1">Create branches to compare them</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Comparison Area */}
                <div className="flex-1 overflow-hidden">
                    {orderedBranchIds.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                                <ArrowsRightLeftIcon className="w-8 h-8 opacity-50" />
                            </div>
                            <div className="text-center">
                                <p className="font-medium text-foreground mb-1">Select branches to compare</p>
                                <p className="text-sm">Choose from the sidebar on the left</p>
                            </div>
                        </div>
                    ) : (
                        <div
                            ref={scrollContainerRef}
                            className="h-full overflow-x-auto overflow-y-hidden p-4"
                        >
                            <Reorder.Group
                                axis="x"
                                values={orderedBranchIds}
                                onReorder={setOrderedBranchIds}
                                className="h-full flex gap-4"
                            >
                                {orderedBranchIds.map(branchId => {
                                    const data = getBranchData(branchId)
                                    if (!data) return null

                                    const ai = data.selectedAIs?.[0]
                                    const freshAI = ai ? allAIOptions.find(option => option.id === ai.id) || ai : null

                                    return (
                                        <Reorder.Item
                                            key={branchId}
                                            value={branchId}
                                            className="h-full flex-shrink-0 flex flex-col cursor-grab active:cursor-grabbing"
                                            style={{ width: 'calc((100vw - 288px - 64px) / 3)', minWidth: '380px' }}
                                            whileDrag={{ scale: 1.02, zIndex: 50 }}
                                        >
                                            <div className="h-full flex flex-col bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                                                {/* Branch Header */}
                                                <div className="p-4 border-b border-border/30 flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {freshAI && (
                                                            <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                                                                {freshAI.logo}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <h3 className="font-medium text-foreground truncate text-sm">
                                                                {data.label || 'Untitled'}
                                                            </h3>
                                                            <p className="text-xs text-muted-foreground">
                                                                {data.messages?.length || 0} messages
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            removeBranch(branchId)
                                                        }}
                                                        className="p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted rounded-lg transition-colors flex-shrink-0"
                                                    >
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Messages */}
                                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                                    {data.messages?.map((msg: IMessage, index: number) => (
                                                        <motion.div
                                                            key={`${msg.id}-${index}`}
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: index * 0.02 }}
                                                            className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                                                        >
                                                            <div
                                                                data-message-id={msg.id}
                                                                className={`max-w-[90%] px-3.5 py-2.5 text-sm leading-relaxed ${msg.isUser
                                                                    ? 'bg-foreground text-background rounded-2xl rounded-br-md'
                                                                    : 'bg-muted/50 text-foreground rounded-2xl rounded-bl-md'
                                                                    }`}
                                                            >
                                                                {msg.text}
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </div>

                                                {/* Input */}
                                                {onSendMessage && (
                                                    <div className="p-3 border-t border-border/30">
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Type a message..."
                                                                className="w-full px-4 py-2.5 pr-10 rounded-xl bg-muted/30 border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                                        e.preventDefault()
                                                                        const target = e.target as HTMLInputElement
                                                                        const text = target.value.trim()
                                                                        if (text) {
                                                                            onSendMessage(text, branchId)
                                                                            target.value = ''
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                                                onClick={(e) => {
                                                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement
                                                                    const text = input?.value?.trim()
                                                                    if (text) {
                                                                        onSendMessage(text, branchId)
                                                                        input.value = ''
                                                                    }
                                                                }}
                                                            >
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M22 2L11 13" />
                                                                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Reorder.Item>
                                    )
                                })}
                            </Reorder.Group>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
