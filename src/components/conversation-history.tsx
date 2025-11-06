'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, Clock, Trash } from '@phosphor-icons/react'

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
      <div className="p-4 border-b border-gray-100">
        <button 
          onClick={onCreateNewConversation}
          className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <PlusCircle size={16} weight="bold" />
          New Conversation
        </button>
      </div>
      
      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-4">
        {conversations.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Clock size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No conversation history</p>
            <p className="text-xs text-gray-400 mt-1">
              Start a new conversation to begin
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedConversations).map(([date, dateConversations]) => (
              <div key={date}>
                <h3 className="text-xs font-medium text-gray-500 px-2 py-2">{date}</h3>
                <div className="space-y-2.5 mt-2">
                  {dateConversations.map(conversation => (
                    <div key={conversation._id} className="flex items-center gap-2 group relative">
                      <button
                        onClick={() => onSelectConversation(conversation._id)}
                        className={`flex-1 text-left p-3 rounded-lg text-sm transition-all duration-200 ease-in-out min-w-0 overflow-hidden ${
                          currentConversationId === conversation._id
                            ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-sm pr-10'
                            : 'hover:bg-gray-50 text-gray-700 group-hover:pr-10 pr-3'
                        }`}
                      >
                        <div className="font-medium truncate block whitespace-nowrap overflow-hidden text-ellipsis">
                          {getConversationTitle(conversation)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1.5 flex items-center justify-between">
                          <span>{conversation.mainMessages?.length || 0} messages</span>
                          <span>{conversation.branches?.length || 0} branches</span>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Delete this conversation?')) {
                            onDeleteConversation(conversation._id)
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 hover:bg-gray-100 rounded-full transition-all duration-200 ease-in-out transform scale-90 group-hover:scale-100 z-10"
                        title="Delete conversation"
                      >
                        <Trash className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
