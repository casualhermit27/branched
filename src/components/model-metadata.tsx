'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Link2 } from 'lucide-react'

interface ModelMetadataProps {
  branchId: string
  currentMetadata?: {
    temperature?: number
    topP?: number
    maxTokens?: number
  }
  onUpdate?: (metadata: any) => void
}

export default function ModelMetadata({ 
  branchId, 
  currentMetadata = {},
  onUpdate 
}: ModelMetadataProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [metadata, setMetadata] = useState({
    temperature: currentMetadata.temperature ?? 0.7,
    topP: currentMetadata.topP ?? 1.0,
    maxTokens: currentMetadata.maxTokens ?? 2000
  })

  const handleUpdate = () => {
    onUpdate?.(metadata)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="Model Settings"
      >
        <Settings size={16} className="text-gray-600" />
      </motion.button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50"
        >
          <h4 className="font-semibold text-gray-900 mb-3">Model Parameters</h4>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Temperature: {metadata.temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={metadata.temperature}
                onChange={(e) => setMetadata({ ...metadata, temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Top P: {metadata.topP.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={metadata.topP}
                onChange={(e) => setMetadata({ ...metadata, topP: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Max Tokens: {metadata.maxTokens}
              </label>
              <input
                type="number"
                min="100"
                max="8000"
                step="100"
                value={metadata.maxTokens}
                onChange={(e) => setMetadata({ ...metadata, maxTokens: parseInt(e.target.value) })}
                className="w-full px-2 py-1 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleUpdate}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Apply
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(false)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

