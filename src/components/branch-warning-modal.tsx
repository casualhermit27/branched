'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Warning, X } from '@phosphor-icons/react'

interface BranchWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onCancel: () => void
  messageText?: string
  existingBranchesCount?: number
  isMultiBranch?: boolean
}

export function BranchWarningModal({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  messageText,
  existingBranchesCount = 0,
  isMultiBranch = false
}: BranchWarningModalProps) {
  if (!isOpen) return null

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
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4 mx-auto">
            <Warning className="w-6 h-6 text-amber-600 dark:text-amber-400" weight="fill" />
          </div>

          {/* Content */}
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              Branch Already Exists
            </h3>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isMultiBranch ? (
                <>
                  A branch already exists for this message. Creating {existingBranchesCount} more branches will add to your conversation tree.
                </>
              ) : (
                <>
                  A branch already exists for this message. This is a duplicate branch. Do you want to create another branch from this point?
                </>
              )}
            </p>

            {messageText && (
              <div className="p-3 bg-muted rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Message:</p>
                <p className="text-sm text-foreground line-clamp-2">
                  {messageText}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 rounded-lg bg-muted hover:bg-accent text-foreground font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                Create {isMultiBranch ? 'Branches' : 'Branch'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

