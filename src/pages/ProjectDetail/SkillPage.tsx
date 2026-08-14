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
} from 'antd'
import { PlusOutlined, TagsOutlined, UserOutlined } from '@ant-design/icons'
import { projectApi, skillApi } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import type { CreateSkillPayload, Skill, SkillStatus } from '@/types'

const { Text, Paragraph } = Typography

/** 状态筛选维度 */
type FilterKey = 'ALL' | SkillStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'DRAFT', label: '草稿' },
  { key: 'PENDING_REVIEW', label: '待审核' },
  { key: 'APPROVED', label: '已发布' },
  { key: 'REJECTED', label: '已拒绝' },
  { key: 'ARCHIVED', label: '已归档' },
]

const STATUS_META: Record<SkillStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: '草稿' },
  PENDING_REVIEW: { color: 'orange', label: '待审核' },
  APPROVED: { color: 'green', label: '已发布' },
  REJECTED: { color: 'red', label: '已拒绝' },
  ARCHIVED: { color: 'default', label: '已归档' },
}

const VISIBILITY_META: Record<Skill['visibility'], { color: string; label: string }> = {
  PRIVATE: { color: 'default', label: '私有' },
  PROJECT_SHARED: { color: 'blue', label: '项目共享' },
}

/**
 * 共享 Skill —— 对齐接口文档 v1.3.0 §8
 * 列表 / 状态筛选 / 详情 / 手动创建 / 提交审核 / 批准·拒绝 / 归档
 */
export function SkillPage() {
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
  const isAdmin = project?.role === 'PROJECT_ADMIN'

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills', projectId],
    queryFn: () => skillApi.list(projectId),
    enabled: !!projectId,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['skills', projectId] })

  const filtered = useMemo(() => {
    if (filter === 'ALL') return skills
    return skills.filter((s) => s.status === filter)
  }, [skills, filter])

  const detail = skills.find((s) => s.id === detailId) ?? null

  const actions = {
    submit: useMutation({
      mutationFn: (id: string) => skillApi.submitReview(projectId, id),
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: (id: string) => skillApi.approve(projectId, id),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: (id: string) => skillApi.reject(projectId, id, '审核未通过'),
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: (id: string) => skillApi.archive(projectId, id),
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
            <h1>共享 Skill</h1>
            <p>沉淀可复用能力片段（规范、提示词、操作指引），经审核后供项目 Agent 使用</p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建 Skill
          </Button>
        </div>
      </header>

      <div className="pd-section__body">
        <Segmented
          options={FILTERS.map((f) => ({ label: f.label, value: f.key }))}
          value={filter}
          onChange={(v) => setFilter(v as FilterKey)}
          style={{ marginBottom: 20 }}
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon="🛠️"
            title="暂无 Skill"
            description="新建一条草稿，提交审核后即可发布为项目共享能力"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((s) => (
              <SkillCard key={s.id} skill={s} onClick={() => setDetailId(s.id)} />
            ))}
          </div>
        )}
      </div>

      {/* 详情抽屉 */}
      <SkillDetail
        skill={detail}
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
      <CreateSkillModal
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
function SkillCard({ skill, onClick }: { skill: Skill; onClick: () => void }) {
  const meta = STATUS_META[skill.status]
  const vis = VISIBILITY_META[skill.visibility]
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
          {skill.name}
        </Text>
        <Space size={4}>
          <Tag color={vis.color} style={{ margin: 0 }}>
            {vis.label}
          </Tag>
          <Tag color={meta.color} style={{ margin: 0 }}>
            {meta.label}
          </Tag>
        </Space>
      </div>
      <Paragraph
        ellipsis={{ rows: 1 }}
        style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}
      >
        {skill.content}
      </Paragraph>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {skill.tags.map((t) => (
          <Tag key={t} icon={<TagsOutlined />} bordered={false} style={{ color: '#9aa3b5' }}>
            {t}
          </Tag>
        ))}
        <Space size={4} style={{ marginLeft: 'auto' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {skill.creator.displayName}
          </Text>
        </Space>
      </div>
    </div>
  )
}

