'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Upload, FileText, Code, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { ConversationExporter, ConversationExport, ExportOptions } from '@/services/conversation-export'

interface ExportImportModalProps {
  isOpen: boolean
  onClose: () => void
  messages: any[]
  branches: any[]
  nodes: any[]
  edges: any[]
  onImport?: (data: ConversationExport) => void
}

export default function ExportImportModal({
  isOpen,
  onClose,
  messages,
  branches,
  nodes,
  edges,
  onImport
}: ExportImportModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [exportFormat, setExportFormat] = useState<'json' | 'markdown'>('json')
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeMetadata: true,
    includeTimestamps: true,
    includeAIResponses: true
  })
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importError, setImportError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const filename = `conversation-export-${new Date().toISOString().split('T')[0]}`
    
    if (exportFormat === 'json') {
      const exportData = ConversationExporter.exportToJSON(
        messages,
        branches,
        nodes,
        edges,
        exportOptions
      )
      ConversationExporter.downloadAsFile(exportData, filename, 'json')
    } else {
      const markdownContent = ConversationExporter.exportToMarkdown(
        messages,
        branches,
        nodes,
        exportOptions
      )
      ConversationExporter.downloadAsFile(markdownContent, filename, 'markdown')
    }
  }

  const handleImport = () => {
    if (!importFile) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importData = ConversationExporter.importFromJSON(content)
        
        if (importData) {
          setImportStatus('success')
          if (onImport) {
            onImport(importData)
          }
          setTimeout(() => {
            onClose()
            setImportStatus('idle')
            setImportFile(null)
          }, 1500)
        } else {
          setImportStatus('error')
          setImportError('Invalid conversation file format')
        }
      } catch (error) {
        setImportStatus('error')
        setImportError('Failed to parse conversation file')
      }
    }
    reader.readAsText(importFile)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
      setImportStatus('idle')
      setImportError('')
    }
  }

  const resetImport = () => {
    setImportFile(null)
    setImportStatus('idle')
    setImportError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Export & Import Conversations
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('export')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'export'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Download size={16} className="inline mr-2" />
                Export
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'import'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Upload size={16} className="inline mr-2" />
                Import
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'export' && (
                <div className="space-y-6">
                  {/* Format Selection */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Export Format</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setExportFormat('json')}
                        className={`p-4 border-2 rounded-lg transition-all ${
                          exportFormat === 'json'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Code size={24} className="mx-auto mb-2 text-gray-600" />
                        <div className="text-sm font-medium">JSON</div>
                        <div className="text-xs text-gray-500">Full data with metadata</div>
                      </button>
                      <button
                        onClick={() => setExportFormat('markdown')}
                        className={`p-4 border-2 rounded-lg transition-all ${
                          exportFormat === 'markdown'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <FileText size={24} className="mx-auto mb-2 text-gray-600" />
                        <div className="text-sm font-medium">Markdown</div>
                        <div className="text-xs text-gray-500">Human-readable format</div>
                      </button>
                    </div>
                  </div>

                  {/* Export Options */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Export Options</h3>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeMetadata}
                          onChange={(e) => setExportOptions(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                          className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Include metadata (title, description, stats)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeTimestamps}
                          onChange={(e) => setExportOptions(prev => ({ ...prev, includeTimestamps: e.target.checked }))}
                          className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Include timestamps</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeAIResponses}
                          onChange={(e) => setExportOptions(prev => ({ ...prev, includeAIResponses: e.target.checked }))}
                          className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Include AI responses</span>
                      </label>
                    </div>
                  </div>

                  {/* Export Stats */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Export Preview</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>Messages: {messages.length}</div>
                      <div>Branches: {branches.length}</div>
                      <div>Nodes: {nodes.length}</div>
                      <div>Edges: {edges.length}</div>
                    </div>
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={handleExport}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <Download size={20} className="mr-2" />
                    Export Conversation
                  </button>
                </div>
              )}

              {activeTab === 'import' && (
                <div className="space-y-6">
                  {/* File Upload */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Import Conversation</h3>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      {!importFile ? (
                        <div>
                          <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                          <p className="text-gray-600 mb-2">Choose a conversation file to import</p>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Select File
                          </button>
                        </div>
                      ) : (
                        <div>
                          <FileText size={48} className="mx-auto mb-4 text-green-500" />
                          <p className="text-gray-900 font-medium mb-1">{importFile.name}</p>
                          <p className="text-sm text-gray-500 mb-4">
                            {(importFile.size / 1024).toFixed(1)} KB
                          </p>
                          <button
                            onClick={resetImport}
                            className="text-gray-500 hover:text-gray-700 text-sm"
                          >
                            Choose Different File
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Import Status */}
                  {importStatus !== 'idle' && (
                    <div className={`p-4 rounded-lg flex items-center ${
                      importStatus === 'success' 
                        ? 'bg-green-50 text-green-800' 
                        : 'bg-red-50 text-red-800'
                    }`}>
                      {importStatus === 'success' ? (
                        <CheckCircle size={20} className="mr-2" />
                      ) : (
                        <WarningCircle size={20} className="mr-2" />
                      )}
                      <span className="text-sm font-medium">
                        {importStatus === 'success' 
                          ? 'Conversation imported successfully!' 
                          : importError
                        }
                      </span>
                    </div>
                  )}

                  {/* Import Button */}
                  {importFile && (
                    <button
                      onClick={handleImport}
                      disabled={importStatus === 'success'}
                      className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload size={20} className="mr-2" />
                      Import Conversation
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
