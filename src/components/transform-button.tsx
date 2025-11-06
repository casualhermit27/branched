'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PaperPlaneTilt, Square } from '@phosphor-icons/react'

interface TransformButtonProps {
  onSend: () => void
  onStop?: () => void
  isDisabled?: boolean
  isGenerating?: boolean
}

export default function TransformButton({ 
  onSend, 
  onStop, 
  isDisabled = false, 
  isGenerating = false 
}: TransformButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  // Variants for the container shape
  const containerVariants = {
    circle: { borderRadius: '50%' },
    square: { borderRadius: '30%' }
  }
  
  // Variants for the icon
  const iconVariants = {
    send: { rotate: 0, scale: 1 },
    stop: { rotate: 90, scale: 1 }
  }
  
  const handleClick = () => {
    if (isGenerating) {
      onStop?.()
    } else {
      onSend()
    }
  }
  
  return (
    <motion.button
      initial="circle"
      animate={isGenerating ? "square" : "circle"}
      variants={containerVariants}
      transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
      onClick={handleClick}
      disabled={isDisabled && !isGenerating}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: isDisabled && !isGenerating ? 1 : 1.02 }}
      whileTap={{ scale: isDisabled && !isGenerating ? 1 : 0.98 }}
      className={`
        flex items-center justify-center
        w-10 h-10
        ${isGenerating 
          ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/50' 
          : 'bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200/50'}
        ${isDisabled && !isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        shadow-sm
        transition-all duration-200
        active:opacity-80
      `}
    >
      <motion.div
        initial="send"
        animate={isGenerating ? "stop" : "send"}
        variants={iconVariants}
        transition={{ duration: 0.3 }}
      >
        {isGenerating ? (
          <Square size={16} weight="fill" />
        ) : (
          <PaperPlaneTilt size={16} weight={isHovered ? "fill" : "regular"} />
        )}
      </motion.div>
    </motion.button>
  )
}
