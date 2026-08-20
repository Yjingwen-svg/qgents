import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Avatar,
  Button,
  ConfigProvider,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import { CameraOutlined, GithubOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teamApi } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { isCurrentUserTeamOwner } from '@/utils/teamOwnership'
import { qgDarkPageTheme } from '@/theme/antdTheme'
import type { CreateTeamPayload, Team, TeamMember, TeamInvitation, TeamRole } from '@/types'
import type { TableProps } from 'antd'

const { Title, Text } = Typography

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: 'TEAM_OWNER', label: 'Owner' },
  { value: 'TEAM_ADMIN', label: '管理员' },
  { value: 'TEAM_MEMBER', label: 'Member' },
]

function getRoleLabel(role: TeamRole): string {
  if (role === 'TEAM_OWNER') return 'Owner'
  if (role === 'TEAM_ADMIN') return '管理员'
  return 'Member'
}

function formatCreatedAt(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

/**
 * 团队设置页 —— 深色主题（与 Banner / 团队侧边栏一致）
 * 顶部：返回团队 + 标题 + GitHub 集成 / 解散团队按钮
 * 下方 Tab：基本信息 / 成员管理
 * 路由：/app/teams/:teamId/settings
 */
export default function TeamSettingsPage() {
  const { teamId = '' } = useParams<{ teamId: string }>()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isHover, setIsHover] = useState(false)

  const {
    data: team,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamApi.getById(teamId),
    enabled: !!teamId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => teamApi.listMembers(teamId),
    enabled: !!teamId,
  })

  // GitHub 集成入口沿用宽松 Owner 判断（含 as=owner / 成员反查兜底）；解散团队用严格 role 判断
  const asOwner = searchParams.get('as') === 'owner'
  const isOwner = team?.role === 'TEAM_OWNER'
  const isTeamOwner = isCurrentUserTeamOwner(team, members, user, asOwner)

  const disbandTeam = useMutation({
    mutationFn: () => teamApi.disband(teamId),
    onSuccess: () => {
      message.success('团队已解散')
      queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] })
      navigate(PATHS.MY_TEAMS, { replace: true })
    },
    onError: (err) => {
      message.error(err instanceof Error ? err.message : '解散失败')
    },
  })

  function handleDisband() {
    Modal.confirm({
      title: '解散团队',
      content: `确定要解散「${team?.name}」吗？解散后团队下的所有项目、群聊和成员将不可恢复。`,
      okText: '解散',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => disbandTeam.mutate(),
    })
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (isError || !team) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
        <EmptyState icon="🔎" title="团队未找到" description="该团队不存在，或你暂无访问权限" />
      </div>
    )
  }

  return (
    <ConfigProvider theme={qgDarkPageTheme}>
      <div style={{ padding: '24px 32px', maxWidth: 720, margin: '0 auto', minHeight: 'calc(100vh - var(--qg-banner-h))' }}>
        {/* 顶部：标题居中，返回链接 / 操作按钮分别绝对定位到左右两侧 */}
        <div style={{ position: 'relative', marginBottom: 24, paddingTop: 4 }}>
          <Link
            to={PATHS.teamDetail(teamId)}
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              color: 'var(--qg-text-on-dark-secondary)',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              textDecoration: 'none',
              border: isHover ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(255,255,255,0.1)',
              background: isHover ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            }}
          >
            ← 返回团队
          </Link>
          <Title level={3} style={{ color: 'var(--qg-text-on-dark)', textAlign: 'center', margin: '32px 0 0' }}>
            团队设置
          </Title>
          <Space style={{ position: 'absolute', right: 0, top: 0 }}>
            {isTeamOwner && (
              <Button icon={<GithubOutlined />} onClick={() => navigate(PATHS.githubIntegration(teamId))}>
                GitHub 集成
              </Button>
            )}
            {isOwner && (
              <Button danger loading={disbandTeam.isPending} onClick={handleDisband}>
                解散团队
              </Button>
            )}
          </Space>
        </div>

        <Tabs
          defaultActiveKey="basic"
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: <BasicInfoTab team={team} teamId={teamId} isOwner={isOwner} />,
            },
            {
              key: 'members',
              label: '成员管理',
              children: (
                <MembersTab
                  teamId={teamId}
                  members={members}
                  isOwner={isOwner}
                  isAdmin={!isOwner && team?.role === 'TEAM_ADMIN'}
                />
              ),
            },
          ]}
        />
      </div>
    </ConfigProvider>
  )
}

