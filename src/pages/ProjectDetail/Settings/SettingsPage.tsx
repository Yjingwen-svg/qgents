// src/pages/ProjectDetail/sections/SettingsPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Tabs, Typography, Input, Switch, Spin, Tag, message, Avatar, Upload } from 'antd'
import { GithubOutlined, SaveOutlined, LockOutlined, UploadOutlined, CameraOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TabsProps } from 'antd'
import { projectApi } from '@/api'
import { githubApi } from '@/api/github'
import { useTasks } from '@/hooks/task-model'
import { useProjectAvatarUpload } from '@/hooks/useProjectAvatarUpload'
import { TaskModelStatusTag } from '@/pages/ProjectDetail/TaskCenter/TaskModelStatusTag'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import type { Project } from '@/types/project'
import type { TaskStatus } from '@/types/task-model'
import './SettingsPage.scss'

const { Title, Text } = Typography
const { TextArea } = Input

// 任务执行 Tab 的三态分类（对齐任务真实状态）
const RUNNING_STATUSES: TaskStatus[] = ['RUNNING', 'DELIVERING']
const PENDING_STATUSES: TaskStatus[] = ['PLANNING', 'PENDING']
const DONE_STATUSES: TaskStatus[] = [
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'CANCELLING',
  'DELIVERY_FAILED',
  'WAITING_DIFF_CONFIRMATION',
]

/**
 * 项目设置页 —— 配置项目级别规则、流程与权限
 *
 * 权限控制：
 * - PROJECT_ADMIN：可编辑所有配置
 * - PROJECT_MEMBER / TEAM_OWNER：只读
 *
 * Tab：基本信息 | 仓库 | 需求群规则 | 任务执行
 */
export function SettingsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [activeTab, setActiveTab] = useState<string>('basic')

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: !!projectId,
  })

  const isEditable = project?.role === 'PROJECT_ADMIN'

  const tabItems: TabsProps['items'] = [
    {
      key: 'basic',
      label: '基本信息',
      children: <BasicInfoTab projectId={projectId} project={project} isEditable={isEditable} />,
    },
    {
      key: 'repositories',
      label: '仓库',
      children: (
        <RepositoriesTab
          projectId={projectId}
          teamId={project?.teamId ?? ''}
          isEditable={isEditable}
        />
      ),
    },
    {
      key: 'group-rules',
      label: '需求群规则',
      children: <GroupRulesTab projectId={projectId} isEditable={isEditable} />,
    },
    {
      key: 'task-execution',
      label: '任务执行',
      children: <TaskExecutionTab projectId={projectId} />,
    },
  ]

  if (isLoading) {
    return (
      <div className="settings-page">
        <div className="settings-page__loading">
          <Spin size="large" />
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <div className="settings-page__header-left">
          <Title level={3} className="settings-page__title">项目设置</Title>
          <Text type="secondary" className="settings-page__desc">
            配置项目级别、流程与权限，保障协同与交付质量
          </Text>
        </div>
      </div>

      <div className="settings-page__tabs">
        <Tabs activeKey={activeTab} items={tabItems} onChange={setActiveTab} className="settings-page__tabs-inner" />
      </div>
    </div>
  )
}

// ============================================================
// Tab 1：基本信息
// ============================================================

