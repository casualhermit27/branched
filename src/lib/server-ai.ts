import { ConversationContext } from '../services/ai-api'

// Server-side AI Provider Implementations

interface ServerAIConfig {
    model: string
    apiKey?: string // Optional BYOK key
}

export async function generateServerResponse(
    provider: string,
    config: ServerAIConfig,
    messages: any[],
    systemPrompt?: string
): Promise<Response> {
    const { model, apiKey } = config

    // 1. Get API Key (Order: BYOK -> Env)
    let key = apiKey
    if (!key) {
        if (provider === 'openai') key = process.env.NEXT_PUBLIC_OPENAI_API_KEY
        else if (provider === 'anthropic' || provider === 'claude') key = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
        else if (provider === 'google' || provider === 'gemini') key = process.env.NEXT_PUBLIC_GEMINI_API_KEY
        else if (provider === 'mistral') key = process.env.NEXT_PUBLIC_MISTRAL_API_KEY
        else if (provider === 'xai' || provider === 'grok') key = process.env.NEXT_PUBLIC_XAI_API_KEY
    }

    if (!key) {
        throw new Error(`Missing API Key for provider: ${provider}`)
    }

    // 2. Call Provider
    switch (provider) {
        case 'openai':
        case 'grok': // Grok is OpenAI compatible
            return streamOpenAI(key, model, messages, systemPrompt, provider === 'grok')

        case 'anthropic':
        case 'claude':
            return streamAnthropic(key, model, messages, systemPrompt)

        case 'google':
        case 'gemini':
            return streamGemini(key, model, messages, systemPrompt)

        case 'mistral':
            return streamMistral(key, model, messages, systemPrompt)

        default:
            throw new Error(`Unsupported provider: ${provider}`)
    }
}

// OpenAI / Grok
async function streamOpenAI(key: string, model: string, messages: any[], system: string | undefined, isGrok = false) {
    const url = isGrok ? 'https://api.x.ai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'

    const formattedMessages = [
        { role: 'system', content: system || 'You are a helpful assistant.' },
        ...messages.map(m => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.text
        }))
    ]

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: model,
            messages: formattedMessages,
            stream: true
        })
    })

    return res
}

// Anthropic
async function streamAnthropic(key: string, model: string, messages: any[], system: string | undefined) {
    const formattedMessages = messages.map(m => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text
    }))

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: model,
            messages: formattedMessages,
            system: system,
            stream: true,
            max_tokens: 4096
        })
    })

    return res
}

// Gemini
async function streamGemini(key: string, model: string, messages: any[], system: string | undefined) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}`

    const contents = [
        ...(system ? [{ role: 'user', parts: [{ text: `System: ${system}` }] }] : []),
        ...messages.map(m => ({
            role: m.isUser ? 'user' : 'model',
            parts: [{ text: m.text }]
        }))
    ]

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    })

    return res
}

// Mistral
async function streamMistral(key: string, model: string, messages: any[], system: string | undefined) {
    const formattedMessages = [
        { role: 'system', content: system || 'You are a helpful assistant.' },
        ...messages.map(m => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.text
        }))
    ]

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: model,
            messages: formattedMessages,
            stream: true
        })
    })

    return res
}
