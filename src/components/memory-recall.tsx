'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brain, X } from 'lucide-react'

interface MemoryRecallProps {
  conversationId: string
  query: string
  onMemorySelected?: (memoryId: string) => void
}

export default function MemoryRecall({ 
  conversationId, 
  query,
  onMemorySelected 
}: MemoryRecallProps) {
  const [memories, setMemories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showContext, setShowContext] = useState(false)

  useEffect(() => {
    if (query && query.length > 3) {
      fetchMemories(query)
    } else {
      setMemories([])
    }
  }, [query, conversationId])

  const fetchMemories = async (searchQuery: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/memory?conversationId=${conversationId}&query=${encodeURIComponent(searchQuery)}&limit=5`
      )
      if (response.ok) {
        const data = await response.json()
        setMemories(data.memories || [])
      }
    } catch (error) {
      console.error('Failed to fetch memories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (memories.length === 0 && !isLoading) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200"
    >
      <div className="flex items-center gap-2 mb-2">
        <Brain size={16} className="text-blue-600" />
        <span className="text-sm font-medium text-blue-900">Context Used</span>
        <button
          onClick={() => setShowContext(!showContext)}
          className="ml-auto text-xs text-blue-600 hover:text-blue-800"
        >
          {showContext ? 'Hide' : 'Show'} ({memories.length})
        </button>
      </div>

      {showContext && (
        <div className="space-y-2 mt-2">
          {isLoading ? (
            <div className="text-xs text-gray-600">Loading memories...</div>
          ) : (
            memories.map((memory) => (
              <motion.div
                key={memory._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-2 bg-white rounded border border-blue-100 text-xs text-gray-700 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => onMemorySelected?.(memory._id)}
              >
                <div className="font-medium text-gray-900 mb-1">{memory.fact}</div>
                {memory.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {memory.tags.map((tag: string) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}
    </motion.div>
  )
}

