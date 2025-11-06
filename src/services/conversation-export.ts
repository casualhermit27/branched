// Conversation Export/Import Service

export interface ConversationExport {
  version: string
  timestamp: number
  metadata: {
    title: string
    description?: string
    totalMessages: number
    totalBranches: number
    aiModels: string[]
  }
  conversation: {
    messages: any[]
    branches: any[]
    nodes: any[]
    edges: any[]
  }
}

export interface ExportOptions {
  includeMetadata?: boolean
  format?: 'json' | 'markdown'
  includeTimestamps?: boolean
  includeAIResponses?: boolean
}

export class ConversationExporter {
  /**
   * Export conversation tree to JSON format
   */
  static exportToJSON(
    messages: any[],
    branches: any[],
    nodes: any[],
    edges: any[],
    options: ExportOptions = {}
  ): ConversationExport {
    const {
      includeMetadata = true,
      includeTimestamps = true,
      includeAIResponses = true
    } = options

    // Filter messages based on options
    let filteredMessages = messages
    if (!includeAIResponses) {
      filteredMessages = messages.filter(msg => msg.isUser)
    }

    // Extract AI models used
    const aiModels = [...new Set(
      filteredMessages
        .filter(msg => !msg.isUser && msg.aiModel)
        .map(msg => msg.aiModel)
    )]

    const exportData: ConversationExport = {
      version: '1.0.0',
      timestamp: Date.now(),
      metadata: includeMetadata ? {
        title: `Conversation Export - ${new Date().toLocaleDateString()}`,
        description: `Exported conversation with ${filteredMessages.length} messages and ${branches.length} branches`,
        totalMessages: filteredMessages.length,
        totalBranches: branches.length,
        aiModels
      } : {} as any,
      conversation: {
        messages: includeTimestamps ? filteredMessages : filteredMessages.map(msg => ({
          ...msg,
          timestamp: undefined
        })),
        branches,
        nodes,
        edges
      }
    }

    return exportData
  }

  /**
   * Export conversation to Markdown format
   */
  static exportToMarkdown(
    messages: any[],
    branches: any[],
    nodes: any[],
    options: ExportOptions = {}
  ): string {
    const {
      includeTimestamps = true,
      includeAIResponses = true
    } = options

    let filteredMessages = messages
    if (!includeAIResponses) {
      filteredMessages = messages.filter(msg => msg.isUser)
    }

    let markdown = `# Conversation Export\n\n`
    markdown += `**Exported:** ${new Date().toLocaleString()}\n`
    markdown += `**Messages:** ${filteredMessages.length}\n`
    markdown += `**Branches:** ${branches.length}\n\n`
    markdown += `---\n\n`

    // Group messages by branch
    const messagesByBranch = this.groupMessagesByBranch(filteredMessages, branches)

    // Export main conversation
    if (messagesByBranch.main && messagesByBranch.main.length > 0) {
      markdown += `## Main Conversation\n\n`
      messagesByBranch.main.forEach((msg, index) => {
        markdown += this.formatMessageAsMarkdown(msg, index + 1, includeTimestamps)
      })
      markdown += `\n`
    }

    // Export branches
    Object.entries(messagesByBranch).forEach(([branchId, branchMessages]) => {
      if (branchId === 'main' || !branchMessages || branchMessages.length === 0) return

      const branch = branches.find(b => b.id === branchId)
      const branchTitle = branch?.title || `Branch ${branchId}`
      
      markdown += `## ${branchTitle}\n\n`
      branchMessages.forEach((msg, index) => {
        markdown += this.formatMessageAsMarkdown(msg, index + 1, includeTimestamps)
      })
      markdown += `\n`
    })

    return markdown
  }

  /**
   * Import conversation from JSON
   */
  static importFromJSON(jsonData: string): ConversationExport | null {
    try {
      const data = JSON.parse(jsonData)
      
      // Validate structure
      if (!data.version || !data.conversation) {
        throw new Error('Invalid conversation format')
      }

      return data as ConversationExport
    } catch (error) {
      console.error('Failed to import conversation:', error)
      return null
    }
  }

  /**
   * Download conversation as file
   */
  static downloadAsFile(
    data: ConversationExport | string,
    filename: string,
    format: 'json' | 'markdown' = 'json'
  ): void {
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    const mimeType = format === 'json' ? 'application/json' : 'text/markdown'
    const extension = format === 'json' ? 'json' : 'md'

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }

  /**
   * Group messages by branch for organized export
   */
  private static groupMessagesByBranch(messages: any[], branches: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {
      main: []
    }

    // Initialize branch groups
    branches.forEach(branch => {
      grouped[branch.id] = []
    })

    // Group messages
    messages.forEach(message => {
      const branchId = message.parentId || 'main'
      if (grouped[branchId]) {
        grouped[branchId].push(message)
      } else {
        grouped.main.push(message)
      }
    })

    // Sort messages by timestamp within each group
    Object.keys(grouped).forEach(branchId => {
      grouped[branchId].sort((a, b) => a.timestamp - b.timestamp)
    })

    return grouped
  }

  /**
   * Format individual message as markdown
   */
  private static formatMessageAsMarkdown(message: any, index: number, includeTimestamps: boolean): string {
    let markdown = `### ${index}. ${message.isUser ? 'You' : (message.aiModel || 'AI')}\n\n`
    
    if (includeTimestamps && message.timestamp) {
      markdown += `*${new Date(message.timestamp).toLocaleString()}*\n\n`
    }

    // Clean and format message text
    let text = message.text
    if (typeof text === 'string') {
      // Convert markdown-like formatting
      text = text
        .replace(/\*\*(.*?)\*\*/g, '**$1**') // Bold
        .replace(/\*(.*?)\*/g, '*$1*') // Italic
        .replace(/`(.*?)`/g, '`$1`') // Code
    }

    markdown += `${text}\n\n`
    return markdown
  }
}
