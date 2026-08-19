import { Spin } from 'antd'
import { useParams } from 'react-router-dom'
import { ChatPanel } from '@/components/chat/ChatPanel'

/**
 * 需求群聊页 —— 薄壳，聊天逻辑在 ChatPanel。
 * 路由：/app/projects/:projectId/req-chat/:groupId
 *
 * groupId 为空 = 刚进入项目、群列表尚未加载完成（ProjectDetailLayout 会在
 * groups 就绪后自动重定向到主群）。此时渲染加载占位而不是 ChatPanel，
 * 避免空 groupId 触发「还没有消息」空态闪烁（修复：从团队首页进入项目闪一下）。
 */
export default function RequirementChatPage() {
  const { projectId = '', groupId = '' } = useParams<{ projectId: string; groupId: string }>()

  if (!groupId) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin tip="正在进入项目群聊…" size="large">
          <div style={{ height: 80, width: 80 }} />
        </Spin>
      </div>
    )
  }

  return <ChatPanel key={groupId} projectId={projectId} groupId={groupId} />
}