function BasicInfoTab({
  projectId,
  project,
  isEditable,
}: {
  projectId: string
  project?: Project
  isEditable: boolean
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  // 项目头像（v2.0.6：从群聊设置栏迁入项目设置-基本信息）
  const { uploading: avatarUploading, uploadAvatar } = useProjectAvatarUpload(project?.teamId)

  // project 异步加载完成后同步到本地 state，避免初始空串不更新
  useEffect(() => {
    setName(project?.name || '')
    setDescription(project?.description || '')
  }, [project])

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      projectApi.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
      message.success('基本信息已更新')
    },
    onError: () => {
      message.error('更新失败，请重试')
    },
  })

  const handleSave = () => {
    if (!name.trim()) {
      message.warning('项目名称不能为空')
      return
    }
    updateMutation.mutate({ name: name.trim(), description: description.trim() })
  }

  return (
    <div className="settings-tab">
      <div className="settings-tab__content">
        {/* 项目头像（v2.0.6：从群聊设置栏迁入项目设置-基本信息；主群会话头像跟随项目头像） */}
        <div className="settings-tab__field">
          <label className="settings-tab__label">项目头像</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Avatar size={64} src={project?.avatarUrl} icon={<CameraOutlined />} style={{ flexShrink: 0 }} />
            {isEditable ? (
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  void uploadAvatar(projectId, file)
                  return false
                }}
              >
                <Button icon={<UploadOutlined />} loading={avatarUploading}>
                  {project?.avatarUrl ? '更换头像' : '上传头像'}
                </Button>
              </Upload>
            ) : (
              <Text type="secondary">仅项目管理员可修改</Text>
            )}
          </div>
        </div>

        <div className="settings-tab__field">
          <label className="settings-tab__label">项目名称</label>
          {isEditable ? (
            <Input
              className="settings-tab__input"
              placeholder="请输入项目名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : (
            <div className="settings-tab__readonly">
              <span>{project?.name || '—'}</span>
              <LockOutlined />
            </div>
          )}
        </div>

        <div className="settings-tab__field">
          <label className="settings-tab__label">项目描述</label>
          {isEditable ? (
            <TextArea
              className="settings-tab__textarea"
              placeholder="请输入项目描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          ) : (
            <div className="settings-tab__readonly">
              <span>{project?.description || '暂无描述'}</span>
              <LockOutlined />
            </div>
          )}
        </div>

        <div className="settings-tab__field settings-tab__field--readonly">
          <label className="settings-tab__label">项目 ID</label>
          <span className="settings-tab__text">{project?.id || '—'}</span>
        </div>

        <div className="settings-tab__field settings-tab__field--readonly">
          <label className="settings-tab__label">创建时间</label>
          <span className="settings-tab__text">
            {project?.createdAt ? new Date(project.createdAt).toLocaleString() : '—'}
          </span>
        </div>

        <div className="settings-tab__field settings-tab__field--readonly">
          <label className="settings-tab__label">我的角色</label>
          <span className="settings-tab__text">
            {project?.role === 'PROJECT_ADMIN' ? 'Project Admin' : 'Project Member'}
          </span>
        </div>

        {isEditable && (
          <div className="settings-tab__footer">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={updateMutation.isPending}
              onClick={handleSave}
            >
              保存基本信息
            </Button>
          </div>
        )}


      </div>
    </div>
  )
}

// ============================================================
// Tab 2：仓库 —— GET /projects/{projectId}/repositories
// ============================================================

