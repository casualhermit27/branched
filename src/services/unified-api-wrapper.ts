// Enhanced Unified API Wrapper with retry logic, cost tracking, and analytics
import { AnalyticsService, AuditLogger } from './analytics-service'

export interface UnifiedAPIRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

export interface UnifiedAPIResponse {
  text: string
  model: string
  timestamp: number
  latency: number
  tokensUsed?: number
  cost?: number
  confidenceScore?: number
}

export interface ModelConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
  costPer1kTokens?: {
    input: number
    output: number
  }
  maxRetries?: number
  retryDelay?: number
}

export class UnifiedAPIWrapper {
  private configs: Map<string, ModelConfig> = new Map()
  private defaultRetries = 3
  private defaultRetryDelay = 1000

  constructor() {
    this.initializeConfigs()
  }

  private initializeConfigs() {
    // Mistral config
    this.configs.set('mistral', {
      id: 'mistral',
      name: 'Mistral',
      baseUrl: process.env.NEXT_PUBLIC_MISTRAL_API_URL || 'https://api.mistral.ai/v1/chat/completions',
      apiKey: process.env.NEXT_PUBLIC_MISTRAL_API_KEY || '',
      modelName: process.env.NEXT_PUBLIC_MISTRAL_MODEL || 'mistral-large-latest',
      costPer1kTokens: { input: 0.002, output: 0.006 },
      maxRetries: 3,
      retryDelay: 1000
    })

    // Gemini config
    this.configs.set('gemini', {
      id: 'gemini',
      name: 'Gemini',
      baseUrl: process.env.NEXT_PUBLIC_GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models',
      apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
      modelName: process.env.NEXT_PUBLIC_GEMINI_MODEL || 'models/gemini-2.0-flash-exp',
      costPer1kTokens: { input: 0.000125, output: 0.0005 },
      maxRetries: 3,
      retryDelay: 1000
    })
  }

  /**
   * Generate response with retry logic, cost tracking, and analytics
   */
  async generateResponse(
    request: UnifiedAPIRequest,
    conversationId: string,
    branchId?: string,
    messageId?: string
  ): Promise<UnifiedAPIResponse> {
    const config = this.configs.get(request.model)
    if (!config) {
      throw new Error(`Model ${request.model} not configured`)
    }

    const startTime = Date.now()
    let lastError: Error | null = null
    const maxRetries = config.maxRetries || this.defaultRetries
    const retryDelay = config.retryDelay || this.defaultRetryDelay

    // Retry logic
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.callAPI(config, request)
        const latency = Date.now() - startTime

        // Calculate cost
        const tokensUsed = response.tokensUsed || this.estimateTokens(request.messages, response.text)
        const cost = this.calculateCost(config, tokensUsed, response.text.length > request.messages.reduce((sum, m) => sum + m.content.length, 0))

        // Track analytics
        if (conversationId && messageId) {
          await AnalyticsService.trackModelUsage(
            conversationId,
            branchId,
            messageId,
            request.model,
            latency,
            tokensUsed,
            cost,
            true
          )

          await AuditLogger.logModelUsage(conversationId, request.model, tokensUsed, cost, branchId)
        }

        return {
          ...response,
          latency,
          tokensUsed,
          cost
        }
      } catch (error: any) {
        lastError = error
        console.warn(`Attempt ${attempt + 1}/${maxRetries} failed:`, error.message)

        // Don't retry on certain errors
        if (error.status === 401 || error.status === 403 || error.status === 400) {
          break
        }

        // Wait before retry
        if (attempt < maxRetries - 1) {
          await this.sleep(retryDelay * (attempt + 1)) // Exponential backoff
        }
      }
    }

    // All retries failed - track failure
    const latency = Date.now() - startTime
    if (conversationId && messageId) {
      await AnalyticsService.trackModelUsage(
        conversationId,
        branchId,
        messageId,
        request.model,
        latency,
        0,
        0,
        false,
        lastError?.message
      )
    }

    throw lastError || new Error('All retry attempts failed')
  }

  private async callAPI(config: ModelConfig, request: UnifiedAPIRequest): Promise<any> {
    // This would call the actual API based on model type
    // For now, delegate to existing API classes
    const { aiService } = await import('./ai-api')
    
    // Map unified request to service-specific format
    const message = request.messages[request.messages.length - 1]?.content || ''
    const context = {
      messages: request.messages.map(m => ({
        id: `msg-${Date.now()}`,
        text: m.content,
        isUser: m.role === 'user',
        timestamp: Date.now(),
        children: []
      })),
      currentBranch: 'main'
    }

    if (config.id === 'mistral') {
      return await aiService.mistralAPI.generateResponse(message, context)
    } else if (config.id === 'gemini') {
      return await aiService.geminiAPI.generateResponse(message, context)
    }

    throw new Error(`Unsupported model: ${config.id}`)
  }

  private estimateTokens(messages: Array<{ content: string }>, response: string): number {
    // Simple estimation: ~4 characters per token
    const inputTokens = messages.reduce((sum, m) => sum + m.content.length, 0) / 4
    const outputTokens = response.length / 4
    return Math.ceil(inputTokens + outputTokens)
  }

  private calculateCost(config: ModelConfig, tokensUsed: number, isOutput: boolean): number {
    if (!config.costPer1kTokens) return 0
    
    const costPer1k = isOutput ? config.costPer1kTokens.output : config.costPer1kTokens.input
    return (tokensUsed / 1000) * costPer1k
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get model configuration
   */
  getConfig(modelId: string): ModelConfig | undefined {
    return this.configs.get(modelId)
  }

  /**
   * Add custom model configuration
   */
  addConfig(config: ModelConfig): void {
    this.configs.set(config.id, config)
  }
}

export const unifiedAPI = new UnifiedAPIWrapper()

