'use client'

import { useState, useEffect, useRef } from 'react'
import { MagnifyingGlass, X, GitBranch, ChatCircleDots } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchMessages, getSearchResultContext, highlightSearchMatch } from './flow-canvas/search'
import type { SearchResult } from './flow-canvas/types'

interface GlobalSearchProps {
    isOpen: boolean
    onClose: () => void
    nodes: any[]
    onNavigate: (nodeId: string, messageId?: string) => void
}

export function GlobalSearch({ isOpen, onClose, nodes, onNavigate }: GlobalSearchProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
        } else {
            setQuery('')
            setResults([])
        }
    }, [isOpen])

    useEffect(() => {
        if (!query.trim()) {
            setResults([])
            return
        }

        const searchResults = searchMessages(query, nodes)
        setResults(searchResults)
    }, [query, nodes])

    // Group results by node
    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.nodeId]) {
            acc[result.nodeId] = []
        }
        acc[result.nodeId].push(result)
        return acc
    }, {} as Record<string, SearchResult[]>)

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
                    />

                    {/* Search Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4"
                    >
                        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                            {/* Search Header */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                                <MagnifyingGlass className="w-5 h-5 text-muted-foreground" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search messages..."
                                    className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 h-9"
                                />
                                <button
                                    onClick={onClose}
                                    className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Results Area */}
                            <div className="overflow-y-auto flex-1 p-2">
                                {query.trim() === '' ? (
                                    <div className="text-center py-12 text-muted-foreground/50 text-sm">
                                        Type to search across all branches and messages
                                    </div>
                                ) : results.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground/50 text-sm">
                                        No matches found for "{query}"
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Found {results.length} matches in {Object.keys(groupedResults).length} branches
                                        </div>

                                        {Object.entries(groupedResults).map(([nodeId, nodeResults]) => {
                                            const node = nodes.find(n => n.id === nodeId)
                                            const nodeTitle = node?.title || node?.data?.label || (nodeId === 'main' ? 'Main Conversation' : 'Untitled Branch')
                                            const isMain = nodeId === 'main' || node?.isMain

                                            return (
                                                <div key={nodeId} className="bg-muted/30 rounded-lg border border-border/50 overflow-hidden">
                                                    {/* Node Header */}
                                                    <div className="px-3 py-2 bg-muted/50 border-b border-border/50 flex items-center gap-2">
                                                        {isMain ? (
                                                            <ChatCircleDots className="w-4 h-4 text-primary" weight="fill" />
                                                        ) : (
                                                            <GitBranch className="w-4 h-4 text-indigo-500" weight="regular" />
                                                        )}
                                                        <span className="text-xs font-semibold text-foreground">{nodeTitle}</span>
                                                        <span className="text-[10px] text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded-full">
                                                            {nodeResults.length} matches
                                                        </span>
                                                    </div>

                                                    {/* Matches */}
                                                    <div className="divide-y divide-border/30">
                                                        {nodeResults.map((result) => (
                                                            <button
                                                                key={result.messageId}
                                                                onClick={() => {
                                                                    onNavigate(result.nodeId, result.messageId)
                                                                    onClose()
                                                                }}
                                                                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors group"
                                                            >
                                                                <div
                                                                    className="text-sm text-foreground/80 line-clamp-2 group-hover:text-foreground"
                                                                    dangerouslySetInnerHTML={{
                                                                        __html: highlightSearchMatch(result.preview, query)
                                                                    }}
                                                                />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-2 bg-muted/30 border-t border-border text-[10px] text-muted-foreground flex justify-between">
                                <span>Press ESC to close</span>
                                <span>{results.length} results</span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
