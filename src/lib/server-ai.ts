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
        else if (provider === 'openrouter') key = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY
    }

    if (!key) {
        throw new Error(`Missing API Key for provider: ${provider}`)
    }

    // 2. Call Provider
    switch (provider) {
        case 'openai':
        case 'grok': // Grok is OpenAI compatible
        case 'openrouter':
            return streamOpenAI(key, model, messages, systemPrompt, provider === 'grok', provider === 'openrouter')


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

// OpenAI / Grok / OpenRouter
async function streamOpenAI(key: string, model: string, messages: any[], system: string | undefined, isGrok = false, isOpenRouter = false) {
    let url = 'https://api.openai.com/v1/chat/completions'
    if (isGrok) url = 'https://api.x.ai/v1/chat/completions'
    if (isOpenRouter) url = 'https://openrouter.ai/api/v1/chat/completions'

    // Filter out messages without text content (can happen with streaming leftovers)
    const validMessages = messages.filter(m => m.text && m.text.trim().length > 0)

    const formattedMessages = [
        { role: 'system', content: system || 'You are a helpful assistant.' },
        ...validMessages.map(m => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.text
        }))
    ]

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
    }

    if (isOpenRouter) {
        headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        headers['X-Title'] = 'Branched Chat'
    }

    // For OpenRouter, strip the 'openrouter/' prefix if present
    // Our internal model IDs use 'openrouter/provider/model' format, but the API expects 'provider/model'
    const actualModel = isOpenRouter && model.startsWith('openrouter/')
        ? model.replace('openrouter/', '')
        : model

    console.log(`[Server-AI] Calling ${url} with model: ${actualModel}`)
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: actualModel,
            messages: formattedMessages,
            stream: true
        })
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error(`[Server-AI] Error from ${url}: ${res.status} - ${errorText}`)
        throw new Error(`API error: ${res.status} - ${errorText}`)
    }

    console.log(`[Server-AI] Response status: ${res.status}`)
    return res
}

// Anthropic
async function streamAnthropic(key: string, model: string, messages: any[], system: string | undefined) {
    // Filter out messages without text content
    const validMessages = messages.filter(m => m.text && m.text.trim().length > 0)

    const formattedMessages = validMessages.map(m => ({
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
    // Normalize model name - if just "gemini" is passed, use the default model
    const modelName = model === 'gemini' ? 'gemini-2.5-flash' : model
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${key}`

    console.log(`[Gemini] Using model: ${modelName}`)
    console.log(`[Gemini] Received ${messages.length} messages`)

    // Filter out messages without text content
    const validMessages = messages.filter(m => m.text && m.text.trim().length > 0)

    console.log(`[Gemini] Valid messages: ${validMessages.length}`)
    console.log(`[Gemini] Message roles:`, validMessages.map(m => ({
        isUser: m.isUser,
        textPreview: m.text?.substring(0, 50) + '...'
    })))

    const contents = [
        ...(system ? [{ role: 'user', parts: [{ text: `System: ${system}` }] }] : []),
        ...validMessages.map(m => ({
            role: m.isUser ? 'user' : 'model',
            parts: [{ text: m.text }]
        }))
    ]

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error(`[Gemini] API Error: ${res.status} - ${errorText}`)
        throw new Error(`Gemini API error: ${res.status} - ${errorText}`)
    }

    console.log(`[Gemini] Response status: ${res.status}, streaming response...`)
    return res
}

// Mistral
async function streamMistral(key: string, model: string, messages: any[], system: string | undefined) {
    // Filter out messages without text content
    const validMessages = messages.filter(m => m.text && m.text.trim().length > 0)

    const formattedMessages = [
        { role: 'system', content: system || 'You are a helpful assistant.' },
        ...validMessages.map(m => ({
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
