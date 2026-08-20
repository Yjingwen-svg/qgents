import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Avatar, Button, Empty, List, Modal, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { groupApi, projectApi, teamApi } from '@/api'
import { formatApiError } from '@/utils/formatApiError'
import { useAuth } from '@/context/AuthContext'
import type { Group, GroupMemberType } from '@/types'

const { Text } = Typography

interface Props {
  projectId: string
  group: Group | null
}

/**
 * 群聊设置栏内嵌的「成员」区（权限分层，v2.0.6）：
 * - owner（项目 owner，主群创建者即项目创建者）：
 *   可「设为管理员 / 移除管理员」（调整项目角色 PROJECT_ADMIN ↔ PROJECT_MEMBER），
 *   可把所有人（含管理员）移出群聊
 * - admin（项目管理员 PROJECT_ADMIN）：只能移出普通成员，不能动 owner 和其他管理员
 * - 普通成员：无管理权限；自己不可被操作
 * 接口：GET/POST .../members、DELETE .../members/{userId}、PATCH 项目成员角色。
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

  // 权限分层：owner = 群创建者（主群创建者即项目 owner）；admin = 项目管理员 PROJECT_ADMIN
  const selfIsOwner = group?.createdBy === user?.id
  const selfIsAdmin = !selfIsOwner && project?.role === 'PROJECT_ADMIN'
  const projectMemberRoleById = new Map(projectMembers.map((m) => [m.userId, m.role]))
  const isMemberOwner = (userId: string): boolean => userId === group?.createdBy
  const isMemberAdmin = (userId: string): boolean => projectMemberRoleById.get(userId) === 'PROJECT_ADMIN'

  const canManage =
    group?.type === 'REQUIREMENT' && (selfIsOwner || selfIsAdmin)

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
  // 设/撤管理员 = 调整项目角色（owner 专属；PROJECT_ADMIN ↔ PROJECT_MEMBER）
  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER' }) =>
      projectApi.updateMemberRole(projectId, userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] })
      message.success('项目角色已更新')
    },
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

  /** 管理模式下的成员行操作（按 owner / admin 分层；仅 USER 成员可操作） */
  function memberActions(
    memberId: string,
    memberName: string,
    memberType: GroupMemberType,
  ): ReactNode[] | undefined {
    if (!manageMode || memberType !== 'USER') return undefined
    if (memberId === user?.id) return undefined // 自己不可操作
    if (isMemberOwner(memberId)) return undefined // owner 唯一且不可被移出
    const actions: ReactNode[] = []
    if (selfIsOwner) {
      // owner：可设/撤管理员 + 移出所有人（含管理员）
      if (isMemberAdmin(memberId)) {
        actions.push(
          <Popconfirm
            key="demote"
            title={`确认将 ${memberName} 移除管理员？`}
            description="移除后将降为项目普通成员"
            okText="移除管理员"
            cancelText="取消"
            onConfirm={() => updateRole.mutate({ userId: memberId, role: 'PROJECT_MEMBER' })}
          >
            <Button size="small" type="text" loading={updateRole.isPending}>
              移除管理员
            </Button>
          </Popconfirm>,
        )
      } else {
        actions.push(
          <Popconfirm
            key="promote"
            title={`确认将 ${memberName} 设为管理员？`}
            description="设为项目管理员后可在各需求群管理普通成员"
            okText="设为管理员"
            cancelText="取消"
            onConfirm={() => updateRole.mutate({ userId: memberId, role: 'PROJECT_ADMIN' })}
          >
            <Button size="small" type="text" loading={updateRole.isPending}>
              设为管理员
            </Button>
          </Popconfirm>,
        )
      }
      actions.push(
        <Popconfirm
          key="remove"
          title={`确认将 ${memberName} 移出群聊？`}
          okText="移出"
          cancelText="取消"
          onConfirm={() => removeMember.mutate(memberId)}
        >
          <Button size="small" type="text" danger loading={removeMember.isPending}>
            移出群聊
          </Button>
        </Popconfirm>,
      )
    } else if (selfIsAdmin && !isMemberAdmin(memberId)) {
      // admin：只能移出普通成员（owner / 管理员不可动）
      actions.push(
        <Popconfirm
          key="remove"
          title={`确认将 ${memberName} 移出群聊？`}
          okText="移出"
          cancelText="取消"
          onConfirm={() => removeMember.mutate(memberId)}
        >
          <Button size="small" type="text" danger loading={removeMember.isPending}>
            移出群聊
          </Button>
        </Popconfirm>,
      )
    }
    return actions
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
        renderItem={(member) => {
          const memberOwner = isMemberOwner(member.id)
          const memberAdmin = isMemberAdmin(member.id)
          return (
            <List.Item actions={memberActions(member.id, member.displayName, member.memberType)}>
              <List.Item.Meta
                avatar={
                  <Avatar
                    size={32}
                    src={member.id === user?.id ? user?.avatarUrl : member.avatarUrl}
                    style={{ background: '#3b82f6' }}
                    icon={<UserOutlined />}
                  >
                    {(member.id === user?.id ? (user?.displayName ?? '我') : member.displayName).slice(0, 1)}
                  </Avatar>
                }
                title={
                  <Text strong>
                    {member.id === user?.id ? user?.displayName ?? member.displayName : member.displayName}
                    {member.id === user?.id ? <Text type="secondary">（我）</Text> : null}
                    {memberOwner ? (
                      <Tag color="gold" style={{ marginLeft: 8, fontSize: 11 }}>所有者</Tag>
                    ) : memberAdmin ? (
                      <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>管理员</Tag>
                    ) : null}
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
          )
        }}
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
