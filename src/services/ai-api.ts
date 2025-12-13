// AI API Service - Gateway Edition
// Routes all requests through /api/chat for Tiered Access & Security
import { getCachedModels } from './model-discovery'

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
  memoryContext?: string
}

// Helper to get key from storage or env (For UI state only)
const getApiKey = (provider: string, envKey: string): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`api_key_${provider}`)
    if (stored) return stored
  }
  return process.env[envKey] || '' // Fallback to env for discovery
}

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

  protected async callGateway(
    model: string,
    message: string,
    context: ConversationContext,
    signal?: AbortSignal
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey
    }

    // Pass User ID if available (Mock/Simple)
    if (typeof localStorage !== 'undefined') {
      const userId = localStorage.getItem('user_id')
      if (userId) headers['x-user-id'] = userId
    }

    // DEBUG: Log what we're sending to the API
    console.log(`[callGateway] Sending to /api/chat:`, {
      model,
      messageCount: context.messages?.length || 0,
      messagesPreview: context.messages?.slice(-3).map(m => ({
        isUser: m.isUser,
        textPreview: m.text?.substring(0, 40) + '...'
      }))
    })

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        message,
        context: { messages: context.messages },
        provider: this.provider
      }),
      signal
    })

    if (!response.ok) {
      // Handle Limits
      if (response.status === 402) throw new Error('Credit limit reached. Please upgrade your plan or add credits.')
      if (response.status === 403) throw new Error('Upgrade required for this model. Please upgrade to access premium models.')
      if (response.status === 404) throw new Error('API endpoint not found. Please check your configuration or try again later.')
      if (response.status === 401) throw new Error('Authentication failed. Please check your API key in Settings.')
      if (response.status === 429) throw new Error('Too many requests. Please wait a moment and try again.')
      if (response.status >= 500) throw new Error('Server error. The AI service is temporarily unavailable. Please try again later.')

      // Try to parse as JSON for structured errors, fallback to generic message
      try {
        const errorData = await response.json()
        const errorMessage = errorData.error || errorData.message || `Request failed with status ${response.status}`
        throw new Error(errorMessage)
      } catch (parseError) {
        // If JSON parsing fails, provide a generic but clean error
        throw new Error(`Unable to process request. Please try again or contact support. (Error ${response.status})`)
      }
    }

    return response
  }

  abstract generateResponse(
    model: string,
    message: string,
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse>
}

// OpenAI
export class OpenAIAPI extends BaseAIAPI {
  protected provider = 'openai'
  protected envKey = 'NEXT_PUBLIC_OPENAI_API_KEY'

  constructor() { super(); this.initKey(); }

  async generateResponse(model: string, message: string, context: ConversationContext, onChunk?: (chunk: string) => void, signal?: AbortSignal): Promise<AIResponse> {
    const response = await this.callGateway(model, message, context, signal)
    if (onChunk) return this.handleStreamingResponse(response, onChunk, signal)
    const data = await response.json()
    return { text: data.choices[0].message.content, model: this.provider, timestamp: Date.now() }
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
      return { text: fullResponse, model: this.provider, timestamp: Date.now() }
    } finally { reader.releaseLock() }
  }
}

// Mistral
export class MistralAPI extends BaseAIAPI {
  protected provider = 'mistral'
  protected envKey = 'NEXT_PUBLIC_MISTRAL_API_KEY'

  constructor() { super(); this.initKey(); }

  protected initKey() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`api_key_${this.provider}`)
      if (stored) { this.apiKey = stored; return }
    }
    this.apiKey = process.env.NEXT_PUBLIC_MISTRAL_API_KEY || ''
  }

  async generateResponse(model: string, message: string, context: ConversationContext, onChunk?: (chunk: string) => void, signal?: AbortSignal): Promise<AIResponse> {
    const response = await this.callGateway(model, message, context, signal)
    // Mistral uses same SSE format as OpenAI
    return this.handleStreamingResponse(response, onChunk, signal)
  }

  private async handleStreamingResponse(response: Response, onChunk?: (chunk: string) => void, signal?: AbortSignal): Promise<AIResponse> {
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
              // Mistral sometimes has slightly different choice structure but mostly same
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullResponse += content
                if (onChunk) onChunk(content)
              }
            } catch (e) {
              console.log('[MistralAPI] Parse error or non-content chunk:', data.substring(0, 100))
            }
          }
        }
      }
      console.log('[MistralAPI] Final response length:', fullResponse.length)
      return { text: fullResponse, model: this.provider, timestamp: Date.now() }
    } finally { reader.releaseLock() }
  }
}

