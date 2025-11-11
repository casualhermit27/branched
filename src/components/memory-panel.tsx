'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, X, ArrowUp, Trash } from '@phosphor-icons/react'

interface MemoryEntry {
  id: string
  content: string
  layer: 'global' | 'branch' | 'node'
  relevanceScore: number
  topic?: string
  sourceMessageId?: string
}

interface MemoryPanelProps {
  branchId: string
  userId?: string
  isOpen: boolean
  onClose: () => void
}

export default function MemoryPanel({ branchId, userId, isOpen, onClose }: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedLayer, setExpandedLayer] = useState<'global' | 'branch' | 'node' | null>(null)

  useEffect(() => {
    if (isOpen && branchId) {
      loadMemories()
    }
  }, [isOpen, branchId])

  const loadMemories = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/memory/context?branchId=${branchId}&depth=3&maxMemories=50${userId ? `&userId=${userId}` : ''}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Combine all memories
          const allMemories: MemoryEntry[] = [
            ...data.data.globalMemories.map((m: any) => ({ ...m, layer: 'global' as const })),
            ...data.data.branchMemories.map((m: any) => ({ ...m, layer: 'branch' as const })),
            ...data.data.nodeMemories.map((m: any) => ({ ...m, layer: 'node' as const }))
          ]
          setMemories(allMemories.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)))
        }
      }
    } catch (error) {
      console.error('Error loading memories:', error)
    } finally {
      setLoading(false)
    }
  }

  const promoteToGlobal = async (memoryId: string) => {
    if (!userId) return
    
    try {
      const response = await fetch('/api/memory/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryId, userId })
      })
      if (response.ok) {
        loadMemories()
      }
    } catch (error) {
      console.error('Error promoting memory:', error)
    }
  }

  const groupedMemories = {
    global: memories.filter(m => m.layer === 'global'),
    branch: memories.filter(m => m.layer === 'branch'),
    node: memories.filter(m => m.layer === 'node')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-xl z-50 flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold text-foreground">Memory Context</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Global Memories */}
                {groupedMemories.global.length > 0 && (
                  <div className="border border-border rounded-lg p-3">
                    <button
                      onClick={() => setExpandedLayer(expandedLayer === 'global' ? null : 'global')}
                      className="w-full flex items-center justify-between mb-2"
                    >
                      <span className="text-sm font-medium text-foreground">
                        Global ({groupedMemories.global.length})
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {expandedLayer === 'global' ? '▼' : '▶'}
                      </span>
                    </button>
                    <AnimatePresence>
                      {expandedLayer === 'global' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2"
                        >
                          {groupedMemories.global.map((memory) => (
                            <div
                              key={memory.id}
                              className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border/50"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p>{memory.content}</p>
                                {memory.topic && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-600 rounded flex-shrink-0">
                                    {memory.topic}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-xs opacity-60">
                                Relevance: {(memory.relevanceScore * 100).toFixed(0)}%
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Branch Memories */}
                {groupedMemories.branch.length > 0 && (
                  <div className="border border-border rounded-lg p-3">
                    <button
                      onClick={() => setExpandedLayer(expandedLayer === 'branch' ? null : 'branch')}
                      className="w-full flex items-center justify-between mb-2"
                    >
                      <span className="text-sm font-medium text-foreground">
                        Branch ({groupedMemories.branch.length})
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {expandedLayer === 'branch' ? '▼' : '▶'}
                      </span>
                    </button>
                    <AnimatePresence>
                      {expandedLayer === 'branch' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2"
                        >
                          {groupedMemories.branch.map((memory) => (
                            <div
                              key={memory.id}
                              className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border/50"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p>{memory.content}</p>
                                {userId && (
                                  <button
                                    onClick={() => promoteToGlobal(memory.id)}
                                    className="p-1 hover:bg-muted rounded transition-colors"
                                    title="Promote to global"
                                  >
                                    <ArrowUp className="w-3 h-3 text-muted-foreground" />
                                  </button>
                                )}
                              </div>
                              {memory.topic && (
                                <span className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded mt-1 inline-block">
                                  {memory.topic}
                                </span>
                              )}
                              <div className="mt-1 text-xs opacity-60">
                                Relevance: {(memory.relevanceScore * 100).toFixed(0)}%
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Node Memories */}
                {groupedMemories.node.length > 0 && (
                  <div className="border border-border rounded-lg p-3">
                    <button
                      onClick={() => setExpandedLayer(expandedLayer === 'node' ? null : 'node')}
                      className="w-full flex items-center justify-between mb-2"
                    >
                      <span className="text-sm font-medium text-foreground">
                        Context ({groupedMemories.node.length})
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {expandedLayer === 'node' ? '▼' : '▶'}
                      </span>
                    </button>
                    <AnimatePresence>
                      {expandedLayer === 'node' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2"
                        >
                          {groupedMemories.node.map((memory) => (
                            <div
                              key={memory.id}
                              className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border/50"
                            >
                              <p>{memory.content}</p>
                              <div className="mt-1 text-xs opacity-60">
                                Relevance: {(memory.relevanceScore * 100).toFixed(0)}%
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {memories.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No memories yet for this branch.</p>
                    <p className="text-xs mt-2">Memories will be extracted from AI responses.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border text-xs text-muted-foreground">
            <p>Total memories: {memories.length}</p>
            <p className="mt-1 opacity-60">
              Memories are automatically extracted and inherited from parent branches.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

