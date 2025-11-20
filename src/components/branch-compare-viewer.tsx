'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, FileArrowDown, Sparkle } from '@phosphor-icons/react'
import type { ComparisonResult, MessageDifference } from '@/services/branch-comparator'

interface BranchCompareViewerProps {
  isOpen: boolean
  onClose: () => void
  comparison: ComparisonResult | null
  onExport?: (format: 'markdown' | 'pdf') => void
  onGenerateSummary?: () => Promise<string>
}

export function BranchCompareViewer({
  isOpen,
  onClose,
  comparison,
  onExport,
  onGenerateSummary
}: BranchCompareViewerProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [selectedDiff, setSelectedDiff] = useState<MessageDifference | null>(null)

  useEffect(() => {
    if (comparison?.summary) {
      setSummary(comparison.summary)
    }
  }, [comparison])

  const handleGenerateSummary = async () => {
    if (!onGenerateSummary) return
    setLoadingSummary(true)
    try {
      const generatedSummary = await onGenerateSummary()
      setSummary(generatedSummary)
    } catch (error) {
      console.error('Error generating summary:', error)
    } finally {
      setLoadingSummary(false)
    }
  }

  if (!isOpen || !comparison) return null

  const getDiffColor = (type: string) => {
    switch (type) {
      case 'added':
        return 'bg-green-500/20 border-green-500/50'
      case 'removed':
        return 'bg-red-500/20 border-red-500/50'
      case 'modified':
        return 'bg-yellow-500/20 border-yellow-500/50'
      default:
        return 'bg-muted border-border'
    }
  }

  const renderTextDiff = (textDiff: any[]) => {
    return textDiff.map((part, index) => {
      const color = part.added
        ? 'bg-green-500/30 text-green-700 dark:text-green-400'
        : part.removed
        ? 'bg-red-500/30 text-red-700 dark:text-red-400'
        : 'bg-transparent'
      return (
        <span key={index} className={color}>
          {part.value}
        </span>
      )
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Branch Comparison</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Similarity: {(comparison.similarity * 100).toFixed(0)}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onExport && (
              <>
                <button
                  onClick={() => onExport('markdown')}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-accent text-foreground font-medium transition-colors flex items-center gap-2"
                >
                  <FileArrowDown className="w-4 h-4" />
                  Export
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Branch 1 */}
            <div className="space-y-4">
              <div className="sticky top-0 bg-card border-b border-border pb-2 mb-4">
                <h3 className="text-lg font-semibold text-foreground">Branch 1</h3>
                <p className="text-sm text-muted-foreground">
                  {comparison.branch1Messages.length} messages
                </p>
              </div>
              <div className="space-y-3">
                {comparison.differences.map((diff, index) => {
                  if (diff.type === 'removed' || diff.type === 'unchanged' || diff.type === 'modified') {
                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${getDiffColor(diff.type)} cursor-pointer hover:opacity-80 transition-opacity`}
                        onClick={() => setSelectedDiff(diff)}
                      >
                        <div className="text-xs font-medium mb-2 uppercase text-muted-foreground">
                          {diff.type}
                        </div>
                        <div className="text-sm text-foreground whitespace-pre-wrap">
                          {diff.branch1Message?.text || ''}
                        </div>
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            </div>

            {/* Branch 2 */}
            <div className="space-y-4">
              <div className="sticky top-0 bg-card border-b border-border pb-2 mb-4">
                <h3 className="text-lg font-semibold text-foreground">Branch 2</h3>
                <p className="text-sm text-muted-foreground">
                  {comparison.branch2Messages.length} messages
                </p>
              </div>
              <div className="space-y-3">
                {comparison.differences.map((diff, index) => {
                  if (diff.type === 'added' || diff.type === 'unchanged' || diff.type === 'modified') {
                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${getDiffColor(diff.type)} cursor-pointer hover:opacity-80 transition-opacity`}
                        onClick={() => setSelectedDiff(diff)}
                      >
                        <div className="text-xs font-medium mb-2 uppercase text-muted-foreground">
                          {diff.type}
                        </div>
                        <div className="text-sm text-foreground whitespace-pre-wrap">
                          {diff.branch2Message?.text || ''}
                        </div>
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            </div>
          </div>

          {/* Selected Diff Detail */}
          {selectedDiff && selectedDiff.type === 'modified' && selectedDiff.textDiff && (
            <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
              <h4 className="font-semibold text-foreground mb-2">Text Differences</h4>
              <div className="p-3 bg-background rounded border border-border font-mono text-sm">
                {renderTextDiff(selectedDiff.textDiff)}
              </div>
              {selectedDiff.similarity !== undefined && (
                <p className="text-xs text-muted-foreground mt-2">
                  Similarity: {(selectedDiff.similarity * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}

          {/* Summary Section */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Sparkle className="w-4 h-4" />
                AI Summary
              </h4>
              {!summary && onGenerateSummary && (
                <button
                  onClick={handleGenerateSummary}
                  disabled={loadingSummary}
                  className="px-3 py-1 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {loadingSummary ? 'Generating...' : 'Generate'}
                </button>
              )}
            </div>
            {summary ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click "Generate" to get an AI-powered summary of the differences.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

