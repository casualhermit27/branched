// AI API Service for Mistral and Gemini integration

export interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: number
  ai?: string
  parentId?: string
  children: string[]
  responses?: { [aiId: string]: string }
}

export interface AIResponse {
  text: string
  model: string
  timestamp: number
}

export interface ConversationContext {
  messages: Message[]
  currentBranch: string
  parentMessages?: Message[]
}

// Mistral API Integration
export class MistralAPI {
  private apiKey: string
  private apiUrl: string
  private model: string

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_MISTRAL_API_KEY || ''
    this.apiUrl = process.env.NEXT_PUBLIC_MISTRAL_API_URL || 'https://api.mistral.ai/v1/chat/completions'
    this.model = process.env.NEXT_PUBLIC_MISTRAL_MODEL || 'mistral-large-latest'
    
    // Test API connection on initialization
    this.testConnection()
  }
  
  private async testConnection() {
    if (!this.apiKey) {
      console.warn('⚠️ Mistral API key not configured')
      return
    }
    
    try {
      console.log('🔍 Testing Mistral API connection...')
      const response = await fetch('https://api.mistral.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      })
      
      console.log('📡 Mistral Models API Response:', response.status, response.statusText)
      
      if (response.ok) {
        const models = await response.json()
        console.log('✅ Mistral API connection successful. Available models:', models.data?.map((m: any) => m.id) || 'Unknown')
        
        // Check if our model is available
        const availableModels = models.data?.map((m: any) => m.id) || []
        if (availableModels.includes(this.model)) {
          console.log('✅ Using model is available:', this.model)
        } else {
          console.warn('⚠️ Using model not found in available models:', this.model)
          console.log('💡 Available models:', availableModels)
        }
      } else {
        const errorText = await response.text().catch(() => 'Could not read error')
        console.warn('⚠️ Mistral API connection test failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
      }
    } catch (error) {
      console.warn('⚠️ Mistral API connection test error:', error)
    }
  }

  async generateResponse(
    message: string, 
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    if (!this.apiKey) {
      console.warn('⚠️ Mistral API key not configured, using fallback response')
      return {
        text: `Mistral response to: "${message}" (API key not configured)`,
        model: 'mistral',
        timestamp: Date.now()
      }
    }

    // Build conversation history for context
    const conversationHistory = this.buildConversationHistory(context)
    
    const requestBody = {
      model: this.model,
      messages: [
        ...conversationHistory,
        {
          role: 'user',
          content: message
        }
      ],
      stream: !!onChunk,
      temperature: 0.7,
      max_tokens: 2000
    }

    try {
      console.log('🚀 Mistral API Request:', {
        url: this.apiUrl,
        model: this.model,
        messageLength: message.length,
        historyLength: conversationHistory.length,
        hasApiKey: !!this.apiKey,
        apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'MISSING'
      })
      
      // Log request body but hide sensitive data
      const safeRequestBody = { ...requestBody }
      console.log('📝 Mistral Request Body:', JSON.stringify(safeRequestBody, null, 2))
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: signal
      })
      
      console.log('📡 Mistral API Response Status:', response.status, response.statusText)

      if (!response.ok) {
        let errorData = {}
        let errorText = ''
        
        try {
          errorData = await response.json()
        } catch (jsonError) {
          try {
            errorText = await response.text()
            console.log('📄 Raw error response text:', errorText)
          } catch (textError) {
            console.log('❌ Could not read error response')
          }
        }
        
        console.error('🚨 Mistral API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData || 'No JSON error data',
          errorText: errorText || 'No text error data',
          url: this.apiUrl,
          hasApiKey: !!this.apiKey,
          apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'MISSING',
          model: this.model,
          headers: Object.fromEntries(response.headers.entries())
        })
        
        // Provide specific error messages based on status codes
        let errorMessage = `Mistral API error: ${response.status} ${response.statusText}`
        
        if (response.status === 401) {
          errorMessage += ' - API key is invalid or expired'
        } else if (response.status === 403) {
          errorMessage += ' - API key does not have permission for this model'
        } else if (response.status === 429) {
          errorMessage += ' - Rate limit exceeded'
        } else if (response.status === 400) {
          errorMessage += ' - Bad request (check model name and parameters)'
        } else if (response.status === 404) {
          errorMessage += ' - Model not found'
        }
        
        if (errorData && typeof errorData === 'object') {
          errorMessage += ` - ${JSON.stringify(errorData)}`
        } else if (errorText) {
          errorMessage += ` - ${errorText}`
        }
        
        throw new Error(errorMessage)
      }

      if (onChunk) {
        // Handle streaming response
        return await this.handleStreamingResponse(response, onChunk, signal)
      } else {
        // Handle regular response
        const data = await response.json()
        return {
          text: data.choices[0].message.content,
          model: 'mistral',
          timestamp: Date.now()
        }
      }
    } catch (error) {
      console.error('🚨 Mistral API error:', error)
      
      // If it's a network error or API failure, return a fallback response
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          console.warn('⚠️ Network error, using fallback response')
          return {
            text: `Mistral response to: "${message}" (Network error - ${error.message})`,
            model: 'mistral',
            timestamp: Date.now()
          }
        }
        
        if (error.message.includes('401') || error.message.includes('403')) {
          console.warn('⚠️ Authentication error, using fallback response')
          return {
            text: `Mistral response to: "${message}" (Authentication error - check API key)`,
            model: 'mistral',
            timestamp: Date.now()
          }
        }
        
        if (error.message.includes('429')) {
          console.warn('⚠️ Rate limit error, using fallback response')
          return {
            text: `Mistral response to: "${message}" (Rate limit exceeded - please try again later)`,
            model: 'mistral',
            timestamp: Date.now()
          }
        }
      }
      
      // For other errors, still throw to maintain existing behavior
      throw error
    }
  }

  private async handleStreamingResponse(
    response: Response, 
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ''

    if (!reader) {
      throw new Error('No response body')
    }

    try {
      while (true) {
        // Check if aborted
        if (signal?.aborted) {
          reader.cancel()
          throw new Error('Generation aborted by user')
        }
        
        const { done, value } = await reader.read()
        if (done) break

        // Check again after reading
        if (signal?.aborted) {
          reader.cancel()
          throw new Error('Generation aborted by user')
        }

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullResponse += content
                // Check if aborted before calling onChunk
                if (!signal?.aborted) {
                  onChunk(content)
                }
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }

      return {
        text: fullResponse,
        model: 'mistral',
        timestamp: Date.now()
      }
    } catch (error) {
      if (signal?.aborted) {
        // Return partial response if aborted
        return {
          text: fullResponse || '[Generation stopped]',
          model: 'mistral',
          timestamp: Date.now()
        }
      }
      throw error
    } finally {
      reader.releaseLock()
    }
  }

  private buildConversationHistory(context: ConversationContext): Array<{role: string, content: string}> {
    const history: Array<{role: string, content: string}> = []

    // Add recent conversation history (last 10 messages for context)
    const recentMessages = context.messages.slice(-10)
    
    for (const msg of recentMessages) {
      history.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.text
      })
    }

    return history
  }
}

