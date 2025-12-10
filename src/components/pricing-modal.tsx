import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, CheckIcon, StarIcon } from '@heroicons/react/24/outline'
import { SparklesIcon } from '@heroicons/react/24/solid'

interface PricingModalProps {
    isOpen: boolean
    onClose: () => void
    currentPlan?: 'free' | 'pro' | 'team'
}

export function PricingModal({ isOpen, onClose, currentPlan = 'free' }: PricingModalProps) {
    if (!isOpen) return null

    const tiers = [
        {
            id: 'free',
            name: 'Free',
            price: '$0',
            period: '/month',
            description: 'Perfect for exploring AI conversations.',
            features: [
                '50 messages per month',
                'Access to 2 AI models',
                'Basic branching (3 branches)',
                'Community support'
            ],
            cta: 'Current Plan',
            popular: false
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '$19.99',
            period: '/month',
            description: 'For professionals who need power.',
            features: [
                '1,000,000 Credits per month',
                'Access to ALL AI models',
                'Unlimited branching',
                'Comparison Dashboard',
                'Priority support'
            ],
            cta: 'Upgrade to Pro',
            popular: true
        },
        {
            id: 'team',
            name: 'Team',
            price: '$99',
            period: '/user/mo',
            description: 'Collaborate with your entire team.',
            features: [
                'Everything in Pro',
                'Team workspaces',
                'Shared conversation links',
                'Centralized billing',
                'SSO & Security'
            ],
            cta: 'Contact Sales',
            popular: false
        }
    ]

    const handleSubscribe = (tierId: string) => {
        if (tierId === 'free') return
        // Mock subscription flow
        alert(`This is a demo! In production, this would open Stripe Checkout for the ${tierId.toUpperCase()} plan.`)
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-5xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-8 text-center border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>

                        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3">
                            Unlock the Full Power of AI
                        </h2>
                        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
                            Choose the plan that fits your workflow. Upgrade to Pro for unlimited access to all models and advanced features.
                        </p>
                    </div>

                    {/* Tiers */}
                    <div className="flex-1 overflow-y-auto p-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {tiers.map((tier) => (
                                <div
                                    key={tier.id}
                                    className={`relative flex flex-col p-6 rounded-2xl border-2 transition-all ${tier.popular
                                        ? 'border-indigo-500 bg-white dark:bg-neutral-800 shadow-xl scale-105 z-10'
                                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'
                                        }`}
                                >
                                    {tier.popular && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-indigo-500 text-white text-xs font-bold uppercase tracking-wide rounded-full flex items-center gap-1 shadow-lg">
                                            <StarIcon className="w-3 h-3" /> Most Popular
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                                            {tier.name}
                                        </h3>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-bold text-neutral-900 dark:text-white">
                                                {tier.price}
                                            </span>
                                            <span className="text-neutral-500 dark:text-neutral-400">
                                                {tier.period}
                                            </span>
                                        </div>
                                        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                                            {tier.description}
                                        </p>
                                    </div>

                                    <ul className="flex-1 space-y-4 mb-8">
                                        {tier.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-3 text-sm text-neutral-700 dark:text-neutral-300">
                                                <CheckIcon className={`w-5 h-5 flex-shrink-0 ${tier.popular ? 'text-indigo-500' : 'text-neutral-400'
                                                    }`} />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <button
                                        onClick={() => handleSubscribe(tier.id)}
                                        disabled={currentPlan === tier.id}
                                        className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${tier.popular
                                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30'
                                            : currentPlan === tier.id
                                                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-default'
                                                : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-700'
                                            }`}
                                    >
                                        {currentPlan === tier.id ? 'Current Plan' : tier.cta}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-center">
                        <p className="text-sm text-neutral-500">
                            Secure payment via Stripe. Cancel anytime.
                            <span className="ml-2 text-indigo-600 cursor-pointer hover:underline">Enterprise questions?</span>
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
