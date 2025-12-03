import { IConversation, IBranch, IMessage, IAIModel } from '@/models/conversation'

export interface ConversationData {
  title: string
  mainMessages: IMessage[]
  selectedAIs: IAIModel[]
  branches: IBranch[]
  contextLinks: string[]
  collapsedNodes: string[]
  minimizedNodes: string[]
  activeNodeId?: string
  viewport: {
    x: number
    y: number
    zoom: number
  }
}

export interface SaveConversationResponse {
  success: boolean
  data?: IConversation
  error?: string
}

export interface LoadConversationsResponse {
  success: boolean
  data?: IConversation[]
  error?: string
}

class MongoDBService {
  private baseUrl = '/api/conversations'

  // Save conversation to MongoDB
  async saveConversation(conversationData: ConversationData, conversationId?: string): Promise<SaveConversationResponse> {
    try {
      // If we have a conversation ID, try to update first
      if (conversationId) {
        const url = `${this.baseUrl}/${conversationId}`
        const method = 'PUT'



        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(conversationData),
        })



        const result = await response.json()

        // If conversation not found, create a new one instead
        if (!response.ok && result.error === 'Conversation not found') {
          console.warn('⚠️ Conversation not found, creating new conversation instead')
          // Fall through to create new conversation
        } else if (!response.ok) {
          console.error('❌ API error:', JSON.stringify(result, null, 2))
          throw new Error(result.error || 'Failed to save conversation')
        } else {
          return result
        }
      }

      // Create new conversation (either no ID provided, or update failed with "not found")
      const url = this.baseUrl
      const method = 'POST'



      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(conversationData),
      })



      const result = await response.json()

      if (!response.ok) {
        console.error('❌ API error:', JSON.stringify(result, null, 2))
        throw new Error(result.error || 'Failed to save conversation')
      }

      return result
    } catch (error) {
      console.error('❌ Error saving conversation:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save conversation'
      }
    }
  }

  // Load all conversations
  async loadConversations(): Promise<LoadConversationsResponse> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load conversations')
      }

      return result
    } catch (error) {
      console.error('Error loading conversations:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load conversations'
      }
    }
  }

  // Load single conversation
  async loadConversation(conversationId: string): Promise<SaveConversationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/${conversationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load conversation')
      }

      return result
    } catch (error) {
      console.error('Error loading conversation:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load conversation'
      }
    }
  }

  // Delete conversation
  async deleteConversation(conversationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete conversation')
      }

      return result
    } catch (error) {
      console.error('Error deleting conversation:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete conversation'
      }
    }
  }

  // Auto-save conversation (with debouncing)
  private saveTimeout: NodeJS.Timeout | null = null

  async autoSaveConversation(conversationData: ConversationData, conversationId?: string, delay: number = 2000): Promise<void> {
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
    // Set new timeout
    this.saveTimeout = setTimeout(async () => {
      try {
        const result = await this.saveConversation(conversationData, conversationId)
        if (result.success) {
          // Success
        } else {
          console.error('❌ Auto-save failed:', result.error)
        }
      } catch (error) {
        console.error('❌ Auto-save error:', error)
      }
    }, delay)
  }

  // Convert app state to MongoDB format
  convertAppStateToMongoDB(appState: any): ConversationData {
    return {
      title: appState.title || 'New Conversation',
      mainMessages: appState.messages || [],
      selectedAIs: appState.selectedAIs || [],
      branches: appState.branches || [],
      contextLinks: appState.contextLinks || [],
      collapsedNodes: appState.collapsedNodes || [],
      minimizedNodes: appState.minimizedNodes || [],
      activeNodeId: appState.activeNodeId,
      viewport: appState.viewport || { x: 0, y: 0, zoom: 1 }
    }
  }

  // Convert MongoDB data to app state
  convertMongoDBToAppState(mongoData: IConversation): any {
    return {
      id: mongoData._id,
      title: mongoData.title,
      messages: mongoData.mainMessages,
      selectedAIs: mongoData.selectedAIs,
      branches: mongoData.branches,
      contextLinks: mongoData.contextLinks,
      collapsedNodes: mongoData.collapsedNodes,
      minimizedNodes: mongoData.minimizedNodes,
      activeNodeId: mongoData.activeNodeId,
      viewport: mongoData.viewport,
      createdAt: mongoData.createdAt,
      updatedAt: mongoData.updatedAt
    }
  }
}

export const mongoDBService = new MongoDBService()
export default mongoDBService