/** ──── Tab 1：基本信息 ──── */
function BasicInfoTab({ team, teamId, isOwner }: { team: Team; teamId: string; isOwner: boolean }) {
  const [form] = Form.useForm<CreateTeamPayload>()
  const queryClient = useQueryClient()
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(team.avatarUrl)

  const updateTeam = useMutation({
    mutationFn: (payload: CreateTeamPayload) => teamApi.update(teamId, payload),
    onSuccess: () => {
      message.success('团队信息已保存')
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] })
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  useEffect(() => {
    form.setFieldsValue({ name: team.name, description: team.description ?? '' })
    setAvatarUrl(team.avatarUrl)
  }, [team, form])

  /** §28.1 团队头像：签发凭证 → 直传 OSS → 确认 → PATCH 回写（仅 Owner） */
  async function handleAvatarUpload(file: File): Promise<boolean> {
    if (!isOwner || avatarUploading) return false
    setAvatarUploading(true)
    try {
      const uploaded = await teamApi.uploadAvatar(teamId, file)
      setAvatarUrl(uploaded)
      await teamApi.update(teamId, { avatarUrl: uploaded })
      message.success('团队头像已更新')
      // 同步刷新所有展示团队头像的查询：详情页、我的团队列表（key 不同，需分别失效）
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] })
      queryClient.invalidateQueries({ queryKey: ['teams', 'mine'] })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '头像上传失败，请重试')
    } finally {
      setAvatarUploading(false)
    }
    return false
  }

  function handleFinish(values: CreateTeamPayload) {
    updateTeam.mutate({
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      avatarUrl: avatarUrl ?? undefined,
    })
  }

  return (
    <Form
      form={form}
      layout="vertical"
      disabled={!isOwner}
      onFinish={handleFinish}
      style={{ maxWidth: 480, margin: '0 auto' }}
    >
      <Form.Item label="团队头像">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={56} src={avatarUrl} icon={<CameraOutlined />} style={{ flexShrink: 0 }} />
          <Upload accept="image/*" showUploadList={false} beforeUpload={handleAvatarUpload}>
            <Button icon={<UploadOutlined />} loading={avatarUploading}>
              上传图片
            </Button>
          </Upload>
        </div>
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          支持 JPG / PNG，建议 200×200 方形图片；上传后自动保存
        </Text>
      </Form.Item>
      <Form.Item
        name="name"
        label="团队名称"
        rules={[{ required: true, whitespace: true, message: '请输入团队名称' }]}
      >
        <Input placeholder="团队名称" />
      </Form.Item>
      <Form.Item name="description" label="团队简介">
        <Input.TextArea rows={3} placeholder="描述团队用途、协作方向" />
      </Form.Item>
      <Form.Item label="成立时间">
        <Text type="secondary">{formatCreatedAt(team.createdAt)}</Text>
      </Form.Item>
      {isOwner && (
        <div style={{display:'flex', justifyContent:'center'}}>
          <Button type="primary" htmlType="submit" loading={updateTeam.isPending}> 
            保存修改
          </Button>
        </div>
      )}
    </Form>
  )
}

