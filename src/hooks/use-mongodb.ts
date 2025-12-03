import { useState, useCallback, useEffect, useRef } from 'react'
import { mongoDBService, ConversationData } from '@/services/mongodb-service'
import { IConversation } from '@/models/conversation'

export interface UseMongoDBOptions {
  autoSave?: boolean
  autoSaveDelay?: number
  onSave?: (success: boolean, error?: string) => void
  onLoad?: (conversations: IConversation[]) => void
  initialConversationId?: string
}

export interface UseMongoDBReturn {
  // State
  conversations: IConversation[]
  currentConversationId: string | null
  isLoading: boolean
  isSaving: boolean
  lastSaved: Date | null
  error: string | null

  // Actions
  saveConversation: (data: ConversationData, id?: string) => Promise<{ success: boolean; conversationId?: string }>
  loadConversations: () => Promise<boolean>
  loadConversation: (id: string) => Promise<boolean>
  deleteConversation: (id: string) => Promise<boolean>
  autoSaveConversation: (data: ConversationData, id?: string) => void
  setCurrentConversationId: (id: string | null) => void
  clearError: () => void
}

export function useMongoDB(options: UseMongoDBOptions = {}): UseMongoDBReturn {
  const {
    autoSave = true,
    autoSaveDelay = 2000,
    onSave,
    onLoad,
    initialConversationId
  } = options

  // State
  const [conversations, setConversations] = useState<IConversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(initialConversationId || null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refs for auto-save
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedDataRef = useRef<ConversationData | null>(null)

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Save conversation
  const saveConversation = useCallback(async (data: ConversationData, id?: string): Promise<{ success: boolean; conversationId?: string }> => {
    setIsSaving(true)
    setError(null)

    try {
      const result = await mongoDBService.saveConversation(data, id)

      if (result.success && result.data) {
        setLastSaved(new Date())

        const newConversationId = result.data._id

        // Update conversations list if this is a new conversation
        // (either no ID was provided, or the original ID didn't exist and a new one was created)
        if (!id && newConversationId) {
          // New conversation created
          setConversations(prev => [result.data!, ...prev])
          setCurrentConversationId(newConversationId)
        } else if (id && newConversationId && newConversationId !== id) {
          // Conversation was not found, so a new one was created - update the ID
          // Conversation was not found, so a new one was created - update the ID
          setConversations(prev => [result.data!, ...prev])
          setCurrentConversationId(newConversationId)
        } else if (id) {
          // Update existing conversation in list
          setConversations(prev =>
            prev.map(conv => conv._id === id ? result.data! : conv)
          )
        }

        onSave?.(true)
        return { success: true, conversationId: newConversationId }
      } else {
        setError(result.error || 'Failed to save conversation')
        onSave?.(false, result.error)
        return { success: false }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save conversation'
      setError(errorMessage)
      onSave?.(false, errorMessage)
      return { success: false }
    } finally {
      setIsSaving(false)
    }
  }, [onSave])

  // Load all conversations
  const loadConversations = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await mongoDBService.loadConversations()

      if (result.success && result.data) {
        setConversations(result.data)
        onLoad?.(result.data)
        return true
      } else {
        setError(result.error || 'Failed to load conversations')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [onLoad])

  // Load single conversation
  const loadConversation = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await mongoDBService.loadConversation(id)

      if (result.success && result.data) {
        setCurrentConversationId(id)
        return true
      } else {
        setError(result.error || 'Failed to load conversation')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversation'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Delete conversation
  const deleteConversation = useCallback(async (id: string): Promise<boolean> => {
    setError(null)

    try {
      const result = await mongoDBService.deleteConversation(id)

      if (result.success) {
        setConversations(prev => prev.filter(conv => conv._id !== id))

        if (currentConversationId === id) {
          setCurrentConversationId(null)
        }

        return true
      } else {
        setError(result.error || 'Failed to delete conversation')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation'
      setError(errorMessage)
      return false
    }
  }, [currentConversationId])

  // Sanitize data to remove circular references and non-serializable values
  const sanitizeData = useCallback((data: any): any => {
    const seen = new WeakSet()

    const sanitize = (obj: any, depth = 0): any => {
      // Handle primitives
      if (obj === null || typeof obj !== 'object') {
        return obj
      }

      // Handle circular references
      if (seen.has(obj)) {
        return '[Circular Reference]'
      }

      // Check for React elements and components before adding to seen set
      if (obj.$$typeof || obj.type || obj.props) {
        return undefined // Skip React elements entirely
      }

      seen.add(obj)

      try {
        // Handle arrays
        if (Array.isArray(obj)) {
          const sanitizedArray = obj.map(item => {
            // Only skip if it's definitely a React element (has $$typeof)
            if (item && typeof item === 'object') {
              if (item.$$typeof) {
                return undefined
              }
            }
            return sanitize(item, depth + 1)
          }).filter(item => item !== undefined)
          return sanitizedArray
        }

        // Handle Date objects
        if (obj instanceof Date) {
          return obj.toISOString()
        }

        // Handle regular objects
        const sanitized: any = {}
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const value = obj[key]

            // Skip functions and symbols
            if (typeof value === 'function' || typeof value === 'symbol') {
              continue
            }

            // Skip React elements
            if (value && typeof value === 'object') {
              if (value.$$typeof) continue
            }

            // Recursively sanitize the value
            const sanitizedValue = sanitize(value, depth + 1)
            if (sanitizedValue !== undefined) {
              sanitized[key] = sanitizedValue
            }
          }
        }

        return sanitized
      } finally {
        // Remove from seen set after processing
        seen.delete(obj)
      }
    }

    try {
      return sanitize(data)
    } catch (error) {
      console.error('Error sanitizing data:', error)
      return {}
    }
  }, [])

  // Auto-save conversation
  const autoSaveConversation = useCallback((data: ConversationData, id?: string) => {
    if (!autoSave) return

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    const sanitizedData = sanitizeData(data)

    sanitizedData.branches?.forEach((b: any) => {
    })

    // Check if data has changed
    const dataString = JSON.stringify(sanitizedData)
    const lastDataString = lastSavedDataRef.current ? JSON.stringify(lastSavedDataRef.current) : null

    if (dataString === lastDataString) {
      return // No changes, skip auto-save
    }

    // Prevent saving incomplete data that would overwrite better data
    // Only save if we have more or equal messages/branches than last saved
    if (lastSavedDataRef.current) {
      const lastMessagesCount = lastSavedDataRef.current.mainMessages?.length || 0
      const lastBranchesCount = lastSavedDataRef.current.branches?.length || 0
      const currentMessagesCount = sanitizedData.mainMessages?.length || 0
      const currentBranchesCount = sanitizedData.branches?.length || 0

      // If new data has significantly less content, it might be incomplete - skip save
      // Allow if messages increased or branches increased (data is getting better)
      // But prevent if both decreased significantly (likely incomplete state)
      if (currentMessagesCount < lastMessagesCount - 1 && currentBranchesCount < lastBranchesCount) {
        return
      }
    }

    // Set new timeout
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await saveConversation(sanitizedData, id)
        if (result.success) {
          // Only update lastSavedDataRef AFTER successful save
          lastSavedDataRef.current = sanitizedData
        } else {
          console.error('❌ Auto-save failed, not updating lastSavedDataRef')
        }
      } catch (error) {
        console.error('❌ Auto-save error:', error)
      }
    }, autoSaveDelay)
  }, [autoSave, autoSaveDelay, saveConversation, sanitizeData])

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  return {
    // State
    conversations,
    currentConversationId,
    isLoading,
    isSaving,
    lastSaved,
    error,

    // Actions
    saveConversation,
    loadConversations,
    loadConversation,
    deleteConversation,
    autoSaveConversation,
    setCurrentConversationId,
    clearError
  }
}
