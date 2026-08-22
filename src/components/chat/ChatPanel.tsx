import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Layout, Button, Input, Space, Typography, theme, Empty, Tag, Popconfirm, Drawer, Divider, Avatar, Spin } from 'antd'
import { App, Upload } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import {
  SendOutlined,
  ThunderboltOutlined,
  FileOutlined,
  FilePdfOutlined,
  CodeOutlined,
  MessageOutlined,
  InboxOutlined,
  PaperClipOutlined,
  CloseOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { formatApiError } from '@/utils/formatApiError'
import { ApiError, groupApi, projectApi, attachmentApi, uploadAttachment, memoryApi, tasksApi, mergeRequestsApi } from '@/api'
import { resolvePreviewUrl } from '@/api/attachment'
import { AttachmentPreviewModal } from '@/components/chat/AttachmentPreviewModal'
import { ChatDiffCard } from '@/components/chat/ChatDiffCard'
import { getApiBaseUrl } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useAgents } from '@/hooks/agents'
import { subscribeRealtimeReconnect } from '@/realtime'
import { useProjectTaskPollingInterval } from '@/realtime/useProjectTaskDomainEvents'
import './ChatPanel.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { TaskTriggerModal } from '@/components/task-domain'
import { GroupMemberSettings } from '@/pages/ProjectDetail/GroupMemberSettings'
import { AuthedImage } from '@/components/AuthedImage'
import { PATHS } from '@/routes/paths'
import { taskModelQueryKeys } from '@/query'
import type {
  Group,
  Message,
  Mention,
  MentionType,
  Page,
  TextMessageContent,
  CodeMessageContent,
  ImageMessageContent,
  FileMessageContent,
  QuoteMessageContent,
  TaskStatusMessageContent,
  TaskStatusRepositoryMapping,
} from '@/types'
import type { TaskMergeRequestPreflightList } from '@/types/task-model'

const { Text } = Typography

/**
 * 群聊聊天面板 —— 消息列表（含时间分隔线）+ @提及 + 发送 + 发起任务入口。
 * 供项目详情（RequirementChatPage）与「项目群聊」工作台（ChatWorkspacePage）复用。
 */
