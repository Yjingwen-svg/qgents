import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
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
  theme,
} from 'antd'
import {
  PlusOutlined,
  TagsOutlined,
  UserOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { groupApi, memoryApi, projectApi } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import type { CreateMemoryPayload, Memory, MemoryStatus } from '@/types'

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
 * 列表 / 状态筛选 / 详情 / 手动创建 / 从群消息生成草稿 / 提交审核 / 批准·拒绝 / 归档
 */
export function MemoryPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterKey>('ALL')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  // 当前用户项目角色（判断是否可批准/拒绝/归档）
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: !!projectId,
  })
  const isAdmin = project?.myRole === 'PROJECT_ADMIN'

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

  const actions = {
    submit: useMutation({
      mutationFn: (id: string) => memoryApi.submitReview(projectId, id),
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: (id: string) => memoryApi.approve(projectId, id),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: (id: string) => memoryApi.reject(projectId, id, '审核未通过'),
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: (id: string) => memoryApi.archive(projectId, id),
      onSuccess: invalidate,
    }),
  }

  if (isLoading) {
    return (
      <div className="pd-section">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <Spin size="large" />
        </div>
      </div>
    )
  }

  return (
    <div className="pd-section">
      <header className="pd-section__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>共享 Memory</h1>
            <p>沉淀团队经验与约定，经审核后供项目复用（非原始聊天记录）</p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建 Memory
          </Button>
        </div>
      </header>

      <div className="pd-section__body">
        <Segmented
          options={FILTERS.map((f) => ({ label: `${f.label}`, value: f.key }))}
          value={filter}
          onChange={(v) => setFilter(v as FilterKey)}
          style={{ marginBottom: 20 }}
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon="🧠"
            title="暂无 Memory"
            description="新建一条草稿，提交审核后即可沉淀为项目共享知识"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                onClick={() => setDetailId(m.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 详情抽屉 */}
      <MemoryDetail
        memory={detail}
        isAdmin={isAdmin}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          setDetailId(null)
          setCreateOpen(true)
        }}
        onAction={async (type) => {
          if (!detail) return
          await actions[type].mutateAsync(detail.id)
        }}
      />

      {/* 新建 / 编辑弹窗 */}
      <CreateMemoryModal
        projectId={projectId}
        open={createOpen}
        editTarget={detail}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          invalidate()
          setCreateOpen(false)
        }}
      />
    </div>
  )
}

/** 列表卡片 */
function MemoryCard({ memory, onClick }: { memory: Memory; onClick: () => void }) {
  const { token } = theme.useToken()
  const meta = STATUS_META[memory.status]
  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(13,155,138,0.5)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text strong style={{ fontSize: 15, color: '#e2e8f0' }}>
          {memory.title}
        </Text>
        <Tag color={meta.color} style={{ margin: 0 }}>
          {meta.label}
        </Tag>
      </div>
      <Paragraph
        ellipsis={{ rows: 1 }}
        style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}
      >
        {memory.content}
      </Paragraph>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Tag bordered={false} style={{ color: token.colorTextSecondary }}>
          {memory.category}
        </Tag>
        {memory.tags.map((t) => (
          <Tag key={t} icon={<TagsOutlined />} bordered={false} style={{ color: '#9aa3b5' }}>
            {t}
          </Tag>
        ))}
        <Space size={4} style={{ marginLeft: 'auto' }}>
          {memory.source === 'MESSAGE' && <MessageOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {memory.creator.displayName}
          </Text>
        </Space>
      </div>
    </div>
  )
}

/** 详情抽屉 */
function MemoryDetail({
  memory,
  isAdmin,
  onClose,
  onEdit,
  onAction,
}: {
  memory: Memory | null
  isAdmin: boolean
  onClose: () => void
  onEdit: () => void
  onAction: (type: 'submit' | 'approve' | 'reject' | 'archive') => Promise<void>
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
          {memory.tags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {memory.tags.map((t) => (
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
            <UserOutlined /> 创建者：{memory.creator.displayName}
          </div>
          {memory.reviewer && (
            <div>
              <UserOutlined /> 审核者：{memory.reviewer.displayName}
              {memory.reviewedAt ? ` · ${formatDate(memory.reviewedAt)}` : ''}
            </div>
          )}
          {memory.source === 'MESSAGE' && memory.sources.length > 0 && (
            <div>
              <MessageOutlined /> 来源：{memory.sources.length} 条群消息
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          {memory.status === 'DRAFT' && (
            <>
              <Button type="primary" onClick={() => onAction('submit')}>
                提交审核
              </Button>
              <Button onClick={onEdit}>编辑</Button>
            </>
          )}
          {memory.status === 'REJECTED' && (
            <Button type="primary" onClick={onEdit}>
              编辑后重新提交
            </Button>
          )}
          {memory.status === 'PENDING_REVIEW' && isAdmin && (
            <>
              <Button type="primary" onClick={() => onAction('approve')}>
                批准
              </Button>
              <Button danger onClick={() => onAction('reject')}>
                拒绝
              </Button>
            </>
          )}
          {memory.status === 'APPROVED' && isAdmin && (
            <Button onClick={() => onAction('archive')}>归档</Button>
          )}
          {memory.status === 'PENDING_REVIEW' && !isAdmin && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              等待 Project Admin 审核
            </Text>
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
  const [genForm] = Form.useForm<{ groupId?: string; instruction?: string }>()

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: !!projectId,
  })

  const create = useMutation({
    mutationFn: (payload: CreateMemoryPayload) => memoryApi.create(projectId, payload),
    onSuccess: () => {
      form.resetFields()
      onCreated()
    },
  })
  const generate = useMutation({
    mutationFn: (v: { groupId?: string; instruction?: string }) =>
      memoryApi.generateDraft(projectId, {
        sourceMessages: v.groupId
          ? [{ groupId: v.groupId, messageId: 'latest' }]
          : [],
        instruction: v.instruction,
      }),
    onSuccess: () => {
      genForm.resetFields()
      onCreated()
    },
  })

  return (
    <Modal
      title={editTarget ? '编辑 Memory' : '新建 Memory'}
      open={open}
      onCancel={onClose}
      onOk={() => (mode === 'manual' ? form.submit() : genForm.submit())}
      okText={editTarget ? '保存' : '创建'}
      confirmLoading={create.isPending || generate.isPending}
      destroyOnClose
    >
      <Segmented
        options={[
          { label: '手动创建', value: 'manual' },
          { label: '从群消息生成', value: 'generate' },
        ]}
        value={mode}
        onChange={(v) => setMode(v as 'manual' | 'generate')}
        style={{ marginBottom: 16 }}
      />

      {mode === 'manual' ? (
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => create.mutate(v)}
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
