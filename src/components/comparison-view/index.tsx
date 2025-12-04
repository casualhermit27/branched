import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, ArrowDownTrayIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { ReactFlowNode } from '@/components/flow-canvas/types'
import { IBranch, IMessage } from '@/models/conversation'
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
    const [inputs, setInputs] = useState<{ [key: string]: string }>({})

    // Initialize with first 2 branches if available
    // Initialize with first 2 branches if available
    // Initialize with first 2 branches if available
    useEffect(() => {
        // Only auto-select if nothing is selected
        if (selectedBranchIds.length === 0 && branches.length > 0) {
            // Filter out main node
            const validBranches = branches.filter(b => b.id !== 'main' && !b.data?.isMain)

            if (validBranches.length > 0) {
                // Select up to 2 valid branches
                setSelectedBranchIds(validBranches.slice(0, 2).map(b => b.id))
            } else {
                // Fallback: select up to 2 of ANY branches (including main if that's all there is)
                setSelectedBranchIds(branches.slice(0, 2).map(b => b.id))
            }
        }
    }, [branches, selectedBranchIds.length])

    // Scroll to focused messages
    useEffect(() => {
        if (initialFocusedMessageIds && initialFocusedMessageIds.length > 0) {
            setTimeout(() => {
                initialFocusedMessageIds.forEach(msgId => {
                    // We use a class selector because the same message ID might appear in multiple branches (if inherited)
                    // Actually, inherited messages have same ID.
                    // So we should scroll all instances.
                    const elements = document.querySelectorAll(`[data-message-id="${msgId}"]`)
                    elements.forEach(el => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2')
                        setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000)
                    })
                })
            }, 500)
        }
    }, [initialFocusedMessageIds, selectedBranchIds])

    const toggleBranchSelection = (branchId: string) => {
        if (selectedBranchIds.includes(branchId)) {
            setSelectedBranchIds(prev => prev.filter(id => id !== branchId))
        } else {
            if (selectedBranchIds.length < 4) {
                setSelectedBranchIds(prev => [...prev, branchId])
            } else {
                // Replace the last one if limit reached
                setSelectedBranchIds(prev => [...prev.slice(0, 3), branchId])
            }
        }
    }

    const getBranchData = (branchId: string) => {
        const node = branches.find(b => b.id === branchId)
        if (!node) return null
        return node.data
    }

    const handleExport = () => {
        const markdown = selectedBranchIds.map(branchId => {
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
        a.download = `comparison-report-${new Date().toISOString().slice(0, 10)}.md`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleInputChange = (branchId: string, value: string) => {
        setInputs(prev => ({ ...prev, [branchId]: value }))
    }

    const handleSend = (branchId: string) => {
        const text = inputs[branchId]?.trim()
        if (text && onSendMessage) {
            onSendMessage(text, branchId)
            setInputs(prev => ({ ...prev, [branchId]: '' }))
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent, branchId: string) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend(branchId)
        }
    }

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
                            Compare responses side-by-side ({selectedBranchIds.length}/3 selected)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-md transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export Report
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
                <div className="w-64 border-r border-border overflow-y-auto p-4 bg-muted/30">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Select Branches</h3>
                    <div className="space-y-2">
                        {branches.map(branch => {
                            const isSelected = selectedBranchIds.includes(branch.id)
                            const data = branch.data
                            return (
                                <button
                                    key={branch.id}
                                    onClick={() => toggleBranchSelection(branch.id)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${isSelected
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                        : 'border-border hover:border-primary/50 bg-card'
                                        }`}
                                >
                                    <div className="font-medium text-sm text-foreground truncate">
                                        {data?.label || 'Untitled Branch'}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                        <span>{data?.messages?.length || 0} msgs</span>
                                        {data?.selectedAIs && data.selectedAIs.length > 0 && (
                                            <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                                                {data.selectedAIs[0].name}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Comparison Grid */}
                <div className="flex-1 overflow-x-auto bg-background">
                    <div className="h-full flex min-w-full">
                        {selectedBranchIds.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                <ArrowsRightLeftIcon className="w-12 h-12 mb-4 opacity-50" />
                                <p>Select branches from the sidebar to compare</p>
                            </div>
                        ) : (
                            selectedBranchIds.map(branchId => {
                                const data = getBranchData(branchId)
                                if (!data) return null

                                return (
                                    <div
                                        key={branchId}
                                        className="flex-1 min-w-[400px] border-r border-border flex flex-col h-full bg-card/50"
                                    >
                                        {/* Column Header */}
                                        <div className="p-4 border-b border-border bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                                            <h3 className="font-semibold text-foreground truncate" title={data.label}>
                                                {data.label}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                {data.selectedAIs?.map((ai: any) => {
                                                    const freshAI = allAIOptions.find(option => option.id === ai.id) || ai
                                                    return (
                                                        <span key={ai.id} className="flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded-md shadow-sm">
                                                            <span className="w-3.5 h-3.5 flex items-center justify-center">
                                                                {freshAI.logo}
                                                            </span>
                                                            <span className="font-medium">{freshAI.name}</span>
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Messages Scroll Area */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                            {data.messages?.map((msg: IMessage, index: number) => (
                                                <div
                                                    key={`${msg.id}-${index}`}
                                                    className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'}`}
                                                >
                                                    <div
                                                        data-message-id={msg.id}
                                                        className={`max-w-[90%] rounded-2xl p-4 shadow-sm transition-all duration-300 ${msg.isUser
                                                            ? 'bg-primary text-primary-foreground rounded-br-none'
                                                            : 'bg-card border border-border rounded-bl-none'
                                                            } ${initialFocusedMessageIds.includes(msg.id) ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                                                        <div className="text-xs font-medium opacity-70 mb-1">
                                                            {msg.isUser ? 'You' : (msg.aiModel || 'AI')}
                                                        </div>
                                                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                                            {msg.text}
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Input Area */}
                                        <div className="p-4 border-t border-border bg-background">
                                            <div className="relative">
                                                <textarea
                                                    value={inputs[branchId] || ''}
                                                    onChange={(e) => handleInputChange(branchId, e.target.value)}
                                                    onKeyDown={(e) => handleKeyDown(e, branchId)}
                                                    placeholder="Send a message..."
                                                    className="w-full min-h-[80px] p-3 pr-12 rounded-xl border border-border bg-muted/30 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary resize-none text-sm transition-all"
                                                />
                                                <button
                                                    onClick={() => handleSend(branchId)}
                                                    disabled={!inputs[branchId]?.trim()}
                                                    className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M22 2L11 13" />
                                                        <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="mt-2 flex justify-between text-xs text-muted-foreground font-mono">
                                                <span>{data.messages?.length || 0} messages</span>
                                                <span>~{(data.messages?.reduce((acc: number, m: any) => acc + (m.text?.length || 0), 0) || 0) / 4} tokens</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