// Claude (Anthropic)
export class ClaudeAPI extends BaseAIAPI {
  protected provider = 'claude'
  protected envKey = 'NEXT_PUBLIC_ANTHROPIC_API_KEY'

  constructor() { super(); this.initKey(); }

  async generateResponse(model: string, message: string, context: ConversationContext, onChunk?: (chunk: string) => void, signal?: AbortSignal): Promise<AIResponse> {
    const response = await this.callGateway(model, message, context, signal)
    if (onChunk) return this.handleStreamingResponse(response, onChunk, signal)
    const data = await response.json()
    return { text: data.content[0].text, model: this.provider, timestamp: Date.now() }
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
          if (line.startsWith('event: content_block_delta')) continue
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
      return { text: fullResponse, model: this.provider, timestamp: Date.now() }
    } finally { reader.releaseLock() }
  }
}

// Grok (OpenAI Compatible)
export class GrokAPI extends OpenAIAPI {
  protected provider = 'grok'
  protected envKey = 'NEXT_PUBLIC_XAI_API_KEY'
  constructor() { super(); this.initKey(); }
}

// Gemini
export class GeminiAPI extends BaseAIAPI {
  protected provider = 'gemini'
  protected envKey = 'NEXT_PUBLIC_GEMINI_API_KEY'

  constructor() { super(); this.initKey(); }

  protected initKey() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`api_key_${this.provider}`)
      if (stored) { this.apiKey = stored; return }
    }
    this.apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  }

  async generateResponse(model: string, message: string, context: ConversationContext, onChunk?: (chunk: string) => void, signal?: AbortSignal): Promise<AIResponse> {
    const response = await this.callGateway(model, message, context, signal)
    // Server returns raw Google stream (JSON Array)
    if (onChunk) return this.handleStreamingResponse(response, onChunk, signal)
    const data = await response.json()
    // Handle non-stream response from server if it wasn't a stream
    if (data.candidates) return { text: data.candidates[0].content.parts[0].text, model: this.provider, timestamp: Date.now() }
    return { text: '', model: this.provider, timestamp: Date.now() }
  }

  private async handleStreamingResponse(response: Response, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<AIResponse> {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ''
    let chunkCount = 0
    if (!reader) throw new Error('No response body')

    try {
      while (true) {
        if (signal?.aborted) { reader.cancel(); throw new Error('Aborted'); }
        const { done, value } = await reader.read()
        if (done) {
          console.log(`[GeminiAPI] Stream complete. Total chunks: ${chunkCount}, Final length: ${fullResponse.length} chars`)
          break
        }
        const chunk = decoder.decode(value)
        chunkCount++

        // Gemini returns a JSON array stream like "[{...},\n,{...}]"
        // Extract text content from the JSON structure
        // The regex matches "text": "..." patterns and handles escaped characters
        const matches = chunk.matchAll(/"text":\s*"((?:[^"\\]|\\.)*)"/g)
        for (const match of matches) {
          // Unescape the content - handle all escape sequences including Unicode
          let content = match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')

          // Unescape Unicode sequences like \u003e to >
          content = content.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
          )

          if (content) {
            fullResponse += content
            onChunk(content)
          }
        }
      }
      console.log(`[GeminiAPI] Returning response with ${fullResponse.length} characters`)
      return { text: fullResponse, model: this.provider, timestamp: Date.now() }
    } finally { reader.releaseLock() }
  }
}

// OpenRouter (OpenAI Compatible)
export class OpenRouterAPI extends OpenAIAPI {
  protected provider = 'openrouter'
  protected envKey = 'NEXT_PUBLIC_OPENROUTER_API_KEY'
  constructor() {
    super();
    this.initKey();
  }

  protected initKey() {
    // Explicit access is required for Next.js build-time inlining
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`api_key_${this.provider}`)
      if (stored) {
        this.apiKey = stored
        return
      }
    }
    this.apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || ''
  }
}

