import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  TagsOutlined,
  UserOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { groupApi, memoryApi } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import type { CreateMemoryPayload, Memory, MemoryStatus, Message } from '@/types'
import './MemoryPage.css'

const { Text, Paragraph } = Typography

/** 状态筛选维度 */
type FilterKey = 'ALL' | MemoryStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'DRAFT', label: '草稿' },
  { key: 'PENDING_REVIEW', label: '待审核' },
  { key: 'APPROVED', label: '已发布' },
  { key: 'REJECTED', label: '已拒绝' },
  { key: 'ARCHIVED', label: '已归档' },
]

const STATUS_META: Record<MemoryStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: '草稿' },
  PENDING_REVIEW: { color: 'orange', label: '待审核' },
  APPROVED: { color: 'green', label: '已发布' },
  REJECTED: { color: 'red', label: '已拒绝' },
  ARCHIVED: { color: 'default', label: '已归档' },
}

/**
 * 共享 Memory —— 对齐接口文档 v1.1.8 §9（A 负责）
 * 列表 / 状态筛选 / 详情 / 手动创建 / 从群消息生成草稿 / 归档
 * 审核功能（提交审核 / 批准·拒绝）统一在交付中心处理，本页不提供
 */
export function MemoryPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterKey>('ALL')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ['memories', projectId],
    queryFn: () => memoryApi.list(projectId),
    enabled: !!projectId,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['memories', projectId] })

  const filtered = useMemo(() => {
    if (filter === 'ALL') return memories
    return memories.filter((m) => m.status === filter)
  }, [memories, filter])

  const detail = memories.find((m) => m.id === detailId) ?? null
  const editTarget = memories.find((m) => m.id === editId) ?? null

  const archive = useMutation({
    mutationFn: (id: string) => memoryApi.archive(projectId, id),
    onSuccess: invalidate,
  })

  if (isLoading) {
    return (
      <div className="memory-page">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <Spin size="large" />
        </div>
      </div>
    )
  }

  return (
    <div className="memory-page">
      <header className="memory-page__header">
        <h1 className="memory-page__title">共享 Memory</h1>
        <p className="memory-page__desc">沉淀团队经验与约定，审核在交付中心统一处理（非原始聊天记录）</p>
      </header>

      <div className="memory-page__toolbar">
        <Segmented
          options={FILTERS.map((f) => ({ label: `${f.label}`, value: f.key }))}
          value={filter}
          onChange={(v) => setFilter(v as FilterKey)}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新建 Memory
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🧠"
          title="暂无共享 Memory"
          description="新建一条草稿，在交付中心提交审核后即可沉淀为项目共享知识"
        />
      ) : (
        <div className="memory-page__list">
          {filtered.map((m, i) => (
            <MemoryCard
              key={m.id}
              memory={m}
              index={i + 1}
              onClick={() => setDetailId(m.id)}
            />
          ))}
        </div>
      )}

      {/* 详情抽屉 */}
      <MemoryDetail
        memory={detail}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          setEditId(detail?.id ?? null)
          setDetailId(null)
          setCreateOpen(true)
        }}
        onArchive={async () => {
          if (!detail) return
          await archive.mutateAsync(detail.id)
        }}
      />

      {/* 新建 / 编辑弹窗 */}
      <CreateMemoryModal
        projectId={projectId}
        open={createOpen}
        editTarget={editTarget}
        onClose={() => {
          setCreateOpen(false)
          setEditId(null)
        }}
        onCreated={() => {
          invalidate()
          setCreateOpen(false)
          setEditId(null)
        }}
      />
    </div>
  )
}

/** 列表卡片 */
function MemoryCard({ memory, index, onClick }: { memory: Memory; index: number; onClick: () => void }) {
  const meta = STATUS_META[memory.status]
  return (
    <Card className="memory-card" onClick={onClick}>
      <div className="memory-card__main">
        <div className="memory-card__left">
          <span className="memory-card__index">{String(index).padStart(2, '0')}</span>
          <div className="memory-card__name-wrap">
            <Text className="memory-card__name">{memory.title}</Text>
            <Paragraph ellipsis={{ rows: 1 }} className="memory-card__content">
              {memory.content}
            </Paragraph>
          </div>
        </div>
        <div className="memory-card__right">
          <Tag color={meta.color} style={{ margin: 0 }}>
            {meta.label}
          </Tag>
          <Text className="memory-card__creator">
            {memory.creator?.displayName ?? '未知'}
          </Text>
        </div>
      </div>
      <div className="memory-card__tags">
        <Tag bordered={false} className="memory-card__category">
          {memory.category}
        </Tag>
        {(memory.tags ?? []).map((t) => (
          <Tag key={t} icon={<TagsOutlined />} bordered={false}>
            {t}
          </Tag>
        ))}
        {memory.source === 'MESSAGE' && (
          <span className="memory-card__source">
            <MessageOutlined /> 来自群消息
          </span>
        )}
      </div>
    </Card>
  )
}

