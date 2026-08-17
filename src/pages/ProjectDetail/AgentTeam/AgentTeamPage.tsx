import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Form, Input, Modal, Select, Spin, Tag, Typography } from 'antd'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '@/api'
import { useAuth } from '@/context/AuthContext'
import { useAgent, useAgentRuntime, useAgents, useArchiveAgent, useCreateAgent, usePublishAgent, useUnpublishAgent, useUpdateAgent } from '@/hooks'
import type { AgentDetail, AgentRole, AgentSummary, CreateAgentPayload } from '@/types'
import { canPerformAgentAction } from '@/utils/agentActions'
import { AgentDetailPanel } from './AgentDetailPanel'
import styles from './AgentTeamPage.module.scss'

const roles: AgentRole[] = ['ORCHESTRATOR', 'PLANNER', 'DEVELOPER', 'TESTER', 'REVIEWER', 'GENERAL']
const emptyAgents: AgentSummary[] = []
const { Title, Text } = Typography

function agentLoadErrorMessage(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: unknown }).status : undefined
  if (status === 403) return '暂无查看 Agent 的权限'
  if (status === 404) return '团队或项目不存在'
  if (typeof status === 'number' && status >= 500) return 'Agent 服务暂时不可用'
  return 'Agent 数据加载失败'
}

export default function AgentTeamPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AgentDetail | null>(null)
  const [form] = Form.useForm<CreateAgentPayload>()
  const project = useQuery({ queryKey: ['qgents', 'projects', projectId], queryFn: () => projectApi.getById(projectId), enabled: Boolean(projectId) })
  const teamId = project.data?.teamId ?? ''
  const list = useAgents(projectId, teamId)
  const agents = list.data?.data ?? emptyAgents
  const agentId = new URLSearchParams(location.search).get('agentId')
  const selected = agents.find((agent) => agent.id === agentId) ?? null
  const detail = useAgent(projectId, teamId, selected?.id ?? null)
  const current = detail.data ?? selected
  const isCreator = Boolean(user?.id && current?.createdBy === user.id)
  const create = useCreateAgent(projectId, teamId)
  const update = useUpdateAgent(projectId, teamId)
  const publish = usePublishAgent(projectId, teamId)
  const unpublish = useUnpublishAgent(projectId, teamId)
  const archive = useArchiveAgent(projectId, teamId)

  useEffect(() => {
    if (!agentId && agents[0]) {
      navigate(`?agentId=${encodeURIComponent(agents[0].id)}`, { replace: true })
      return
    }
    if (agentId && !selected) {
      if (agents[0]) navigate(`?agentId=${encodeURIComponent(agents[0].id)}`, { replace: true })
      else navigate(location.pathname, { replace: true })
    }
  }, [agentId, agents, location.pathname, navigate, selected])

  const reload = () => {
    if (project.isError) {
      void project.refetch()
      return
    }
    void list.refetch()
  }

  if (project.isLoading || (!project.isError && !teamId) || list.isLoading) return <div className={styles.page}><div className={styles.empty}><Spin /></div></div>
  if (project.isError || list.isError) return <div className={styles.page}><div className={styles.error}><Alert type="error" showIcon message={agentLoadErrorMessage(project.error ?? list.error)} action={<Button onClick={reload}>重新加载</Button>} /></div></div>

  const invalid = Boolean(agentId && !selected)
  const save = async (values: CreateAgentPayload) => {
    const saved = editing ? await update.mutateAsync({ agentId: editing.id, payload: values }) : await create.mutateAsync(values)
    setOpen(false)
    navigate(`?agentId=${encodeURIComponent(saved.id)}`)
  }
  const beginEdit = () => {
    if (!current || !isCreator || !canPerformAgentAction(current, 'edit') || !detail.data) return
    setEditing(detail.data)
    form.setFieldsValue({ name: detail.data.name, avatar: detail.data.avatar ?? undefined, role: detail.data.role, description: detail.data.description ?? '', prompt: detail.data.prompt ?? '' })
    setOpen(true)
  }

  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.titleRow}><div><Title level={2} className={styles.title}>Agent 团队</Title><Text className={styles.subtitle}>管理团队可见的 Agent，并查看项目内的运行与分配情况。</Text></div></div><div className={styles.headerActions}><Button className={styles.addButton} type="primary" onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ role: 'GENERAL', description: '', prompt: '' }); setOpen(true) }}>添加 Agent</Button></div></header>
    <div className={styles.notice}>Agent 是个人级资源；仓库、基准分支和工作分支由 Task、TaskStep 与 ExecutionContext 决定，不固定绑定在 Agent 上。</div>
    {invalid ? <Alert type="warning" showIcon message="Agent 不存在或当前不可见" /> : null}
    <div className={styles.layout}>
      <main className={styles.listPane} aria-label="Agent 列表">
        {agents.length === 0 ? <div className={styles.empty}>暂无 Agent</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Agent</th><th>类型/角色</th><th>实时状态</th><th>并发上限</th><th>需求群分配</th><th>Workflow 分配</th><th>Skill 访问</th><th>Memory 访问</th></tr></thead><tbody>{agents.map((agent) => <AgentRuntimeRow key={agent.id} projectId={projectId} agent={agent} selected={agent.id === selected?.id} onSelect={() => navigate(`?agentId=${encodeURIComponent(agent.id)}`)} />)}</tbody></table></div>}
        <div className={styles.explanation}>Skill/Memory 共享资源的编辑权限由团队角色控制：TEAM_OWNER 可编辑，TEAM_MEMBER 仅使用。</div>
      </main>
      {current ? <AgentDetailPanel projectId={projectId} agent={current} detail={detail.data} onEdit={beginEdit} canEdit={isCreator && canPerformAgentAction(current, 'edit')} canPublish={isCreator && canPerformAgentAction(current, 'publish')} canUnpublish={isCreator && canPerformAgentAction(current, 'unpublish')} canArchive={isCreator && canPerformAgentAction(current, 'archive')} onPublish={() => publish.mutate({ agentId: current.id }, { onError: () => void detail.refetch() })} onUnpublish={() => unpublish.mutate({ agentId: current.id }, { onError: () => void detail.refetch() })} onArchive={() => archive.mutate({ agentId: current.id }, { onError: () => void detail.refetch() })} /> : <aside className={styles.detailPane}><div className={styles.empty}>{agents.length ? '请选择一个 Agent' : '暂无 Agent'}</div></aside>}
    </div>
    <Modal open={open} title={editing ? '编辑 Agent' : '添加 Agent'} onCancel={() => setOpen(false)} onOk={() => form.submit()}><Form form={form} layout="vertical" onFinish={save}><Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="avatar" label="头像"><Input /></Form.Item><Form.Item name="role" label="角色" rules={[{ required: true }]}><Select options={roles.map((role) => ({ value: role }))} /></Form.Item><Form.Item name="description" label="用途描述" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={3} placeholder="说明该 Agent 适合处理什么任务" /></Form.Item><Form.Item name="prompt" label="Prompt" rules={[{ required: true }]}><Input.TextArea /></Form.Item></Form></Modal>
  </div>
}

