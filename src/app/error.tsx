'use client'

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error)
    }, [error])

    return (
        <div className="flex h-[100dvh] w-full flex-col items-center justify-center p-4 bg-white/50 dark:bg-black/50 backdrop-blur-md">
            <div className="max-w-md w-full p-6 text-center space-y-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center border border-red-100 dark:border-red-900/50">
                    <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                        Something went wrong
                    </h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        {error.message || "An unexpected error occurred. Please try again."}
                    </p>
                </div>

                <div className="flex gap-3 justify-center pt-2">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors border border-transparent hover:border-neutral-300 dark:hover:border-neutral-600"
                    >
                        Refresh Page
                    </button>
                    <button
                        onClick={reset}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-500/20 hover:shadow-blue-500/40"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    )
}
