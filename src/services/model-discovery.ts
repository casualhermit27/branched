// Model Discovery Service
// Auto-detects provider from API key and fetches available models

export interface DiscoveredModel {
    id: string
    name: string
    provider: string
    description?: string
    contextWindow?: number
    maxTokens?: number
}

export interface ProviderInfo {
    id: string
    name: string
    models: DiscoveredModel[]
}

// Detect provider from API key prefix
export function detectProviderFromKey(apiKey: string): string | null {
    if (!apiKey || apiKey.length < 10) return null

    const key = apiKey.trim()

    // OpenAI keys start with "sk-" (but not "sk-ant-")
    if (key.startsWith('sk-') && !key.startsWith('sk-ant-')) {
        return 'openai'
    }

    // Anthropic keys start with "sk-ant-"
    if (key.startsWith('sk-ant-')) {
        return 'claude'
    }

    // Google/Gemini keys are typically 39 characters starting with "AI"
    if (key.startsWith('AI') && key.length >= 39) {
        return 'gemini'
    }

    // Mistral keys are UUIDs or start with specific patterns
    // They're typically 32 characters (UUID without dashes) or have specific format
    if (key.length === 32 && /^[a-zA-Z0-9]+$/.test(key)) {
        return 'mistral'
    }

    // xAI/Grok keys - they use a similar format to OpenAI
    if (key.startsWith('xai-')) {
        return 'grok'
    }

    return null
}

// Fetch available models from OpenAI
async function fetchOpenAIModels(apiKey: string): Promise<DiscoveredModel[]> {
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        })

        if (!response.ok) {
            console.error('OpenAI models fetch failed:', response.status)
            return []
        }

        const data = await response.json()

        // Filter to chat models only (gpt-*)
        const chatModels = data.data
            .filter((m: any) => m.id.startsWith('gpt-') && !m.id.includes('instruct'))
            .map((m: any) => ({
                id: m.id,
                name: formatModelName(m.id),
                provider: 'openai',
                description: getModelDescription(m.id)
            }))
            .sort((a: DiscoveredModel, b: DiscoveredModel) => {
                // Sort by model version (newer first)
                return b.id.localeCompare(a.id)
            })

        // Return top models, deduplicated
        const uniqueModels = deduplicateModels(chatModels)
        return uniqueModels.length > 0 ? uniqueModels : getDefaultOpenAIModels()
    } catch (error) {
        console.error('Error fetching OpenAI models:', error)
        return []
    }
}

// Fetch available models from Anthropic
async function fetchAnthropicModels(apiKey: string): Promise<DiscoveredModel[]> {
    // Anthropic doesn't have a public models list endpoint that works from browser
    // Return known models - the API will reject if user doesn't have access
    return [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'claude', description: 'Most intelligent model' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'claude', description: 'Fast and efficient' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'claude', description: 'Powerful for complex tasks' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'claude', description: 'Balanced performance' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'claude', description: 'Fastest response' },
    ]
}

// Fetch available models from Google Gemini
async function fetchGeminiModels(apiKey: string): Promise<DiscoveredModel[]> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        )

        if (!response.ok) {
            console.error('Gemini models fetch failed:', response.status)
            return []
        }

        const data = await response.json()

        // Filter to generative models
        const generativeModels = data.models
            .filter((m: any) => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => ({
                id: m.name.replace('models/', ''),
                name: formatModelName(m.displayName || m.name.replace('models/', '')),
                provider: 'gemini',
                description: m.description?.substring(0, 100)
            }))

        return generativeModels.length > 0 ? generativeModels : getDefaultGeminiModels()
    } catch (error) {
        console.error('Error fetching Gemini models:', error)
        return []
    }
}

// Fetch available models from Mistral
async function fetchMistralModels(apiKey: string): Promise<DiscoveredModel[]> {
    try {
        const response = await fetch('https://api.mistral.ai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        })

        if (!response.ok) {
            console.error('Mistral models fetch failed:', response.status)
            return []
        }

        const data = await response.json()

        const models = data.data
            .map((m: any) => ({
                id: m.id,
                name: formatModelName(m.id),
                provider: 'mistral',
                description: m.description || ''
            }))

        return models.length > 0 ? models : getDefaultMistralModels()
    } catch (error) {
        console.error('Error fetching Mistral models:', error)
        return []
    }
}

// Fetch available models from xAI (Grok)
async function fetchGrokModels(apiKey: string): Promise<DiscoveredModel[]> {
    try {
        const response = await fetch('https://api.x.ai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        })

        if (!response.ok) {
            console.error('xAI models fetch failed:', response.status)
            return []
        }

        const data = await response.json()

        const models = data.data
            .map((m: any) => ({
                id: m.id,
                name: formatModelName(m.id),
                provider: 'grok',
                description: ''
            }))

        return models.length > 0 ? models : getDefaultGrokModels()
    } catch (error) {
        console.error('Error fetching xAI models:', error)
        return []
    }
}

// Fetch available models from OpenRouter
async function fetchOpenRouterModels(apiKey: string): Promise<DiscoveredModel[]> {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        })

        if (!response.ok) {
            console.error('OpenRouter models fetch failed:', response.status)
            return []
        }

        const data = await response.json()
        const models = data.data
            .map((m: any) => ({
                id: m.id,
                name: m.name,
                provider: 'openrouter',
                description: m.description,
                contextWindow: m.context_length
            }))
            .sort((a: DiscoveredModel, b: DiscoveredModel) => a.name.localeCompare(b.name))

        return models.length > 0 ? models : []
    } catch (error) {
        console.error('Error fetching OpenRouter models:', error)
        return []
    }
}