/** ──── Tab 2：成员管理 ──── */
function MembersTab({
  teamId,
  members,
  isOwner,
  isAdmin,
}: {
  teamId: string
  members: TeamMember[]
  isOwner: boolean
  /** 当前用户是团队管理员（TEAM_ADMIN，非 Owner）—— 只能移出普通成员 */
  isAdmin: boolean
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('TEAM_MEMBER')

  const { data: invitations = [] } = useQuery({
    queryKey: ['teams', teamId, 'invitations'],
    queryFn: () => teamApi.listInvitations(teamId),
    enabled: !!teamId && isOwner,
  })

  const inviteMutation = useMutation({
    // expiresInDays 后端必填（INVALID_ARGUMENT），前端默认 7 天
    mutationFn: () =>
      teamApi.invite(teamId, { email: inviteEmail.trim(), role: inviteRole, expiresInDays: 7 }),
    onSuccess: () => {
      message.success('邀请已发送')
      setInviteEmail('')
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'invitations'] })
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => teamApi.revokeInvitation(teamId, invitationId),
    onSuccess: () => {
      message.success('邀请已撤销')
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'invitations'] })
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => teamApi.removeMember(teamId, userId),
    onSuccess: () => {
      message.success('成员已移除')
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  // 设/撤管理员 = 调整团队角色（仅 Owner；TEAM_ADMIN ↔ TEAM_MEMBER）
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) =>
      teamApi.updateMemberRole(teamId, userId, role),
    onSuccess: () => {
      message.success('团队角色已更新')
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
    },
    onError: (err) => message.error(formatApiError(err)),
  })

  function confirmRemove(member: TeamMember) {
    const name = member.displayName || member.userId
    Modal.confirm({
      title: '移除成员',
      content: `确定要将「${name}」移出团队吗？`,
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => removeMutation.mutate(member.userId),
    })
  }

  function confirmRoleChange(member: TeamMember, nextRole: 'TEAM_ADMIN' | 'TEAM_MEMBER') {
    const name = member.displayName || member.userId
    const promote = nextRole === 'TEAM_ADMIN'
    Modal.confirm({
      title: promote ? '设为管理员' : '移除管理员',
      content: promote
        ? `确定将「${name}」设为团队管理员？管理员可创建项目并管理普通成员。`
        : `确定移除「${name}」的管理员身份？移除后降为普通成员。`,
      okText: promote ? '设为管理员' : '移除管理员',
      cancelText: '取消',
      onOk: () => updateRoleMutation.mutate({ userId: member.userId, role: nextRole }),
    })
  }

  const columns: TableProps<TeamMember>['columns'] = [
    {
      title: '成员',
      key: 'name',
      render: (_, m) => m.displayName || m.userId,
    },
    {
      title: '邮箱',
      key: 'email',
      render: (_, m) => m.email || '—',
    },
    {
      title: '角色',
      key: 'role',
      width: 180,
      render: (_, m) => (
        <Space size={4}>
          <Tag color={m.role === 'TEAM_OWNER' ? 'gold' : m.role === 'TEAM_ADMIN' ? 'blue' : 'default'}>
            {getRoleLabel(m.role)}
          </Tag>
          {m.role === 'TEAM_OWNER' ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              （不可降级）
            </Text>
          ) : null}
        </Space>
      ),
    },
    ...(isOwner || isAdmin
      ? [
          {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_: unknown, m: TeamMember) => {
              const isSelf = m.userId === user?.id
              const isMemberOwner = m.role === 'TEAM_OWNER'
              const isMemberAdmin = m.role === 'TEAM_ADMIN'
              if (isSelf || isMemberOwner) {
                // 自己不可操作；Owner 唯一且不可被操作
                return (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    —
                  </Text>
                )
              }
              const actions: React.ReactNode[] = []
              if (isOwner) {
                // Owner：可设/撤管理员 + 移除所有人（含管理员）
                actions.push(
                  <Button
                    key="role"
                    size="small"
                    type="link"
                    loading={updateRoleMutation.isPending}
                    onClick={() => confirmRoleChange(m, isMemberAdmin ? 'TEAM_MEMBER' : 'TEAM_ADMIN')}
                  >
                    {isMemberAdmin ? '移除管理员' : '设为管理员'}
                  </Button>,
                )
                actions.push(
                  <Button
                    key="remove"
                    size="small"
                    danger
                    type="link"
                    loading={removeMutation.isPending}
                    onClick={() => confirmRemove(m)}
                  >
                    移除
                  </Button>,
                )
              } else if (isAdmin && !isMemberAdmin) {
                // 管理员：只能移除普通成员（owner / 其他管理员不可动）
                actions.push(
                  <Button
                    key="remove"
                    size="small"
                    danger
                    type="link"
                    loading={removeMutation.isPending}
                    onClick={() => confirmRemove(m)}
                  >
                    移除
                  </Button>,
                )
              }
              return actions.length > 0 ? <Space size={4}>{actions}</Space> : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  —
                </Text>
              )
            },
          },
        ]
      : []),
  ]

  const invitationColumns: TableProps<TeamInvitation>['columns'] = [
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: TeamRole) => getRoleLabel(role),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: TeamInvitation['status']) => {
        const map: Record<string, string> = {
          PENDING: 'orange',
          ACCEPTED: 'green',
          REVOKED: 'default',
          EXPIRED: 'default',
        }
        return <Tag color={map[status] ?? 'default'}>{status}</Tag>
      },
    },
    {
      title: '邀请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatCreatedAt(v),
    },
    ...(isOwner
      ? [
          {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_: unknown, inv: TeamInvitation) =>
              inv.status === 'PENDING' ? (
                <Button
                  size="small"
                  type="link"
                  danger
                  loading={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(inv.id)}
                >
                  撤销
                </Button>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Table
          rowKey="userId"
          columns={columns}
          dataSource={members}
          pagination={false}
          size="middle"
        />
      </div>

      {isOwner && (
        <div>
          <Title level={5}>邀请成员</Title>
          <Space.Compact style={{ width: '100%', maxWidth: 480 }}>
            <Input
              placeholder="输入邮箱地址"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onPressEnter={() => inviteEmail.trim() && inviteMutation.mutate()}
            />
            <Select
              value={inviteRole}
              options={ROLE_OPTIONS}
              style={{ width: 120 }}
              onChange={(v) => setInviteRole(v)}
            />
            <Button
              type="primary"
              loading={inviteMutation.isPending}
              disabled={!inviteEmail.trim()}
              onClick={() => inviteMutation.mutate()}
            >
              发送邀请
            </Button>
          </Space.Compact>

          {invitations.length > 0 && (
            <Table
              rowKey="id"
              columns={invitationColumns}
              dataSource={invitations}
              pagination={false}
              size="small"
              style={{ marginTop: 16, maxWidth: 720 }}
              title={() => '待处理邀请'}
            />
          )}
        </div>
      )}
    </Space>
  )
}
