'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, X } from '@phosphor-icons/react'

export type LinkType = 'merge' | 'reference' | 'continuation' | 'alternative'

interface BranchLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (params: {
    sourceBranchId: string
    targetBranchId: string
    linkType: LinkType
    description?: string
    weight?: number
  }) => void
  sourceBranchId: string
  availableBranches: Array<{ id: string; label: string }>
  linkTypes?: Array<{ value: LinkType; label: string; description: string }>
}

const defaultLinkTypes: Array<{ value: LinkType; label: string; description: string }> = [
  {
    value: 'reference',
    label: 'Reference',
    description: 'This branch references the other for context'
  },
  {
    value: 'continuation',
    label: 'Continuation',
    description: 'This branch continues from the other branch'
  },
  {
    value: 'merge',
    label: 'Merge',
    description: 'These branches should be merged together'
  },
  {
    value: 'alternative',
    label: 'Alternative',
    description: 'These branches explore alternative approaches'
  }
]

export function BranchLinkModal({
  isOpen,
  onClose,
  onConfirm,
  sourceBranchId,
  availableBranches,
  linkTypes = defaultLinkTypes
}: BranchLinkModalProps) {
  const [targetBranchId, setTargetBranchId] = useState('')
  const [linkType, setLinkType] = useState<LinkType>('reference')
  const [description, setDescription] = useState('')
  const [weight, setWeight] = useState(0.5)

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!targetBranchId) {
      alert('Please select a target branch')
      return
    }

    onConfirm({
      sourceBranchId,
      targetBranchId,
      linkType,
      description: description.trim() || undefined,
      weight
    })

    // Reset form
    setTargetBranchId('')
    setLinkType('reference')
    setDescription('')
    setWeight(0.5)
  }

  const filteredBranches = availableBranches.filter(b => b.id !== sourceBranchId)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 z-10"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4 mx-auto">
            <Link className="w-6 h-6 text-blue-600 dark:text-blue-400" weight="fill" />
          </div>

          {/* Content */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-foreground text-center">
              Create Branch Link
            </h3>

            {/* Target Branch Selector */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Link to Branch
              </label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a branch...</option>
                {filteredBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Link Type Selector */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Link Type
              </label>
              <div className="space-y-2">
                {linkTypes.map((type) => (
                  <label
                    key={type.value}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="linkType"
                      value={type.value}
                      checked={linkType === type.value}
                      onChange={(e) => setLinkType(e.target.value as LinkType)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a note about this link..."
                rows={3}
                className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Weight Slider */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Context Importance: {(weight * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg bg-muted hover:bg-accent text-foreground font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                Create Link
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

