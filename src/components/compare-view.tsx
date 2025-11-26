'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowsLeftRight, Lock, LockOpen } from '@phosphor-icons/react'
import ChatInterface from './chat-interface'
import type { Message, AI } from './flow-canvas/types'

interface CompareViewProps {
    isOpen: boolean
    onClose: () => void
    node1: {
        id: string
        label: string
        messages: Message[]
        selectedAIs: AI[]
    }
    node2: {
        id: string
        label: string
        messages: Message[]
        selectedAIs: AI[]
    }
}

export function CompareView({ isOpen, onClose, node1, node2 }: CompareViewProps) {
    const [syncScroll, setSyncScroll] = useState(true)
    const leftScrollRef = useRef<HTMLDivElement>(null)
    const rightScrollRef = useRef<HTMLDivElement>(null)
    const isScrollingRef = useRef<'left' | 'right' | null>(null)

    // Sync scroll logic
    useEffect(() => {
        const leftEl = leftScrollRef.current
        const rightEl = rightScrollRef.current

        if (!leftEl || !rightEl || !syncScroll) return

        const handleLeftScroll = () => {
            if (isScrollingRef.current === 'right') return
            isScrollingRef.current = 'left'

            const percentage = leftEl.scrollTop / (leftEl.scrollHeight - leftEl.clientHeight)
            rightEl.scrollTop = percentage * (rightEl.scrollHeight - rightEl.clientHeight)

            // Reset after a small delay
            setTimeout(() => {
                if (isScrollingRef.current === 'left') isScrollingRef.current = null
            }, 50)
        }

        const handleRightScroll = () => {
            if (isScrollingRef.current === 'left') return
            isScrollingRef.current = 'right'

            const percentage = rightEl.scrollTop / (rightEl.scrollHeight - rightEl.clientHeight)
            leftEl.scrollTop = percentage * (leftEl.scrollHeight - leftEl.clientHeight)

            setTimeout(() => {
                if (isScrollingRef.current === 'right') isScrollingRef.current = null
            }, 50)
        }

        leftEl.addEventListener('scroll', handleLeftScroll)
        rightEl.addEventListener('scroll', handleRightScroll)

        return () => {
            leftEl.removeEventListener('scroll', handleLeftScroll)
            rightEl.removeEventListener('scroll', handleRightScroll)
        }
    }, [syncScroll, isOpen])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[90vw] h-[90vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <ArrowsLeftRight className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">Compare Branches</h2>
                            <p className="text-xs text-muted-foreground">Side-by-side comparison mode</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSyncScroll(!syncScroll)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${syncScroll
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                                }`}
                            title={syncScroll ? "Unlock scrolling" : "Lock scrolling"}
                        >
                            {syncScroll ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                            <span>{syncScroll ? 'Sync Scroll On' : 'Sync Scroll Off'}</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="flex-1 grid grid-cols-2 divide-x divide-border overflow-hidden">
                    {/* Left Column */}
                    <div className="flex flex-col h-full min-h-0 bg-card/50">
                        <div className="p-3 border-b border-border/50 bg-muted/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${node1.id === 'main' ? 'bg-primary' : 'bg-emerald-500'}`} />
                                <span className="font-medium text-sm truncate max-w-[200px]">{node1.label}</span>
                            </div>
                            {node1.selectedAIs.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border/50">
                                    <span className="w-3 h-3 flex items-center justify-center">
                                        {node1.selectedAIs[0].logo}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{node1.selectedAIs[0].name}</span>
                                </div>
                            )}
                        </div>

                        <div
                            ref={leftScrollRef}
                            className="flex-1 overflow-y-auto p-4"
                        >
                            <div className="pointer-events-none">
                                <ChatInterface
                                    messages={node1.messages}
                                    onSendMessage={() => { }} // Read-only
                                    selectedAIs={node1.selectedAIs}
                                    onBranchFromMessage={() => { }} // Read-only
                                    currentBranch={null}
                                    isGenerating={false}
                                    onStopGeneration={() => { }}
                                    existingBranchesCount={0}
                                    isMain={node1.id === 'main'}
                                    nodeId={node1.id}
                                    readOnly={true}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="flex flex-col h-full min-h-0 bg-card/50">
                        <div className="p-3 border-b border-border/50 bg-muted/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${node2.id === 'main' ? 'bg-primary' : 'bg-emerald-500'}`} />
                                <span className="font-medium text-sm truncate max-w-[200px]">{node2.label}</span>
                            </div>
                            {node2.selectedAIs.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border/50">
                                    <span className="w-3 h-3 flex items-center justify-center">
                                        {node2.selectedAIs[0].logo}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{node2.selectedAIs[0].name}</span>
                                </div>
                            )}
                        </div>

                        <div
                            ref={rightScrollRef}
                            className="flex-1 overflow-y-auto p-4"
                        >
                            <div className="pointer-events-none">
                                <ChatInterface
                                    messages={node2.messages}
                                    onSendMessage={() => { }} // Read-only
                                    selectedAIs={node2.selectedAIs}
                                    onBranchFromMessage={() => { }} // Read-only
                                    currentBranch={null}
                                    isGenerating={false}
                                    onStopGeneration={() => { }}
                                    existingBranchesCount={0}
                                    isMain={node2.id === 'main'}
                                    nodeId={node2.id}
                                    readOnly={true}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
