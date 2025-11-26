'use client'

import type { ReactNode } from 'react'
import type { AI, Message } from '@/hooks/use-conversation-state'

type AIInput = AI & {
	functional?: boolean
	logo?: ReactNode
}

const getDefaultInitialLogo = (): ReactNode => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<circle cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="1.5" fill="none" />
		<path
			d="M8 12L10.5 9.5L15.5 14.5"
			stroke="#8B5CF6"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<circle cx="6" cy="6" r="1" fill="#8B5CF6" />
		<circle cx="18" cy="6" r="1" fill="#8B5CF6" />
		<circle cx="6" cy="18" r="1" fill="#8B5CF6" />
		<circle cx="18" cy="18" r="1" fill="#8B5CF6" />
	</svg>
)

const getBestGradientLogo = (): ReactNode => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		className="drop-shadow-sm"
	>
		<defs>
			<linearGradient id="bestGradientRestore" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stopColor="#8B5CF6" />
				<stop offset="50%" stopColor="#6366F1" />
				<stop offset="100%" stopColor="#3B82F6" />
			</linearGradient>
		</defs>
		<path
			d="M12 2L14.5 8.5L21 9.5L16 14L17.5 20.5L12 17L6.5 20.5L8 14L3 9.5L9.5 8.5L12 2Z"
			fill="url(#bestGradientRestore)"
			opacity="0.9"
			className="drop-shadow-sm"
		/>
		<path
			d="M12 5L13.5 9L17 9.5L14 12L14.5 15.5L12 13.5L9.5 15.5L10 12L7 9.5L10.5 9L12 5Z"
			fill="white"
			opacity="0.3"
		/>
	</svg>
)

const getLogoForAI = (ai: AIInput, gradient = false): ReactNode => {
	if (ai.id === 'best') {
		return gradient ? getBestGradientLogo() : getDefaultInitialLogo()
	}

	if (ai.id === 'gemini-2.5-pro') {
		return <img src="/logos/gemini.svg" alt="Gemini" className="w-5 h-5" />
	}

	if (ai.id === 'mistral-large') {
		return <img src="/logos/mistral-ai_logo.svg" alt="Mistral" className="w-5 h-5" />
	}

	return <span className="text-xs font-medium">{ai.name.charAt(0)}</span>
}

const normalizeAi = (ai: AIInput, gradient = false): AI => ({
	id: ai.id,
	name: ai.name,
	color: ai.color,
	functional: ai.functional !== undefined ? ai.functional : true,
	logo: ai.logo ?? getLogoForAI(ai, gradient)
})

export function restoreAILogos(ai: AIInput): AI {
	return normalizeAi(ai, false)
}

export function restoreBranchAILogos(ai: AIInput): AI {
	return normalizeAi(ai, true)
}

export function sanitizeMessages(msgs: any[]): Message[] {
	if (!msgs || !Array.isArray(msgs)) return []

	return msgs
		.filter(msg => msg && typeof msg === 'object' && msg.id)
		.map(msg => {
			const finalText = msg.text || msg.streamingText || ''

			const sanitized: Message = {
				...msg,
				text: finalText,
				isStreaming: false,
				streamingText: undefined
			}

			Object.keys(sanitized).forEach(key => {
				if (sanitized[key as keyof Message] === undefined) {
					delete sanitized[key as keyof Message]
				}
			})

			return sanitized
		})
}