/** 详情抽屉 */
function SkillDetail({
  skill,
  isAdmin,
  onClose,
  onEdit,
  onAction,
}: {
  skill: Skill | null
  isAdmin: boolean
  onClose: () => void
  onEdit: () => void
  onAction: (type: 'submit' | 'approve' | 'reject' | 'archive') => Promise<void>
}) {
  if (!skill) return <Drawer open={false} onClose={onClose} />
  const meta = STATUS_META[skill.status]
  const vis = VISIBILITY_META[skill.visibility]

  return (
    <Drawer
      title={skill.name}
      placement="right"
      size={420}
      open
      onClose={onClose}
      extra={<Tag color={meta.color}>{meta.label}</Tag>}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Tag color={vis.color}>{vis.label}</Tag>
          {skill.tags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {skill.tags.map((t) => (
                <Tag key={t} icon={<TagsOutlined />} style={{ marginBottom: 4 }}>
                  {t}
                </Tag>
              ))}
            </div>
          )}
        </div>

        <Paragraph style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap', marginBottom: 0 }}>
          {skill.content}
        </Paragraph>

        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
          <div>
            <UserOutlined /> 创建者：{skill.creator.displayName}
          </div>
          {skill.reviewer && (
            <div>
              <UserOutlined /> 审核者：{skill.reviewer.displayName}
              {skill.reviewedAt ? ` · ${formatDate(skill.reviewedAt)}` : ''}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          {skill.status === 'DRAFT' && (
            <>
              <Button type="primary" onClick={() => onAction('submit')}>
                提交审核
              </Button>
              <Button onClick={onEdit}>编辑</Button>
            </>
          )}
          {skill.status === 'REJECTED' && (
            <Button type="primary" onClick={onEdit}>
              编辑后重新提交
            </Button>
          )}
          {skill.status === 'PENDING_REVIEW' && isAdmin && (
            <>
              <Button type="primary" onClick={() => onAction('approve')}>
                批准
              </Button>
              <Button danger onClick={() => onAction('reject')}>
                拒绝
              </Button>
            </>
          )}
          {skill.status === 'APPROVED' && isAdmin && (
            <Button onClick={() => onAction('archive')}>归档</Button>
          )}
          {skill.status === 'PENDING_REVIEW' && !isAdmin && (
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
function CreateSkillModal({
  projectId,
  open,
  editTarget,
  onClose,
  onCreated,
}: {
  projectId: string
  open: boolean
  editTarget: Skill | null
  onClose: () => void
  onCreated: () => void
}) {
  const [form] = Form.useForm<CreateSkillPayload>()

  const create = useMutation({
    mutationFn: (payload: CreateSkillPayload) => skillApi.create(projectId, payload),
    onSuccess: () => {
      form.resetFields()
      onCreated()
    },
  })

  return (
    <Modal
      title={editTarget ? '编辑 Skill' : '新建 Skill'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editTarget ? '保存' : '创建'}
      confirmLoading={create.isPending}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(v) => create.mutate(v)}
        initialValues={
          editTarget
            ? {
                name: editTarget.name,
                content: editTarget.content,
                tags: editTarget.tags,
                visibility: editTarget.visibility,
              }
            : { visibility: 'PRIVATE' }
        }
      >
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="例如：Java API 规范" maxLength={50} />
        </Form.Item>
        <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
          <Input.TextArea
            placeholder="规范、提示词、操作指引或工具调用约束"
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </Form.Item>
        <Form.Item name="visibility" label="可见性">
          <Select
            options={[
              { value: 'PRIVATE', label: '私有（仅自己可用）' },
              { value: 'PROJECT_SHARED', label: '项目共享' },
            ]}
          />
        </Form.Item>
        <Form.Item name="tags" label="标签（逗号分隔）">
          <Select
            mode="tags"
            placeholder="输入后回车，如 java / backend"
            tokenSeparators={[',']}
            open={false}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