function AgentRuntimeRow({ projectId, agent, selected, onSelect }: { projectId: string; agent: AgentSummary; selected: boolean; onSelect: () => void }) {
  const runtime = useAgentRuntime(projectId, agent.id)
  const data = runtime.data
  return <tr className={selected ? styles.selected : ''} onClick={onSelect}>
    <td data-label="Agent"><div className={styles.agentCell}><Avatar className={styles.avatar} src={agent.avatar ?? undefined}>{agent.name.slice(0, 2)}</Avatar><div><div className={styles.agentName}>{agent.name}</div><div className={styles.description}>{agent.description ?? '暂无描述'}</div></div></div></td>
    <td data-label="类型/角色"><Tag className={styles.tag}>{agent.role}</Tag></td>
    <td data-label="实时状态"><Tag className={`${styles.tag} ${data?.status === 'RUNNING' ? styles.statusRunning : styles.statusIdle}`}>{data?.status ?? '—'}</Tag></td>
    <td data-label="并发上限"><span className={styles.stat}>{data ? `${data.activeRunCount}/${data.concurrencyLimit ?? '暂无'}` : '—'}</span></td>
    <td data-label="需求群分配"><span className={styles.stat}>{data ? `${data.assignmentUsage.requirementGroups.assignedCount}/${data.assignmentUsage.requirementGroups.assignableCount}` : '—'}</span></td>
    <td data-label="Workflow 分配"><span className={styles.stat}>{data ? `${data.assignmentUsage.workflows.assignedCount}/${data.assignmentUsage.workflows.assignableCount}` : '—'}</span></td>
    <td data-label="Skill 访问"><span className={styles.muted}>{data?.skillAccessScope ?? '—'}</span></td>
    <td data-label="Memory 访问"><span className={styles.muted}>{data?.memoryAccessScope ?? '—'}</span></td>
  </tr>
}
