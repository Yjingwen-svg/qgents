import { useParams } from 'react-router-dom'
import { ChatPanel } from '@/components/chat/ChatPanel'

/**
 * 需求群聊页 —— 薄壳，聊天逻辑在 ChatPanel。
 * 路由：/app/projects/:projectId/req-chat/:groupId
 */
export default function RequirementChatPage() {
  const { projectId = '', groupId = '' } = useParams<{ projectId: string; groupId: string }>()
  return <ChatPanel projectId={projectId} groupId={groupId} />
}