// Main function to discover models for a provider
export async function discoverModels(provider: string, apiKey: string): Promise<DiscoveredModel[]> {
    switch (provider) {
        case 'openai':
            return fetchOpenAIModels(apiKey)
        case 'claude':
            return fetchAnthropicModels(apiKey)
        case 'gemini':
            return fetchGeminiModels(apiKey)
        case 'mistral':
            return fetchMistralModels(apiKey)
        case 'grok':
            return fetchGrokModels(apiKey)
        case 'openrouter':
            return fetchOpenRouterModels(apiKey)
        default:
            return []
    }
}

// Validate an API key by attempting to fetch models
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; provider: string | null; models: DiscoveredModel[] }> {
    const provider = detectProviderFromKey(apiKey)

    if (!provider) {
        return { valid: false, provider: null, models: [] }
    }

    try {
        const models = await discoverModels(provider, apiKey)
        return {
            valid: models.length > 0,
            provider,
            models
        }
    } catch (error) {
        return { valid: false, provider, models: [] }
    }
}

// Helper functions
function formatModelName(id: string): string {
    // Convert model IDs to human-readable names
    const nameMap: Record<string, string> = {
        // OpenAI
        'gpt-5.1-thinking': 'GPT-5.1 Thinking',
        'gpt-5.1-instant': 'GPT-5.1 Instant',
        'gpt-5.1-codex-max': 'GPT-5.1 Codex Max',
        'gpt-4o': 'GPT-4o',
        'gpt-4o-mini': 'GPT-4o Mini',

        // Anthropic
        'claude-4-5-opus-20251124': 'Claude 4.5 Opus',
        'claude-4-5-sonnet-20250921': 'Claude 4.5 Sonnet',
        'claude-4-5-haiku-20251015': 'Claude 4.5 Haiku',
        'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',

        // Google
        'gemini-3.0-pro-preview': 'Gemini 3.0 Pro',
        'gemini-3.0-pro-image-preview': 'Gemini 3.0 Pro Vision',
        'gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
        'gemini-1.5-pro': 'Gemini 1.5 Pro',

        // Mistral
        'mistral-large-latest': 'Mistral Large 3',
        'mistral-large-2411': 'Mistral Large 3',
        'ministral-3-latest': 'Ministral 3',
        'codestral-2501': 'Codestral 2.0',

        // xAI
        'grok-2': 'Grok 2',
        'grok-beta': 'Grok Beta',
    }

    return nameMap[id] || id
        .replace(/-/g, ' ')
        .replace(/(\d+)/g, ' $1')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .trim()
}

function getModelDescription(id: string): string {
    const descMap: Record<string, string> = {
        'gpt-5.1-thinking': 'Advanced reasoning & problem solving',
        'gpt-5.1-instant': 'Fast, conversational responses',
        'claude-4-5-opus-20251124': 'State-of-the-art coding & reasoning',
        'gemini-3.0-pro-preview': '1M context, multimodal reasoning',
        'mistral-large-latest': 'Top-tier open weights model',
    }
    return descMap[id] || ''
}

function deduplicateModels(models: DiscoveredModel[]): DiscoveredModel[] {
    const seen = new Set<string>()
    return models.filter(m => {
        // Keep only base model versions, skip dated versions
        const baseId = m.id.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-\d{4}$/, '')
        if (seen.has(baseId)) return false
        seen.add(baseId)
        return true
    })
}

// Default model lists (fallbacks)
function getDefaultOpenAIModels(): DiscoveredModel[] {
    return [
        { id: 'gpt-5.1-thinking', name: 'GPT-5.1 Thinking', provider: 'openai', description: 'Advanced reasoning' },
        { id: 'gpt-5.1-instant', name: 'GPT-5.1 Instant', provider: 'openai', description: 'Fast chat' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Reliable all-rounder' },
    ]
}

function getDefaultGeminiModels(): DiscoveredModel[] {
    return [
        { id: 'gemini-3.0-pro-preview', name: 'Gemini 3.0 Pro', provider: 'gemini', description: 'Most intelligent Gemini' },
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'gemini', description: 'Fast responses' },
    ]
}

function getDefaultMistralModels(): DiscoveredModel[] {
    return [
        { id: 'mistral-large-latest', name: 'Mistral Large 3', provider: 'mistral', description: 'Most capable' },
        { id: 'ministral-3-latest', name: 'Ministral 3', provider: 'mistral', description: 'Efficient edge model' },
        { id: 'codestral-latest', name: 'Codestral', provider: 'mistral', description: 'Code specialization' },
    ]
}

function getDefaultGrokModels(): DiscoveredModel[] {
    return [
        { id: 'grok-2', name: 'Grok 2', provider: 'grok', description: 'Latest xAI model' },
    ]
}

// Store for discovered models per provider
const modelCache: Map<string, DiscoveredModel[]> = new Map()

export function getCachedModels(provider: string): DiscoveredModel[] | null {
    return modelCache.get(provider) || null
}

export function setCachedModels(provider: string, models: DiscoveredModel[]): void {
    modelCache.set(provider, models)
}

export function clearModelCache(): void {
    modelCache.clear()
}
