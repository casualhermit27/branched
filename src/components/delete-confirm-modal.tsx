'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Warning, X, Trash } from '@phosphor-icons/react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onCancel?: () => void
  title?: string
  message?: string
  itemName?: string
  itemType?: 'branch' | 'conversation' | 'item'
  destructive?: boolean
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  itemName,
  itemType = 'item',
  destructive = true
}: DeleteConfirmModalProps) {
  if (!isOpen) return null

  const handleCancel = () => {
    onCancel?.()
    onClose()
  }

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const defaultTitle = title || `Delete ${itemType === 'branch' ? 'Branch' : itemType === 'conversation' ? 'Conversation' : 'Item'}?`
  const defaultMessage = message || `Are you sure you want to delete this ${itemType}? This action cannot be undone.`

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCancel}
          className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-card dark:bg-card border border-border dark:border-border/60 rounded-2xl shadow-2xl max-w-md w-full p-6 z-10"
        >
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-muted dark:hover:bg-muted/80 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground dark:text-muted-foreground/80" />
          </button>

          {/* Icon */}
          <div className={`flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto ${
            destructive 
              ? 'bg-destructive/10 dark:bg-destructive/20' 
              : 'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            {destructive ? (
              <Trash className={`w-6 h-6 ${destructive ? 'text-destructive dark:text-destructive' : 'text-amber-600 dark:text-amber-400'}`} weight="fill" />
            ) : (
              <Warning className="w-6 h-6 text-amber-600 dark:text-amber-400" weight="fill" />
            )}
          </div>

          {/* Content */}
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold text-foreground dark:text-foreground">
              {defaultTitle}
            </h3>
            
            <p className="text-sm text-muted-foreground dark:text-muted-foreground/80 leading-relaxed">
              {defaultMessage}
            </p>

            {itemName && (
              <div className="p-3 bg-muted/50 dark:bg-muted/30 rounded-lg border border-border/60 dark:border-border/40">
                <p className="text-xs text-muted-foreground dark:text-muted-foreground/70 mb-1">Name:</p>
                <p className="text-sm font-medium text-foreground dark:text-foreground line-clamp-2">
                  {itemName}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 rounded-lg bg-muted dark:bg-muted/80 hover:bg-muted/80 dark:hover:bg-muted text-foreground dark:text-foreground font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  destructive
                    ? 'bg-destructive hover:bg-destructive/90 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Delete
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