/** 详情抽屉 */
function MemoryDetail({
  memory,
  onClose,
  onEdit,
  onArchive,
}: {
  memory: Memory | null
  onClose: () => void
  onEdit: () => void
  onArchive: () => Promise<void>
}) {
  if (!memory) return <Drawer open={false} onClose={onClose} />
  const meta = STATUS_META[memory.status]

  return (
    <Drawer
      title={memory.title}
      placement="right"
      size={420}
      open
      onClose={onClose}
      extra={<Tag color={meta.color}>{meta.label}</Tag>}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            分类：{memory.category}
          </Text>
          {(memory.tags ?? []).length > 0 && (
            <div style={{ marginTop: 8 }}>
              {(memory.tags ?? []).map((t) => (
                <Tag key={t} icon={<TagsOutlined />} style={{ marginBottom: 4 }}>
                  {t}
                </Tag>
              ))}
            </div>
          )}
        </div>

        <Paragraph style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap', marginBottom: 0 }}>
          {memory.content}
        </Paragraph>

        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
          <div>
            <UserOutlined /> 创建者：{memory.creator?.displayName ?? '未知'}
          </div>
          {memory.reviewer && (
            <div>
              <UserOutlined /> 审核者：{memory.reviewer.displayName}
              {memory.reviewedAt ? ` · ${formatDate(memory.reviewedAt)}` : ''}
            </div>
          )}
          {memory.source === 'MESSAGE' && (memory.sources ?? []).length > 0 && (
            <div>
              <MessageOutlined /> 来源：{(memory.sources ?? []).length} 条群消息
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          {(memory.status === 'DRAFT' || memory.status === 'REJECTED') && (
            <Button type="primary" onClick={onEdit}>编辑</Button>
          )}
          {memory.status === 'APPROVED' && (
            <Button onClick={onArchive}>归档</Button>
          )}
        </div>
      </Space>
    </Drawer>
  )
}

/** 新建 / 编辑弹窗 */
function CreateMemoryModal({
  projectId,
  open,
  editTarget,
  onClose,
  onCreated,
}: {
  projectId: string
  open: boolean
  editTarget: Memory | null
  onClose: () => void
  onCreated: () => void
}) {
  const [form] = Form.useForm<CreateMemoryPayload>()
  const [mode, setMode] = useState<'manual' | 'generate'>('manual')
  const [genForm] = Form.useForm<{ groupId?: string; messageIds?: string[]; instruction?: string }>()
  // 当前选中的群，用于拉取该群消息列表供勾选
  const [genGroupId, setGenGroupId] = useState<string | undefined>()

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: !!projectId,
  })

  // 选中群后拉取该群消息，供勾选具体消息（对齐接口文档 §9 sourceMessages，精确到 messageId）
  // 游标分页：下拉滚动到底部自动加载下一页
  const {
    data: messagePages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['groups', projectId, genGroupId, 'messages'],
    queryFn: ({ pageParam }) => groupApi.listMessages(projectId, genGroupId ?? '', pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.page.hasMore ? (lastPage.page.nextCursor ?? undefined) : undefined,
    enabled: !!genGroupId && mode === 'generate',
  })
  const groupMessages = useMemo(
    () => messagePages?.pages.flatMap((p) => p.data) ?? [],
    [messagePages],
  )

  const save = useMutation({
    mutationFn: (payload: CreateMemoryPayload) =>
      editTarget
        ? memoryApi.patch(projectId, editTarget.id, payload)
        : memoryApi.create(projectId, payload),
    onSuccess: () => {
      form.resetFields()
      onCreated()
    },
  })
  const generate = useMutation({
    mutationFn: (v: { groupId?: string; messageIds?: string[]; instruction?: string }) =>
      memoryApi.generateDraft(projectId, {
        // 精确到 messageId 数组，不再用 'latest' 兜底
        sourceMessages: (v.messageIds ?? []).map((messageId) => ({
          groupId: v.groupId ?? '',
          messageId,
        })),
        instruction: v.instruction,
      }),
    onSuccess: () => {
      genForm.resetFields()
      setGenGroupId(undefined)
      onCreated()
    },
  })

  return (
    <Modal
      title={editTarget ? '编辑 Memory' : '新建 Memory'}
      open={open}
      onCancel={onClose}
      onOk={() => (editTarget || mode === 'manual' ? form.submit() : genForm.submit())}
      okText={editTarget ? '保存' : '创建'}
      confirmLoading={save.isPending || generate.isPending}
      destroyOnClose
    >
      {!editTarget && (
        <Segmented
          options={[
            { label: '手动创建', value: 'manual' },
            { label: '从群消息生成', value: 'generate' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as 'manual' | 'generate')}
          style={{ marginBottom: 16 }}
        />
      )}

      {editTarget || mode === 'manual' ? (
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => save.mutate(v)}
          initialValues={
            editTarget
              ? {
                  title: editTarget.title,
                  content: editTarget.content,
                  category: editTarget.category,
                  tags: editTarget.tags,
                }
              : { category: 'ENGINEERING_DECISION' }
          }
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例如：密码存储约定" maxLength={50} />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea
              placeholder="沉淀为可复用的项目知识或约定"
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select
              options={[
                { value: 'ENGINEERING_DECISION', label: '工程决策' },
                { value: 'PROCESS', label: '流程约定' },
                { value: 'GENERAL', label: '通用' },
              ]}
            />
          </Form.Item>
          <Form.Item name="tags" label="标签（逗号分隔）">
            <Select
              mode="tags"
              placeholder="输入后回车，如 auth / security"
              tokenSeparators={[',']}
              open={false}
            />
          </Form.Item>
        </Form>
      ) : (
        <Form form={genForm} layout="vertical" onFinish={(v) => generate.mutate(v)}>
          <Form.Item name="groupId" label="来源群聊">
            <Select
              placeholder="选择要沉淀的需求群"
              options={groups
                .filter((g) => g.type === 'REQUIREMENT')
                .map((g) => ({ value: g.id, label: g.title }))}
              onChange={(v) => {
                setGenGroupId(v)
                genForm.setFieldValue('messageIds', [])
              }}
            />
          </Form.Item>
          <Form.Item
            name="messageIds"
            label="选择消息"
            rules={[{ required: true, message: '请至少选择一条消息' }]}
          >
            <Select
              mode="multiple"
              placeholder={genGroupId ? '勾选要沉淀的消息' : '先选择来源群聊'}
              disabled={!genGroupId}
              options={groupMessages.map((m) => ({
                value: m.id,
                label: formatMessagePreview(m),
              }))}
              optionFilterProp="label"
              onPopupScroll={(e) => {
                const el = e.target as HTMLElement
                if (
                  el.scrollTop + el.clientHeight >= el.scrollHeight - 12 &&
                  hasNextPage &&
                  !isFetchingNextPage
                ) {
                  fetchNextPage()
                }
              }}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  {hasNextPage && (
                    <div
                      style={{
                        padding: '6px 12px',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: 12,
                      }}
                    >
                      {isFetchingNextPage ? '加载中…' : '滚动加载更多'}
                    </div>
                  )}
                </>
              )}
            />
          </Form.Item>
          <Form.Item name="instruction" label="沉淀说明（可选）">
            <Input placeholder="例如：沉淀为项目认证安全约定" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 把消息转成下拉选项里的可读摘要（带发送者 + 时间，各类型可辨认） */
function formatMessagePreview(message: Message): string {
  const time = formatTime(message.createdAt)
  const sender =
    message.senderType === 'SYSTEM'
      ? '系统'
      : (message.senderName ?? (message.senderType === 'AGENT' ? 'Agent' : '成员'))
  return `${time} ${sender}｜${messageBody(message)}`
}

/** 各类型消息的可读正文 */
function messageBody(message: Message): string {
  const c = message.content as Record<string, unknown>
  switch (message.type) {
    case 'TEXT':
    case 'SYSTEM':
      return typeof c.text === 'string' ? c.text : ''
    case 'CODE':
      return `[代码] ${typeof c.code === 'string' ? c.code.slice(0, 40) : ''}`
    case 'IMAGE':
      return '[图片]'
    case 'FILE':
      return `[文件] ${typeof c.name === 'string' ? c.name : ''}`
    case 'DIFF':
      return `[交付] ${typeof c.title === 'string' && c.title ? c.title : ''}`
    case 'TASK_STATUS':
      return `[任务] ${
        typeof c.message === 'string' && c.message
          ? c.message
          : typeof c.status === 'string'
            ? c.status
            : ''
      }`
    case 'QUOTE':
      return `[引用] ${typeof c.quotedText === 'string' ? c.quotedText : ''}`
    default:
      return `[${message.type}]`
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
