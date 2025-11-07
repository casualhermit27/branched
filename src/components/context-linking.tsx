'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, X, Plus } from 'lucide-react'

interface ContextLinkingProps {
  branchId: string
  availableBranches: Array<{ id: string; label: string }>
  currentLinks?: string[]
  onLink?: (targetBranchId: string) => void
  onUnlink?: (targetBranchId: string) => void
}

export default function ContextLinking({
  branchId,
  availableBranches,
  currentLinks = [],
  onLink,
  onUnlink
}: ContextLinkingProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showLinkMenu, setShowLinkMenu] = useState(false)

  const linkedBranches = availableBranches.filter(b => currentLinks.includes(b.id))
  const unlinkedBranches = availableBranches.filter(b => 
    b.id !== branchId && !currentLinks.includes(b.id)
  )

  const handleLink = (targetBranchId: string) => {
    onLink?.(targetBranchId)
    setShowLinkMenu(false)
  }

  const handleUnlink = (targetBranchId: string) => {
    onUnlink?.(targetBranchId)
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg transition-colors ${
          currentLinks.length > 0 
            ? 'bg-purple-50 text-purple-600' 
            : 'hover:bg-gray-100 text-gray-600'
        }`}
        title="Context Links"
      >
        <Link2 size={16} />
        {currentLinks.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {currentLinks.length}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Context Links</h4>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Linked Branches */}
            {linkedBranches.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Linked Branches</p>
                <div className="space-y-1">
                  {linkedBranches.map(branch => (
                    <div
                      key={branch.id}
                      className="flex items-center justify-between p-2 bg-purple-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-700 truncate flex-1">{branch.label}</span>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleUnlink(branch.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                      >
                        <X size={12} className="text-red-600" />
                      </motion.button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Link */}
            {unlinkedBranches.length > 0 && (
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowLinkMenu(!showLinkMenu)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Plus size={14} className="text-gray-600" />
                  <span className="text-sm text-gray-700">Link Branch</span>
                </motion.button>

                <AnimatePresence>
                  {showLinkMenu && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 space-y-1 max-h-48 overflow-y-auto"
                    >
                      {unlinkedBranches.map(branch => (
                        <motion.button
                          key={branch.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleLink(branch.id)}
                          className="w-full text-left p-2 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <span className="text-sm text-gray-700">{branch.label}</span>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {linkedBranches.length === 0 && unlinkedBranches.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">
                No other branches available
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

