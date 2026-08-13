import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal, Form, Input } from 'antd'
import { PATHS, PROJECT_NAV } from '@/routes/paths'
import { groupApi, projectApi } from '@/api'
import { useAppUiStore } from '@/store/appUiStore'
import type { CreateGroupPayload } from '@/types'
import './ProjectDetailLayout.scss'

/**
 * 项目详情布局：固定左侧导航，右侧为子路由 Outlet
 *
 * 左侧「群聊」列表：项目总群 + 需求群，数据来自 GET /groups
 *   /app/projects/:projectId/req-chat/:groupId
 */
export function ProjectDetailLayout() {
  const { projectId = '', groupId } = useParams<{
    projectId: string
    groupId?: string
  }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const onReqChat = location.pathname.includes('/req-chat')
  const onCode = location.pathname.includes('/code')
  const setCurrentTeam = useAppUiStore((state) => state.setCurrentTeam)
  const setCurrentProject = useAppUiStore((state) => state.setCurrentProject)

  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm<CreateGroupPayload>()

  // 从后端获取项目名
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectApi.getById(projectId),
    enabled: !!projectId,
  })
  const projectName = project?.name ?? projectId

  // 群列表（项目总群 + 需求群）
  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: !!projectId,
  })
  const mainGroup = groups.find((g) => g.type === 'PROJECT_MAIN') ?? groups[0]
  const requirementGroups = groups.filter((g) => g.type === 'REQUIREMENT')

  // 记录项目及所属团队上下文，供顶部「团队首页」按钮回到正确团队
  useEffect(() => {
    if (!projectId) return
    if (project?.teamId) setCurrentTeam(project.teamId)
    setCurrentProject(projectId)
  }, [projectId, project?.teamId, setCurrentTeam, setCurrentProject])

  // 创建需求群
  const createGroup = useMutation({
    mutationFn: (payload: CreateGroupPayload) => groupApi.create(projectId, payload),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['groups', projectId] })
      setCreateOpen(false)
      form.resetFields()
      navigate(PATHS.projectReqChat(projectId, group.id), { replace: true })
    },
  })

  // 在群聊路径但未指定具体群（/req-chat 无 groupId）时，重定向到项目总群
  if (onReqChat && !groupId && mainGroup) {
    return <Navigate to={PATHS.projectReqChat(projectId, mainGroup.id)} replace />
  }

  return (
    <div className="pd">
      <aside className="pd-nav" aria-label="项目导航">
        {/* 当前项目名 —— 位于导航列表上方 */}
        <div className="pd-nav__project">
          <span className="pd-nav__project-label">当前项目</span>
          <strong className="pd-nav__project-name" title={projectName}>
            {projectName}
          </strong>
        </div>

        <nav className="pd-nav__menu">
          {PROJECT_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.to(projectId)}
              className={({ isActive }) => {
                // 需求群聊：任意 /req-chat/* 都高亮该导航项
                const active =
                  item.path === 'req-chat'
                    ? onReqChat
                    : item.path === 'code'
                      ? onCode
                      : isActive
                return `pd-nav__item${active ? ' is-active' : ''}`
              }}
            >
              <NavIcon id={item.path} />
              <span className="pd-nav__label">{item.label}</span>
              {'badge' in item && item.badge != null ? (
                <span className="pd-nav__badge">{item.badge}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        {/* —— 群聊列表 —— */}
        <div className="pd-nav__branches">
          <div className="pd-nav__branches-head">
            <span>群聊</span>
          </div>
          <ul className="pd-nav__branch-list">
            {mainGroup && (
              <li>
                <NavLink
                  to={PATHS.projectReqChat(projectId, mainGroup.id)}
                  className={() =>
                    `pd-nav__branch${onReqChat && groupId === mainGroup.id ? ' is-active' : ''}`
                  }
                >
                  <span className="pd-nav__branch-hash">#</span>
                  <span className="pd-nav__branch-text">
                    <span className="pd-nav__branch-title">{mainGroup.title}</span>
                    <span className="pd-nav__branch-ref">项目总群</span>
                  </span>
                </NavLink>
              </li>
            )}
            {requirementGroups.map((g) => (
              <li key={g.id}>
                <NavLink
                  to={PATHS.projectReqChat(projectId, g.id)}
                  className={() =>
                    `pd-nav__branch${onReqChat && groupId === g.id ? ' is-active' : ''}`
                  }
                >
                  <span className="pd-nav__branch-hash">#</span>
                  <span className="pd-nav__branch-text">
                    <span className="pd-nav__branch-title">{g.title}</span>
                    <span className="pd-nav__branch-ref">需求群</span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="pd-nav__new-branch-chat"
            onClick={() => setCreateOpen(true)}
          >
            + 新建需求群
          </button>
        </div>
      </aside>

      <div className="pd-main">
        <Outlet />
      </div>

      {/* 新建需求群弹窗 */}
      <Modal
        title="新建需求群"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={createGroup.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => createGroup.mutate(values)}
          initialValues={{ type: 'REQUIREMENT' }}
        >
          <Form.Item
            name="title"
            label="需求群名称"
            rules={[{ required: true, message: '请输入需求群名称' }]}
          >
            <Input placeholder="例如：登录功能" maxLength={50} />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）">
            <Input.TextArea
              placeholder="简要说明这个需求群要讨论什么"
              autoSize={{ minRows: 2, maxRows: 4 }}
              maxLength={200}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function NavIcon({ id }: { id: string }) {
  const paths: Record<string, string> = {
    overview: 'M4 10.5L12 4l8 6.5V20H4V10.5z',
    'req-chat':
      'M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4.2A2.5 2.5 0 0 1 5 12.5v-6z',
    tasks: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    workflow: 'M4 7h6v4H4V7zm10 0h6v4h-6V7zM9 11v3h6v3',
    agents:
      'M9 8a3 3 0 1 0 0-0.01M17 9a2.5 2.5 0 1 0 0-0.01M3.5 19c.8-3 2.8-4.5 5.5-4.5S14 16 14.5 19M14.5 14.5c1.6-.4 3.2.2 4.5 1.8',
    skills: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z',
    memory: 'M6 5h12v14H6V5zm3 4h6M9 12h6M9 15h4',
    code: 'M9 7L4 12l5 5M15 7l5 5-5 5',
    testset: 'M9 4h6l1 3h4v13H4V7h4l1-3zm3 6v6m0 0l-2-2m2 2l2-2',
    members:
      'M9 8a3 3 0 1 0 0-.01M16.5 9a2.2 2.2 0 1 0 0-.01M4 19c.8-3 2.6-4.5 5-4.5s4.2 1.5 5 4.5M14 14.5c1.4-.3 2.8.3 4 1.7',
    settings:
      'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6',
  }

  return (
    <svg className="pd-nav__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={paths[id] ?? paths.overview}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
