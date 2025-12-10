import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Paperclip, ArrowRight, GitBranch, ShareNetwork, ChatsCircle, Lightning } from '@phosphor-icons/react'
import AIPills from '@/components/ai-pills'
import type { AI } from '@/components/ai-pills'

interface EmptyStateProps {
    onSendMessage: (text: string) => void
    className?: string
    selectedAIs: AI[]
    onAddAI: (ai: AI) => void
    onRemoveAI: (aiId: string) => void
    onSelectSingle: (ai: AI) => void
    getBestAvailableModel: () => string
    tier?: 'free' | 'pro'
    checkLimit?: (type: 'branch' | 'message') => boolean
}

export function EmptyState({
    onSendMessage,
    className = '',
    selectedAIs,
    onAddAI,
    onRemoveAI,
    onSelectSingle,
    getBestAvailableModel,
    tier = 'free',
    checkLimit
}: EmptyStateProps) {
    const [input, setInput] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (checkLimit && !checkLimit('message')) return

            if (input.trim()) {
                onSendMessage(input)
                setInput('')
            }
        }
    }

    const suggestions = [
        { icon: <GitBranch className="w-4 h-4" />, text: "Compare multiple AI perspectives" },
        { icon: <ShareNetwork className="w-4 h-4" />, text: "Brainstorm complex topics" },
        { icon: <ChatsCircle className="w-4 h-4" />, text: "Draft with different tones" },
        { icon: <Lightning className="w-4 h-4" />, text: "Solve problems faster" },
    ]

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
        }
    }, [input])

    return (
        <div className={`flex flex-col items-center justify-center min-h-screen p-4 bg-background ${className}`}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-3xl flex flex-col items-center gap-8"
            >
                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl md:text-5xl font-serif italic text-foreground">
                        Branch your <span className="not-italic font-sans font-medium">thoughts</span>
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                        Explore multiple paths simultaneously. Chat with diverse AI models to unlock new possibilities.
                    </p>
                </div>

                {/* Input Area */}
                <div className="w-full relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
                    <div className="relative bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden transition-all duration-300 focus-within:ring-1 focus-within:ring-ring/20 focus-within:border-primary/20">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => {
                                if (checkLimit && !checkLimit('message')) {
                                    textareaRef.current?.blur()
                                }
                            }}
                            placeholder="Start a new conversation..."
                            className="w-full bg-transparent border-none outline-none p-6 text-lg placeholder:text-muted-foreground/40 min-h-[120px] resize-none"
                            style={{ maxHeight: '300px' }}
                        />

                        {/* Bottom Actions */}
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border/30">
                            <div className="flex items-center gap-4">
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
                                    onSelectSingle={(ai) => {
                                        if (checkLimit && !checkLimit('branch')) return
                                        onSelectSingle(ai)
                                    }}
                                    showAddButton={true}
                                    getBestAvailableModel={getBestAvailableModel}
                                    tier={tier}
                                />
                                <div className="h-6 w-px bg-border/50 mx-2"></div>
                                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                    <Paperclip className="w-4 h-4" />
                                    <span>Add Files</span>
                                </button>
                            </div>

                            <button
                                onClick={() => {
                                    if (checkLimit && !checkLimit('message')) return
                                    if (input.trim()) {
                                        onSendMessage(input)
                                        setInput('')
                                    }
                                }}
                                disabled={!input.trim()}
                                className={`p-2 rounded-full transition-all duration-200 ${input.trim()
                                    ? 'bg-primary text-primary-foreground shadow-md hover:scale-105'
                                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                                    }`}
                            >
                                <ArrowRight className="w-5 h-5" weight="bold" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Suggestions */}
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                    <span className="w-full text-center text-sm text-muted-foreground mb-2">Or try one of these starting points:</span>
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                if (checkLimit && !checkLimit('message')) return
                                setInput(suggestion.text)
                                if (textareaRef.current) {
                                    textareaRef.current.focus()
                                    // Reset height to auto then scrollHeight to handle multi-line suggestions
                                    setTimeout(() => {
                                        if (textareaRef.current) {
                                            textareaRef.current.style.height = 'auto'
                                            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
                                        }
                                    }, 0)
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-card border border-border/60 hover:border-primary/30 hover:bg-muted/50 rounded-full text-sm text-muted-foreground hover:text-foreground transition-all duration-200"
                        >
                            {suggestion.icon}
                            <span>{suggestion.text}</span>
                        </button>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}