// Gemini API Integration
export class GeminiAPI {
  private apiKey: string
  private apiUrl: string
  private model: string

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
    this.model = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'models/gemini-2.0-flash-exp'
    this.apiUrl = process.env.NEXT_PUBLIC_GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1beta/${this.model}:generateContent`
    
    // Test API connection on initialization
    this.testConnection()
  }
  
  private async testConnection() {
    if (!this.apiKey) {
      console.warn('⚠️ Gemini API key not configured')
      return
    }
    
    try {
      console.log('🔍 Testing Gemini API connection...')
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`)
      
      console.log('📡 Gemini Models API Response:', response.status, response.statusText)
      
      if (response.ok) {
        const models = await response.json()
        console.log('✅ Gemini API connection successful. Available models:', models.models?.map((m: any) => m.name) || 'Unknown')
        
        // Check if our model is available
        const availableModels = models.models?.map((m: any) => m.name) || []
        if (availableModels.includes(this.model)) {
          console.log('✅ Using model is available:', this.model)
        } else {
          console.warn('⚠️ Using model not found in available models:', this.model)
          console.log('💡 Available models:', availableModels)
        }
      } else {
        const errorText = await response.text().catch(() => 'Could not read error')
        console.warn('⚠️ Gemini API connection test failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
      }
    } catch (error) {
      console.warn('⚠️ Gemini API connection test error:', error)
    }
  }

  async generateResponse(
    message: string, 
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured')
    }

    // Build conversation history for context
    const conversationHistory = this.buildConversationHistory(context)
    
    const requestBody = {
      contents: [
        ...conversationHistory,
        {
          role: 'user',
          parts: [{ text: message }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
        topP: 0.8,
        topK: 40
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ]
    }

    try {
      console.log('🚀 Gemini API Request:', {
        url: `${this.apiUrl}?key=${this.apiKey.substring(0, 10)}...`,
        model: this.model,
        messageLength: message.length,
        historyLength: conversationHistory.length
      })
      console.log('📝 Gemini Request Body:', JSON.stringify(requestBody, null, 2))
      
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: signal
      })

      if (!response.ok) {
        let errorData = {}
        let errorText = ''
        
        try {
          errorData = await response.json()
        } catch (jsonError) {
          try {
            errorText = await response.text()
            console.log('📄 Raw Gemini error response text:', errorText)
          } catch (textError) {
            console.log('❌ Could not read Gemini error response')
          }
        }
        
        console.error('🚨 Gemini API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          errorText,
          url: this.apiUrl,
          hasApiKey: !!this.apiKey,
          apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'MISSING',
          model: this.model,
          headers: Object.fromEntries(response.headers.entries())
        })
        
        // Provide specific error messages based on status codes
        let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`
        
        if (response.status === 401) {
          errorMessage += ' - API key is invalid or expired'
        } else if (response.status === 403) {
          errorMessage += ' - API key does not have permission for this model'
        } else if (response.status === 429) {
          errorMessage += ' - Rate limit exceeded'
        } else if (response.status === 400) {
          errorMessage += ' - Bad request (check model name and parameters)'
        } else if (response.status === 404) {
          errorMessage += ' - Model not found'
        }
        
        if (errorData && typeof errorData === 'object') {
          errorMessage += ` - ${JSON.stringify(errorData)}`
        } else if (errorText) {
          errorMessage += ` - ${errorText}`
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const text = data.candidates[0].content.parts[0].text
        
        // Simulate streaming for Gemini (since it doesn't support streaming in the same way)
        if (onChunk) {
          const words = text.split(' ')
          for (let i = 0; i < words.length; i++) {
            // Check if aborted
            if (signal?.aborted) {
              break
            }
            
            const chunk = words[i] + (i < words.length - 1 ? ' ' : '')
            if (!signal?.aborted) {
              onChunk(chunk)
            }
            await new Promise(resolve => setTimeout(resolve, 50)) // Small delay for streaming effect
          }
        }

        return {
          text,
          model: 'gemini',
          timestamp: Date.now()
        }
      } else {
        throw new Error('Invalid response format from Gemini API')
      }
    } catch (error) {
      console.error('Gemini API error:', error)
      throw error
    }
  }

  private buildConversationHistory(context: ConversationContext): Array<{role: string, parts: Array<{text: string}>}> {
    const history: Array<{role: string, parts: Array<{text: string}>}> = []

    // Add recent conversation history (last 10 messages for context)
    const recentMessages = context.messages.slice(-10)
    
    for (const msg of recentMessages) {
      history.push({
        role: msg.isUser ? 'user' : 'model',
        parts: [{ text: msg.text }]
      })
    }

    return history
  }
}

// AI Service Manager
export class AIService {
  private mistralAPI: MistralAPI
  private geminiAPI: GeminiAPI

  constructor() {
    this.mistralAPI = new MistralAPI()
    this.geminiAPI = new GeminiAPI()
  }

  async generateResponse(
    model: string,
    message: string,
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    switch (model.toLowerCase()) {
      case 'mistral':
        return await this.mistralAPI.generateResponse(message, context, onChunk, signal)
      case 'gemini':
        return await this.geminiAPI.generateResponse(message, context, onChunk, signal)
      default:
        throw new Error(`Unsupported model: ${model}`)
    }
  }

  isModelAvailable(model: string): boolean {
    switch (model.toLowerCase()) {
      case 'mistral':
        return !!process.env.NEXT_PUBLIC_MISTRAL_API_KEY
      case 'gemini':
        return !!process.env.NEXT_PUBLIC_GEMINI_API_KEY
      default:
        return false
    }
  }
}

// Export singleton instance
export const aiService = new AIService()
