'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock, Key, Robot, CheckCircle, Warning, Sparkle } from '@phosphor-icons/react'
import { aiService } from '@/services/ai-api'
import { validateApiKey } from '@/services/model-discovery'

interface UpsellModalProps {
    isOpen: boolean
    onClose: () => void
    modelName: string
    provider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'xai' | string
}

export function UpsellModal({ isOpen, onClose, modelName, provider }: UpsellModalProps) {
    const [apiKey, setApiKey] = useState('')
    const [isValidating, setIsValidating] = useState(false)
    const [validationResult, setValidationResult] = useState<{ valid: boolean | null, message: string }>({ valid: null, message: '' })

    const handleSaveKey = async () => {
        if (!apiKey.trim()) return

        setIsValidating(true)
        setValidationResult({ valid: null, message: 'Validating key...' })

        try {
            const result = await validateApiKey(apiKey.trim())

            if (result.valid) {
                // Save to service
                aiService.updateKey(provider.toLowerCase(), apiKey.trim())
                setValidationResult({ valid: true, message: 'Key verified and saved!' })

                setTimeout(() => {
                    onClose()
                    setApiKey('')
                    setValidationResult({ valid: null, message: '' })
                    // Optionally reload the page or trigger a context update
                    window.location.reload()
                }, 1500)
            } else {
                setValidationResult({ valid: false, message: 'Invalid API Key' })
            }
        } catch (e) {
            // Fallback save if validation fails (offline or other issue)
            aiService.updateKey(provider.toLowerCase(), apiKey.trim())
            setValidationResult({ valid: true, message: 'Key saved (Validation skipped)' })
            setTimeout(() => {
                onClose()
                window.location.reload()
            }, 1500)
        } finally {
            setIsValidating(false)
        }
    }

    const getProviderName = (p: string) => {
        switch (p.toLowerCase()) {
            case 'openai': return 'OpenAI'
            case 'anthropic': case 'claude': return 'Anthropic'
            case 'google': case 'gemini': return 'Google'
            case 'mistral': return 'Mistral'
            case 'xai': case 'grok': return 'xAI'
            default: return p
        }
    }

    // Map provider to specific getting started URL
    const getKeyUrl = (p: string) => {
        switch (p.toLowerCase()) {
            case 'openai': return 'https://platform.openai.com/api-keys'
            case 'anthropic': case 'claude': return 'https://console.anthropic.com/settings/keys'
            case 'google': case 'gemini': return 'https://aistudio.google.com/app/apikey'
            case 'mistral': return 'https://console.mistral.ai/api-keys/'
            case 'xai': case 'grok': return 'https://console.x.ai/'
            default: return '#'
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative bg-card text-card-foreground w-full max-w-2xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col md:flex-row"
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 z-10"
                    >
                        <X size={20} />
                    </button>

                    {/* Left Side: Pro Upgrade (The "Expensive" Path) */}
                    <div className="flex-1 p-8 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-border/50">
                        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 rounded-2xl flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
                            <Sparkle size={32} weight="fill" />
                        </div>

                        <h2 className="text-xl font-bold mb-2">Upgrade to Pro</h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            Get 1,000 monthly credits to use premium models like {modelName} directly.
                        </p>

                        <ul className="text-sm space-y-3 mb-8 w-full text-left">
                            <li className="flex items-center gap-2">
                                <CheckCircle className="text-purple-500" weight="fill" />
                                <span>Access GPT-4o, Claude 3.5, & more</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="text-purple-500" weight="fill" />
                                <span>Priority Support</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="text-purple-500" weight="fill" />
                                <span>Unlimited Cloud Storage</span>
                            </li>
                        </ul>

                        <button className="w-full py-3 px-4 bg-foreground text-background rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg active:scale-95">
                            Subscribe for $20/mo
                        </button>
                        <p className="text-[10px] text-muted-foreground mt-3">Cancel anytime. Secure payment via Stripe.</p>
                    </div>

                    {/* Right Side: BYOK (The "Free" Path) */}
                    <div className="flex-1 p-8 bg-card flex flex-col">
                        <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                            <Key size={18} />
                            <span className="text-xs font-medium uppercase tracking-wider">Developer Option</span>
                        </div>
                        <h2 className="text-xl font-bold mb-2">Bring Your Own Key</h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            Already have an API key? Enter it below to use {modelName} for free (you pay the provider directly).
                        </p>

                        <div className="space-y-4 flex-1">
                            <div>
                                <label className="text-xs font-medium mb-1.5 block">
                                    {getProviderName(provider)} API Key
                                </label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={`sk-...`}
                                    className="w-full p-3 rounded-xl bg-muted/50 border border-border focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-mono text-sm"
                                />
                            </div>

                            {validationResult.message && (
                                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${validationResult.valid === true ? 'bg-emerald-500/10 text-emerald-600' :
                                        validationResult.valid === false ? 'bg-red-500/10 text-red-600' : 'bg-blue-500/10 text-blue-600'
                                    }`}>
                                    {validationResult.valid === true ? <CheckCircle weight="fill" /> :
                                        validationResult.valid === false ? <Warning weight="fill" /> : <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
                                    {validationResult.message}
                                </div>
                            )}

                            <button
                                onClick={handleSaveKey}
                                disabled={!apiKey || isValidating}
                                className="w-full py-2.5 px-4 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isValidating ? 'Verifying...' : 'Save Key'}
                            </button>
                        </div>

                        <div className="mt-6 pt-4 border-t border-border/50 text-center">
                            <a
                                href={getKeyUrl(provider)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium inline-flex items-center gap-1"
                            >
                                Get a {getProviderName(provider)} API Key
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                            </a>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
