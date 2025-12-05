'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { X, Mail, Lock, User, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface LoginModalProps {
    isOpen: boolean
    onClose: () => void
    defaultTab?: 'login' | 'signup'
}

export function LoginModal({ isOpen, onClose, defaultTab = 'login' }: LoginModalProps) {
    const [tab, setTab] = useState<'login' | 'signup'>(defaultTab)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Form states
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            if (tab === 'signup') {
                const res = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, name }),
                })

                const data = await res.json()

                if (!res.ok) {
                    throw new Error(data.message || 'Signup failed')
                }

                // Auto login after signup
                const result = await signIn('credentials', {
                    email,
                    password,
                    redirect: false,
                })

                if (result?.error) {
                    throw new Error(result.error)
                }

                onClose()
            } else {
                const result = await signIn('credentials', {
                    email,
                    password,
                    redirect: false,
                })

                if (result?.error) {
                    throw new Error('Invalid credentials')
                }

                onClose()
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md overflow-hidden rounded-2xl bg-[#1a1a1a] border border-white/10 shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h2 className="text-xl font-semibold text-white">
                        {tab === 'login' ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {tab === 'signup' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    placeholder="john@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="animate-spin" size={18} />}
                            {tab === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>

                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
                        <span>{tab === 'login' ? "Don't have an account?" : "Already have an account?"}</span>
                        <button
                            onClick={() => setTab(tab === 'login' ? 'signup' : 'login')}
                            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                            {tab === 'login' ? 'Sign up' : 'Log in'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
