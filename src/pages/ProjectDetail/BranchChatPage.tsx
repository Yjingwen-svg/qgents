import { useSearchParams } from 'react-router-dom'

const BRANCHES: Record<string, { title: string; ref: string }> = {
  login: { title: '登录功能', ref: 'feat/login' },
  pay: { title: '支付回调', ref: 'feat/payment-hook' },
  dashboard: { title: '数据看板', ref: 'feat/dashboard' },
}

/**
 * 分支群聊子页：对话面板框架 + 右侧上下文壳
 * 对话内容区留空
 */
export function BranchChatPage() {
  const [params] = useSearchParams()
  const branchId = params.get('branch') ?? 'login'
  const branch = BRANCHES[branchId] ?? BRANCHES.login

  return (
    <>
      <section className="pd-chat" aria-label="分支群聊">
        <header className="pd-chat__header">
          <div className="pd-chat__header-info">
            <h1>
              <span className="pd-chat__hash">#</span>
              {branch.title}
            </h1>
            <p>{/* TODO: 成员 + Agent */}成员 · Agent 协作中 · {branch.ref}</p>
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

        <div className="pd-chat__messages" aria-label="对话内容（待填充）" />

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
              placeholder="输入消息，@Agent 可派发任务…"
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

      <aside className="pd-side" aria-label="分支群上下文">
        <section className="pd-side__block">
          <h2>分支群上下文</h2>
          <div className="pd-side__empty" />
        </section>
        <section className="pd-side__block">
          <h2>本群任务</h2>
          <div className="pd-side__empty" />
        </section>
        <section className="pd-side__block">
          <h2>工作流</h2>
          <div className="pd-side__empty" />
        </section>
        <section className="pd-side__block">
          <h2>合并状态</h2>
          <div className="pd-side__empty" />
        </section>
      </aside>
    </>
  )
}
