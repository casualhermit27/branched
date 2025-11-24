import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline'

interface Step {
    title: string
    description: string
    target?: string // CSS selector for highlighting (optional for MVP)
    image?: React.ReactNode
}

interface OnboardingTourProps {
    isOpen: boolean
    onClose: () => void
    onComplete: () => void
}

export function OnboardingTour({ isOpen, onClose, onComplete }: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(0)

    const steps: Step[] = [
        {
            title: "Welcome to Multi-AI Conversations",
            description: "Experience a new way to collaborate with AI. Branch conversations, compare models, and visualize your thoughts.",
            image: <div className="text-6xl">👋</div>
        },
        {
            title: "Branching Conversations",
            description: "Don't just chat linearly. Click the 'Branch' button on any message to explore different directions without losing context.",
            image: <div className="text-6xl">🌿</div>
        },
        {
            title: "Multi-Model Comparison",
            description: "Select multiple AI models (Gemini, Mistral, etc.) to see how they answer the same prompt differently side-by-side.",
            image: <div className="text-6xl">🤖</div>
        },
        {
            title: "Visual Flow Canvas",
            description: "Switch to Map View to see your entire conversation tree. Zoom, pan, and organize your ideas visually.",
            image: <div className="text-6xl">🗺️</div>
        }
    ]

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1)
        } else {
            onComplete()
        }
    }

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors z-10"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>

                    <div className="p-8 flex flex-col items-center text-center">
                        <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-400">
                            {steps[currentStep].image}
                        </div>

                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
                            {steps[currentStep].title}
                        </h2>
                        <p className="text-neutral-600 dark:text-neutral-400 mb-8 leading-relaxed">
                            {steps[currentStep].description}
                        </p>

                        <div className="flex items-center justify-between w-full">
                            <div className="flex gap-1">
                                {steps.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`w-2 h-2 rounded-full transition-all ${idx === currentStep
                                                ? 'bg-indigo-600 w-6'
                                                : 'bg-neutral-200 dark:bg-neutral-700'
                                            }`}
                                    />
                                ))}
                            </div>

                            <div className="flex gap-3">
                                {currentStep > 0 && (
                                    <button
                                        onClick={handlePrev}
                                        className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                    >
                                        Back
                                    </button>
                                )}
                                <button
                                    onClick={handleNext}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2"
                                >
                                    {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                                    {currentStep < steps.length - 1 && <ChevronRightIcon className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
