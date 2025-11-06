'use client'

import { motion } from 'framer-motion'

export const LoadingSpinner = ({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <motion.div
      className={`${sizeClasses[size]} border-2 border-gray-200 border-t-blue-600 rounded-full`}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  )
}

export const SkeletonLoader = ({ lines = 3 }: { lines?: number }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </div>
  )
}

export const TypingIndicator = () => {
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm text-gray-500 dark:text-gray-400">AI is typing</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </div>
    </div>
  )
}

export const ButtonLoading = ({ children, loading, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => {
  return (
    <button
      {...props}
      disabled={loading}
      className={`relative ${props.className || ''}`}
    >
      {loading && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <LoadingSpinner size="sm" />
        </motion.div>
      )}
      <span className={loading ? 'opacity-0' : 'opacity-100'}>
        {children}
      </span>
    </button>
  )
}
