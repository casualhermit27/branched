export interface ModelConfig {
    id: string
    name: string
    provider: string
    tier: 'free' | 'pro'
    costPerMessage: number // In credits
    description?: string
}

export const MODELS: Record<string, ModelConfig> = {
    // Free Tier Models (Gemini 2.5 & Mistral)
    'gemini-2.5-flash': {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'google',
        tier: 'free',
        costPerMessage: 0,
        description: 'Fast, efficient, next-gen multimodal'
    },
    'gemini-2.5-pro': {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'google',
        tier: 'free',
        costPerMessage: 0,
        description: 'Advanced reasoning and multimodal'
    },
    'mistral-small-latest': {
        id: 'mistral-small-latest',
        name: 'Mistral Small',
        provider: 'mistral',
        tier: 'free',
        costPerMessage: 0,
        description: 'Efficient and low-latency'
    },

    // Pro Tier Models
    'gpt-4o': {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        tier: 'pro',
        costPerMessage: 10,
        description: 'Most advanced model for complex tasks'
    },
    'gpt-4-turbo': {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        tier: 'pro',
        costPerMessage: 10,
        description: 'High-intelligence model with updated knowledge'
    },
    'claude-3-5-sonnet-20241022': {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        tier: 'pro',
        costPerMessage: 10,
        description: 'Balanced intelligence and speed'
    },
    'claude-3-opus': {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        tier: 'pro',
        costPerMessage: 20,
        description: 'Most powerful model for highly complex tasks'
    },
    'gemini-1.5-pro': {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        tier: 'pro',
        costPerMessage: 10,
        description: 'Next-gen multimodal reasoning'
    },
    'mistral-large-latest': {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        provider: 'mistral',
        tier: 'pro',
        costPerMessage: 10,
        description: 'Top-tier reasoning capabilities'
    },
    // Previously free models moved to Pro/Hidden or just removed from Free list logic
    'gpt-3.5-turbo': {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        tier: 'pro',
        costPerMessage: 5,
        description: 'Legacy reliable model'
    },
    'claude-3-haiku': {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        tier: 'pro',
        costPerMessage: 5,
        description: 'Fastest model'
    }
}

export const FREE_DAILY_LIMIT = 50
export const PRO_MONTHLY_CREDITS = 1000000 // 1 Million credits
