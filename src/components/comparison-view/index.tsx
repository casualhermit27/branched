import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, ArrowDownTrayIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { ReactFlowNode } from '@/components/flow-canvas/types'
import { IBranch, IMessage } from '@/models/conversation'

interface ComparisonViewProps {
    branches: ReactFlowNode[]
    onClose: () => void
    initialSelectedBranchIds?: string[]
    className?: string
}

export function ComparisonView({ branches, onClose, className = '', initialSelectedBranchIds = [] }: ComparisonViewProps) {
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(initialSelectedBranchIds)

    // Initialize with first 2 branches if available
    useEffect(() => {
        if (branches.length >= 2 && selectedBranchIds.length === 0) {
            // Filter out main node if possible, or just take first 2
            const validBranches = branches.filter(b => b.id !== 'main')
            if (validBranches.length >= 2) {
                setSelectedBranchIds([validBranches[0].id, validBranches[1].id])
            } else if (branches.length >= 2) {
                setSelectedBranchIds([branches[0].id, branches[1].id])
            }
        }
    }, [branches])

    const toggleBranchSelection = (branchId: string) => {
        if (selectedBranchIds.includes(branchId)) {
            setSelectedBranchIds(prev => prev.filter(id => id !== branchId))
        } else {
            if (selectedBranchIds.length < 3) {
                setSelectedBranchIds(prev => [...prev, branchId])
            } else {
                // Replace the last one if limit reached
                setSelectedBranchIds(prev => [...prev.slice(0, 2), branchId])
            }
        }
    }

    const getBranchData = (branchId: string) => {
        const node = branches.find(b => b.id === branchId)
        if (!node) return null
        return node.data
    }

    const handleExport = () => {
        // TODO: Implement export logic
        console.log('Exporting comparison...')
    }

    return (
        <div className={`flex flex-col h-full bg-white dark:bg-neutral-900 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <ArrowsRightLeftIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Model Comparison</h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Compare responses side-by-side ({selectedBranchIds.length}/3 selected)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export Report
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Sidebar - Branch Selection */}
                <div className="w-64 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto p-4 bg-neutral-50 dark:bg-neutral-900/50">
                    <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Select Branches</h3>
                    <div className="space-y-2">
                        {branches.map(branch => {
                            const isSelected = selectedBranchIds.includes(branch.id)
                            const data = branch.data
                            return (
                                <button
                                    key={branch.id}
                                    onClick={() => toggleBranchSelection(branch.id)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${isSelected
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500'
                                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 bg-white dark:bg-neutral-800'
                                        }`}
                                >
                                    <div className="font-medium text-sm text-neutral-900 dark:text-white truncate">
                                        {data?.label || 'Untitled Branch'}
                                    </div>
                                    <div className="text-xs text-neutral-500 mt-1 flex items-center gap-2">
                                        <span>{data?.messages?.length || 0} msgs</span>
                                        {data?.selectedAIs && data.selectedAIs.length > 0 && (
                                            <span className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded text-[10px]">
                                                {data.selectedAIs[0].name}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Comparison Grid */}
                <div className="flex-1 overflow-x-auto">
                    <div className="h-full flex min-w-full">
                        {selectedBranchIds.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
                                <ArrowsRightLeftIcon className="w-12 h-12 mb-4 opacity-50" />
                                <p>Select branches from the sidebar to compare</p>
                            </div>
                        ) : (
                            selectedBranchIds.map(branchId => {
                                const data = getBranchData(branchId)
                                if (!data) return null

                                return (
                                    <div
                                        key={branchId}
                                        className="flex-1 min-w-[350px] border-r border-neutral-200 dark:border-neutral-800 flex flex-col h-full bg-white dark:bg-neutral-900"
                                    >
                                        {/* Column Header */}
                                        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                                            <h3 className="font-semibold text-neutral-900 dark:text-white truncate" title={data.label}>
                                                {data.label}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
                                                {data.selectedAIs?.map((ai: any) => (
                                                    <span key={ai.id} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full shadow-sm">
                                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ai.color?.split(' ')[0]?.replace('text-', '') || '#6366F1' }} />
                                                        {ai.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Messages Scroll Area */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                            {data.messages?.map((msg: IMessage) => (
                                                <div
                                                    key={msg.id}
                                                    className={`p-3 rounded-lg text-sm ${msg.isUser
                                                        ? 'bg-neutral-100 dark:bg-neutral-800 ml-8'
                                                        : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 mr-8'
                                                        }`}
                                                >
                                                    <div className="font-medium text-xs text-neutral-500 mb-1">
                                                        {msg.isUser ? 'You' : (msg.aiModel || 'AI')}
                                                    </div>
                                                    <div className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-200 leading-relaxed">
                                                        {msg.text}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Metrics Footer (Mock) */}
                                        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-500 flex justify-between">
                                            <span>{data.messages?.length || 0} messages</span>
                                            <span>~{(data.messages?.reduce((acc: number, m: any) => acc + (m.text?.length || 0), 0) || 0) / 4} tokens</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
