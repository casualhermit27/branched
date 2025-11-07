'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'

interface BranchSuggestion {
  id: string
  message: string
  suggestedModel: string
  reason: string
  confidence: number
}

interface AutoBranchSuggestionsProps {
  conversationId: string
  currentMessage: string
  availableModels: string[]
  onAccept?: (suggestion: BranchSuggestion) => void
  onDismiss?: (suggestionId: string) => void
}

export default function AutoBranchSuggestions({
  conversationId,
  currentMessage,
  availableModels,
  onAccept,
  onDismiss
}: AutoBranchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<BranchSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!currentMessage || currentMessage.length < 10) return

    // Auto-suggest logic: Check if message might benefit from multiple perspectives
    const shouldSuggest = checkIfShouldSuggest(currentMessage)
    
    if (shouldSuggest) {
      generateSuggestions()
    }
  }, [currentMessage])

  const checkIfShouldSuggest = (message: string): boolean => {
    // Simple heuristics - can be enhanced with AI
    const keywords = ['compare', 'different', 'alternative', 'perspective', 'opinion', 'debate']
    const lowerMessage = message.toLowerCase()
    return keywords.some(keyword => lowerMessage.includes(keyword))
  }

  const generateSuggestions = async () => {
    setIsLoading(true)
    
    try {
      // Call API to generate suggestions
      const response = await fetch('/api/branches/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: currentMessage,
          availableModels
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to generate suggestions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = (suggestion: BranchSuggestion) => {
    onAccept?.(suggestion)
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
  }

  const handleDismiss = (suggestionId: string) => {
    onDismiss?.(suggestionId)
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
  }

  if (suggestions.length === 0 && !isLoading) return null

  return (
    <AnimatePresence>
      {(suggestions.length > 0 || isLoading) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles size={20} className="text-purple-600" />
            </div>
            
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-2">Branch Suggestions</h4>
              
              {isLoading ? (
                <div className="text-sm text-gray-600">Analyzing conversation...</div>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start justify-between gap-3 p-3 bg-white rounded-lg border border-purple-100"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-purple-700">
                            Try {suggestion.suggestedModel}
                          </span>
                          <span className="text-xs text-gray-500">
                            {(suggestion.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{suggestion.reason}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleAccept(suggestion)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Accept
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDismiss(suggestion.id)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X size={14} className="text-gray-400" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

