'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, Clock, Trash } from '@phosphor-icons/react'
import { DeleteConfirmModal } from './delete-confirm-modal'

interface Conversation {
  _id: string
  title: string
  updatedAt: string
  mainMessages: any[]
  branches: any[]
}

interface ConversationHistoryProps {
  conversations: Conversation[]
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onCreateNewConversation: () => void
  onDeleteConversation: (id: string) => void
}

export default function ConversationHistory({
  conversations,
  currentConversationId,
  onSelectConversation,
  onCreateNewConversation,
  onDeleteConversation
}: ConversationHistoryProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; conversationId: string | null; conversationTitle?: string }>({
    isOpen: false,
    conversationId: null
  })
  // Group conversations by date
  const groupedConversations = conversations.reduce((groups: Record<string, Conversation[]>, conversation) => {
    const date = new Date(conversation.updatedAt)
    const dateKey = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })

    if (!groups[dateKey]) {
      groups[dateKey] = []
    }

    groups[dateKey].push(conversation)
    return groups
  }, {})

  // Get conversation title
  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.title && conversation.title !== 'New Conversation' && conversation.title !== 'Conversation') {
      return conversation.title
    }

    // Find first user message
    const firstUserMessage = conversation.mainMessages?.find(m => m.isUser)
    if (firstUserMessage) {
      return firstUserMessage.text.length > 40
        ? firstUserMessage.text.substring(0, 40) + '...'
        : firstUserMessage.text
    }

    return `Conversation ${conversation._id.substring(0, 6)}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* New Conversation Button */}
      <div className="p-4 border-b border-border/80">
        <button
          onClick={onCreateNewConversation}
          className="w-full py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium border border-purple-200/60 active:scale-[0.98]"
        >
          <PlusCircle size={16} weight="bold" />
          New Conversation
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-4">
        {conversations.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Clock size={36} className="mx-auto mb-3 text-muted-foreground/50" weight="light" />
            <p className="text-sm font-medium text-foreground">No conversation history</p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Start a new conversation to begin
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedConversations).map(([date, dateConversations]) => (
              <div key={date}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2.5">{date}</h3>
                <div className="space-y-2 mt-1">
                  {dateConversations.map(conversation => (
                    <div key={conversation._id} className="flex items-center gap-2 group relative">
                      <button
                        onClick={() => onSelectConversation(conversation._id)}
                        className={`flex-1 text-left p-3 rounded-lg text-sm transition-all duration-200 ease-in-out min-w-0 overflow-hidden ${currentConversationId === conversation._id
                            ? 'bg-purple-50 text-purple-700 border border-purple-200/60 shadow-sm pr-10'
                            : 'hover:bg-muted text-foreground border border-transparent hover:border-border/60 group-hover:pr-10 pr-3'
                          }`}
                      >
                        <div className="font-medium truncate block whitespace-nowrap overflow-hidden text-ellipsis leading-snug">
                          {getConversationTitle(conversation)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1.5 flex items-center justify-between gap-2">
                          <span>{conversation.mainMessages?.length || 0} {conversation.mainMessages?.length === 1 ? 'message' : 'messages'}</span>
                          <span>{conversation.branches?.length || 0} {conversation.branches?.length === 1 ? 'branch' : 'branches'}</span>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm({
                            isOpen: true,
                            conversationId: conversation._id,
                            conversationTitle: getConversationTitle(conversation)
                          })
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 ease-in-out z-10 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete conversation"
                      >
                        <Trash className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, conversationId: null })}
        onConfirm={() => {
          if (deleteConfirm.conversationId) {
            onDeleteConversation(deleteConfirm.conversationId)
          }
          setDeleteConfirm({ isOpen: false, conversationId: null })
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, conversationId: null })}
        itemType="conversation"
        itemName={deleteConfirm.conversationTitle}
        title="Delete Conversation?"
        message="Are you sure you want to delete this conversation? All messages and branches will be permanently deleted. This action cannot be undone."
      />
    </div>
  )
}
