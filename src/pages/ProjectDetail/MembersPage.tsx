import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { projectApi, teamApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import type { ProjectMember } from '@/types'
import type { TableProps } from 'antd'

const { Title, Text } = Typography

/**
 * 项目成员页 —— 对齐接口文档 §5.2「项目与项目成员」。
 * 列表展示项目成员与角色；Project Admin 可添加（从团队选）与移除成员；不能移除自己。
 */
export function MembersPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // 当前项目信息（判断是否 Project Admin）
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: !!projectId,
  })
  const isAdmin = project?.role === 'PROJECT_ADMIN'

  // 项目成员
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectApi.listMembers(projectId),
    enabled: !!projectId,
  })

  // 团队成员（作为「添加成员」候选，做差集）
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teams', project?.teamId, 'members'],
    queryFn: () => teamApi.listMembers(project?.teamId ?? ''),
    enabled: !!project?.teamId,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(projectId, userId),
    onSuccess: () => {
      message.success('成员已移除')
      invalidate()
    },
    onError: (err) => message.error(err instanceof Error ? err.message : '移除失败'),
  })

  const addMutation = useMutation({
    mutationFn: (userIds: string[]) =>
      Promise.all(userIds.map((id) => projectApi.addMember(projectId, id))),
    onSuccess: () => {
      message.success('成员已加入项目')
      setAddOpen(false)
      setSelectedIds([])
      invalidate()
    },
    onError: (err) => message.error(err instanceof Error ? err.message : '添加失败'),
  })

  // 项目成员接口可能不返回 displayName，用团队成员信息补全（项目成员 ⊆ 团队成员）
  const teamMemberById = new Map(teamMembers.map((tm) => [tm.userId, tm]))
  const resolveDisplayName = (m: ProjectMember) =>
    m.displayName || teamMemberById.get(m.userId)?.displayName || m.userId
  const resolveEmail = (m: ProjectMember) =>
    m.email || teamMemberById.get(m.userId)?.email || '—'

  function confirmRemove(member: ProjectMember) {
    Modal.confirm({
      title: '移除成员',
      content: `确定要将「${resolveDisplayName(member)}」移出项目吗？`,
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => removeMutation.mutate(member.userId),
    })
  }

  // 添加成员候选 = 团队成员 − 已在项目里的成员
  const candidateMembers = teamMembers.filter(
    (tm) => !members.some((pm) => pm.userId === tm.userId),
  )

  const columns: TableProps<ProjectMember>['columns'] = [
    {
      title: '成员',
      key: 'member',
      render: (_, m) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserOutlined style={{ color: '#8b5cf6' }} />
          <div>
            <div>{resolveDisplayName(m)}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {resolveEmail(m)}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: ProjectMember['role']) => (
        <Tag color={role === 'PROJECT_ADMIN' ? 'gold' : 'default'}>
          {role === 'PROJECT_ADMIN' ? 'Admin' : 'Member'}
        </Tag>
      ),
    },
    ...(isAdmin
      ? [
          {
            title: '操作',
            key: 'action',
            width: 120,
            render: (_: unknown, m: ProjectMember) => {
              const isSelf = m.userId === user?.id
              // 不能移除自己（Admin 也不能把自己移出项目）
              if (isSelf) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
              return (
                <Button
                  size="small"
                  danger
                  type="link"
                  loading={removeMutation.isPending}
                  onClick={() => confirmRemove(m)}
                >
                  移除
                </Button>
              )
            },
          },
        ]
      : []),
  ]

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', background: '#fff', minHeight: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: '#10234d' }}>
            项目成员
          </Title>
          <Text style={{ color: '#60759f' }}>管理项目成员与角色</Text>
        </div>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedIds([])
              setAddOpen(true)
            }}
          >
            添加成员
          </Button>
        )}
      </div>

      <Table
        rowKey="userId"
        columns={columns}
        dataSource={members}
        pagination={false}
      />

      {/* 添加成员弹窗：从团队现有成员里选（已在项目里的不显示） */}
      <Modal
        title="添加项目成员"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => addMutation.mutate(selectedIds)}
        okText="添加"
        cancelText="取消"
        confirmLoading={addMutation.isPending}
        okButtonProps={{ disabled: selectedIds.length === 0 }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            从团队现有成员中选择，选中即加入项目（无需对方确认）
          </Text>
        </div>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择团队成员"
          value={selectedIds}
          onChange={setSelectedIds}
          options={candidateMembers.map((m) => ({
            value: m.userId,
            label: m.displayName || m.userId,
          }))}
          optionFilterProp="label"
        />
      </Modal>
    </div>
  )
}
