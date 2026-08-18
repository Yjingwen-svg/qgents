import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Avatar, Button, Empty, List, Modal, Popconfirm, Select, Space, Typography } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { groupApi, projectApi, teamApi } from '@/api'
import { formatApiError } from '@/utils/formatApiError'
import { useAuth } from '@/context/AuthContext'
import type { Group } from '@/types'

const { Text } = Typography

interface Props {
  projectId: string
  group: Group | null
}

/**
 * 群聊设置栏内嵌的「成员」区（创建者或 Project Admin 可管理）：
 * - 点开栏直接显示成员列表（头像 + 昵称 + 邮箱，自己带「（我）」标记）
 * - 「成员管理」开关：开启后每个 USER 成员行追加「移出群聊」，「取消」退出管理态
 * - 「邀请成员」：从项目成员中选择未入群的（真实后端项目成员接口可能缺 displayName，用团队成员接口补全）
 * 接口：GET/POST .../members、DELETE .../members/{userId}（后端补充文档见根目录接口补充）。
 */
export function GroupMemberSettings({ projectId, group }: Props) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [manageMode, setManageMode] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteIds, setInviteIds] = useState<string[]>([])

  const groupId = group?.id ?? ''

  const { data: members = [] } = useQuery({
    queryKey: ['groups', projectId, groupId, 'members'],
    queryFn: () => groupApi.listMembers(projectId, groupId),
    enabled: !!groupId,
  })
  // 邀请候选 = 项目成员（未入群的）；项目成员接口可能不返回 displayName，用团队成员接口补全
  const { data: projectMembers = [] } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectApi.listMembers(projectId),
    enabled: !!projectId,
  })
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: !!projectId,
  })
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teams', project?.teamId, 'members'],
    queryFn: () => teamApi.listMembers(project?.teamId ?? ''),
    enabled: !!project?.teamId,
  })
  const teamMemberNameById = new Map(teamMembers.map((tm) => [tm.userId, tm.displayName]))
  const resolveProjectMemberName = (userId: string): string =>
    projectMembers.find((m) => m.userId === userId)?.displayName ||
    teamMemberNameById.get(userId) ||
    userId

  const canManage =
    group?.type === 'REQUIREMENT' && (group.createdBy === user?.id || project?.role === 'PROJECT_ADMIN')

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['groups', projectId, groupId, 'members'] })
    // memberCount 变化 → 群列表/侧栏校准
    void queryClient.invalidateQueries({ queryKey: ['groups', projectId] })
    void queryClient.invalidateQueries({ queryKey: ['chat', 'main-groups'] })
  }

  const addMember = useMutation({
    mutationFn: (userId: string) => groupApi.addMember(projectId, groupId, userId),
    // 错误不在 mutation 层 toast：confirmInvite 串行邀请时统一汇总汇报
    onSuccess: invalidate,
  })
  const removeMember = useMutation({
    mutationFn: (userId: string) => groupApi.removeMember(projectId, groupId, userId),
    onSuccess: invalidate,
    onError: (error) => message.error(formatApiError(error)),
  })

  const memberUserIds = new Set(members.filter((m) => m.memberType === 'USER').map((m) => m.id))
  const inviteCandidates = projectMembers.filter((m) => !memberUserIds.has(m.userId))

  const [inviting, setInviting] = useState(false)

  /** 串行逐人邀请：避免并发写同一群成员导致后端 500；失败逐个汇总，不静默 */
  async function confirmInvite(): Promise<void> {
    const ids = [...inviteIds]
    if (ids.length === 0) return
    setInviting(true)
    let okCount = 0
    const failed: string[] = []
    for (const userId of ids) {
      try {
        await addMember.mutateAsync(userId)
        okCount += 1
      } catch {
        failed.push(resolveProjectMemberName(userId))
      }
    }
    setInviting(false)
    setInviteIds([])
    setInviteOpen(false)
    if (failed.length === 0) {
      message.success(`已邀请 ${okCount} 位成员`)
    } else {
      message.warning(`已邀请 ${okCount} 位；${failed.join('、')} 邀请失败，请稍后重试`)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>成员（{members.length}）</Text>
        {canManage && (
          <Space size={4}>
            <Button
              size="small"
              icon={<PlusOutlined />}
              disabled={inviteCandidates.length === 0}
              onClick={() => setInviteOpen(true)}
            >
              邀请成员
            </Button>
            {manageMode ? (
              <Button size="small" onClick={() => setManageMode(false)}>
                取消
              </Button>
            ) : (
              <Button size="small" onClick={() => setManageMode(true)}>
                成员管理
              </Button>
            )}
          </Space>
        )}
      </div>

      <List
        dataSource={members}
        locale={{ emptyText: <Empty description="暂无成员" /> }}
        renderItem={(member) => (
          <List.Item
            actions={
              manageMode && member.memberType === 'USER' && member.id !== user?.id
                ? [
                    <Popconfirm
                      key="remove"
                      title={`确认将 ${member.displayName} 移出群聊？`}
                      okText="移出"
                      cancelText="取消"
                      onConfirm={() => removeMember.mutate(member.id)}
                    >
                      <Button size="small" type="text" danger loading={removeMember.isPending}>
                        移出群聊
                      </Button>
                    </Popconfirm>,
                  ]
                : undefined
            }
          >
            <List.Item.Meta
              avatar={
                <Avatar
                  size={32}
                  src={member.avatarUrl}
                  style={{ background: '#3b82f6' }}
                  icon={<UserOutlined />}
                >
                  {member.displayName.slice(0, 1)}
                </Avatar>
              }
              title={
                <Text strong>
                  {member.displayName}
                  {member.id === user?.id ? <Text type="secondary">（我）</Text> : null}
                </Text>
              }
              description={
                member.email ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {member.email}
                  </Text>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {member.memberType === 'AGENT' ? 'Agent' : ''}
                  </Text>
                )
              }
            />
          </List.Item>
        )}
      />

      {/* 邀请成员：从项目成员中选择未入群的 */}
      <Modal
        title="邀请成员"
        open={inviteOpen}
        onCancel={() => {
          setInviteOpen(false)
          setInviteIds([])
        }}
        onOk={confirmInvite}
        okText="邀请"
        cancelText="取消"
        confirmLoading={inviting}
        width={420}
        destroyOnHidden
      >
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择要邀请的项目成员"
          value={inviteIds}
          onChange={setInviteIds}
          optionFilterProp="label"
          options={inviteCandidates.map((m) => ({ value: m.userId, label: resolveProjectMemberName(m.userId) }))}
        />
      </Modal>
    </>
  )
}
