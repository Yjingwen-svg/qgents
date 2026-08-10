import { useParams } from 'react-router-dom'
import { getRequirement } from './requirements'

/**
 * 需求群聊 IM 外壳
 *
 * 路由：/app/projects/:projectId/req-chat/:reqId
 * 例：reqId=login → 「登录功能」独立会话
 *
 * 对话内容区留空（已去掉右侧上下文面板）
 * TODO[业务填充]: 按 reqId 拉取该需求的聊天历史 / Diff 卡片等
 */
export function RequirementChatPage() {
  const { projectId, reqId } = useParams<{ projectId: string; reqId: string }>()
  const req = getRequirement(reqId)

  return (
    <section className="pd-chat" aria-label={`需求群聊-${req.title}`}>
      <header className="pd-chat__header">
        <div className="pd-chat__header-info">
          <h1>
            <span className="pd-chat__hash">#</span>
            {req.title}
          </h1>
          <p>
            {/* TODO: 成员 + Agent */}
            需求群聊 · {req.ref}
            {projectId ? ` · project:${projectId}` : null}
          </p>
        </div>
        <div className="pd-chat__header-actions">
          <button type="button" className="pd-chat__trigger" disabled>
            + 触发任务
          </button>
          <button type="button" className="pd-chat__more" aria-label="更多" disabled>
            ···
          </button>
        </div>
      </header>

      <div
        className="pd-chat__messages"
        aria-label={`对话内容-${req.id}（待填充）`}
      />

      <footer className="pd-chat__composer">
        <div className="pd-chat__composer-tools">
          <button type="button" aria-label="@ 提及" disabled>
            @
          </button>
          <button type="button" aria-label="附件" disabled>
            📎
          </button>
          <button type="button" aria-label="代码块" disabled>
            {'</>'}
          </button>
        </div>
        <div className="pd-chat__composer-row">
          <textarea
            placeholder={`在「${req.title}」需求群发送消息，@Agent 可派发任务…`}
            rows={1}
            disabled
            aria-label="消息输入"
          />
          <button type="button" className="pd-chat__send" aria-label="发送" disabled>
            发送
          </button>
        </div>
      </footer>
    </section>
  )
}