// AI Service Manager
export class AIService {
  private mistralAPI: MistralAPI
  private geminiAPI: GeminiAPI
  private openaiAPI: OpenAIAPI
  private claudeAPI: ClaudeAPI
  private grokAPI: GrokAPI
  private openrouterAPI: OpenRouterAPI

  constructor() {
    this.mistralAPI = new MistralAPI()
    this.geminiAPI = new GeminiAPI()
    this.openaiAPI = new OpenAIAPI()
    this.claudeAPI = new ClaudeAPI()
    this.grokAPI = new GrokAPI()
    this.openrouterAPI = new OpenRouterAPI()
  }

  public getMistralAPI(): MistralAPI { return this.mistralAPI }
  public getGeminiAPI(): GeminiAPI { return this.geminiAPI }

  async generateResponse(
    model: string,
    message: string,
    context: ConversationContext,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    const normalizedModel = model.toLowerCase()

    if (normalizedModel.includes('openrouter')) return this.openrouterAPI.generateResponse(model, message, context, onChunk, signal)
    if (normalizedModel.includes('mistral') || normalizedModel.includes('codestral') || normalizedModel.includes('ministral')) return this.mistralAPI.generateResponse(model, message, context, onChunk, signal)
    if (normalizedModel.includes('gemini')) return this.geminiAPI.generateResponse(model, message, context, onChunk, signal)
    if (normalizedModel.includes('gpt') || normalizedModel.includes('openai')) return this.openaiAPI.generateResponse(model, message, context, onChunk, signal)
    if (normalizedModel.includes('claude')) return this.claudeAPI.generateResponse(model, message, context, onChunk, signal)
    if (normalizedModel.includes('grok')) return this.grokAPI.generateResponse(model, message, context, onChunk, signal)

    throw new Error(`Unsupported model: ${model}`)
  }

  // Simplified availability check (UI uses this for listing, but Gateway handles real auth)
  // We return TRUE if we have a key (BYOK) OR if it's a Free model (Gemini/Mistral/Llama)
  // But wait, the prompt says "Lock" logic in UI handles visual restrictions.
  // Here we just report if we have a key for BYOK purposes?
  // Actually, UI calls this to populate the dropdown.
  // We should keep `hasKey` as "User provided a key".
  isModelAvailable(model: string): boolean {
    const normalizedModel = model.toLowerCase()

    // Always allow these models (they use env keys on the server)
    // This allows the Client to try calling the Server even if the Client Logic 
    // doesn't have the API Key (e.g. Build Time env var missing).
    // The Server will then use its Runtime Env Vars to fulfill the request.
    const allowedModels = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'mistral-small-latest'
    ].map(id => id.toLowerCase())
    if (allowedModels.some(id => normalizedModel.includes(id))) return true

    // Check local keys for other models
    if (normalizedModel.includes('openrouter')) return this.openrouterAPI.hasKey()
    if (normalizedModel.includes('mistral') || normalizedModel.includes('codestral') || normalizedModel.includes('ministral')) return this.mistralAPI.hasKey()
    if (normalizedModel.includes('gemini')) return this.geminiAPI.hasKey()
    if (normalizedModel.includes('gpt') || normalizedModel.includes('openai')) return this.openaiAPI.hasKey()
    if (normalizedModel.includes('claude')) return this.claudeAPI.hasKey()
    if (normalizedModel.includes('grok')) return this.grokAPI.hasKey()

    return false
  }

  updateKey(provider: string, key: string) {
    switch (provider.toLowerCase()) {
      case 'openrouter': this.openrouterAPI.setApiKey(key); break;
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

  // Get the best available model based on keys and discovered models
  getBestModel(): string {
    // Priority 1: Check for Gemini key first (most likely configured)
    if (this.geminiAPI.hasKey()) {
      return 'gemini-2.5-flash'
    }

    // Priority 2: Check for Mistral key
    if (this.mistralAPI.hasKey()) {
      return 'mistral-small-latest'
    }

    // Priority 3: Check discovered models from other providers
    const providers = ['openai', 'claude', 'grok']
    for (const provider of providers) {
      if (this.getKey(provider)) {
        const cached = getCachedModels(provider)
        if (cached && cached.length > 0) {
          return cached[0].id
        }
      }
    }

    // Priority 4: Default fallback to Gemini 2.5 Flash (will use server key)
    return 'gemini-2.5-flash'
  }
}

export const aiService = new AIService()
