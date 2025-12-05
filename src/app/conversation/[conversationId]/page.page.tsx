import ConversationPage from '@/components/conversation-page'

interface PageProps {
    params: Promise<{
        conversationId: string
    }>
}

export default async function Conversation({ params }: PageProps) {
    const { conversationId } = await params
    return <ConversationPage initialConversationId={conversationId} />
}