export function ChatPanel({ projectId, groupId }: { projectId: string; groupId: string }) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mentions, setMentions] = useState<Mention[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const [triggerOpen, setTriggerOpen] = useState(false)
  // 群聊设置栏（收纳成员管理 / AI 沉淀 / 归档等除「发起任务」外的操作）
  const [settingsOpen, setSettingsOpen] = useState(false)
  // 回复引用：选中某条消息后，输入区显示引用条，发送时以 QUOTE 类型 + replyToId 提交
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  const quoteDiffBlockReason = useCallback((preflight: TaskMergeRequestPreflightList): string | null => {
    for (const item of preflight.items) {
      const mergeStatus = item.mergeRequest?.status
      if (mergeStatus === 'MERGED') {
        return '该 Diff 对应的 MR 已合并，当前不能引用继续修改。'
      }
      if (mergeStatus === 'CLOSED') {
        return '该 Diff 对应的 MR 已关闭，当前不能引用继续修改。'
      }
      if (mergeStatus === 'OPEN' || item.status === 'MR_CREATED') {
        return '该 Diff 已进入 MR 流程，当前不能引用继续修改。'
      }
      switch (item.status) {
        case 'REQUESTED':
        case 'DRY_RUN_QUEUED':
        case 'DRY_RUN_RUNNING':
          return '当前 Diff 正在进行 MR 预检，请等待预检完成后再引用继续修改。'
        case 'WAITING_CQ':
          return '当前 Diff 正在等待 CQ+1 审查，暂不能引用继续修改。'
        case 'CREATING_MR':
          return '当前 Diff 正在创建 MR，暂不能引用继续修改。'
        default:
          break
      }
    }
    return null
  }, [])

  const handleReply = useCallback(async (target: Message) => {
    if (target.type !== 'DIFF') {
      setReplyTo(target)
      return
    }
    const content = target.content as { taskId?: unknown }
    const taskId = typeof content.taskId === 'string' ? content.taskId.trim() : ''
    if (!taskId) {
      message.error('当前 Diff 缺少任务上下文，暂时无法引用继续修改，请刷新页面后重试。')
      return
    }
    try {
      const preflight = await queryClient.fetchQuery({
        queryKey: taskModelQueryKeys.mergeRequests.preflightByTask(projectId, taskId),
        queryFn: () => mergeRequestsApi.getTaskPreflight(projectId, taskId),
        staleTime: 0,
      })
      const blockReason = quoteDiffBlockReason(preflight)
      if (blockReason) {
        message.error(blockReason)
        return
      }
      setReplyTo(target)
      requestAnimationFrame(() => inputRef.current?.focus())
    } catch (error) {
      message.error(`暂时无法确认当前 Diff 状态：${formatApiError(error)}`)
    }
  }, [message, projectId, queryClient, quoteDiffBlockReason])
  // 附件内联预览（增量契约 §4/§5）：点击 IMAGE/FILE 打开页内预览弹窗
  const [previewTarget, setPreviewTarget] = useState<{
    attachmentId: string
    fileName?: string
    embeddedPreviewUrl?: string
  } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const incrementalSyncRef = useRef<() => void>(() => {})
  // 群聊 @ 提及：已读游标（markRead 返回）与「有人@我」提示条
  const [lastReadSeq, setLastReadSeq] = useState<number | null>(null)
  const [mentionFlashId, setMentionFlashId] = useState<string | null>(null)
  // 已点击忽略的「有人@你」消息 id：点击跳转后按钮消失，新 @ 消息再来时重新出现
  const [dismissedMentionId, setDismissedMentionId] = useState<string | null>(null)
  // 消息列表内部真正承载消息的内容容器（ResizeObserver 监听其高度变化）
  const contentRef = useRef<HTMLDivElement>(null)
  // 用户是否「应该保持贴底」：发送消息/切群/首载时置 true；用户主动上滚查看历史时置 false。
  // 图片加载完成、内容高度变化时据此决定是否自动滚到底，避免把看历史的用户拉回底部。
  const shouldStickToBottomRef = useRef(true)
  // 本次发送后需要强制滚到底（即使布局滚动事件把 stick 标志重算为 false 也照滚），待消息渲染后清除。
  const pendingScrollRef = useRef(false)
  // 消息输入框 ref：右键「@ta」后聚焦进入编辑态
  const inputRef = useRef<TextAreaRef>(null)
  // 右键成员消息的上下文菜单（@ta）：记录触发位置与目标消息
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; message: Message } | null>(null)
  const taskPollingInterval = useProjectTaskPollingInterval(projectId, 5_000)

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: !!projectId,
  })
  const group = groups.find((g) => g.id === groupId)
  const mainGroup = groups.find((g) => g.type === 'PROJECT_MAIN')

  // 归档需求群（仅创建者可见，Project Admin 兜底后端校验）
  const archiveGroup = useMutation({
    mutationFn: () => groupApi.archive(projectId, groupId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups', projectId] })
      if (mainGroup) navigate(PATHS.projectReqChat(projectId, mainGroup.id))
    },
  })

  // 群成员（项目成员 + Agent），@ 提及用户候选来源
  const { data: members = [] } = useQuery({
    queryKey: ['groups', projectId, groupId, 'members'],
    queryFn: () => groupApi.listMembers(projectId, groupId),
    enabled: !!projectId && !!groupId,
  })
  const currentUserId = user?.id
  const userMembers = members.filter((m) => m.memberType === 'USER')
  // 过滤掉自己的用户（Agent 保留，因为没有"自己"）
  const otherUserMembers = userMembers.filter((m) => m.id !== currentUserId)

  // @ Agent 候选来源：团队 Agent 列表（不依赖群成员，v1.8.0 §7/§22）
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: !!projectId,
  })
  const { data: taskPage } = useQuery({
    queryKey: taskModelQueryKeys.tasks.list(projectId, { limit: 100 }),
    queryFn: () => tasksApi.list(projectId, { limit: 100 }),
    enabled: !!projectId,
    refetchInterval: taskPollingInterval,
  })
  const taskStatusById = new Map((taskPage?.data ?? []).map((task) => [task.id, task.status]))
  const teamId = project?.teamId
  // @ Agent 候选：走 useAgents hook（queryKeys.agents.list 前缀），
  // 与 AgentTeamPage 的 create/publish/archive mutation invalidate 的 queryKeys.agents.all 对齐，
  // 避免内联 key 分裂导致 @ 候选列表永不刷新
  const { data: agentsPage } = useAgents(projectId, teamId)
  // 仅展示可被 @ 的 Agent（ACTIVE 状态）
  const teamAgents = (agentsPage?.data ?? []).filter((a) => a.status === 'ACTIVE'&&a.name==='编排助手')

  const {
    data: page,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['groups', projectId, groupId, 'messages'],
    queryFn: ({ pageParam }) => groupApi.listMessages(projectId, groupId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.page.hasMore ? lastPage.page.nextCursor : undefined),
    enabled: !!projectId && !!groupId,
  })
  // 后端消息列表不保证顺序，按 sequence（缺则退回 createdAt）升序排，保证新消息在下方。
  // useInfiniteQuery 的 page 顺序是「第一页(最新) → 下一页(更早)」，合并后统一按 sequence 升序。
  const messages = useMemo(() => {
    const list = page?.pages.flatMap((p) => p.data) ?? []
    return [...list].sort((a, b) => {
      const as = a.sequence ?? Number.MAX_SAFE_INTEGER
      const bs = b.sequence ?? Number.MAX_SAFE_INTEGER
      if (as !== bs) return as - bs
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }, [page])

  // 可靠增量同步：SSE/WS 只作为提示，实际消息通过 afterSequence REST 拉取并按 ID 合并。
  useEffect(() => {
    if (!projectId || !groupId) return
    let stopped = false
    let syncing = false
    let pending = false
    const key = ['groups', projectId, groupId, 'messages'] as const

    const currentSequence = (): number => {
      // useInfiniteQuery 缓存结构为 { pages, pageParams }：取全部页的消息算最大 sequence
      const cached = queryClient.getQueryData<InfiniteData<Page<Message>>>(key)
      const rows = cached?.pages.flatMap((p) => p.data) ?? []
      return rows.reduce((max, item) => Math.max(max, item.sequence ?? 0), 0)
    }
    const sync = async (): Promise<void> => {
      if (stopped) return
      if (syncing) {
        pending = true
        return
      }
      syncing = true
      try {
        let afterSequence = currentSequence()
        const received: Message[] = []
        let lastPage: Page<Message> | undefined
        while (!stopped) {
          // 后端接口为 /messages/incremental?afterSequence=N（listMessagesIncremental）
          const result = await groupApi.listMessagesIncremental(projectId, groupId, afterSequence)
          lastPage = result
          received.push(...result.data)
          if (!result.page.hasMore || !result.page.nextCursor) break
          const nextSequence = Number(result.page.nextCursor)
          if (!Number.isSafeInteger(nextSequence) || nextSequence <= afterSequence) break
          afterSequence = nextSequence
        }
        if (stopped || received.length === 0) return
        queryClient.setQueryData<InfiniteData<Page<Message>>>(key, (old) => {
          if (!old || !lastPage) {
            return { pages: [{ ...(lastPage as Page<Message>), data: received }], pageParams: [undefined] }
          }
          const [first, ...rest] = old.pages
          const updates = new Map(received.map((m) => [m.id, m]))
          const merged = first.data.map((m) => updates.get(m.id) ?? m)
          const known = new Set(first.data.map((m) => m.id))
          merged.push(...received.filter((m) => !known.has(m.id)))
          return {
            ...old,
            pages: [{ ...first, data: merged }, ...rest],
          }
        })
      } catch {
        // REST 是可靠来源；短暂网络失败交由下一次 SSE/WS 信号或重连再次补偿。
      } finally {
        syncing = false
        if (pending && !stopped) {
          pending = false
          void sync()
        }
      }
    }
    incrementalSyncRef.current = () => { void sync() }
    const onMessageEvent = (event: Event) => {
      const detail = (event as CustomEvent<{
        projectId?: string
        groupId?: string
        eventType?: string
      }>).detail
      if (detail?.projectId !== projectId || detail.groupId !== groupId) return
      if (detail.eventType === 'task.updated') {
        // Task 可能先于 TASK_STATUS 消息落库；收到 task.updated 后补查几次，
        // 让群聊进度卡片不必等到下一次完整刷新才出现。
        void sync()
        for (const delay of [500, 1500, 3000]) {
          window.setTimeout(() => {
            if (!stopped) void sync()
          }, delay)
        }
        return
      }
      // message.updated 复用原消息的 sequence，增量接口按 sequence 查询时不会返回它。
      // 失效整页查询，确保 TASK_STATUS 卡片用更新后的 content 替换旧的 PLANNING。
      if (detail.eventType === 'message.updated') {
        void queryClient.invalidateQueries({ queryKey: ['groups', projectId, groupId, 'messages'] })
        return
      }
      void sync()
    }
    const onReconnect = () => void sync()
    window.addEventListener('qgents:message-event', onMessageEvent)
    window.addEventListener('qgents:realtime-reconnected', onReconnect)
    return () => {
      stopped = true
      incrementalSyncRef.current = () => {}
      window.removeEventListener('qgents:message-event', onMessageEvent)
      window.removeEventListener('qgents:realtime-reconnected', onReconnect)
    }
  }, [groupId, projectId, queryClient])

  // 首屏列表完成后补一次，覆盖「事件先到、查询尚未写入缓存」的竞态。
  useEffect(() => {
    if (page) incrementalSyncRef.current()
  }, [page])

  // 发送者头像（微信式，边缘展示）：优先群成员 avatarUrl，自己用当前用户头像；SYSTEM 无头像
  const memberAvatarById = new Map(
    members.filter((mem) => mem.avatarUrl).map((mem) => [mem.id, mem.avatarUrl as string]),
  )
  function resolveSenderAvatar(m: Message): string | undefined {
    if (m.senderType === 'SYSTEM') return undefined
    if (m.senderType === 'USER' && m.senderId === user?.id) return user?.avatarUrl
    return m.senderId ? memberAvatarById.get(m.senderId) : undefined
  }

  // 无条件滚到底部：切群 / 首次加载 / 自己发送新消息时使用
  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  // 单张图片加载完成：如果用户「应该保持贴底」，则重新滚到底（rAF 等布局稳定后再滚）。
  // 多张图片时每张触发一次，第 1 张、第 2 张……依次改变高度都能重新贴底。
  const handleImageLoad = useCallback(() => {
    if (!shouldStickToBottomRef.current) return
    const el = listRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  // 用户滚动消息列表：据此更新「是否应该保持贴底」。
  // 接近底部 → 贴底；明显上翻查看历史 → 不贴底（图片加载也不拉回）。
  // 滚到顶部且还有更早的历史 → 触发分页加载（cursor 翻页，往上加载更早消息）。
  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    shouldStickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 80
    // 顶部触发加载更早历史：scrollTop 接近 0 且还有下一页，且不在加载中
    if (el.scrollTop <= 24 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // 向上加载更早消息后保持滚动位置：记录加载前的「距底距离」，加载完成后恢复，
  // 避免新页插入顶部后视图跳到顶部（停留在原来看的那条消息附近）。
  const prevScrollAnchorRef = useRef<number | null>(null)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    if (isFetchingNextPage) {
      prevScrollAnchorRef.current = el.scrollHeight - el.scrollTop
      return
    }
    const anchor = prevScrollAnchorRef.current
    if (anchor != null && messages.length > 0) {
      el.scrollTop = el.scrollHeight - anchor
    }
    prevScrollAnchorRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetchingNextPage, messages.length])

  // ResizeObserver：监听消息内容容器高度变化（图片加载、新消息渲染都会改变高度）。
  // 辅助机制：图片 onLoad 是主信号，RO 兜底覆盖「图片失败/懒加载等无 onLoad 场景」。
  useEffect(() => {
    const el = listRef.current
    const content = contentRef.current
    if (!el || !content) return
    const observer = new ResizeObserver(() => {
      if (shouldStickToBottomRef.current) {
        el.scrollTop = el.scrollHeight
      }
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  // 消息变化 / 切换群聊：
  // - 切群、首次加载 → 无条件滚到底（并把贴底标志置 true）
  // - 新消息到达（含自己发送）→ 用户之前在底部则滚，在查看历史则不打扰
  // - 本群刚发送新消息（pendingScrollRef）→ 强制滚到底，忽略滚动事件把 stick 标志重算成 false
  const lastMessageId = messages[messages.length - 1]?.id
  useEffect(() => {
    if (messages.length === 0) return
    if (pendingScrollRef.current || shouldStickToBottomRef.current) {
      pendingScrollRef.current = false
      scrollToBottom()
    }
    // 切群时强制贴底：groupId 变化代表进入新群，无视历史滚动位置
    // 通过重置标志 + 无条件滚动实现
  }, [messages.length, lastMessageId, groupId, scrollToBottom])

  // 切换群聊：进入新群一律贴底（重置用户滚动状态）
  useEffect(() => {
    shouldStickToBottomRef.current = true
    scrollToBottom()
    // 右键 @ta 菜单随群切换关闭，避免残留到新群的旧坐标菜单
    setCtxMenu(null)
  }, [groupId, scrollToBottom])

  // 进群全读（§三）：直接调后端推进已读游标。
  // 不用 useMutation：StrictMode/切群重挂载下 react-query 的 MutationObserver 会偶发
  // 「mutate() 被调用但 mutationFn 不执行」（setOptions 在 pending 时 reset，新 Mutation 拿不到
  // mutationFn）→ read 请求不发。这里是纯副作用（乐观清零 + 推进游标），直接 fetch 最可靠。
  const markGroupReadNow = useCallback(async (): Promise<void> => {
    if (!projectId || !groupId) return
    // 乐观清零当前群未读：红点立即消失，不等后端往返
    // 注意：必须用 setQueryData（精确匹配）——setQueriesData 是前缀模糊匹配，
    // 会把 ['groups', projectId, groupId, 'messages'] 的分页信封对象也喂给 updater，
    // groups.map 直接崩掉，导致 read 请求在发出前就被中断。
    const clearCurrent = (groups: Group[] | undefined): Group[] | undefined =>
      groups ? groups.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)) : groups
    queryClient.setQueryData<Group[]>(['groups', projectId], clearCurrent)
    queryClient.setQueryData<Group[]>(['chat', 'main-groups'], clearCurrent)
    try {
      const data = await groupApi.markRead(projectId, groupId)
      // 记录已读游标：后续新消息 seq > 游标 且 @ 我 的才触发「有人@我」提示
      setLastReadSeq(data?.lastReadSequenceNo ?? null)
    } catch {
      // 已读失败不打断：保持乐观清零（用户已进群阅读），后端游标由下次进群重试覆盖
    }
    void queryClient.invalidateQueries({ queryKey: ['groups', projectId] })
    void queryClient.invalidateQueries({ queryKey: ['chat', 'main-groups'] })
  }, [projectId, groupId, queryClient])

  // 进群全读一次（仅在切换群时）：推进后端已读游标，作为「@ 我」未读判定基准。
  // 不能依赖 messages.length——否则每条新消息都会全读，把 @ 未读游标推进到最新，
  // 「↑ 有人@了我」提示条与群列表 @ 角标（后端 mentionedUnread）将永远不出现。
  useEffect(() => {
    if (groupId) void markGroupReadNow()
  }, [groupId, markGroupReadNow])

  // 离开群 / 组件卸载时：补一次「离开即已读」，把游标推进到该群最新消息。
  // 否则「进群后新消息累积的 unreadCount / mentionedUnread」会在离开群后于侧栏残留红点/红字
  // （侧栏红点与「有人@你」渲染只看 unreadCount / mentionedUnread，不看当前是否在看该群——见 ProjectDetailLayout）。
  // 注意：只调接口 + 更新 queryClient 缓存，不做 setState（卸载时 setState 会告警）。
  useEffect(() => {
    const projectIdAtMount = projectId
    const groupIdAtMount = groupId
    return () => {
      if (!projectIdAtMount || !groupIdAtMount) return
      // 乐观清零该群 unreadCount 与 mentionedUnread，避免离开后侧栏红点/红字残留
      const clearLeft = (groups: Group[] | undefined): Group[] | undefined =>
        groups
          ? groups.map((g) =>
              g.id === groupIdAtMount ? { ...g, unreadCount: 0, mentionedUnread: 0 } : g,
            )
          : groups
      queryClient.setQueryData<Group[]>(['groups', projectIdAtMount], clearLeft)
      queryClient.setQueryData<Group[]>(['chat', 'main-groups'], clearLeft)
      void groupApi.markRead(projectIdAtMount, groupIdAtMount).catch(() => {
        // 离开时已读失败：下次进群 markRead 会覆盖，不阻塞
      })
    }
  }, [projectId, groupId, queryClient])

  // 兜底：消息列表首次加载成功后补发一次 read（幂等，游标只前进）。
  // 覆盖「进群 effect 因时序/挂载问题未触发」的情况——只要点进群、消息加载出来，read 必发。
  const markReadForGroupRef = useRef<string | null>(null)
  useEffect(() => {
    if (!page || !groupId) return
    if (markReadForGroupRef.current === groupId) return
    markReadForGroupRef.current = groupId
    void markGroupReadNow()
  }, [page, groupId, markGroupReadNow])

  /**
   * 消息校准（可靠消息同步 §1/§2）：
   * - 本地消息带 sequence → 用 max(sequence) 调 /messages/incremental 补齐缺失消息，合并进缓存
   * - incremental 失败或本地无 sequence → 回退整页 invalidate 重拉
   */
  const reconcileMessages = useCallback(async (): Promise<void> => {
    if (!projectId || !groupId) return
    // useInfiniteQuery 缓存结构为 { pages, pageParams }：取全部页的消息算最大 sequence
    const cached = queryClient.getQueryData<InfiniteData<Page<Message>>>([
      'groups',
      projectId,
      groupId,
      'messages',
    ])
    const all = cached?.pages.flatMap((p) => p.data) ?? []
    const sequences = all.map((m) => m.sequence).filter((s): s is number => typeof s === 'number')
    const maxSequence = sequences.length > 0 ? Math.max(...sequences) : null

    if (maxSequence == null) {
      // 本地没有 sequence 信息（旧数据/首次）→ 整页重拉
      void queryClient.invalidateQueries({ queryKey: ['groups', projectId, groupId, 'messages'] })
      void queryClient.invalidateQueries({ queryKey: ['groups', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['chat', 'main-groups'] })
      return
    }

    try {
      // §1：增量拉取 sequence > maxSequence 的消息，按 id 去重合并进第一页（最新页）
      const incremental = await groupApi.listMessagesIncremental(projectId, groupId, maxSequence)
      if (incremental.data.length === 0) return
      queryClient.setQueryData<InfiniteData<Page<Message>>>(
        ['groups', projectId, groupId, 'messages'],
        (prev) => {
          if (!prev) {
            return {
              pages: [incremental],
              pageParams: [undefined],
            }
          }
          const [first, ...rest] = prev.pages
          const updates = new Map(incremental.data.map((m) => [m.id, m]))
          const merged = first.data.map((m) => updates.get(m.id) ?? m)
          const known = new Set(first.data.map((m) => m.id))
          merged.push(...incremental.data.filter((m) => !known.has(m.id)))
          return {
            ...prev,
            pages: [{ ...first, data: merged }, ...rest],
          }
        },
      )
      // 群列表/主群的最新消息摘要也需校准
      void queryClient.invalidateQueries({ queryKey: ['groups', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['chat', 'main-groups'] })
    } catch {
      // 增量接口失败（如后端未实现）→ 回退整页重拉
      void queryClient.invalidateQueries({ queryKey: ['groups', projectId, groupId, 'messages'] })
      void queryClient.invalidateQueries({ queryKey: ['groups', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['chat', 'main-groups'] })
    }
  }, [projectId, groupId, queryClient])

  // 窗口从后台/最小化回到前台时校准当前群消息：浏览器会挂起后台标签页（WS 断开、消息丢失），
  // 而全局 refetchOnWindowFocus 为 false，回前台必须显式校准，否则群聊面板停留旧消息。
  // 优先用可靠消息增量接口（§1）按 sequence 补齐；本地无 sequence（旧数据）才整页重拉。
  useEffect(() => {
    if (!projectId || !groupId) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void reconcileMessages()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [projectId, groupId, queryClient, reconcileMessages])

  // WS 断线重连成功后：对当前群消息做增量补齐（可靠消息同步 §1/§2），
  // 比整页重拉更精准——只拉 sequence 之后的缺失消息合并进缓存。
  useEffect(() => {
    if (!projectId || !groupId) return
    return subscribeRealtimeReconnect(() => {
      void reconcileMessages()
    })
  }, [projectId, groupId, reconcileMessages])

  // @ 提及面板：最后一个 @ 到行尾无空格时弹出；@ 后输入的字符作为候选过滤关键词（如 @张 → 只剩名字带「张」）
  const lastAt = draft.lastIndexOf('@')
  const mentionOpen = lastAt >= 0 && !draft.slice(lastAt).includes(' ')
  const mentionQuery = lastAt >= 0 ? draft.slice(lastAt + 1).toLowerCase().trim() : ''
  const filteredAgents = teamAgents.filter((a) => !mentionQuery || a.name.toLowerCase().includes(mentionQuery))
  const filteredUsers = otherUserMembers.filter(
    (m) => !mentionQuery || m.displayName.toLowerCase().includes(mentionQuery),
  )

  // 未读「@ 我」消息列表（升序）：seq > 已读游标 且 mentions 含我 且非本人发送；
  // lastReadSeq 为空（进群全读完成前）不提示，避免把历史 @ 消息当未读
  const mentionMessages = useMemo(() => {
    if (lastReadSeq == null || !currentUserId) return []
    return messages.filter(
      (m) =>
        m.senderType !== 'AGENT' &&
        m.senderId !== currentUserId &&
        (m.sequence ?? 0) > lastReadSeq &&
        (m.mentions ?? []).some((mention) => mention.type === 'USER' && mention.id === currentUserId),
    )
  }, [messages, lastReadSeq, currentUserId])
  // 提示条跳转目标 = 最新一条未读 @ 消息
  const mentionMessage = mentionMessages.length === 0 ? null : mentionMessages[mentionMessages.length - 1]

  /** 滚动到指定消息并临时高亮（复用「有人@你」点击效果） */
  function flashMention(messageId: string): void {
    setMentionFlashId(messageId)
    setDismissedMentionId(messageId)
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => setMentionFlashId(null), 2200)
  }

  /** 点击「有人@你」：滚动到该消息并临时高亮；同时忽略该条，按钮消失（新 @ 消息再来时重新出现） */
  function jumpToMention() {
    if (!mentionMessage) return
    flashMention(mentionMessage.id)
  }
  const showMentionBar = mentionMessage !== null && mentionMessage.id !== dismissedMentionId
  const canOpenTaskTrigger = group?.type === 'REQUIREMENT' && group.status === 'ACTIVE' && !group.isArchived

  // 从「@ 提及」通知跳转过来：自动滚动到被 @ 的消息并高亮（模拟点击提示条）。
  // 通知带 resourceId=messageId → 精确定位；缺 messageId（旧数据）→ 兜底跳到最上面（最早）一条被 @ 的消息。
  // 精确目标不在已加载分页窗口时，拉单条（GET .../messages/{messageId}）合并进列表后再跳转。
  // 跳转成功后才消费导航 state，避免重渲染重复触发。
  const autoMentionJumpedRef = useRef(false)
  const autoMentionFetchingRef = useRef(false)
  useEffect(() => {
    if (autoMentionJumpedRef.current || messages.length === 0 || !currentUserId) return
    const mentionMessageId = (location.state as { mentionMessageId?: string } | null)?.mentionMessageId
    const hasAutoJumpFlag =
      typeof mentionMessageId === 'string' || (location.state as { autoJumpMention?: boolean } | null)?.autoJumpMention === true
    if (!hasAutoJumpFlag) return
    const isUserMention = (m: Message): boolean =>
      m.senderType !== 'AGENT' &&
      m.senderId !== currentUserId &&
      (m.mentions ?? []).some((mention) => mention.type === 'USER' && mention.id === currentUserId)
    const target = mentionMessageId
      ? messages.find((m) => m.id === mentionMessageId && isUserMention(m))
      : messages.find(
          isUserMention,
        )
    if (target) {
      autoMentionJumpedRef.current = true
      flashMention(target.id)
      navigate(location.pathname, { replace: true, state: {} })
      return
    }
    // 精确目标不在已加载窗口：拉单条并合并（只拉一次；失败保持现状，状态不消费）
    if (typeof mentionMessageId === 'string' && !autoMentionFetchingRef.current) {
      autoMentionFetchingRef.current = true
      void groupApi
        .getMessage(projectId, groupId, mentionMessageId)
        .then((msg) => {
          // useInfiniteQuery 缓存结构为 { pages, pageParams }：单条合并进第一页（最新页）
          queryClient.setQueryData<InfiniteData<Page<Message>>>(
            ['groups', projectId, groupId, 'messages'],
            (prev) => {
              if (!prev || prev.pages[0]?.data.some((m) => m.id === msg.id)) return prev
              const [first, ...rest] = prev.pages
              return {
                ...prev,
                pages: [
                  { ...first, data: [...first.data, msg] },
                  ...rest,
                ],
              }
            },
          )
        })
        .catch(() => {
          // 单条拉取失败：静默，不阻塞聊天
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, location.pathname, navigate, location.state, currentUserId])

  function pickMention(target: { id: string; displayName: string; type: MentionType }) {
    // 用「@显示名 + 空格」替换掉最后一个 @ 及其后的过滤字符，避免残留查询词
    setDraft((prev) => {
      const at = prev.lastIndexOf('@')
      return at >= 0 ? `${prev.slice(0, at)}@${target.displayName} ` : `${prev}@${target.displayName} `
    })
    setMentions((prev) => [...prev, { type: target.type, id: target.id }])
  }

  /**
   * 右键「@ta」：把目标消息的发送者解析为可 @ 的候选（与候选面板同源：userMembers / teamAgents）。
   * 解析不到的（如 SYSTEM、自己、非候选 Agent）返回 null，不弹出菜单。
   */
  function resolveCtxMention(m: Message): { displayName: string; type: MentionType } | null {
    if (m.senderType === 'USER') {
      const member = userMembers.find((mem) => mem.id === m.senderId)
      return member ? { displayName: member.displayName, type: 'USER' } : null
    }
    if (m.senderType === 'AGENT') {
      const agent = teamAgents.find((a) => a.id === m.senderId)
      return agent ? { displayName: agent.name, type: 'AGENT' } : null
    }
    return null
  }

  /** 右键菜单「@ta」：在输入框追加 @该成员 + 空格，登记提及并聚焦输入框进入编辑态 */
  function mentionFromCtx(m: Message): void {
    const resolved = resolveCtxMention(m)
    if (!resolved || !m.senderId) return
    setDraft((prev) => {
      const base = prev.trimEnd()
      return base ? `${base} @${resolved.displayName} ` : `@${resolved.displayName} `
    })
    setMentions((prev) => [...prev, { type: resolved.type, id: m.senderId as string }])
    setCtxMenu(null)
    // 等 draft 更新后再聚焦（TextArea 由受控 value 驱动，聚焦本身不依赖 draft）
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  // 右键菜单打开时：点击任意处 / 滚动 / 失焦关闭（菜单自身 mousedown 会阻止冒泡，避免点菜单即关）
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('blur', close)
    }
  }, [ctxMenu])

  // ──── 乐观发送：先把消息插进缓存展示（带转圈），后端返回后替换为真实消息 ────
  const messagesKey = ['groups', projectId, groupId, 'messages'] as const

  function insertOptimisticMessage(msg: Message): void {
    queryClient.setQueryData<InfiniteData<Page<Message>>>(messagesKey, (prev) => {
      const page: Page<Message> = prev?.pages[0] ?? { data: [], page: { nextCursor: null, hasMore: false } }
      if (!prev) {
        return { pages: [{ ...page, data: [msg] }], pageParams: [undefined] }
      }
      return {
        ...prev,
        pages: [{ ...page, data: [msg, ...page.data] }, ...prev.pages.slice(1)],
      }
    })
  }

  function replaceOptimisticMessage(optimisticId: string, real: Message): void {
    queryClient.setQueryData<InfiniteData<Page<Message>>>(messagesKey, (prev) => {
      if (!prev) return prev
      return {
        ...prev,
        pages: prev.pages.map((p) => ({
          ...p,
          data: p.data.map((m) => (m.id === optimisticId ? { ...real, pending: false } : m)),
        })),
      }
    })
  }

  function removeOptimisticMessage(optimisticId: string): void {
    queryClient.setQueryData<InfiniteData<Page<Message>>>(messagesKey, (prev) => {
      if (!prev) return prev
      return {
        ...prev,
        pages: prev.pages.map((p) => ({ ...p, data: p.data.filter((m) => m.id !== optimisticId) })),
      }
    })
  }

  async function handleSend() {
    const text = draft.trim()
    // 允许纯引用（引用 DIFF 卡等）：回复目标存在时正文可为空（B3，服务端用群描述兜底）
    if ((!text && !replyTo) || sending) return

    // 提及与正文对齐：用户删除 @某某 文本后不再携带该提及（修复「删掉 @agent 仍触发建任务」）。
    // pickMention 只在候选面板加载完成（teamAgents/userMembers 已就绪）时可点，故此处映射可靠。
    const mentionDisplayName = (mention: Mention): string | undefined =>
      mention.type === 'AGENT'
        ? teamAgents.find((agent) => agent.id === mention.id)?.name
        : userMembers.find((member) => member.id === mention.id)?.displayName
    const effectiveMentions = mentions.filter((mention) => {
      const displayName = mentionDisplayName(mention)
      return !!displayName && text.includes(displayName)
    })
    const hasAgentMention = effectiveMentions.some((mention) => mention.type === 'AGENT')
    const taskText = taskTextFromReply(text, effectiveMentions, mentionDisplayName)
    setSending(true)
    setSendError(null)
    // 乐观发送：先本地构造一条临时消息（pending 转圈）插入缓存，避免等待后端返回期间"卡住没反应"
    const optimisticId = `cmsg_${Date.now()}`
    const optimisticContent = replyTo
      ? {
          // QUOTE 同时提供通用 text 字段。自动建任务和群摘要按普通消息取正文时，
          // 不应退化为序列化整个引用元数据对象。
          text: taskText,
          quotedMessageId: replyTo.id,
          quotedText: quotePreview(replyTo),
          quotedSenderName: replyTo.senderName ?? (replyTo.senderType === 'AGENT' ? 'Agent' : '成员'),
          replyText: text,
        }
      : { text }
    insertOptimisticMessage({
      id: optimisticId,
      groupId,
      type: replyTo ? 'QUOTE' : 'TEXT',
      content: optimisticContent,
      senderType: 'USER',
      senderId: user?.id,
      senderName: user?.displayName,
      createdAt: new Date().toISOString(),
      replyToId: replyTo ? replyTo.id : null,
      replyText: replyTo ? text : undefined,
      pending: true,
    })
    try {
      // 自己发消息 → 应当保持贴底（新消息渲染 + 历史图片继续加载时都滚到底）
      shouldStickToBottomRef.current = true
      // 强制滚底：发送期间产生的滚动/布局事件可能把 stick 标志重算为 false，用 pending 标志兜底
      pendingScrollRef.current = true
      // 回复引用：type=QUOTE，quotedText 为被引用消息的原始内容摘要，replyText 为回复正文。
      // §7 冻结：replyText 放顶层；content 内保留一份以兼容旧后端/旧数据读取
      const result = await groupApi.sendMessage(projectId, groupId, {
        type: replyTo ? 'QUOTE' : 'TEXT',
        content: optimisticContent,
        replyText: replyTo ? text : undefined,
        mentions: effectiveMentions.length > 0 ? effectiveMentions : undefined,
        replyToId: replyTo ? replyTo.id : null,
        clientMessageId: optimisticId,
      })
      const sentMessage = result.message
      const quotedDiff = replyTo?.type === 'DIFF'
      // 成功：用真实消息替换乐观消息（去掉 pending 转圈）
      replaceOptimisticMessage(optimisticId, sentMessage)
      setDraft('')
      setMentions([])
      setReplyTo(null)
      await queryClient.invalidateQueries({
        queryKey: ['groups', projectId, groupId, 'messages'],
      })
      // 发送完成后强制滚一次，确保最新消息可见（pending 标志由消息变化效果统一清除）
      scrollToBottom()
      if (hasAgentMention && canOpenTaskTrigger) {
        void queryClient.invalidateQueries({ queryKey: ['qgents', 'projects', projectId, 'tasks'] })
      }
      if (result.task) {
        message.success(`${result.task.displayCode} 已创建，当前状态：${result.task.status}`)
      } else if (quotedDiff && sentMessage) {
        // 引用 DIFF 卡续作：优先走续作（复用源 Workspace，不得传 repositoryIds），后端未自动建任务时显式触发。
        // 传入发送时的正文作为任务标题/需求（此时 draft 已清空，不能读组件状态）
        triggerFromMessage.mutate({
          messageId: sentMessage.id,
          title: taskTitleFromMessage(text),
          requirement: text,
        })
      } else if (hasAgentMention && canOpenTaskTrigger) {
        // 普通 @编排助手消息由 MessageSentListener 在服务端自动建 Task。
        // 这里不再并行调用 /trigger-task，避免自动触发尚未落库时重复创建任务
        // 产生误报（任务随后仍由服务端按项目仓库范围异步创建）。
        if (canOpenTaskTrigger) {
          void queryClient.invalidateQueries({ queryKey: ['qgents', 'projects', projectId, 'tasks'] })
          message.info('需求已发送，任务正在后台创建。')
        }
      }
      return sentMessage
    } catch (error) {
      // 失败：移除乐观消息，展示错误（原 draft 保留，可重发）
      removeOptimisticMessage(optimisticId)
      setSendError(formatApiError(error))
      return null
    } finally {
      setSending(false)
    }
  }

  // 显式触发任务（§7 从消息触发任务；续作引用时不得传 repositoryIds，C1/C2）。
  // 触发参数由调用方传入：handleSend 里 draft 会在触发前清空，不能闭包读 draft（否则 title/requirement 恒空）。
  const triggerFromMessage = useMutation({
    mutationFn: (input: { messageId: string; title: string; requirement?: string }) =>
      groupApi.triggerTask(projectId, groupId, input.messageId, {
        title: input.title,
        requirement: input.requirement,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['qgents', 'projects', projectId, 'tasks'] })
      message.success('增量任务已创建，正在生成执行方案。')
    },
    onError: (error) => {
      // C3：引用 DIFF 续作的 422 错误码给出明确提示；其余走通用错误文案
      const code = error instanceof ApiError && error.body && typeof error.body === 'object' && 'error' in error.body
        ? (error.body as { error?: { code?: unknown } }).error?.code
        : undefined
      if (code === 'QUOTED_DIFF_INVALID') message.error('该 Diff 已失效，请刷新消息列表后重试')
      else if (code === 'QUOTED_DIFF_NOT_ACCESSIBLE') message.error('无权引用该 Diff，请确认项目权限')
      else message.error(error instanceof Error ? error.message : '任务触发失败，请重试')
    },
  })

  /** 选择附件后：直传 OSS → 发送 IMAGE/FILE 消息（§18 附件链路 + 增量契约 §6 attachmentId） */
  async function handleUpload(file: File) {
    if (uploading) return
    setUploading(true)
    try {
      const attachmentId = await uploadAttachment(projectId, file)
      const url = attachmentApi.contentUrl(projectId, attachmentId)
      const isImage = file.type.startsWith('image/')
      await groupApi.sendMessage(projectId, groupId, {
        type: isImage ? 'IMAGE' : 'FILE',
        content: isImage
          ? // §6.2：IMAGE content 必须带 attachmentId（多模态输入依赖）
            { url, attachmentId }
          : { url, attachmentId, name: file.name, size: file.size, mimeType: file.type },
        clientMessageId: `cmsg_${Date.now()}`,
      })
      await queryClient.invalidateQueries({
        queryKey: ['groups', projectId, groupId, 'messages'],
      })
    } catch (e) {
      message.error(e instanceof Error ? e.message : '附件发送失败')
    } finally {
      setUploading(false)
    }
  }

  /**
   * 打开文件消息：解析 attachmentId 后打开页内预览弹窗（增量契约 §4/§5）。
   * 无法解析附件 ID 时提示（不再直接跳新标签；预览弹窗内负责 preview-url / download 降级）。
   */
  const openFile = useCallback(
    (target: Message) => {
      const c = target.content as FileMessageContent
      // §6：content.attachmentId 为必填；兼容旧消息从 url 解析
      const attachmentId = c.attachmentId || extractAttachmentId(c.url)
      if (!attachmentId) {
        message.error('无法解析附件 ID，请刷新后重试')
        return
      }
      setPreviewTarget({
        attachmentId,
        fileName: c.name,
        // §7：后端若已回填 previewUrl（相对路径带 token），零请求直接预览
        embeddedPreviewUrl: c.previewUrl,
      })
    },
    [message],
  )

  // AI 自动沉淀 Memory（草稿）：后端自动检索当前群最近聊天并生成草稿，投给用户/Admin 审核确认
  const createAiMemory = useMutation({
    mutationFn: () => memoryApi.generateDraft(projectId, { groupId }),
    onSuccess: () => {
      message.success('AI 已根据最近群聊生成 Memory 草稿，可在交付中心提交审核')
      void queryClient.invalidateQueries({ queryKey: ['memories', projectId] })
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : 'Memory 生成失败，请重试')
    },
  })

  // TASK_STATUS 任务状态卡按消息流时间位置渲染（不置顶）；
  // 后端单卡持续更新（message.updated → 重查消息列表），content 原地刷新

  return (
    // 聊天区错误边界：渲染崩溃只挂聊天区，侧栏/动态面板不受影响；切群自动复位
    <ErrorBoundary resetKey={groupId}>
      <Layout style={{ height: '100%', background: token.colorBgBase }}>
      {/* 顶部：群标题 + 操作入口；多选模式下切换为「取消 | 已选择 N 条」 */}
      <div
        className="chat-panel__header"
        style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${token.colorBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {/* 项目主群：群头像 = 项目头像（v2.0.6，与群聊工作台会话列表一致）；需求群不显示 */}
            {group?.type === 'PROJECT_MAIN' ? (
              <Avatar
                size={36}
                src={project?.avatarUrl}
                icon={<TeamOutlined />}
                style={{ background: '#3b82f6', flexShrink: 0 }}
              />
            ) : null}
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ fontSize: 16 }}>
                <Text type="success">#</Text> {group?.title ?? '群聊'}
              </Text>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {group?.type === 'PROJECT_MAIN' ? '项目总群' : '需求群'}
                  {group?.memberCount ? ` · ${group.memberCount} 人` : ''}
                </Text>
              </div>
            </div>
          </div>
          <Space className="chat-panel__header-actions" size={8} wrap>
            {/* @Agent 发起任务入口 —— 打开 B 的 TaskTriggerModal；其余操作收进「群聊设置」栏 */}
            {canOpenTaskTrigger && <Button
              type="primary"
              ghost
              icon={<ThunderboltOutlined />}
              onClick={() => setTriggerOpen(true)}
            >
              发起任务
            </Button>}
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsOpen(true)}
            >
              群聊设置
            </Button>
          </Space>
        </>
      </div>

      {/* 消息列表 */}
      <Layout.Content
        ref={listRef}
        className="chat-panel__message-list"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          background: token.colorBgBase,
        }}
        onScroll={handleScroll}
        aria-label="对话内容"
      >
        {isLoading ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#5b6b82', fontSize: 14 }}>
                <MessageOutlined style={{ marginRight: 8 }} />
                正在加载群聊消息…
              </div>
            </div>
          </div>
        ) : isError ? (
          <Empty description="消息加载失败" />
        ) : messages.length === 0 ? (
          <Empty description="还没有消息，来说点什么吧" />
        ) : (
          <div ref={contentRef} className="chat-panel__message-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 顶部：加载更早历史的分页指示 */}
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              {isFetchingNextPage ? (
                <Spin size="small" />
              ) : hasNextPage ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  向上滚动加载更早消息
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  — 已加载全部历史消息 —
                </Text>
              )}
            </div>
            {messages.map((m, messageIndex) => {
              const isSelf = m.senderType === 'USER' && m.senderId === user?.id
              const previousMessage = messages[messageIndex - 1]
              const groupedWithPrevious = Boolean(
                previousMessage &&
                  previousMessage.senderType !== 'SYSTEM' &&
                  m.senderType !== 'SYSTEM' &&
                  previousMessage.senderType === m.senderType &&
                  previousMessage.senderId === m.senderId &&
                  previousMessage.type !== 'TASK_STATUS' &&
                  m.type !== 'TASK_STATUS',
              )
              const flashing = mentionFlashId === m.id
              return (
                <div
                  key={m.id}
                  className={groupedWithPrevious ? 'chat-panel__message-row chat-panel__message-row--grouped' : 'chat-panel__message-row'}
                  id={`msg-${m.id}`}
                  onContextMenu={
                    !isSelf && m.senderType !== 'SYSTEM'
                      ? (e) => {
                          e.preventDefault()
                          setCtxMenu({ x: e.clientX, y: e.clientY, message: m })
                        }
                      : undefined
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    // 让气泡按左右对齐
                    justifyContent: isSelf ? 'flex-end' : 'flex-start',
                    // 被 @ 跳转后的临时高亮
                    background: flashing ? 'rgba(245, 158, 11, 0.18)' : undefined,
                    borderRadius: 8,
                    padding: flashing ? '3px 8px' : undefined,
                    margin: flashing ? '-3px -8px' : undefined,
                    transition: 'background 0.4s ease',
                  }}
                >
                  {/* 他人消息：头像在左边缘；自己消息：头像在右边缘（微信式） */}
                  {!isSelf && m.senderType !== 'SYSTEM' && (
                    <Avatar
                      size={32}
                      src={resolveSenderAvatar(m)}
                      style={{ flexShrink: 0, background: '#3b82f6', marginTop: 2 }}
                    >
                      {(m.senderName ?? '?').slice(0, 1)}
                    </Avatar>
                  )}
                  {/* 内层 div 限制最大宽度 78%（相对消息列宽），气泡在内部 fit-content 铺满可用宽度，
                      保证每行容纳更多字；左右对齐由外层 justifyContent 控制 */}
                  <div style={{ maxWidth: '78%', minWidth: 0 }}>
                    <MessageBubble
                      message={m}
                      isSelf={isSelf}
                      selfDisplayName={user?.displayName ?? '我'}
                      projectId={projectId}
                      taskStatusById={taskStatusById}
                      onReply={handleReply}
                      onOpenFile={openFile}
                      onImageLoad={handleImageLoad}
                    />
                  </div>
                  {isSelf && (
                    <Avatar
                      size={32}
                      src={user?.avatarUrl}
                      style={{ flexShrink: 0, background: '#f97316', marginTop: 2 }}
                    >
                      {(user?.displayName ?? '我').slice(0, 1)}
                    </Avatar>
                  )}
                </div>
              )
            })}
            {/* 未读「@ 我」提示条：点击跳到被 @ 的那条消息，点击后按钮消失 */}
            {showMentionBar ? (
              <div
                className="chat-panel__mention-jump"
                onClick={jumpToMention}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    jumpToMention()
                  }
                }}
              >
                <span aria-hidden>↑</span>
                <span>有人@你{mentionMessages.length > 1 ? ` · ${mentionMessages.length} 条` : ''}</span>
              </div>
            ) : null}
          </div>
        )}
      </Layout.Content>

      {/* 底部输入区 */}

        <div className="chat-panel__composer" style={{ position: 'relative', padding: '12px 20px 16px', borderTop: `1px solid ${token.colorBorder}` }}>
          {/* @ 提及成员面板 */}
          {mentionOpen && (filteredAgents.length > 0 || filteredUsers.length > 0) && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 20,
              right: 20,
              marginBottom: 8,
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
              maxHeight: 240,
              overflowY: 'auto',
              padding: 6,
              zIndex: 10,
            }}
          >
            {/* Agent 候选：仅活跃需求群可 @ Agent（项目总群不提供 @Agent，发起任务必须挂 REQUIREMENT 群） */}
            {canOpenTaskTrigger && filteredAgents.length > 0 && (
              <MentionGroup
                label="Agent"
                members={filteredAgents.map((a) => ({ id: a.id, displayName: a.name, type: 'AGENT' as const, avatarUrl: a.avatar }))}
                onPick={pickMention}
              />
            )}
            {filteredUsers.length > 0 && (
              <MentionGroup
                label="成员"
                members={filteredUsers.map((m) => ({ id: m.id, displayName: m.displayName, type: 'USER' as const, avatarUrl: m.avatarUrl }))}
                onPick={pickMention}
              />
            )}
          </div>
        )}

        {/* 回复引用条：选中消息后显示，可取消 */}
        {replyTo && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
              padding: '6px 10px',
              border: `1px solid ${token.colorBorder}`,
              borderLeft: '3px solid #3b82f6',
              borderRadius: 8,
              background: token.colorFillQuaternary,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                回复 {replyTo.senderName ?? (replyTo.senderType === 'AGENT' ? 'Agent' : '成员')}：
              </Text>
              <Text ellipsis style={{ fontSize: 12 }}>
                {quotePreview(replyTo)}
              </Text>
              {replyTo.type === 'DIFF' && (
                <Text type="warning" style={{ fontSize: 12, display: 'block' }}>
                  引用 Diff 卡将发起增量修改（复用源工作区）
                </Text>
              )}
            </div>
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setReplyTo(null)}
              aria-label="取消回复"
            />
          </div>
        )}

        {sendError ? <Text type="danger" style={{ display: 'block', marginBottom: 8 }}>{sendError}</Text> : null}
        <div className="chat-panel__composer-row">
          <Upload
            showUploadList={false}
            multiple={false}
            beforeUpload={(file) => {
              void handleUpload(file)
              return false
            }}
          >
            <Button className="chat-panel__composer-tool" icon={<PaperClipOutlined />} loading={uploading} aria-label="发送文件" />
          </Upload>
          <Input.TextArea
            ref={inputRef}
            placeholder="输入消息，@ 可提及成员或 Agent，回车发送…"
            autoSize={{ minRows: 1, maxRows: 4 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            // 发送中禁用输入框：防止发送期间继续输入/重复回车触发
            disabled={sending}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="chat-panel__composer-input"
          />
            <Button
            className="chat-panel__composer-send"
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            disabled={sending || (!draft.trim() && !replyTo)}
          >
            发送
          </Button>
        </div>
        </div>

      {/* @Agent 发起任务弹窗（B 的 TaskTriggerModal） */}
      <TaskTriggerModal
        open={triggerOpen}
        projectId={projectId}
        groupId={groupId}
        initialInstruction=""
        onClose={() => setTriggerOpen(false)}
      />

      {/* 群聊设置栏 —— 收纳除「发起任务」外的群操作（成员管理 / AI 沉淀 / 归档等） */}
      <Drawer
        title="群聊设置"
        placement="right"
        width={320}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {/* 成员区：直接内嵌显示成员；「成员管理」开关后每行追加「移出群聊」 */}
          <GroupMemberSettings projectId={projectId} group={group ?? null} />
          <Divider />
          {/* AI 沉淀 Memory —— 自动检索本群最近聊天生成草稿，投给用户/Admin 确认 */}
          <Button
            block
            icon={<MessageOutlined />}
            loading={createAiMemory.isPending}
            onClick={() => {
              createAiMemory.mutate()
              setSettingsOpen(false)
            }}
          >
            AI 沉淀 Memory
          </Button>
          {/* 归档需求群 —— 仅需求群 + 创建者可见 */}
          {group?.type === 'REQUIREMENT' && group.createdBy === user?.id && !group.isArchived && (
            <Popconfirm
              title="归档需求群"
              description="归档后该群将移入「已归档」，不可恢复。确定归档？"
              okText="归档"
              cancelText="取消"
              onConfirm={() => {
                archiveGroup.mutate()
                setSettingsOpen(false)
              }}
            >
              <Button block danger icon={<InboxOutlined />} loading={archiveGroup.isPending}>
                归档需求群
              </Button>
            </Popconfirm>
          )}
        </Space>
      </Drawer>
      {/* 附件内联预览（增量契约 §4/§5/§7）：图片放大 / PDF iframe / 文本代码高亮 / 不支持回退下载 */}
      {previewTarget ? (
        <AttachmentPreviewModal
          open
          projectId={projectId}
          attachmentId={previewTarget.attachmentId}
          fileName={previewTarget.fileName}
          embeddedPreviewUrl={previewTarget.embeddedPreviewUrl}
          onClose={() => setPreviewTarget(null)}
        />
      ) : null}
      {/* 右键成员消息上下文菜单：@ta 该成员（点击空白/滚动/失焦自动关闭） */}
      {ctxMenu ? (
        <div
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 1000,
            minWidth: 120,
            padding: 4,
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorder}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Button
            type="text"
            block
            onClick={() => mentionFromCtx(ctxMenu.message)}
            style={{ textAlign: 'left' }}
          >
            <Text strong style={{ marginRight: 6 }}>@</Text>
            ta
          </Button>
        </div>
      ) : null}
      </Layout>
    </ErrorBoundary>
  )
}

