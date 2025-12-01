// AI API Service for Mistral, Gemini, OpenAI, Claude, and Grok integration

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
  memoryContext?: string // Aggregated memory context string
}

// Helper to get key from storage or env
const getApiKey = (provider: string, envKey: string): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`api_key_${provider}`)
    if (stored) return stored
  }
  return process.env[envKey] || ''
}

// Base API Class
abstract class BaseAIAPI {
  protected apiKey: string
  protected abstract provider: string
  protected abstract envKey: string

  constructor() {
    this.apiKey = ''
  }

  protected initKey() {
    this.apiKey = getApiKey(this.provider, this.envKey)
  }

  public setApiKey(key: string) {
    this.apiKey = key
    if (typeof window !== 'undefined') {
      if (key) {
        localStorage.setItem(`api_key_${this.provider}`, key)
      } else {
        localStorage.removeItem(`api_key_${this.provider}`)
      }
    }
  }

  public hasKey(): boolean {
    return !!this.apiKey
  }

  abstract generateResponse(
    message: string,
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse>
}

// Mistral API Integration
export class MistralAPI extends BaseAIAPI {
  protected provider = 'mistral'
  protected envKey = 'NEXT_PUBLIC_MISTRAL_API_KEY'
  private apiUrl: string
  private model: string

  constructor() {
    super()
    this.initKey()
    this.apiUrl = process.env.NEXT_PUBLIC_MISTRAL_API_URL || 'https://api.mistral.ai/v1/chat/completions'
    this.model = process.env.NEXT_PUBLIC_MISTRAL_MODEL || 'mistral-large-latest'
  }

  async generateResponse(
    message: string,
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('Mistral API key not configured')
    }

    const conversationHistory = this.buildConversationHistory(context)

    const requestBody = {
      model: this.model,
      messages: [
        ...conversationHistory,
        { role: 'user', content: message }
      ],
      stream: !!onChunk,
      temperature: 0.7,
      max_tokens: 2000
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Mistral API error: ${response.status} - ${errorText}`)
      }

      if (onChunk) {
        return await this.handleStreamingResponse(response, onChunk, signal)
      } else {
        const data = await response.json()
        return {
          text: data.choices[0].message.content,
          model: 'mistral',
          timestamp: Date.now()
        }
      }
    } catch (error) {
      console.error('Mistral API error:', error)
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

    if (!reader) throw new Error('No response body')

    try {
      while (true) {
        if (signal?.aborted) {
          reader.cancel()
          throw new Error('Generation aborted')
        }

        const { done, value } = await reader.read()
        if (done) break

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
                onChunk(content)
              }
            } catch (e) { }
          }
        }
      }
      return { text: fullResponse, model: 'mistral', timestamp: Date.now() }
    } finally {
      reader.releaseLock()
    }
  }

  private buildConversationHistory(context: ConversationContext): Array<{ role: string, content: string }> {
    const history: Array<{ role: string, content: string }> = []
    if (context.memoryContext) {
      history.push({
        role: 'system',
        content: `Context and memories:\n${context.memoryContext}\n\nUse this context to inform your responses.`
      })
    }
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
export class GeminiAPI extends BaseAIAPI {
  protected provider = 'gemini'
  protected envKey = 'NEXT_PUBLIC_GEMINI_API_KEY'
  private apiUrl: string
  private model: string

  constructor() {
    super()
    this.initKey()
    this.model = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash-exp'
    this.apiUrl = process.env.NEXT_PUBLIC_GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`
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

    const conversationHistory = this.buildConversationHistory(context)
    const requestBody = {
      contents: [
        ...conversationHistory,
        { role: 'user', parts: [{ text: message }] }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000
      }
    }

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const text = data.candidates[0].content.parts[0].text
        if (onChunk) {
          // Simulate streaming
          const words = text.split(' ')
          for (let i = 0; i < words.length; i++) {
            if (signal?.aborted) break
            onChunk(words[i] + (i < words.length - 1 ? ' ' : ''))
            await new Promise(resolve => setTimeout(resolve, 20))
          }
        }
        return { text, model: 'gemini', timestamp: Date.now() }
      } else {
        throw new Error('Invalid response format from Gemini API')
      }
    } catch (error) {
      console.error('Gemini API error:', error)
      throw error
    }
  }

  private buildConversationHistory(context: ConversationContext): Array<{ role: string, parts: Array<{ text: string }> }> {
    const history: Array<{ role: string, parts: Array<{ text: string }> }> = []
    if (context.memoryContext) {
      history.push({
        role: 'user',
        parts: [{ text: `Context and memories:\n${context.memoryContext}\n\nUse this context to inform your responses.` }]
      })
    }
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

// OpenAI API Integration
export class OpenAIAPI extends BaseAIAPI {
  protected provider = 'openai'
  protected envKey = 'NEXT_PUBLIC_OPENAI_API_KEY'
  private apiUrl = 'https://api.openai.com/v1/chat/completions'
  private model = 'gpt-4o'

  constructor() {
    super()
    this.initKey()
  }

  async generateResponse(
    message: string,
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    if (!this.apiKey) throw new Error('OpenAI API key not configured')

    const messages = [
      { role: 'system', content: context.memoryContext || 'You are a helpful assistant.' },
      ...context.messages.slice(-10).map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.text })),
      { role: 'user', content: message }
    ]

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: !!onChunk
      }),
      signal
    })

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)

    if (onChunk) {
      return this.handleStreamingResponse(response, onChunk, signal)
    } else {
      const data = await response.json()
      return { text: data.choices[0].message.content, model: 'openai', timestamp: Date.now() }
    }
  }

  private async handleStreamingResponse(response: Response, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<AIResponse> {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ''
    if (!reader) throw new Error('No response body')

    try {
      while (true) {
        if (signal?.aborted) { reader.cancel(); throw new Error('Aborted'); }
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) { fullResponse += content; onChunk(content); }
            } catch (e) { }
          }
        }
      }
      return { text: fullResponse, model: 'openai', timestamp: Date.now() }
    } finally { reader.releaseLock() }
  }
}