function RepositoriesTab({
  projectId,
  teamId,
  isEditable,
}: {
  projectId: string
  teamId: string
  isEditable: boolean
}) {
  const navigate = useNavigate()
  const { data: repositories = [], isLoading, isError } = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId),
  })

  /** 查询团队已安装的 GitHub App，用于直接跳转到「查看仓库」页 */
  const installationsQuery = useQuery({
    queryKey: queryKeys.githubInstallations(teamId),
    queryFn: () => githubApi.listInstallations(teamId),
    enabled: Boolean(teamId),
  })
  const installations = installationsQuery.data ?? []
  // 过滤掉已删除的安装，只统计活跃的
  const activeInstallations = installations.filter((i) => i.status !== 'DELETED')

  function handleBindClick() {
    if (!teamId) {
      message.warning('缺少团队信息，无法跳转绑定页')
      return
    }
    // 等待 installations 加载完成后再跳转
    if (installationsQuery.isLoading) {
      message.info('正在加载安装信息，请稍候')
      return
    }
    // 如果只有一个活跃的 GitHub App 安装，直接跳转到「查看仓库」页
    if (activeInstallations.length === 1) {
      navigate(PATHS.githubInstallationRepos(teamId, activeInstallations[0].id))
      return
    }
    // 多个或零个活跃安装 → 跳到 GitHub 集成页，让用户选择安装或先安装
    navigate(PATHS.githubIntegration(teamId))
  }

  return (
    <div className="settings-tab">
      <div className="settings-tab__content">
        <div className="settings-tab__section-header">
          <Text strong>已绑定仓库</Text>
          {isEditable && (
            <Button type="primary" size="small" onClick={handleBindClick}>
              + 绑定仓库
            </Button>
          )}
        </div>

        <div className="settings-tab__repo-list">
          {isLoading ? (
            <div className="settings-tab__repo-placeholder">
              <Spin />
            </div>
          ) : isError ? (
            <div className="settings-tab__repo-placeholder">
              <Text type="danger">仓库列表加载失败，请稍后重试</Text>
            </div>
          ) : repositories.length === 0 ? (
            <div className="settings-tab__repo-placeholder">
              <Text type="secondary">暂无已绑定仓库</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {isEditable ? '点击「绑定仓库」从 GitHub 授权仓库中添加' : '请联系项目管理员绑定仓库'}
              </Text>
            </div>
          ) : (
            repositories.map((repo) => (
              <div key={repo.id} className="settings-tab__repo-item">
                <div className="settings-tab__repo-item-main">
                  <GithubOutlined className="settings-tab__repo-item-icon" />
                  <div className="settings-tab__repo-item-text">
                    <Text strong className="settings-tab__repo-item-title">
                      {repo.displayName || repo.fullName.split('/').pop() || repo.fullName}
                    </Text>
                    <Text type="secondary" className="settings-tab__repo-item-fullname">
                      {repo.fullName}
                    </Text>
                  </div>
                  <Tag color={repo.authorizationStatus === 'AUTHORIZED' ? 'success' : 'warning'}>
                    {repo.authorizationStatus === 'AUTHORIZED' ? '已授权' : '已撤销'}
                  </Tag>
                </div>
                <div className="settings-tab__repo-item-meta">
                  <Text type="secondary">默认分支：{repo.defaultBranch || '—'}</Text>
                  <Text type="secondary">
                    绑定于 {repo.boundAt ? new Date(repo.boundAt).toLocaleString() : '—'}
                  </Text>
                </div>
              </div>
            ))
          )}
        </div>

        {!isEditable && (
          <div className="settings-tab__readonly-hint">
            <LockOutlined />
            <Text type="secondary" style={{ fontSize: 13 }}>
              只读模式，仓库管理需 Project Admin 权限
            </Text>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Tab 3：需求群规则
// ============================================================

function GroupRulesTab({
  projectId,
  isEditable,
}: {
  projectId: string
  isEditable: boolean
}) {
  const queryClient = useQueryClient()
  const [allowCreateGroup, setAllowCreateGroup] = useState(true)
  const [autoArchiveGroup, setAutoArchiveGroup] = useState(false)
  const [allowAgentTrigger, setAllowAgentTrigger] = useState(true)
  const [autoJoinAllGroups, setAutoJoinAllGroups] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['projects', projectId, 'settings'],
    queryFn: () => projectApi.getSettings(projectId),
    enabled: !!projectId,
  })

  // settings 异步加载后同步到本地 state
  useEffect(() => {
    if (!settings) return
    setAllowCreateGroup(settings.allowCreateGroup)
    setAutoArchiveGroup(settings.autoArchiveGroup)
    setAllowAgentTrigger(settings.allowAgentTrigger)
    setAutoJoinAllGroups(settings.autoJoinAllGroups)
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: () =>
      projectApi.updateSettings(projectId, {
        allowCreateGroup,
        autoArchiveGroup,
        allowAgentTrigger,
        autoJoinAllGroups,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'settings'] })
      message.success('需求群规则已保存')
    },
    onError: () => {
      message.error('保存失败，请重试')
    },
  })

  return (
    <div className="settings-tab">
      <div className="settings-tab__content">
        {isLoading ? (
          <div className="settings-tab__repo-placeholder">
            <Spin />
          </div>
        ) : (
          <>
            <div className="settings-tab__field settings-tab__field--switch">
              <div className="settings-tab__switch-row">
                <Switch checked={allowCreateGroup} onChange={setAllowCreateGroup} disabled={!isEditable} />
                <label className="settings-tab__label">允许成员创建需求群</label>
              </div>
              <div className="settings-tab__hint">
                {isEditable ? '关闭后只有 Project Admin 能创建需求群' : '当前为只读状态'}
              </div>
            </div>

            <div className="settings-tab__field settings-tab__field--switch">
              <div className="settings-tab__switch-row">
                <Switch checked={autoArchiveGroup} onChange={setAutoArchiveGroup} disabled={!isEditable} />
                <label className="settings-tab__label">任务完成后自动归档群聊</label>
              </div>
              <div className="settings-tab__hint">
                {isEditable ? '开启后，关联任务完成时自动归档需求群' : '当前为只读状态'}
              </div>
            </div>

            <div className="settings-tab__field settings-tab__field--switch">
              <div className="settings-tab__switch-row">
                <Switch checked={allowAgentTrigger} onChange={setAllowAgentTrigger} disabled={!isEditable} />
                <label className="settings-tab__label">允许 @Agent 发起任务</label>
              </div>
              <div className="settings-tab__hint">
                {isEditable ? '关闭后群内不显示「发起任务」按钮' : '当前为只读状态'}
              </div>
            </div>

            <div className="settings-tab__field settings-tab__field--switch">
              <div className="settings-tab__switch-row">
                <Switch checked={autoJoinAllGroups} onChange={setAutoJoinAllGroups} disabled={!isEditable} />
                <label className="settings-tab__label">新成员自动加入所有需求群</label>
              </div>
              <div className="settings-tab__hint">
                {isEditable ? '开启后，新成员自动进入所有已存在的需求群' : '当前为只读状态'}
              </div>
            </div>

            {isEditable && (
              <div className="settings-tab__footer">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  保存需求群规则
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Tab 4：任务执行
// ============================================================

function TaskExecutionTab({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const [taskFilter, setTaskFilter] = useState<'running' | 'pending' | 'done'>('running')
  const { data, isLoading } = useTasks(projectId)
  const tasks = data?.data ?? []

  const statusSet =
    taskFilter === 'running' ? RUNNING_STATUSES : taskFilter === 'pending' ? PENDING_STATUSES : DONE_STATUSES
  const filtered = tasks.filter((t) => statusSet.includes(t.status))

  return (
    <div className="settings-tab">
      <div className="settings-tab__content">
        <div className="settings-tab__filter-tabs">
          <button
            className={`settings-tab__filter-btn ${taskFilter === 'running' ? 'settings-tab__filter-btn--active' : ''}`}
            onClick={() => setTaskFilter('running')}
          >
            正在执行
          </button>
          <button
            className={`settings-tab__filter-btn ${taskFilter === 'pending' ? 'settings-tab__filter-btn--active' : ''}`}
            onClick={() => setTaskFilter('pending')}
          >
            未执行
          </button>
          <button
            className={`settings-tab__filter-btn ${taskFilter === 'done' ? 'settings-tab__filter-btn--active' : ''}`}
            onClick={() => setTaskFilter('done')}
          >
            已执行
          </button>
        </div>

        <div className="settings-tab__task-list">
          {isLoading ? (
            <div className="settings-tab__task-placeholder">
              <Spin />
            </div>
          ) : filtered.length === 0 ? (
            <div className="settings-tab__task-placeholder">
              <Text type="secondary">暂无任务</Text>
            </div>
          ) : (
            filtered.map((task) => (
              <div
                key={task.id}
                className="settings-tab__task-item"
                onClick={() => navigate(PATHS.projectTaskDetail(projectId, task.id))}
              >
                <div className="settings-tab__task-item-main">
                  <Text strong className="settings-tab__task-item-title">
                    {task.title}
                  </Text>
                  <TaskModelStatusTag status={task.status} />
                </div>
                <div className="settings-tab__task-item-meta">
                  <Text type="secondary">发起人：{task.createdByUser?.displayName ?? '—'}</Text>
                  <Text type="secondary">
                    更新于 {task.updatedAt ? new Date(task.updatedAt).toLocaleString() : '—'}
                  </Text>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}