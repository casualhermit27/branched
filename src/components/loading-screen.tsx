'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Check } from '@phosphor-icons/react'

const steps = [
    "Initializing environment",
    "Loading local history",
    "Syncing branches",
    "Preparing layout"
]

interface LoadingScreenProps {
    statusText?: string
    currentStepIndex?: number
}

export function LoadingScreen({ statusText, currentStepIndex }: LoadingScreenProps) {
    const [localStep, setLocalStep] = useState(0)

    // Use prop if provided, otherwise local state
    const displayStep = currentStepIndex !== undefined ? currentStepIndex : localStep

    useEffect(() => {
        // Only run auto-advance if no manual step provided
        if (currentStepIndex === undefined) {
            const interval = setInterval(() => {
                setLocalStep(prev => (prev < steps.length - 1 ? prev + 1 : prev))
            }, 600)
            return () => clearInterval(interval)
        }
    }, [currentStepIndex])

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background w-full absolute inset-0 z-50">
            <div className="flex flex-col items-start gap-3 min-w-[200px]">
                {steps.map((step, index) => {
                    const isComplete = index < displayStep
                    const isCurrent = index === displayStep
                    const isPending = index > displayStep

                    return (
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.1 }}
                            className="flex items-center gap-3"
                        >
                            <div className="w-4 flex justify-center">
                                {isComplete ? (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    >
                                        <Check className="w-3.5 h-3.5 text-green-500" weight="bold" />
                                    </motion.div>
                                ) : isCurrent ? (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-1.5 h-1.5 bg-foreground rounded-full animate-pulse"
                                    />
                                ) : (
                                    <div className="w-1.5 h-1.5 bg-muted-foreground/20 rounded-full" />
                                )}
                            </div>
                            <span className={`text-sm font-medium transition-colors duration-300 ${isComplete ? 'text-muted-foreground' :
                                isCurrent ? 'text-foreground' :
                                    'text-muted-foreground/30'
                                }`}>
                                {isCurrent && statusText ? statusText : step + (isCurrent ? '...' : '')}
                            </span>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
