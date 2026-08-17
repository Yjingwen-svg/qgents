import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Avatar, Button, Empty, List, Modal, Popconfirm, Select, Typography } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { groupApi, projectApi } from '@/api'
import { formatApiError } from '@/utils/formatApiError'
import type { Group } from '@/types'

const { Text } = Typography

interface Props {
  projectId: string
  /** 当前管理的群；null = 弹窗关闭 */
  group: Pick<Group, 'id' | 'title'> | null
  onClose: () => void
}

/**
 * 需求群「成员管理」弹窗（创建者或 Project Admin 可见）。
 * 成员列表（昵称 + 邮箱）+ 邀请成员（从项目成员选未入群的）+ 移出群聊。
 * 接口：GET/POST .../members、DELETE .../members/{userId}（后端补充文档见根目录接口补充）。
 */
export function GroupMemberManagerModal({ projectId, group, onClose }: Props) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteIds, setInviteIds] = useState<string[]>([])

  const groupId = group?.id ?? ''

  const { data: members = [] } = useQuery({
    queryKey: ['groups', projectId, groupId, 'members'],
    queryFn: () => groupApi.listMembers(projectId, groupId),
    enabled: !!groupId,
  })
  // 邀请候选 = 项目成员（未入群的）
  const { data: projectMembers = [] } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectApi.listMembers(projectId),
    enabled: !!projectId,
  })

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['groups', projectId, groupId, 'members'] })
    // memberCount 变化 → 群列表/侧栏校准
    void queryClient.invalidateQueries({ queryKey: ['groups', projectId] })
    void queryClient.invalidateQueries({ queryKey: ['chat', 'main-groups'] })
  }

  const addMember = useMutation({
    mutationFn: (userId: string) => groupApi.addMember(projectId, groupId, userId),
    onSuccess: invalidate,
    onError: (error) => message.error(formatApiError(error)),
  })
  const removeMember = useMutation({
    mutationFn: (userId: string) => groupApi.removeMember(projectId, groupId, userId),
    onSuccess: invalidate,
    onError: (error) => message.error(formatApiError(error)),
  })

  const memberUserIds = new Set(members.filter((m) => m.memberType === 'USER').map((m) => m.id))
  const inviteCandidates = projectMembers.filter((m) => !memberUserIds.has(m.userId))

  function confirmInvite(): void {
    for (const userId of inviteIds) addMember.mutate(userId)
    setInviteIds([])
    setInviteOpen(false)
  }

  return (
    <Modal
      title="成员管理"
      open={!!group}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={480}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          disabled={inviteCandidates.length === 0}
          onClick={() => setInviteOpen(true)}
        >
          邀请成员
        </Button>
      </div>

      <List
        dataSource={members}
        locale={{ emptyText: <Empty description="暂无成员" /> }}
        renderItem={(member) => (
          <List.Item
            actions={
              member.memberType === 'USER'
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
              avatar={<Avatar size={32} style={{ background: '#3b82f6' }} icon={<UserOutlined />} />}
              title={<Text strong>{member.displayName}</Text>}
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
        confirmLoading={addMember.isPending}
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
          options={inviteCandidates.map((m) => ({ value: m.userId, label: m.displayName }))}
        />
      </Modal>
    </Modal>
  )
}