function taskTitleFromMessage(text: string): string {
  const withoutLeadingMentions = text.replace(/(?:^|\s)@\S+/g, ' ').trim()
  return (withoutLeadingMentions || text).slice(0, 80)
}

/**
 * 消息气泡保留 @ 提及以表达对 Agent 的指派；任务正文不应把它当作需求的一部分。
 * 仅移除本次实际提及对象开头的名称，避免误删需求正文中的普通 @ 字符。
 */
function taskTextFromReply(
  text: string,
  mentions: readonly Mention[],
  displayNameForMention: (mention: Mention) => string | undefined,
): string {
  let result = text.trim()
  const names = mentions
    .map(displayNameForMention)
    .filter((name): name is string => Boolean(name))
    .sort((left, right) => right.length - left.length)

  for (const name of names) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`^@${escapedName}(?:[\\s，,：:]+)?`), '').trim()
  }
  return result || text.trim()
}

/** 时间分隔线文案：今天 HH:mm / 昨天 HH:mm / M月D日 HH:mm（气泡时间展示用） */
function formatTimeDivider(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return hhmm
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return `昨天 ${hhmm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hhmm}`
}

/** 消息气泡发送时间：HH:mm（当天）/ 昨天 HH:mm / M月D日 HH:mm */
function formatClock(iso: string): string {
  return formatTimeDivider(iso)
}

