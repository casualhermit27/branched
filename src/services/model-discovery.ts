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
            return getDefaultOpenAIModels()
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
        return getDefaultOpenAIModels()
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
            return getDefaultGeminiModels()
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
        return getDefaultGeminiModels()
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
            return getDefaultMistralModels()
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
        return getDefaultMistralModels()
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
            return getDefaultGrokModels()
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
        return getDefaultGrokModels()
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
        'gpt-4o': 'GPT-4o',
        'gpt-4o-mini': 'GPT-4o Mini',
        'gpt-4-turbo': 'GPT-4 Turbo',
        'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
        'gpt-4': 'GPT-4',
        'gpt-3.5-turbo': 'GPT-3.5 Turbo',
        'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
        'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
        'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
        'claude-3-opus-20240229': 'Claude 3 Opus',
        'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
        'claude-3-haiku-20240307': 'Claude 3 Haiku',
        'gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
        'gemini-1.5-pro': 'Gemini 1.5 Pro',
        'gemini-1.5-flash': 'Gemini 1.5 Flash',
        'gemini-pro': 'Gemini Pro',
        'mistral-large-latest': 'Mistral Large',
        'mistral-medium-latest': 'Mistral Medium',
        'mistral-small-latest': 'Mistral Small',
        'open-mistral-7b': 'Mistral 7B',
        'open-mixtral-8x7b': 'Mixtral 8x7B',
        'grok-beta': 'Grok Beta',
        'grok-2': 'Grok 2',
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
        'gpt-4o': 'Most capable GPT-4 model',
        'gpt-4o-mini': 'Fast and affordable',
        'gpt-4-turbo': 'GPT-4 with vision',
        'gpt-4': 'Original GPT-4',
        'gpt-3.5-turbo': 'Fast and efficient',
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
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Most capable GPT-4 model' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Fast and affordable' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', description: 'GPT-4 with vision' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', description: 'Fast and efficient' },
    ]
}

function getDefaultGeminiModels(): DiscoveredModel[] {
    return [
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'gemini', description: 'Latest Gemini model' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', description: 'Advanced reasoning' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', description: 'Fast responses' },
    ]
}

function getDefaultMistralModels(): DiscoveredModel[] {
    return [
        { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', description: 'Most capable' },
        { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'mistral', description: 'Fast and efficient' },
    ]
}

function getDefaultGrokModels(): DiscoveredModel[] {
    return [
        { id: 'grok-beta', name: 'Grok Beta', provider: 'grok', description: 'xAI flagship model' },
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