// Claude API Integration (Anthropic)
export class ClaudeAPI extends BaseAIAPI {
  protected provider = 'claude'
  protected envKey = 'NEXT_PUBLIC_ANTHROPIC_API_KEY'
  private apiUrl = 'https://api.anthropic.com/v1/messages'
  private model = 'claude-3-5-sonnet-20240620'

  constructor() {
    super()
    this.initKey()
  }

  async generateResponse(
    message: string,
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    if (!this.apiKey) throw new Error('Anthropic API key not configured')

    const messages = [
      ...context.messages.slice(-10).map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.text })),
      { role: 'user', content: message }
    ]

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'dangerously-allow-browser': 'true' // Required for client-side calls
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        system: context.memoryContext || '',
        stream: !!onChunk,
        max_tokens: 2000
      }),
      signal
    })

    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)

    if (onChunk) {
      return this.handleStreamingResponse(response, onChunk, signal)
    } else {
      const data = await response.json()
      return { text: data.content[0].text, model: 'claude', timestamp: Date.now() }
    }
  }

  private async handleStreamingResponse(response: Response, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<AIResponse> {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ''
    if (!reader) throw new Error('No response body')

    try {
      while (true) {
        if (signal?.aborted) { reader.cancel(); throw new Error('Aborted'); }
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('event: content_block_delta')) {
            // Next line is data
            continue
          }
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullResponse += parsed.delta.text
                onChunk(parsed.delta.text)
              }
            } catch (e) { }
          }
        }
      }
      return { text: fullResponse, model: 'claude', timestamp: Date.now() }
    } finally { reader.releaseLock() }
  }
}

// Grok API Integration (xAI) - OpenAI Compatible
export class GrokAPI extends OpenAIAPI {
  protected provider = 'grok'
  protected envKey = 'NEXT_PUBLIC_XAI_API_KEY'
  private xApiUrl = 'https://api.x.ai/v1/chat/completions'
  private xModel = 'grok-beta'

  constructor() {
    super()
    this.initKey()
  }

  async generateResponse(
    message: string,
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    if (!this.apiKey) throw new Error('xAI API key not configured')

    // Use OpenAI implementation but override URL and Model
    const originalUrl = (this as any).apiUrl
    const originalModel = (this as any).model

    // @ts-ignore
    this.apiUrl = this.xApiUrl
    // @ts-ignore
    this.model = this.xModel

    try {
      return await super.generateResponse(message, context, onChunk, signal)
    } finally {
      // Restore defaults
      // @ts-ignore
      this.apiUrl = originalUrl
      // @ts-ignore
      this.model = originalModel
    }
  }
}

// AI Service Manager
export class AIService {
  private mistralAPI: MistralAPI
  private geminiAPI: GeminiAPI
  private openaiAPI: OpenAIAPI
  private claudeAPI: ClaudeAPI
  private grokAPI: GrokAPI

  constructor() {
    this.mistralAPI = new MistralAPI()
    this.geminiAPI = new GeminiAPI()
    this.openaiAPI = new OpenAIAPI()
    this.claudeAPI = new ClaudeAPI()
    this.grokAPI = new GrokAPI()
  }

  async generateResponse(
    model: string,
    message: string,
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    const normalizedModel = model.toLowerCase()

    if (normalizedModel.includes('mistral')) return this.mistralAPI.generateResponse(message, context, onChunk, signal)
    if (normalizedModel.includes('gemini')) return this.geminiAPI.generateResponse(message, context, onChunk, signal)
    if (normalizedModel.includes('gpt') || normalizedModel.includes('openai')) return this.openaiAPI.generateResponse(message, context, onChunk, signal)
    if (normalizedModel.includes('claude')) return this.claudeAPI.generateResponse(message, context, onChunk, signal)
    if (normalizedModel.includes('grok')) return this.grokAPI.generateResponse(message, context, onChunk, signal)

    throw new Error(`Unsupported model: ${model}`)
  }

  isModelAvailable(model: string): boolean {
    const normalizedModel = model.toLowerCase()
    if (normalizedModel.includes('mistral')) return this.mistralAPI.hasKey()
    if (normalizedModel.includes('gemini')) return this.geminiAPI.hasKey()
    if (normalizedModel.includes('gpt') || normalizedModel.includes('openai')) return this.openaiAPI.hasKey()
    if (normalizedModel.includes('claude')) return this.claudeAPI.hasKey()
    if (normalizedModel.includes('grok')) return this.grokAPI.hasKey()
    return false
  }

  updateKey(provider: string, key: string) {
    switch (provider.toLowerCase()) {
      case 'mistral': this.mistralAPI.setApiKey(key); break;
      case 'gemini': this.geminiAPI.setApiKey(key); break;
      case 'openai': this.openaiAPI.setApiKey(key); break;
      case 'claude': this.claudeAPI.setApiKey(key); break;
      case 'grok': this.grokAPI.setApiKey(key); break;
    }
  }

  getKey(provider: string): string {
    return getApiKey(provider.toLowerCase(), '')
  }
}

// Export singleton instance
export const aiService = new AIService()
