'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitMerge, X, Spinner, Sparkle } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'

interface SynthesizeResult {
    success: boolean
    synthesizedText: string
    model: string
    sourceBranchIds: string[]
}

interface SynthesizeModalProps {
    isOpen: boolean
    onClose: () => void
    selectedNodes: {
        id: string
        label: string
        messages: { id: string; text: string; isUser: boolean }[]
    }[]
    onSynthesize: (result: SynthesizeResult) => void
}

export function SynthesizeModal({
    isOpen,
    onClose,
    selectedNodes,
    onSynthesize
}: SynthesizeModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSynthesize = async () => {
        setIsLoading(true)
        setError(null)
        setResult(null)

        try {
            // Get the last AI message from each selected node
            const responses = selectedNodes.map(node => {
                const aiMessages = node.messages.filter(m => !m.isUser)
                const lastAiMessage = aiMessages[aiMessages.length - 1]
                return {
                    nodeId: node.id,
                    nodeLabel: node.label,
                    text: lastAiMessage?.text || 'No response'
                }
            })

            // Build synthesis prompt
            const synthesisPrompt = `You are a synthesis expert. Your task is to analyze multiple AI responses and create a single, comprehensive "Best of" response that:

1. **Finds Consensus**: Identify points where all responses agree
2. **Resolves Conflicts**: When responses disagree, use reasoning to determine the most accurate answer
3. **Combines Strengths**: Take the best elements from each response
4. **Maintains Quality**: Ensure the final response is well-structured and clear

Here are the ${responses.length} responses to synthesize:

${responses.map((r, i) => `---\n**Response ${i + 1} (from ${r.nodeLabel}):**\n${r.text}\n`).join('\n')}

---

Now synthesize these responses into a single, comprehensive answer. Structure your response clearly and note any key differences you resolved.`

            // Call the chat API with synthesis prompt
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o', // Use high-reasoning model for synthesis
                    messages: [
                        {
                            role: 'user',
                            content: synthesisPrompt
                        }
                    ],
                    stream: false // No streaming for synthesis
                })
            })

            if (!response.ok) {
                throw new Error('Failed to synthesize responses')
            }

            const data = await response.json()
            const synthesizedText = data.content || data.text || data.message || ''

            setResult(synthesizedText)

            // Return the result to parent
            onSynthesize({
                success: true,
                synthesizedText,
                model: 'gpt-4o',
                sourceBranchIds: selectedNodes.map(n => n.id)
            })

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Synthesis failed')
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <GitMerge className="w-5 h-5 text-amber-500" weight="bold" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Synthesize Responses</h2>
                                <p className="text-sm text-muted-foreground">
                                    Merging {selectedNodes.length} responses into a unified answer
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Source Nodes */}
                        <div>
                            <h3 className="text-sm font-medium text-foreground mb-3">Source Branches</h3>
                            <div className="flex flex-wrap gap-2">
                                {selectedNodes.map(node => (
                                    <div
                                        key={node.id}
                                        className="px-3 py-1.5 bg-muted rounded-lg text-sm text-foreground border border-border/50"
                                    >
                                        {node.label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Preview of responses */}
                        {!result && (
                            <div>
                                <h3 className="text-sm font-medium text-foreground mb-3">Responses to Synthesize</h3>
                                <div className="space-y-3">
                                    {selectedNodes.map(node => {
                                        const aiMessages = node.messages.filter(m => !m.isUser)
                                        const lastAiMessage = aiMessages[aiMessages.length - 1]
                                        return (
                                            <div
                                                key={node.id}
                                                className="p-4 bg-muted/50 rounded-xl border border-border/30"
                                            >
                                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                                    {node.label}
                                                </div>
                                                <p className="text-sm text-foreground line-clamp-3">
                                                    {lastAiMessage?.text || 'No response available'}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Error state */}
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Loading state */}
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                                    <Sparkle className="w-6 h-6 text-amber-500 animate-pulse" weight="fill" />
                                </div>
                                <p className="text-sm font-medium text-foreground">Synthesizing responses...</p>
                                <p className="text-xs text-muted-foreground mt-1">Finding consensus and resolving conflicts</p>
                            </div>
                        )}

                        {/* Result */}
                        {result && !isLoading && (
                            <div>
                                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                                    <GitMerge className="w-4 h-4 text-amber-500" />
                                    Synthesized Response
                                </h3>
                                <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl border-2 border-amber-300 dark:border-amber-700">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown>{result}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-border flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Cancel
                        </button>
                        {!result ? (
                            <button
                                onClick={handleSynthesize}
                                disabled={isLoading || selectedNodes.length < 2}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner className="w-4 h-4 animate-spin" />
                                        <span>Synthesizing...</span>
                                    </>
                                ) : (
                                    <>
                                        <GitMerge className="w-4 h-4" />
                                        <span>Synthesize</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={onClose}
                                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
                            >
                                Done
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
