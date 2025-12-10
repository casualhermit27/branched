'use client'

import { useCallback } from 'react'
import type {
	AI,
	Message,
	ConversationState,
	Branch as ConversationBranch
} from './use-conversation-state'
import { aiService, type ConversationContext } from '@/services/ai-api'

interface ToastOptions {
	type: 'success' | 'error' | 'info' | 'warning'
	title: string
	message: string
}

interface UseConversationMessageActionsParams {
	state: ConversationState
	addToast: (toast: ToastOptions) => void
	checkLimit?: (type: 'branch' | 'message') => boolean
}

export function useConversationMessageActions({
	state,
	addToast,
	checkLimit
}: UseConversationMessageActionsParams) {
	const {
		selectedAIs,
		setSelectedAIs,
		messages,
		setMessages,
		currentBranch,
		setConversationNodes,
		conversationNodes,
		activeBranchId,
		setActiveBranchId,
		setPendingBranchMessageId,
		setShowBranchWarning,
		pendingBranchData,
		setPendingBranchData,
		setSavedBranches,
		setIsGenerating,
		mainAbortControllerRef,
		setShowPricingModal,
		messageCount,
		setMessageCount,
		branchCacheRef
	} = state

	const getBestAvailableModel = useCallback((): string => {
		return aiService.getBestModel()
	}, [])

	const addAI = useCallback((ai: AI) => {
		setSelectedAIs(prev => {
			if (prev.find(selected => selected.id === ai.id)) {
				return prev
			}
			return [...prev, ai]
		})
	}, [setSelectedAIs])

	const removeAI = useCallback((aiId: string) => {
		setSelectedAIs(prev => {
			if (prev.length <= 1) {
				return prev
			}
			return prev.filter(ai => ai.id !== aiId)
		})
	}, [setSelectedAIs])

	const selectSingleAI = useCallback((ai: AI) => {
		setSelectedAIs([ai])
	}, [setSelectedAIs])

	const selectSingleAIById = useCallback((aiId: string) => {
		const targetAI = selectedAIs.find(ai => ai.id === aiId)
		if (targetAI) {
			setSelectedAIs([targetAI])
		}
	}, [selectedAIs, setSelectedAIs])

	const stopGeneration = useCallback(() => {
		setIsGenerating(false)

		if (mainAbortControllerRef.current) {
			mainAbortControllerRef.current.abort()
			mainAbortControllerRef.current = null
		}

		setMessages(prev => prev.map(msg => {
			if (msg.isStreaming && msg.streamingText) {
				return {
					...msg,
					text: msg.streamingText || '[Generation stopped]',
					isStreaming: false,
					streamingText: undefined
				}
			}
			return msg
		}).filter(msg => {
			if (msg.isStreaming && !msg.streamingText) {
				return false
			}
			return true
		}))
	}, [mainAbortControllerRef, setIsGenerating, setMessages])

	const sendMessage = useCallback(async (text: string, branchId?: string) => {
		if (!text.trim()) {
			return
		}

		const targetBranchId = branchId || activeBranchId

		if (checkLimit && !checkLimit('message')) {
			return
		}

		if (messageCount >= 50) {
			setShowPricingModal(true)
			return
		}
		setMessageCount(prev => prev + 1)

		const newMessage: Message = {
			id: `msg-${Date.now()}`,
			text,
			isUser: true,
			timestamp: Date.now(),
			parentId: branchId || undefined,
			children: []
		}

		// Only update global messages if we are targeting the active branch or main
		if (!targetBranchId || targetBranchId === activeBranchId) {
			setMessages(prev => [...prev, newMessage])
		}

		let memoryContext = ''
		try {
			const memoryResponse = await fetch(`/api/memory/context?branchId=${activeBranchId || 'main'}&depth=3&maxMemories=50`)
			if (memoryResponse.ok) {
				const memoryData = await memoryResponse.json()
				if (memoryData.success) {
					memoryContext = memoryData.data.aggregatedContext
				}
			}
		} catch (error) {
			console.error('❌ Error fetching memory context:', error)
		}



		// Prepare context for AI
		let contextMessages = [...messages, newMessage] // Default to main messages if no branch

		if (targetBranchId) {
			const targetNode = conversationNodes.find(n => n.id === targetBranchId)
			if (targetNode) {
				const inherited = targetNode.data?.inheritedMessages || []
				const branchMsgs = targetNode.data?.messages || []
				// Context should be: Inherited + Branch History + New Message
				// Note: branchMsgs typically includes the new message already if we updated state correctly, 
				// but let's be safe and construct it explicitly to ensure order.
				// However, we just added newMessage to state? No, async state updates might not be ready.
				// So: inherited + (branchMsgs WITHOUT newMessage if it was added? No, we haven't added it to node yet in this scope properly?)
				// Wait, we update 'setConversationNodes' below for UI, but here we need 'context' NOW.
				// So: inherited + existing_branch_messages + newMessage
				contextMessages = [...inherited, ...branchMsgs, newMessage]
			}
		}

		const context: ConversationContext = {
			messages: contextMessages,
			currentBranch: targetBranchId || 'main',
			parentMessages: messages, // Keeping this for reference if needed, but 'messages' main property is what AI uses
			memoryContext
		}

		setIsGenerating(true)

		const abortController = new AbortController()
		mainAbortControllerRef.current = abortController

		if (targetBranchId) {
			setSavedBranches(prev =>
				prev.map(b => b.id === targetBranchId
					? { ...b, messages: [...b.messages, newMessage] }
					: b
				)
			)

			setConversationNodes(prev => prev.map(node => {
				if (node.id === targetBranchId) {
					return {
						...node,
						data: {
							...(node.data || {}),
							messages: [...(node.data?.messages || []), newMessage]
						}
					}
				}
				return node
			}))
		} else if (messages.length === 0) {
			const autoBranchId = `branch-${Date.now()}`
			const autoBranch: ConversationBranch = {
				id: autoBranchId,
				title: text.length > 40 ? `${text.substring(0, 40)}...` : text,
				messages: [newMessage],
				timestamp: Date.now(),
				children: []
			}

			setSavedBranches(prev => [...prev, autoBranch])
			setActiveBranchId(autoBranchId)
		}

		if (selectedAIs.length > 1) {
			const groupId = `group-${Date.now()}`

			const aiPromises = selectedAIs.map(async (ai, index) => {
				const streamingMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${ai.id}-${index}`

				try {
					let modelName: string
					if (ai.id === 'best') {
						modelName = getBestAvailableModel()
					} else {
						// Direct mapping for OpenRouter or other specific provider-prefix models
						if (ai.id.includes('openrouter')) {
							modelName = ai.id
						} else {
							modelName = ai.id === 'gemini-2.5-pro' ? 'gemini'
								: ai.id === 'mistral-large' ? 'mistral'
									: ai.id.includes('gpt') ? 'openai'
										: ai.id.includes('claude') ? 'claude'
											: ai.id.includes('grok') ? 'grok'
												: ai.id.includes('gemini') ? 'gemini'
													: ai.id
						}
					}

					// Check if API key is available for this model
					const hasApiKey = aiService.isModelAvailable(modelName)

					const streamingMessage: Message = {
						id: streamingMessageId,
						text: '',
						isUser: false,
						timestamp: Date.now(),
						parentId: newMessage.id,
						children: [],
						aiModel: ai.id,
						groupId,
						isStreaming: true,
						streamingText: ''
					}

					// Only update global messages if viewing the target branch
					if (!targetBranchId || targetBranchId === activeBranchId) {
						setMessages(prev => [...prev, streamingMessage])
					}

					if (targetBranchId) {
						setSavedBranches(prev =>
							prev.map(b => b.id === targetBranchId
								? { ...b, messages: [...b.messages, streamingMessage] }
								: b
							)
						)

						setConversationNodes(prev => prev.map(node => {
							if (node.id === targetBranchId) {
								return {
									...node,
									data: {
										...node.data,
										messages: [...(node.data.messages || []), streamingMessage]
									}
								}
							}
							return node
						}))
					}

					if (abortController.signal.aborted) {
						throw new Error('Generation aborted')
					}

					let finalResponse = ''

					if (hasApiKey) {
						// Use real API with streaming
						const context: ConversationContext = {
							messages: (() => {
								const seenIds = new Set<string>()
								return messages.filter((m: Message) => {
									if (!m.text || m.text.trim().length === 0) return false
									if (seenIds.has(m.id)) return false
									seenIds.add(m.id)
									return true
								})
							})(),
							currentBranch: targetBranchId || 'main'
						}

						const onChunk = (chunk: string) => {
							setMessages(prev => prev.map((msg: Message) =>
								msg.id === streamingMessageId
									? { ...msg, streamingText: (msg.streamingText || '') + chunk }
									: msg
							))

							setConversationNodes(prevNodes => prevNodes.map(node => {
								if (node.id === 'main') return node

								const branchMessages = node.data?.messages || []
								const messageIndex = branchMessages.findIndex((msg: Message) => msg.id === streamingMessageId)

								if (messageIndex !== -1) {
									const updatedMessages = [...branchMessages]
									const currentMsg = updatedMessages[messageIndex]
									updatedMessages[messageIndex] = {
										...currentMsg,
										streamingText: (currentMsg.streamingText || '') + chunk
									}
									return { ...node, data: { ...node.data, messages: updatedMessages } }
								}
								return node
							}))
						}

						try {
							const result = await aiService.generateResponse(
								modelName,
								text,
								context,
								onChunk,
								abortController.signal
							)
							finalResponse = result.text
						} catch (apiError) {
							// If API fails, show error
							finalResponse = `Error from ${ai.name}: ${apiError instanceof Error ? apiError.message : 'API request failed'}`
						}
					} else {
						// Use mock response (no API key / free plan)
						const mockResponse = `[Mock] ${ai.name}: This is a simulated response. Add your ${modelName.toUpperCase()} API key in settings to get real AI responses.`

						const words = mockResponse.split(' ')
						for (let i = 0; i < words.length; i++) {
							if (abortController.signal.aborted) {
								throw new Error('Generation aborted')
							}

							const chunk = `${i === 0 ? '' : ' '}${words[i]}`

							setMessages(prev => prev.map((msg: Message) =>
								msg.id === streamingMessageId
									? { ...msg, streamingText: (msg.streamingText || '') + chunk }
									: msg
							))

							setConversationNodes(prevNodes => prevNodes.map(node => {
								if (node.id === 'main') return node

								const branchMessages = node.data?.messages || []
								const messageIndex = branchMessages.findIndex((msg: Message) => msg.id === streamingMessageId)

								if (messageIndex !== -1) {
									const updatedMessages = [...branchMessages]
									const currentMsg = updatedMessages[messageIndex]
									updatedMessages[messageIndex] = {
										...currentMsg,
										streamingText: (currentMsg.streamingText || '') + chunk
									}
									return { ...node, data: { ...node.data, messages: updatedMessages } }
								}
								return node
							}))

							await new Promise(resolve => setTimeout(resolve, 30))
						}
						finalResponse = mockResponse
					}

					// Finalize message
					setMessages(prev => prev.map(msg =>
						msg.id === streamingMessageId
							? { ...msg, text: finalResponse, isStreaming: false, streamingText: undefined }
							: msg
					))

					setConversationNodes(prevNodes => prevNodes.map(node => {
						if (node.id === 'main') return node

						const branchMessages = node.data?.messages || []
						return {
							...node,
							data: {
								...node.data,
								messages: branchMessages.map((msg: Message) =>
									msg.id === streamingMessageId
										? { ...msg, text: finalResponse, isStreaming: false, streamingText: undefined, timestamp: Date.now() }
										: msg
								)
							}
						}
					}))

					return {
						id: streamingMessageId,
						text: finalResponse,
						isUser: false,
						timestamp: Date.now(),
						parentId: newMessage.id,
						children: [],
						aiModel: ai.id,
						groupId
					}
				} catch (error) {
					const wasAborted = error instanceof Error && (error.message.includes('aborted') || error.message.includes('AbortError'))

					if (wasAborted) {
						setMessages(prev => prev.map(msg => {
							if (msg.id === streamingMessageId && msg.isStreaming) {
								return {
									...msg,
									text: msg.streamingText || '[Generation stopped]',
									isStreaming: false,
									streamingText: undefined
								}
							}
							return msg
						}).filter(msg => !(msg.isStreaming && !msg.streamingText && msg.id === streamingMessageId)))

						return {
							id: streamingMessageId,
							text: '[Generation stopped]',
							isUser: false,
							timestamp: Date.now(),
							parentId: newMessage.id,
							children: [],
							aiModel: ai.id,
							groupId
						}
					}

					return {
						id: `msg-${Date.now()}-${ai.id}-${index}`,
						text: `${ai.name} error: ${error instanceof Error ? error.message : 'Unknown error'}`,
						isUser: false,
						timestamp: Date.now(),
						parentId: newMessage.id,
						children: [],
						aiModel: ai.id,
						groupId
					}
				}
			})

			try {
				await Promise.all(aiPromises)
			} catch (error) {
				console.error('❌ Error in multi-AI response generation:', error)
			} finally {
				setIsGenerating(false)
				mainAbortControllerRef.current = null
			}
		} else {
			const selectedAI = selectedAIs[0]

			try {
				let modelName: string
				if (selectedAI?.id === 'best') {
					modelName = getBestAvailableModel()
				} else {
					// Direct mapping for OpenRouter or other specific provider-prefix models
					if (selectedAI?.id?.includes('openrouter')) {
						modelName = selectedAI.id
					} else {
						modelName = selectedAI?.id === 'gemini-2.5-pro' ? 'gemini'
							: selectedAI?.id === 'mistral-large' ? 'mistral'
								: selectedAI?.id?.includes('gpt') ? 'openai'
									: selectedAI?.id?.includes('claude') ? 'claude'
										: selectedAI?.id?.includes('grok') ? 'grok'
											: selectedAI?.id?.includes('gemini') ? 'gemini'
												: selectedAI?.id || 'openai'
					}
				}

				// Check if API key is available for this model
				const hasApiKey = aiService.isModelAvailable(modelName)

				let aiResponse: Message

				if (selectedAI) {
					const streamingMessageId = `msg-${Date.now()}`
					const streamingMessage: Message = {
						id: streamingMessageId,
						text: '',
						isUser: false,
						timestamp: Date.now(),
						parentId: newMessage.id,
						children: [],
						aiModel: selectedAI.id,
						isStreaming: true,
						streamingText: ''
					}

					// Only update global messages if viewing the target branch
					if (!targetBranchId || targetBranchId === activeBranchId) {
						setMessages(prev => [...prev, streamingMessage])
					}

					if (targetBranchId) {
						setConversationNodes(prev => prev.map(node => {
							if (node.id === targetBranchId) {
								return {
									...node,
									data: {
										...node.data,
										messages: [...(node.data.messages || []), streamingMessage]
									}
								}
							}
							return node
						}))
					}

					if (abortController.signal.aborted) {
						throw new Error('Generation aborted')
					}

					let finalResponse = ''

					if (hasApiKey) {
						// Use real API with streaming
						const context: ConversationContext = {
							messages: (() => {
								const seenIds = new Set<string>()
								return messages.filter((m: Message) => {
									if (!m.text || m.text.trim().length === 0) return false
									if (seenIds.has(m.id)) return false
									seenIds.add(m.id)
									return true
								})
							})(),
							currentBranch: targetBranchId || 'main'
						}

						const onChunk = (chunk: string) => {
							setMessages(prev => prev.map(msg =>
								msg.id === streamingMessageId
									? { ...msg, streamingText: (msg.streamingText || '') + chunk }
									: msg
							))

							if (targetBranchId) {
								setConversationNodes(prevNodes => prevNodes.map(node => {
									if (node.id === targetBranchId) {
										const branchMessages = node.data?.messages || []
										const messageIndex = branchMessages.findIndex((msg: Message) => msg.id === streamingMessageId)
										if (messageIndex !== -1) {
											const updatedMessages = [...branchMessages]
											const currentMsg = updatedMessages[messageIndex]
											updatedMessages[messageIndex] = {
												...currentMsg,
												streamingText: (currentMsg.streamingText || '') + chunk
											}
											return { ...node, data: { ...node.data, messages: updatedMessages } }
										}
									}
									return node
								}))
							}
						}

						try {
							const result = await aiService.generateResponse(
								modelName,
								text,
								context,
								onChunk,
								abortController.signal
							)
							finalResponse = result.text
						} catch (apiError) {
							finalResponse = `Error from ${selectedAI.name}: ${apiError instanceof Error ? apiError.message : 'API request failed'}`
						}
					} else {
						// Use mock response (no API key / free plan)
						const mockResponse = `[Mock] ${selectedAI.name}: This is a simulated response. Add your ${modelName.toUpperCase()} API key in settings.`

						const words = mockResponse.split(' ')
						for (let i = 0; i < words.length; i++) {
							if (abortController.signal.aborted) {
								throw new Error('Generation aborted')
							}

							const chunk = `${i === 0 ? '' : ' '}${words[i]}`

							setMessages(prev => prev.map(msg =>
								msg.id === streamingMessageId
									? { ...msg, streamingText: (msg.streamingText || '') + chunk }
									: msg
							))

							if (targetBranchId) {
								setConversationNodes(prevNodes => prevNodes.map(node => {
									if (node.id === targetBranchId) {
										const branchMessages = node.data?.messages || []
										const messageIndex = branchMessages.findIndex((msg: Message) => msg.id === streamingMessageId)
										if (messageIndex !== -1) {
											const updatedMessages = [...branchMessages]
											const currentMsg = updatedMessages[messageIndex]
											updatedMessages[messageIndex] = {
												...currentMsg,
												streamingText: (currentMsg.streamingText || '') + chunk
											}
											return { ...node, data: { ...node.data, messages: updatedMessages } }
										}
									}
									return node
								}))
							}

							await new Promise(resolve => setTimeout(resolve, 30))
						}
						finalResponse = mockResponse
					}

					// Final update to set isStreaming: false
					setMessages(prev => prev.map((msg: Message) =>
						msg.id === streamingMessageId
							? { ...msg, text: finalResponse, isStreaming: false, streamingText: undefined, timestamp: Date.now() }
							: msg
					))

					if (targetBranchId) {
						setConversationNodes(prevNodes => prevNodes.map(node => {
							if (node.id === targetBranchId) {
								const branchMessages = node.data?.messages || []
								return {
									...node,
									data: {
										...node.data,
										messages: branchMessages.map((msg: Message) =>
											msg.id === streamingMessageId
												? { ...msg, text: finalResponse, isStreaming: false, streamingText: undefined, timestamp: Date.now() }
												: msg
										)
									}
								}
							}
							return node
						}))
					}

					aiResponse = {
						id: streamingMessageId,
						text: finalResponse,
						isUser: false,
						timestamp: Date.now(),
						parentId: newMessage.id,
						children: [],
						aiModel: selectedAI.id
					}
				} else {
					aiResponse = {
						id: `msg-${Date.now()}`,
						text: `${(selectedAI as AI | undefined)?.name || 'AI'} response to: "${text}" (API not configured)`,
						isUser: false,
						timestamp: Date.now(),
						parentId: newMessage.id,
						children: [],
						aiModel: (selectedAI as AI | undefined)?.id
					}
				}

				if (!aiResponse.isStreaming) {
					setMessages(prev => [...prev, aiResponse])
				}

				if (targetBranchId) {
					setSavedBranches(prev =>
						prev.map(b => b.id === targetBranchId
							? { ...b, messages: [...b.messages, aiResponse] }
							: b
						)
					)

					setConversationNodes(prev => prev.map(node => {
						if (node.id === targetBranchId) {
							// If it was streaming, we already updated it. If not (else block), we append.
							// But wait, if it WAS streaming, 'aiResponse' is the final object.
							// We updated conversationNodes above to finalize the streaming message.
							// So we only need to append if it wasn't streaming (the else block case).

							if (!aiResponse.isStreaming && !node.data.messages.some((m: Message) => m.id === aiResponse.id)) {
								return {
									...node,
									data: {
										...node.data,
										messages: [...(node.data.messages || []), aiResponse]
									}
								}
							}
						}
						return node
					}))
				}

				setIsGenerating(false)
				mainAbortControllerRef.current = null
			} catch (error) {
				console.error('Error generating AI response:', error)

				const wasAborted = error instanceof Error && (error.message.includes('aborted') || error.message.includes('AbortError'))
				mainAbortControllerRef.current = null

				if (wasAborted) {
					setMessages(prev => prev.map(msg => {
						if (msg.isStreaming && msg.streamingText) {
							return {
								...msg,
								text: msg.streamingText || '[Generation stopped]',
								isStreaming: false,
								streamingText: undefined
							}
						}
						return msg
					}).filter(msg => !(msg.isStreaming && !msg.streamingText)))
				} else {
					const errorResponse: Message = {
						id: `msg-${Date.now()}`,
						text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
						isUser: false,
						timestamp: Date.now(),
						parentId: newMessage.id,
						children: [],
						aiModel: selectedAIs[0]?.id
					}

					setMessages(prev => [...prev, errorResponse])
				}

				setIsGenerating(false)
			}
		}
	}, [
		activeBranchId,
		conversationNodes,
		getBestAvailableModel,
		messageCount,
		messages,
		selectedAIs,
		setActiveBranchId,
		setConversationNodes,
		setIsGenerating,
		setMessageCount,
		setMessages,
		setSavedBranches,
		setShowPricingModal
	])

	const getBranchCountForMessage = useCallback((messageId: string) =>
		conversationNodes.filter(node =>
			node.parentMessageId === messageId && node.id !== 'main' && !node.isMain
		).length, [conversationNodes])

	const branchFromMessage = useCallback((messageId: string, isMultiBranch = false) => {
		if (!messageId) return

		if (checkLimit && !checkLimit('branch')) {
			return
		}

		const cachedBranchId = branchCacheRef.current.get(messageId)
		// Only use cache if NOT creating a multi-branch or duplicate (which we can't know yet, but we can check if we're forcing a new one)
		// Actually, if we are here, we might be creating a duplicate.
		// If cachedBranchId exists, we usually navigate to it.
		// BUT if the user wants to create a duplicate, we shouldn't just navigate.
		// The UI flow is: click -> check cache -> if exists, navigate.
		// To support duplicates, we need to know if the user explicitly requested a new branch or if we should show the warning.

		// If we are already in the process of creating a duplicate (via warning confirm), we skip cache
		const isCreatingDuplicate = pendingBranchData?.messageId === messageId && pendingBranchData?.allowDuplicate

		if (cachedBranchId && !isMultiBranch && !isCreatingDuplicate) {
			// Check if we should show warning instead of navigating
			const existingBranchCount = getBranchCountForMessage(messageId)
			if (existingBranchCount > 0) {
				// Don't auto-navigate, let the logic below handle the warning/duplicate check
			} else {
				setActiveBranchId(cachedBranchId)
				addToast({
					type: 'info',
					title: 'Branch Exists',
					message: 'Navigating to existing branch'
				})
				return
			}
		}

		const targetMessage = messages.find(m => m.id === messageId) ||
			conversationNodes.flatMap(n => n.messages || []).find(m => m.id === messageId)

		const existingBranchCount = getBranchCountForMessage(messageId)
		const MAX_DUPLICATE_BRANCHES = 6

		if (!isMultiBranch) {
			if (existingBranchCount >= MAX_DUPLICATE_BRANCHES) {
				addToast({
					type: 'warning',
					title: 'Branch limit reached',
					message: `You can create up to ${MAX_DUPLICATE_BRANCHES} branches from the same message. Delete or merge one to continue.`
				})
				return
			}

			if (existingBranchCount > 0) {
				setPendingBranchData({
					messageId,
					isMultiBranch: false,
					messageText: targetMessage?.text?.substring(0, 100),
					parentNodeId: 'main',
					existingBranchesCount: existingBranchCount
				})
				setShowBranchWarning(true)
				return
			}
		}

		setPendingBranchData({
			messageId,
			isMultiBranch,
			messageText: targetMessage?.text?.substring(0, 100),
			parentNodeId: 'main',
			branchGroupId: isMultiBranch ? `group-${Date.now()}` : undefined
		})

		const hasBranches = conversationNodes.length > 0 && conversationNodes.some(n => n.id !== 'main' && !n.isMain)

		if (!hasBranches) {
			setPendingBranchMessageId(messageId)
		} else {
			setPendingBranchMessageId(messageId)
		}
	}, [
		addToast,
		branchCacheRef,
		conversationNodes,
		getBranchCountForMessage,
		messages,
		setActiveBranchId,
		setPendingBranchData,
		setPendingBranchMessageId,
		setShowBranchWarning
	])

	const handleBranchWarning = useCallback((data: {
		messageId: string
		messageText?: string
		existingBranchId?: string
		isMultiBranch: boolean
		existingBranchesCount?: number
		parentNodeId: string
		limitReached?: boolean
	}) => {
		setPendingBranchData({
			messageId: data.messageId,
			isMultiBranch: data.isMultiBranch,
			messageText: data.messageText,
			parentNodeId: data.parentNodeId,
			existingBranchesCount: data.existingBranchesCount,
			limitReached: data.limitReached
		})
		setShowBranchWarning(true)
	}, [setPendingBranchData, setShowBranchWarning])

	const handleBranchWarningConfirm = useCallback(() => {
		if (pendingBranchData) {
			setShowBranchWarning(false)
			const { messageId } = pendingBranchData
			setPendingBranchData(prev => prev ? { ...prev, allowDuplicate: true } : prev)
			setPendingBranchMessageId(messageId)
		}
	}, [pendingBranchData, setPendingBranchData, setPendingBranchMessageId, setShowBranchWarning])

	const handleBranchWarningCancel = useCallback(() => {
		setShowBranchWarning(false)
		setPendingBranchData(null)
	}, [setPendingBranchData, setShowBranchWarning])

	const updateConversationNodes = useCallback((nodes: any[]) => {
		if (!nodes || nodes.length === 0) {
			console.warn('⚠️ updateConversationNodes called with empty or invalid nodes array!', nodes)
			return
		}

		nodes.forEach(node => {
			if (node.data?.parentMessageId && node.id !== 'main' && !node.data?.isMain) {
				branchCacheRef.current.set(node.data.parentMessageId, node.id)
			}
		})

		const newConversationNodes = nodes.map(node => {
			const isMainNode = node.id === 'main' || node.data?.isMain
			const parentId = node.data?.parentId
			const parentMessageId = node.data?.parentMessageId

			return {
				id: node.id,
				type: node.type || (isMainNode ? 'main' : 'branch'),
				title: node.data?.messages?.[0]?.text?.substring(0, 30) + '...' || node.data?.label || 'Untitled',
				messages: node.data?.messages || [],
				timestamp: node.data?.messages?.[0]?.timestamp || Date.now(),
				parentId: isMainNode ? undefined : parentId,
				parentMessageId: isMainNode ? undefined : parentMessageId,
				inheritedMessages: isMainNode ? undefined : (node.data?.inheritedMessages || []),
				branchMessages: isMainNode ? undefined : (node.data?.branchMessages || []),
				children: [],
				isActive: node.id === activeBranchId,
				selectedAIs: node.data?.selectedAIs || [],
				isMain: isMainNode,
				isMinimized: node.data?.isMinimized || false,
				showAIPill: node.data?.showAIPill || false,
				position: node.position || { x: 0, y: 0 },
				nodeData: node.data
			}
		})

		queueMicrotask(() => {
			setConversationNodes(() => {
				const hasMain = newConversationNodes.some(n => n.id === 'main' || n.isMain)
				if (!hasMain) {
					const mainNode = {
						id: 'main',
						type: 'main',
						title: 'Main Conversation',
						messages: messages || [],
						timestamp: Date.now(),
						parentId: undefined,
						children: [],
						isActive: !currentBranch,
						selectedAIs: selectedAIs || [],
						isMain: true,
						position: { x: 400, y: 50 }
					}
					return [mainNode, ...newConversationNodes]
				}

				return newConversationNodes.map(node => {
					if (node.id === 'main' || node.isMain) {
						return {
							...node,
							messages: node.messages && node.messages.length > 0 ? node.messages : (messages || [])
						}
					}
					return node
				})
			})
		})
	}, [
		activeBranchId,
		addToast,
		branchCacheRef,
		currentBranch,
		messages,
		selectedAIs,
		setConversationNodes
	])

	const editMessage = useCallback(async (nodeId: string, messageId: string, newText: string) => {
		if (checkLimit && !checkLimit('message')) return

		// 1. Identify Target Node and Messages
		let targetNodeMessages: Message[] = []
		let targetAIs: AI[] = selectedAIs

		if (nodeId === 'main') {
			targetNodeMessages = messages
		} else {
			const node = conversationNodes.find(n => n.id === nodeId)
			if (node) {
				targetNodeMessages = node.data?.messages || []
				if (node.data?.selectedAIs?.length) {
					targetAIs = node.data.selectedAIs
				}
			}
		}

		if (!targetNodeMessages.length) return

		// 2. Truncate and Update
		const msgIndex = targetNodeMessages.findIndex(m => m.id === messageId)
		if (msgIndex === -1) return

		// Keep messages up to this one
		const truncatedMessages = targetNodeMessages.slice(0, msgIndex + 1)

		// Update the text
		truncatedMessages[msgIndex] = { ...truncatedMessages[msgIndex], text: newText }

		// Update State
		if (nodeId === 'main') {
			setMessages(truncatedMessages)
		} else {
			setConversationNodes(prev => prev.map(n =>
				n.id === nodeId
					? { ...n, data: { ...n.data, messages: truncatedMessages } }
					: n
			))
		}

		// 3. Regenerate Response
		setIsGenerating(true)
		const abortController = new AbortController()
		mainAbortControllerRef.current = abortController

		const selectedAI = targetAIs[0] // Simplify to single AI for edit for now, or loop like sendMessage

		if (!selectedAI) {
			setIsGenerating(false)
			return
		}

		try {
			let modelName = selectedAI.id === 'best' ? getBestAvailableModel() : selectedAI.id

			// Handle model mapping (copied from sendMessage)
			if (selectedAI.id === 'gemini-2.5-pro') modelName = 'gemini'
			else if (selectedAI.id === 'mistral-large') modelName = 'mistral'
			else if (selectedAI.id.includes('gpt')) modelName = 'openai'
			else if (selectedAI.id.includes('claude')) modelName = 'claude'
			else if (selectedAI.id.includes('grok')) modelName = 'grok'
			else if (selectedAI.id.includes('gemini')) modelName = 'gemini'

			const hasApiKey = aiService.isModelAvailable(modelName)
			const streamingMessageId = `msg-${Date.now()}`
			const streamingMessage: Message = {
				id: streamingMessageId,
				text: '',
				isUser: false,
				timestamp: Date.now(),
				parentId: messageId,
				children: [],
				aiModel: selectedAI.id,
				isStreaming: true,
				streamingText: ''
			}

			// Add streaming message to state
			if (nodeId === 'main') {
				setMessages(prev => [...prev, streamingMessage])
			} else {
				setConversationNodes(prev => prev.map(n =>
					n.id === nodeId
						? { ...n, data: { ...n.data, messages: [...n.data.messages, streamingMessage] } }
						: n
				))
			}

			let finalResponse = ''
			if (hasApiKey) {
				const context: ConversationContext = {
					messages: truncatedMessages,
					currentBranch: nodeId
				}

				const onChunk = (chunk: string) => {
					if (nodeId === 'main') {
						setMessages(prev => prev.map(msg =>
							msg.id === streamingMessageId ? { ...msg, streamingText: (msg.streamingText || '') + chunk } : msg
						))
					} else {
						setConversationNodes(prev => prev.map(n => {
							if (n.id === nodeId) {
								const msgs = n.data.messages || []
								const idx = msgs.findIndex((m: Message) => m.id === streamingMessageId)
								if (idx !== -1) {
									const newMsgs = [...msgs]
									newMsgs[idx] = { ...newMsgs[idx], streamingText: (newMsgs[idx].streamingText || '') + chunk }
									return { ...n, data: { ...n.data, messages: newMsgs } }
								}
							}
							return n
						}))
					}
				}

				const result = await aiService.generateResponse(modelName, newText, context, onChunk, abortController.signal)
				finalResponse = result.text
			} else {
				// Mock response
				finalResponse = `[Mock Edit] ${selectedAI.name}: response to "${newText}"`
				// Simulate streaming... (simplified)
				if (nodeId === 'main') {
					setMessages(prev => prev.map(msg => msg.id === streamingMessageId ? { ...msg, streamingText: finalResponse } : msg))
				}
			}

			// Finalize
			if (nodeId === 'main') {
				setMessages(prev => prev.map(msg =>
					msg.id === streamingMessageId ? { ...msg, text: finalResponse, isStreaming: false, streamingText: undefined } : msg
				))
			} else {
				setConversationNodes(prev => prev.map(n => {
					if (n.id === nodeId) {
						const msgs = n.data.messages || []
						const idx = msgs.findIndex((m: Message) => m.id === streamingMessageId)
						if (idx !== -1) {
							const newMsgs = [...msgs]
							newMsgs[idx] = { ...newMsgs[idx], text: finalResponse, isStreaming: false, streamingText: undefined }
							return { ...n, data: { ...n.data, messages: newMsgs } }
						}
					}
					return n
				}))
			}

		} catch (error) {
			console.error('Edit generation error:', error)
		} finally {
			setIsGenerating(false)
			mainAbortControllerRef.current = null
		}

	}, [
		checkLimit,
		messages,
		conversationNodes,
		selectedAIs,
		setMessages,
		setConversationNodes,
		setIsGenerating,
		getBestAvailableModel
	])

	return {
		getBestAvailableModel,
		addAI,
		removeAI,
		selectSingleAI,
		selectSingleAIById,
		stopGeneration,
		sendMessage,
		branchFromMessage,
		handleBranchWarning,
		handleBranchWarningConfirm,
		handleBranchWarningCancel,
		updateConversationNodes,
		editMessage
	}
}

