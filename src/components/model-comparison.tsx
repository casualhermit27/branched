'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, TrendingUp, Zap, ThumbsUp, ThumbsDown } from 'lucide-react'

interface BranchComparison {
  branchId: string
  label: string
  model: string
  confidenceScore?: number
  reasoningScore?: number
  latency?: number
  tokensUsed?: number
  cost?: number
  upvotes?: number
  downvotes?: number
  messages: any[]
}

interface ModelComparisonProps {
  branches: BranchComparison[]
  onPromote?: (branchId: string) => void
  onUpvote?: (branchId: string) => void
  onDownvote?: (branchId: string) => void
  conversationId: string
}

export default function ModelComparison({
  branches,
  onPromote,
  onUpvote,
  onDownvote,
  conversationId
}: ModelComparisonProps) {
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)

  if (branches.length === 0) return null

  // Sort by confidence score (highest first)
  const sortedBranches = [...branches].sort((a, b) => 
    (b.confidenceScore || 0) - (a.confidenceScore || 0)
  )

  const bestBranch = sortedBranches[0]

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Model Comparison</h3>
        <span className="text-sm text-gray-500">{branches.length} responses</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedBranches.map((branch, index) => {
          const isBest = index === 0
          const confidence = branch.confidenceScore || 0
          const reasoning = branch.reasoningScore || 0
          const netVotes = (branch.upvotes || 0) - (branch.downvotes || 0)

          return (
            <motion.div
              key={branch.branchId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-white rounded-xl border-2 p-4 transition-all duration-200 ${
                isBest 
                  ? 'border-purple-500 shadow-lg' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {isBest && (
                <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Star size={12} fill="currentColor" />
                  Best
                </div>
              )}

              <div className="space-y-3">
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900">{branch.model}</span>
                    <span className="text-xs text-gray-500">{branch.label}</span>
                  </div>
                </div>

                {/* Scores */}
                <div className="space-y-2">
                  {confidence > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Confidence</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 transition-all duration-300"
                            style={{ width: `${confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {(confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {reasoning > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Reasoning</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${reasoning * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {(reasoning * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {branch.latency && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <Zap size={12} />
                      <span>{(branch.latency / 1000).toFixed(1)}s</span>
                    </div>
                  )}
                  {branch.tokensUsed && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <TrendingUp size={12} />
                      <span>{branch.tokensUsed.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onPromote?.(branch.branchId)}
                    className="flex-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    Promote
                  </motion.button>
                  
                  <div className="flex items-center gap-1">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onUpvote?.(branch.branchId)}
                      className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                    >
                      <ThumbsUp size={14} className={netVotes > 0 ? 'text-green-600' : 'text-gray-400'} />
                    </motion.button>
                    <span className="text-xs text-gray-600 min-w-[20px] text-center">
                      {netVotes > 0 ? '+' : ''}{netVotes}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onDownvote?.(branch.branchId)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <ThumbsDown size={14} className={netVotes < 0 ? 'text-red-600' : 'text-gray-400'} />
                    </motion.button>
                  </div>
                </div>

                {/* Preview */}
                {branch.messages.length > 0 && (
                  <div 
                    className="text-xs text-gray-600 line-clamp-2 cursor-pointer hover:text-gray-900 transition-colors"
                    onClick={() => setSelectedBranch(selectedBranch === branch.branchId ? null : branch.branchId)}
                  >
                    {branch.messages[branch.messages.length - 1]?.text?.substring(0, 100)}...
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Expanded View */}
      <AnimatePresence>
        {selectedBranch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200"
          >
            {branches.find(b => b.branchId === selectedBranch)?.messages.map((msg: any) => (
              <div key={msg.id} className="mb-3 last:mb-0">
                <div className={`text-sm ${msg.isUser ? 'text-blue-600' : 'text-gray-700'}`}>
                  <span className="font-medium">{msg.isUser ? 'You' : 'AI'}: </span>
                  {msg.text}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