/**
 * 附件/图片 URL 兼容（问题记录：移动端上传返回相对路径、Web 端为绝对路径）。
 * 绝对地址（http/https/data/blob）原样返回；相对路径（/ 开头）拼 API base，
 * 使 Web 端也能正确请求鉴权下载代理（§18.5）。
 */
function normalizeContentUrl(url: string | undefined | null): string {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  if (url.startsWith('/')) return `${getApiBaseUrl()}${url}`
  return url
}

/** 从附件 URL（§18.5 content 地址）中提取 attachmentId，供 §18.3 download-url 使用 */
function extractAttachmentId(url: string | undefined | null): string | null {
  if (!url) return null
  const match = url.match(/\/attachments\/([^/?#]+)(?:\/content)?/)
  return match ? match[1] : null
}

/**
 * 按 mimeType 粗判附件类型图标（增量契约 §2.1 枚举的展示层近似：
 * 精确 previewType 由服务端判定，弹窗内调 preview-url 获得）。
 */
function fileTypeMetaFromMime(mimeType: string | undefined): { icon: React.ReactNode; label: string } {
  const mime = (mimeType ?? '').toLowerCase()
  if (mime === 'application/pdf') return { icon: <FilePdfOutlined style={{ color: '#ef4444' }} />, label: 'PDF·' }
  if (mime.startsWith('image/')) return { icon: <FileOutlined style={{ color: '#8b5cf6' }} />, label: '图片·' }
  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('javascript') ||
    mime.includes('yaml') ||
    mime.includes('shell')
  ) {
    return { icon: <CodeOutlined style={{ color: '#3b82f6' }} />, label: '代码·' }
  }
  return { icon: <FileOutlined style={{ color: '#64748b' }} />, label: '' }
}

/** 生成被引用消息的一行摘要（回复引用条展示用；DIFF/IMAGE/FILE 等无文本类型给占位文案） */
function quotePreview(message: Message): string {
  const content = message.content as Record<string, unknown> | null
  switch (message.type) {
    case 'CODE':
      return `[代码块] ${typeof content?.code === 'string' ? content.code.slice(0, 40) : ''}`
    case 'IMAGE':
      return '[图片]'
    case 'FILE':
      return `[文件] ${typeof content?.name === 'string' ? content.name : ''}`
    case 'DIFF':
      return `[Diff] ${typeof content?.title === 'string' ? content.title : '代码变更'}`
    case 'TASK_STATUS':
      return `[任务状态] ${typeof content?.message === 'string' ? content.message : (typeof content?.status === 'string' ? content.status : '')}`
    case 'QUOTE': {
      // 引用一条「引用消息」时，被引用内容应为该消息实际回复的正文（replyText），
      // 而不是其引用的上层内容——避免嵌套引用叠加成 [引用][引用]…
      const quoted = content as QuoteMessageContent | null
      // §7 冻结：replyText 回显在顶层；content.replyText 兼容旧数据
      const text = message.replyText ?? quoted?.replyText ?? quoted?.quotedText ?? ''
      return text || '[引用]'
    }
    default: {
      const text = typeof content?.text === 'string' ? content.text : ''
      return text || '[消息]'
    }
  }
}

/** @ 提及面板分组 */
function MentionGroup({
  label,
  members,
  onPick,
}: {
  label: string
  members: Array<{ id: string; displayName: string; type: MentionType; avatarUrl?: string | null }>
  onPick: (m: { id: string; displayName: string; type: MentionType }) => void
}) {
  const { token } = theme.useToken()
  return (
    <div style={{ marginBottom: 4 }}>
      <Text type="secondary" style={{ fontSize: 11, padding: '4px 8px', display: 'block' }}>
        {label}
      </Text>
      {members.map((m) => (
        <div
          key={m.id}
          onClick={() => onPick(m)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 8px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLDivElement).style.background = token.colorFillSecondary
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
          }}
        >
          {m.avatarUrl ? (
            <img
              src={m.avatarUrl}
              alt=""
              style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: m.type === 'AGENT' ? '#3b82f6' : '#8b5cf6',
                color: '#fff',
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {m.type === 'AGENT' ? '🤖' : (m.displayName.slice(0, 1) || '?')}
            </span>
          )}
          <Text style={{ fontSize: 13 }}>{m.displayName}</Text>
        </div>
      ))}
    </div>
  )
}

