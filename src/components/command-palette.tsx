'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Command {
  id: string
  title: string
  description?: string
  icon?: React.ReactNode
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  commands: Command[]
  isOpen: boolean
  onClose: () => void
}

export const CommandPalette = ({ commands, isOpen, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredCommands = commands.filter(command => {
    const searchText = `${command.title} ${command.description || ''} ${command.keywords?.join(' ') || ''}`.toLowerCase()
    return searchText.includes(query.toLowerCase())
  })

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-lg mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search commands..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <XMarkIcon className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Commands List */}
            <div className="max-h-80 overflow-y-auto">
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No commands found
                </div>
              ) : (
                filteredCommands.map((command, index) => (
                  <button
                    key={command.id}
                    onClick={() => {
                      command.action()
                      onClose()
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 ${
                      index === selectedIndex ? 'bg-gray-50 dark:bg-gray-700' : ''
                    }`}
                  >
                    {command.icon && (
                      <div className="flex-shrink-0 text-gray-400">
                        {command.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {command.title}
                      </div>
                      {command.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {command.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center justify-between">
                <span>↑↓ to navigate</span>
                <span>Enter to select</span>
                <span>Esc to close</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
