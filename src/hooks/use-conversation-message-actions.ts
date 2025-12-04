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
}

export function useConversationMessageActions({
	state,
	addToast
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
		if (aiService.isModelAvailable('gemini')) {
			return 'gemini'
		}
		if (aiService.isModelAvailable('mistral')) {
			return 'mistral'
		}
		return 'gpt-4'
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

		setMessages(prev => [...prev, newMessage])

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

		const targetBranchId = branchId || activeBranchId

		const context: ConversationContext = {
			messages: [...messages, newMessage],
			currentBranch: targetBranchId || 'main',
			parentMessages: messages,
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
						modelName = ai.id === 'gemini-2.5-pro' ? 'gemini'
							: ai.id === 'mistral-large' ? 'mistral'
								: 'gpt-4'
					}

					const mockResponse = `This is a mock response from ${ai.name} to: "${text}". In a real scenario, this would be generated by the ${modelName} API. This response simulates what the AI would say based on the conversation context.`

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

					setMessages(prev => [...prev, streamingMessage])

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

					const words = mockResponse.split(' ')
					const chunkDelay = 50

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
							// Find message by ID - more robust than checking isStreaming
							const messageIndex = branchMessages.findIndex((msg: Message) => msg.id === streamingMessageId)

							if (messageIndex !== -1) {
								const updatedMessages = [...branchMessages]
								const currentMsg = updatedMessages[messageIndex]

								updatedMessages[messageIndex] = {
									...currentMsg,
									streamingText: (currentMsg.streamingText || '') + chunk
								}

								return {
									...node,
									data: {
										...node.data,
										messages: updatedMessages
									}
								}
							} else {
								// Fallback: If message not found (rare race condition), append it
								// This ensures we don't lose the message if the initial add hasn't propagated
								return {
									...node,
									data: {
										...node.data,
										messages: [...branchMessages, {
											...streamingMessage,
											streamingText: (streamingMessage.streamingText || '') + chunk
										}]
									}
								}
							}
						}))

						await new Promise(resolve => setTimeout(resolve, 80)) // Increased delay for stability
					}

					setConversationNodes(prevNodes => prevNodes.map(node => {
						if (node.id === 'main') return node

						const branchMessages = node.data?.messages || []
						return {
							...node,
							data: {
								...node.data,
								messages: branchMessages.map((msg: Message) =>
									msg.id === streamingMessageId
										? {
											...msg,
											text: mockResponse,
											isStreaming: false,
											streamingText: undefined,
											timestamp: Date.now()
										}
										: msg
								)
							}
						}
					}))

					return {
						id: streamingMessageId,
						text: mockResponse,
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
					modelName = selectedAI?.id === 'gemini-2.5-pro' ? 'gemini'
						: selectedAI?.id === 'mistral-large' ? 'mistral'
							: 'gpt-4'
				}

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

					setMessages(prev => [...prev, streamingMessage])

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

					const mockResponse = `This is a mock response from ${selectedAI.name} to: "${text}". In a real scenario, this would be generated by the ${modelName} API. This response simulates what the AI would say based on the conversation context.`

					const words = mockResponse.split(' ')
					const chunkDelay = 50

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
									// Find message by ID - more robust than checking isStreaming
									const messageIndex = branchMessages.findIndex((msg: Message) => msg.id === streamingMessageId)

									if (messageIndex !== -1) {
										const updatedMessages = [...branchMessages]
										const currentMsg = updatedMessages[messageIndex]

										updatedMessages[messageIndex] = {
											...currentMsg,
											streamingText: (currentMsg.streamingText || '') + chunk
										}

										return {
											...node,
											data: {
												...node.data,
												messages: updatedMessages
											}
										}
									} else {
										// Fallback: If message not found (rare race condition), append it
										// This ensures we don't lose the message if the initial add hasn't propagated
										return {
											...node,
											data: {
												...node.data,
												messages: [...branchMessages, {
													...streamingMessage,
													streamingText: (streamingMessage.streamingText || '') + chunk
												}]
											}
										}
									}
								}
								return node
							}))
						}

						await new Promise(resolve => setTimeout(resolve, 80)) // Increased delay for stability
					}

					// Final update to set isStreaming: false
					setMessages(prev => prev.map((msg: Message) =>
						msg.id === streamingMessageId
							? {
								...msg,
								text: mockResponse,
								isStreaming: false,
								streamingText: undefined,
								timestamp: Date.now()
							}
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
												? {
													...msg,
													text: mockResponse,
													isStreaming: false,
													streamingText: undefined,
													timestamp: Date.now()
												}
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
						text: mockResponse,
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
		limitMessage?: string
	}) => {
		setPendingBranchData({
			messageId: data.messageId,
			isMultiBranch: data.isMultiBranch,
			messageText: data.messageText,
			parentNodeId: data.parentNodeId,
			existingBranchesCount: data.existingBranchesCount,
			limitReached: data.limitReached,
			limitMessage: data.limitMessage
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
		updateConversationNodes
	}
}

