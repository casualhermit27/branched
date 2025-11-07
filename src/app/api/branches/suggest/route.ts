// API Route: /api/branches/suggest
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, message, availableModels } = body

    // Simple suggestion logic - can be enhanced with AI
    const suggestions = []
    
    // Check message characteristics
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('creative') || lowerMessage.includes('write')) {
      suggestions.push({
        id: `suggest-${Date.now()}-1`,
        message,
        suggestedModel: 'gpt-4',
        reason: 'GPT-4 excels at creative writing tasks',
        confidence: 0.8
      })
    }
    
    if (lowerMessage.includes('code') || lowerMessage.includes('programming')) {
      suggestions.push({
        id: `suggest-${Date.now()}-2`,
        message,
        suggestedModel: 'claude',
        reason: 'Claude is excellent for code generation and analysis',
        confidence: 0.85
      })
    }
    
    if (lowerMessage.includes('research') || lowerMessage.includes('fact')) {
      suggestions.push({
        id: `suggest-${Date.now()}-3`,
        message,
        suggestedModel: 'gemini',
        reason: 'Gemini provides comprehensive research capabilities',
        confidence: 0.75
      })
    }

    // If no specific suggestions, suggest comparing models
    if (suggestions.length === 0 && availableModels.length > 1) {
      suggestions.push({
        id: `suggest-${Date.now()}-4`,
        message,
        suggestedModel: availableModels[1] || 'gemini',
        reason: 'Compare responses from different models for diverse perspectives',
        confidence: 0.6
      })
    }

    return NextResponse.json({ 
      success: true, 
      suggestions: suggestions.slice(0, 3) // Limit to 3 suggestions
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