/** 单条消息气泡 —— 区分 USER / AGENT / SYSTEM，按类型渲染 IMAGE/FILE/QUOTE/DIFF/TASK_STATUS */
function MessageBubble({
  message,
  isSelf,
  selfDisplayName,
  projectId,
  onReply,
  onOpenFile,
  onImageLoad,
  taskStatusById,
}: {
  message: Message
  isSelf: boolean
  /** 自己的实时昵称（改昵称后即时更新；来自 ChatPanel 的 user.displayName） */
  selfDisplayName?: string
  projectId: string
  /** 点击「回复」时回调，用于设置回复引用（SYSTEM 消息不提供） */
  onReply?: (m: Message) => void
  /** 打开文件消息（FILE 类型走页内预览/下载，见 AttachmentPreviewModal） */
  onOpenFile?: (m: Message) => void
  /** 图片真正加载完成回调（透传给 AuthedImage，供 ChatPanel 保持贴底） */
  onImageLoad?: () => void
  taskStatusById: ReadonlyMap<string, string>
}) {
  const { token } = theme.useToken()

  // 临时防御（后端修复后可移除）：后端在「引用消息触发任务」链路可能错误插入一条
  // content 序列化的 TEXT 复制消息（形如 "@编排助手 {…quotedMessageId…}"），整条隐藏，
  // 避免在正常 QUOTE 消息旁再显示一串乱码。正常用户文本不会命中该特征。
  if (isMalformedQuoteCopy(message)) return null

  // SYSTEM 消息居中弱化展示
  if (message.senderType === 'SYSTEM') {
    const taskStatus = message.type === 'TASK_STATUS'
      ? taskStatusById.get((message.content as TaskStatusMessageContent).taskId)
      : undefined
    return (
      <div style={{ textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {renderContent(message, projectId, onOpenFile, onImageLoad, onReply, false, taskStatus)}
        </Text>
      </div>
    )
  }

  const alignSelf = isSelf ? 'flex-end' : 'flex-start'
  const bubbleBg = isSelf ? token.colorPrimary : token.colorFillSecondary
  const bubbleColor = isSelf ? '#fff' : token.colorText
  const bubbleBorder = isSelf ? 'none' : `1px solid ${token.colorBorder}`
  const isCode = message.type === 'CODE'
  // 图片消息：气泡不设 padding/背景，直接展示图片本体
  const isImage = message.type === 'IMAGE'
  const taskStatus = message.type === 'TASK_STATUS'
    ? taskStatusById.get((message.content as TaskStatusMessageContent).taskId)
    : undefined

  return (
    <div
      className="chat-message-bubble"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: alignSelf,
        // fit-content：气泡宽度 = 内容自然宽度（长文本时铺满外层可用宽度，短文本贴内容）
        // maxWidth 100%：受外层内层 div 的 78% 约束，每行可容纳更多字
        width: 'fit-content',
        maxWidth: '100%',
        alignSelf,
        minWidth: 0,
      }}
    >
      {/* sender 行：不撑满宽度，跟随气泡边缘对齐；nowrap 防止昵称/时间换行。
          对方（气泡靠左）：昵称 时间 回复；己方（气泡靠右）：回复 时间 昵称（昵称贴气泡）
          回复按钮始终渲染占位，用 CSS :hover + visibility 控制显隐，避免按钮出现/消失引发布局抖动 */}
      <div
        style={{
          marginBottom: 2,
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
      >
        {isSelf ? (
          <>
            {onReply && (
              <Button
                className="chat-message-bubble__reply"
                type="text"
                size="small"
                style={{ fontSize: 11, height: 'auto', padding: '0 4px', minWidth: 0 }}
                onClick={() => onReply(message)}
              >
                回复
              </Button>
            )}
            <Text type="secondary" style={{ fontSize: 11 }}>
              {formatClock(message.createdAt)}
            </Text>
            {/* 乐观发送中：显示转圈，后端确认后替换为真实消息 */}
            {message.pending ? <Spin size="small" /> : null}
            {/* 自己消息昵称：用实时 selfDisplayName（改昵称后即时更新），不用后端落库的旧 senderName */}
            <Text type="secondary">
              {message.senderType === 'AGENT' ? 'Agent' : (selfDisplayName ?? message.senderName ?? '我')}
            </Text>
          </>
        ) : (
          <>
            <Text type="secondary">
              {message.senderType === 'AGENT' ? '🤖 ' : ''}
              {message.senderName ?? (message.senderType === 'AGENT' ? 'Agent' : '成员')}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {formatClock(message.createdAt)}
            </Text>
            {onReply && (
              <Button
                className="chat-message-bubble__reply"
                type="text"
                size="small"
                style={{ fontSize: 11, height: 'auto', padding: '0 4px', minWidth: 0 }}
                onClick={() => onReply(message)}
              >
                回复
              </Button>
            )}
          </>
        )}
      </div>
      <div
        style={{
          padding: isImage ? 0 : '8px 12px',
          borderRadius: 10,
          background: isImage ? 'transparent' : isCode ? (isSelf ? token.colorPrimary : '#1e293b') : bubbleBg,
          color: isCode && !isSelf ? '#e6edf3' : bubbleColor,
          border: isImage ? 'none' : isCode ? 'none' : bubbleBorder,
          whiteSpace: isCode ? 'pre-wrap' : 'normal',
          // 普通文本：overflowWrap 只在内容溢出容器时才断行，wordBreak normal 不拆中文短词，
          // 保证「你好」「收到」等短文本保持一行；超长英文串溢出时可断开，不会撑破聊天区域。
          // CODE 消息保留断行能力（wordBreak break-word），超长代码行可断开。
          overflowWrap: 'break-word',
          wordBreak: isCode ? 'break-word' : 'normal',
          minWidth: 0,
          maxWidth: '100%',
          fontFamily: isCode ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
          fontSize: isCode ? 13 : undefined,
          overflow: 'hidden',
        }}
      >
        {renderContent(message, projectId, onOpenFile, onImageLoad, onReply, isSelf, taskStatus)}
      </div>
      {/* QUOTE 引用消息：被引用的原消息挂载在气泡下方（带竖线），类似微信「当前消息 + 引用原消息」 */}
      {message.type === 'QUOTE' ? (
        <QuoteAttachment message={message} />
      ) : null}
    </div>
  )
}

/**
 * QUOTE 消息 content 解析：后端可能回传对象，也可能是 JSON 字符串（历史/联调兼容），
 * 统一转成 QuoteMessageContent；解析失败返回 null。
 */
function parseQuoteContent(message: Message): QuoteMessageContent | null {
  const raw = message.content
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as QuoteMessageContent
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as QuoteMessageContent
  }
  return null
}

/**
 * 判定「后端错误插入的引用复制消息」：type=TEXT 且文本形如
 * "@某Agent {…含 quotedMessageId 的引用协议 JSON…}"（后端在引用消息触发任务时
 * 把存储后的 QUOTE content 序列化成文本插入，sender 伪装成原用户）。
 * 前端整条隐藏，避免与正常 QUOTE 消息重复显示乱码；后端修复后此特征自然消失。
 */
function isMalformedQuoteCopy(message: Message): boolean {
  if (message.type !== 'TEXT') return false
  const content = message.content as TextMessageContent | null
  const text = typeof content?.text === 'string' ? content.text : ''
  if (!text) return false
  return /^@\S+\s*\{[\s\S]*"quotedMessageId"[\s\S]*\}/.test(text)
}

/** 引用消息的「原消息」挂载条：气泡下方、左侧灰色竖线、灰色小字 */
function QuoteAttachment({ message }: { message: Message }) {
  const content = parseQuoteContent(message)
  if (!content?.quotedText) return null
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginTop: 4,
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      <div style={{ width: 3, borderRadius: 2, background: '#94a3b8', flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        {content.quotedSenderName ? (
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            {content.quotedSenderName}
          </Text>
        ) : null}
        <div style={{ fontSize: 12, color: '#94a3b8', overflowWrap: 'break-word' }}>{content.quotedText}</div>
      </div>
    </div>
  )
}

/** 按消息类型渲染 content */
function renderContent(
  message: Message,
  projectId: string,
  onOpenFile?: (m: Message) => void,
  onImageLoad?: () => void,
  onReply?: (m: Message) => void,
  isSelf = false,
  taskStatus?: string,
): React.ReactNode {
  switch (message.type) {
    case 'CODE': {
      const c = message.content as CodeMessageContent
      return c.code ?? ''
    }
    case 'IMAGE': {
      const c = message.content as ImageMessageContent
      // 增量契约 §7：content.previewUrl 若由后端回填（带短期 token），直接用；
      // 否则走 §18.5 content 代理（带 Bearer 拉取）。地址优先用 attachmentId 重建，
      // 与存储的 content.url 前缀无关——历史消息 url 可能是 /api/... 或 /projects/...，
      // 直接 normalizeContentUrl 会把已带 /api 的地址拼成 /api/api/... 双前缀 404。
      // 缺 attachmentId 的旧消息才回退 normalizeContentUrl(c.url)。
      const previewUrl = typeof c.previewUrl === 'string' && c.previewUrl ? resolvePreviewUrl(c.previewUrl) : null
      const contentUrl = c.attachmentId
        ? attachmentApi.contentUrl(projectId, c.attachmentId)
        : normalizeContentUrl(c.url)
      const image = (
        <AuthedImage
          src={previewUrl ?? contentUrl}
          width={c.width ?? 260}
          height={c.height}
          style={{ borderRadius: 10, display: 'block', maxWidth: '100%' }}
          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120'%3E%3Crect width='100%25' height='100%25' fill='%231c2128'/%3E%3C/svg%3E"
          onLoad={onImageLoad}
        />
      )
      // 图片查看走 antd <Image> 内置全屏预览（AuthedImage 默认开启），不再套自定义 AttachmentPreviewModal
      return image
    }
    case 'FILE': {
      const c = message.content as FileMessageContent
      // §7：previewable=true 时提示可内联预览（点击走 previewUrl 打开）
      const previewable = c.previewable === true || Boolean(c.previewUrl)
      // 按 mimeType 粗判文件类型显示图标（§2.1；弹窗内会再按 previewType 精确处理）
      const fileMeta = fileTypeMetaFromMime(c.mimeType)
      return (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onOpenFile?.(message)
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 24, display: 'inline-flex' }}>{fileMeta.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{c.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatFileSize(c.size)}
              {previewable ? ` · ${fileMeta.label}点击预览` : ''}
            </Text>
          </div>
        </a>
      )
    }
    case 'QUOTE': {
      // 气泡内只显示回复正文；被引用的原消息由 MessageBubble 挂载在气泡下方（带竖线）。
      // §7 冻结：replyText 回显在顶层；content.replyText 兼容旧数据
      const c = parseQuoteContent(message)
      return message.replyText || c?.replyText || ''
    }
    case 'DIFF': {
      // 群聊内 Diff 卡片：固定高度可展开的「文件树 + 行级 diff 视图」；
      // 「查看 Diff」跳转代码提交 diff 详情 /app/projects/:projectId/code/diff/:diffId
      return <ChatDiffCard message={message} projectId={projectId} onReply={onReply} />
    }
    case 'TASK_STATUS': {
      const c = message.content as TaskStatusMessageContent
      const steps = c.plan?.steps ?? []
      // 多仓库：currentRepositoryPaths 非空时只展示当前步骤实际涉及的仓库（按 workspacePath 匹配）
      const currentPaths = c.currentRepositoryPaths
      const repositoryMappings = normalizeTaskStatusRepositoryMappings(c.repositoryMappings).filter(
        (mapping) => currentPaths === undefined || currentPaths.includes(mapping.workspacePath),
      )
      const messageStatus = c.status?.toUpperCase()
      const queriedStatus = taskStatus?.toUpperCase()
      const hasRunningStep = steps.some((step) => step.status === 'RUNNING')
      // 消息和任务查询可能短暂不同步：步骤已开始执行时，避免旧的 PLANNING 覆盖真实运行态。
      // 同样地，任务状态卡本身已经携带了 WAITING_DIFF_CONFIRMATION /
      // WAITING_PREFLIGHT 等用户动作态；若任务列表仍缓存 RUNNING，不能让卡片
      // 把已经完成开发的任务继续显示成“执行中”。一旦查询返回更晚的非运行态，
      // 查询结果仍优先。
      const staleQueriedStatus = !queriedStatus
        || queriedStatus === 'PLANNING'
        || queriedStatus === 'PENDING'
        || queriedStatus === 'RUNNING'
        || queriedStatus === 'IN_PROGRESS'
      const messageHasTerminalOrWaitingStatus = Boolean(messageStatus && [
        'WAITING_DIFF_CONFIRMATION',
        'WAITING_PREFLIGHT',
        'DELIVERING',
        'DELIVERY_FAILED',
        'SUCCEEDED',
        'FAILED',
        'CANCELLED',
      ].includes(messageStatus))
      const displayStatus = messageHasTerminalOrWaitingStatus && staleQueriedStatus
        ? messageStatus
        : queriedStatus === 'PLANNING' && (messageStatus !== 'PLANNING' || hasRunningStep)
          ? (messageStatus && messageStatus !== 'PLANNING' ? messageStatus : 'RUNNING')
          : (queriedStatus ?? messageStatus ?? 'PLANNING')
      const statusKey = displayStatus.toUpperCase()
      const diffReady =
        statusKey === 'WAITING_DIFF_CONFIRMATION' ||
        statusKey === 'DELIVERING' ||
        statusKey === 'DELIVERY_FAILED' ||
        statusKey === 'SUCCEEDED'
      return (
        <div
          style={{
            padding: '10px 12px',
            border: '1px solid rgba(13, 155, 138, 0.35)',
            borderRadius: 8,
            background: 'rgba(13, 155, 138, 0.06)',
          }}
        >
          {/* 头部：运行状态 + 当前阶段 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {c.phase ? `${c.phase} · ` : ''}任务运行状态
            </div>
            <Tag color={taskStatusColor(displayStatus)} style={{ margin: 0 }}>
              {taskStatusLabel(displayStatus)}
            </Tag>
          </div>
          {c.message ? <Text style={{ display: 'block', marginTop: 2 }}>{c.message}</Text> : null}
          {c.plan?.summary ? (
            <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
              {c.plan.summary}
            </Text>
          ) : null}
          {c.deliveryMode ? (
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              {c.deliveryMode}
              {c.deliveryReason ? ` · ${c.deliveryReason}` : ''}
            </Text>
          ) : null}
          {repositoryMappings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>当前操作仓库：</Text>
              {repositoryMappings.map((mapping) => (
                <div
                  key={`${mapping.repositoryId}:${mapping.workspacePath}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                >
                  {/* 展示 GitHub 实际仓库名 fullName（回退短名 name / 工作区目录） */}
                  <Tag style={{ margin: 0, fontSize: 12 }}>
                    {mapping.fullName ?? mapping.name ?? mapping.workspacePath}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    工作区目录：{mapping.workspacePath}
                  </Text>
                </div>
              ))}
            </div>
          ) : null}

          {/* 执行计划步骤 */}
          {steps.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              {steps.map((step) => (
                <div key={step.stepId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0' }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: stepStatusColor(step.status),
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>
                      <Text strong>{step.sequence}.</Text> {step.title}
                      {step.role ? <Text type="secondary" style={{ fontSize: 11 }}> · {step.role}</Text> : null}
                    </div>
                    {step.message ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {step.message}
                      </Text>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Diff 栏：任务进入交付阶段后可查看 Diff */}
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px dashed rgba(13, 155, 138, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {diffReady ? '任务已产生代码变更' : '代码变更生成后在此查看'}
            </Text>
            {/* 右下角按钮：任务完成/交付阶段 → 查看交付详情（交付中心）；未完成 → 查看任务 */}
            {diffReady ? (
              <Link to={`${PATHS.projectDiffs(projectId)}?taskId=${encodeURIComponent(c.taskId)}`}>
                <Button size="small" type="link">
                  查看交付详情
                </Button>
              </Link>
            ) : (
              <Link to={PATHS.projectTaskDetail(projectId, c.taskId)}>
                <Button size="small" type="link">
                  查看任务
                </Button>
              </Link>
            )}
          </div>
        </div>
      )
    }
    default: {
      const c = message.content as TextMessageContent
      return renderTextWithAtMentions(c.text ?? '', isSelf)
    }
  }
}

/**
 * §39：只接受工作区一级相对目录与项目仓库绑定 ID。
 * 真实接口已经承诺按 workspacePath 排序；这里仍做非破坏性排序与去重，避免历史消息或异常数据使卡片重复、无序。
 */
function normalizeTaskStatusRepositoryMappings(
  mappings: TaskStatusMessageContent['repositoryMappings'],
): TaskStatusRepositoryMapping[] {
  if (!Array.isArray(mappings)) return []

  const uniqueMappings = new Map<string, TaskStatusRepositoryMapping>()
  for (const mapping of mappings) {
    if (!mapping || !mapping.workspacePath || !mapping.repositoryId) continue
    uniqueMappings.set(`${mapping.repositoryId}:${mapping.workspacePath}`, mapping)
  }
  return [...uniqueMappings.values()].sort((left, right) => left.workspacePath.localeCompare(right.workspacePath))
}

/**
 * TEXT/QUOTE 文本渲染：把形如 {@code @名字} 的 @ 提及高亮显示（编排助手回群的
 * 「@发起者 您创建的任务已开始」提示与用户手动 @ 均受益），其余文本原样输出。
 */
function renderTextWithAtMentions(text: string, isSelf: boolean): React.ReactNode {
  if (!text) return ''
  const parts = text.split(/(@[^\s@，。；：！？,.!?]+)/g)
  if (parts.length <= 1) return text
  return parts.map((part, index) =>
    part.startsWith('@') ? (
      <span
        key={index}
        style={{
          color: isSelf ? '#fef08a' : '#1677ff',
          background: isSelf ? 'rgba(255, 255, 255, 0.14)' : 'rgba(22, 119, 255, 0.1)',
          borderRadius: 3,
          fontWeight: 700,
          padding: '0 2px',
        }}
      >
        {part}
      </span>
    ) : (
      part
    ),
  )
}

/** 文件大小格式化（字节 → 可读） */
function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/** 任务状态 → 卡片 tag 颜色 */
function taskStatusColor(status: string): string {
  const s = status.toUpperCase()
  if (s === 'SUCCEEDED' || s === 'COMPLETED') return 'green'
  if (s === 'FAILED' || s === 'CANCELLED') return 'red'
  if (s === 'WAITING_DIFF_CONFIRMATION' || s === 'WAITING_PREFLIGHT') return 'gold'
  if (s === 'DELIVERY_FAILED') return 'red'
  if (s === 'RUNNING' || s === 'IN_PROGRESS') return 'blue'
  return 'default'
}

/** 执行计划步骤状态 → 圆点颜色 */
function stepStatusColor(status: string): string {
  const s = status.toUpperCase()
  if (s === 'SUCCEEDED') return '#16a34a'
  if (s === 'RUNNING') return '#2563eb'
  if (s === 'FAILED') return '#dc2626'
  return '#cbd5e1'
}

/** 任务状态 → 卡片 tag 中文标签（§5.4：终态用「已完成/失败」而非英文枚举） */
function taskStatusLabel(status: string): string {
  const s = status.toUpperCase()
  if (s === 'SUCCEEDED' || s === 'COMPLETED') return '已完成'
  if (s === 'FAILED') return '失败'
  if (s === 'CANCELLED' || s === 'CANCELLING') return '已取消'
  if (s === 'RUNNING' || s === 'IN_PROGRESS') return '执行中'
  if (s === 'WAITING_DIFF_CONFIRMATION') return '等待 Diff 确认'
  if (s === 'DELIVERING') return '交付中'
  if (s === 'DELIVERY_FAILED') return '交付失败'
  return s
}
