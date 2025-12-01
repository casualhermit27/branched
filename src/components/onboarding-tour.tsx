import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { PlayCircle } from '@phosphor-icons/react'

const VideoPlaceholder = ({ name }: { name: string }) => {
    return (
        <div className="w-full aspect-video bg-muted/30 dark:bg-muted/10 rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-3 group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
            <div className="w-16 h-16 rounded-full bg-background/80 backdrop-blur-sm shadow-sm flex items-center justify-center z-10">
                <PlayCircle className="w-8 h-8 text-primary/80" weight="fill" />
            </div>
            <p className="text-xs text-muted-foreground font-mono z-10">Insert Video: {name}</p>
        </div>
    )
}

interface Step {
    title: string
    description: string
    image: React.ReactNode
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
            description: "Experience a new way to collaborate with AI. Branch conversations, compare models, and visualize your thoughts in a powerful canvas.",
            image: <VideoPlaceholder name="welcome_tour.mp4" />
        },
        {
            title: "Branching Conversations",
            description: "Don't just chat linearly. Click the 'Branch' button on any message to explore different directions without losing context.",
            image: <VideoPlaceholder name="branching_demo.mp4" />
        },
        {
            title: "Multi-Model Comparison",
            description: "Select multiple AI models (Gemini, Mistral, OpenAI, etc.) to see how they answer the same prompt differently side-by-side.",
            image: <VideoPlaceholder name="comparison_demo.mp4" />
        },
        {
            title: "Visual Flow Canvas",
            description: "Switch to Map View to see your entire conversation tree. Zoom, pan, and organize your ideas visually.",
            image: <VideoPlaceholder name="canvas_nav.mp4" />
        },
        {
            title: "Bring Your Own Key (BYOK)",
            description: "Use your own API keys for OpenAI, Anthropic, Google, and more. Click the Settings (Gear) icon in the top bar to manage your keys securely.",
            image: <VideoPlaceholder name="settings_byok.mp4" />
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
                    className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors z-10"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>

                    <div className="p-8 flex flex-col items-center text-center">
                        <div className="w-full mb-8">
                            {steps[currentStep].image}
                        </div>

                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col items-center"
                        >
                            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
                                {steps[currentStep].title}
                            </h2>
                            <p className="text-neutral-600 dark:text-neutral-400 mb-8 leading-relaxed text-sm">
                                {steps[currentStep].description}
                            </p>
                        </motion.div>

                        <div className="flex items-center justify-between w-full mt-auto">
                            <div className="flex gap-1.5">
                                {steps.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep
                                            ? 'bg-indigo-600 w-6'
                                            : 'bg-neutral-200 dark:bg-neutral-700 w-1.5'
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
