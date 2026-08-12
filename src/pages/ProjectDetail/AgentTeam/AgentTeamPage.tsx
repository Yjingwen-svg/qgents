import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Avatar, Button, Form, Input, Modal, Select, Spin, Tag, Typography } from 'antd'
import { CloseOutlined, EditOutlined, InfoCircleOutlined, PlusOutlined, RobotOutlined, SettingOutlined, TeamOutlined, ToolOutlined } from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { projectApi } from '@/api'
import { useAgent, useAgents, useArchiveAgent, useBindAgentSkills, useCreateAgent, useProjectSkillOptions, usePublishAgent, useUnpublishAgent, useUpdateAgent } from '@/hooks'
import type { AgentDetail, AgentDetailTab, AgentRole, AgentSummary, CreateAgentPayload } from '@/types'
import type { AgentPresentation } from '@/types'
import styles from './AgentTeamPage.module.scss'

const { Title, Paragraph, Text } = Typography
const roleLabels: Record<AgentRole, string> = { ORCHESTRATOR: '编排', PLANNER: '规划', DEVELOPER: '开发', TESTER: '测试', REVIEWER: '审查', GENERAL: '通用' }
const tabs: Array<{ key: AgentDetailTab; label: string }> = [
  { key: 'overview', label: '概览' }, { key: 'assignments', label: '分配详情' }, { key: 'config', label: '配置' }, { key: 'capabilities', label: '能力与工具' }, { key: 'runs', label: '运行记录' },
]

function initials(name: string): string { return name.trim().slice(0, 2).toUpperCase() || 'A' }
function statusLabel(status: AgentSummary['availability']): string { return status === 'RUNNING' ? '运行中' : status === 'IDLE' ? '空闲' : '已归档' }
function visibilityLabel(value: AgentSummary['visibility']): string { return value === 'PRIVATE' ? 'PRIVATE' : value === 'TEAM_SHARED' ? 'TEAM_SHARED' : '系统 Agent' }
function message(error: unknown): string { return error instanceof Error ? error.message : '请求失败，请稍后重试。' }
function presentationOf(agent: AgentSummary): AgentPresentation { return agent.presentation ?? { concurrencyLimit: null, requirementUsage: null, workflowUsage: null, skillScope: 'UNKNOWN', memoryScope: 'UNKNOWN', assignmentDetails: [], runningTasks: [], runRecords: [] } }

export function AgentTeamPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<AgentDetailTab>('overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentDetail | null>(null)
  const [form] = Form.useForm<CreateAgentPayload>()
  const projectQuery = useQuery({ queryKey: ['qgents', 'projects', projectId ?? ''], queryFn: () => projectApi.getById(projectId ?? ''), enabled: Boolean(projectId) })
  const teamId = projectQuery.data?.teamId ?? ''
  const agentsQuery = useAgents(teamId)
  const agentId = new URLSearchParams(location.search).get('agentId')
  const agents = useMemo(() => agentsQuery.data?.data ?? [], [agentsQuery.data])
  const selectedSummary = agents.find((agent) => agent.id === agentId) ?? null
  const selectedId = selectedSummary?.id ?? null
  const detailQuery = useAgent(teamId, selectedId)
  const skillsQuery = useProjectSkillOptions(projectId ?? '')
  const createMutation = useCreateAgent(teamId)
  const updateMutation = useUpdateAgent(teamId)
  const publishMutation = usePublishAgent(teamId)
  const unpublishMutation = useUnpublishAgent(teamId)
  const archiveMutation = useArchiveAgent(teamId)
  const bindMutation = useBindAgentSkills(projectId ?? '', teamId)
  const selected = detailQuery.data ?? selectedSummary

  useEffect(() => {
    if (!agentId && agents[0]) navigate(`?agentId=${encodeURIComponent(agents[0].id)}`, { replace: true })
  }, [agentId, agents, navigate])

  const mutationError = [createMutation, updateMutation, publishMutation, unpublishMutation, archiveMutation, bindMutation].find((item) => item.error)?.error
  const openCreate = () => { setEditingAgent(null); form.resetFields(); form.setFieldsValue({ role: 'GENERAL', capabilities: [], prompt: '' }); setModalOpen(true) }
  const openEdit = () => {
    const detail = detailQuery.data
    if (!detail?.permissions.canEdit) return
    setEditingAgent(detail)
    form.setFieldsValue({ name: detail.name, avatar: detail.avatar ?? undefined, role: detail.role, capabilities: detail.capabilities, prompt: detail.prompt ?? '' })
    setModalOpen(true)
  }
  const submitForm = async (values: CreateAgentPayload) => {
    const saved = editingAgent
      ? await updateMutation.mutateAsync({ agentId: editingAgent.id, payload: values })
      : await createMutation.mutateAsync(values)
    navigate(`?agentId=${encodeURIComponent(saved.id)}`)
    setModalOpen(false)
  }
  const selectAgent = (id: string) => navigate(`?agentId=${encodeURIComponent(id)}`)
  const closeDetail = () => navigate({ pathname: location.pathname, search: '' })

  if (!projectId || projectQuery.isPending || agentsQuery.isPending) return <div className={styles.page}><Spin /></div>
  if (projectQuery.isError) return <div className={styles.page}><div className={styles.error}>项目上下文加载失败：{message(projectQuery.error)}</div></div>
  if (agentsQuery.isError) return <div className={styles.page}><div className={styles.error}>Agent 列表加载失败：{message(agentsQuery.error)}</div></div>
  const invalidId = Boolean(agentId && agentsQuery.isSuccess && !selectedSummary)

  return <div className={styles.page}>
    <header className={styles.header}><div><div className={styles.titleRow}><Title level={2} className={styles.title}>Agent 团队</Title><InfoCircleOutlined className={styles.info} /></div><Paragraph className={styles.subtitle}>项目级 Agent 资源池（机器能力集合）</Paragraph></div><div className={styles.headerActions}><Button type="primary" icon={<PlusOutlined />} className={styles.addButton} onClick={openCreate}>添加 Agent</Button><Button type="text" icon={<SettingOutlined />} aria-label="Agent 设置" disabled /></div></header>
    <div className={styles.notice}><TeamOutlined className={styles.noticeIcon} />Agent 是机器能力（技能 + 记忆 + 工具的组合），用于执行任务，不是人类权限角色。</div>
    {mutationError ? <Alert type="error" showIcon message={message(mutationError)} closable /> : null}
    <div className={styles.layout}>
      <main className={styles.listPane}>{invalidId ? <Alert type="warning" showIcon message={`URL 中的 Agent「${agentId}」不存在或当前不可见，未自动切换其他 Agent。`} /> : null}{agents.length === 0 ? <div className={styles.empty}>暂无可见 Agent</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Agent（机器能力）</th><th>类型</th><th>状态</th><th>并发上限</th><th>需求群分配<br />（使用/总）</th><th>工作流分配<br />（使用/总）</th><th>Skill<br />访问范围</th><th>Memory<br />访问范围</th></tr></thead><tbody>{agents.map((agent) => <AgentRow key={agent.id} agent={agent} selected={agent.id === selectedId} onSelect={selectAgent} />)}</tbody></table></div>}<div className={styles.explanation}>说明：并发上限表示该 Agent 同时可处理的任务数量上限。分配数表示当前在需求群聊/工作流中的使用数量。</div></main>
      {selected ? <AgentDetailPane agent={selected} detail={detailQuery.data} activeTab={activeTab} setActiveTab={setActiveTab} onClose={closeDetail} onEdit={openEdit} onPublish={() => publishMutation.mutate({ agentId: selected.id })} onUnpublish={() => unpublishMutation.mutate({ agentId: selected.id })} onArchive={() => archiveMutation.mutate({ agentId: selected.id })} onBind={(skillIds) => bindMutation.mutate({ agentId: selected.id, skillIds })} skillOptions={skillsQuery.data ?? []} /> : <aside className={styles.detailPane}><div className={styles.empty}>选择一个 Agent 查看详情</div></aside>}
    </div>
    <section className={styles.scopeSection}><h2 className={styles.scopeHeading}>项目资源访问范围 <Text type="secondary">（所有 Agent 共享）</Text></h2><div className={styles.scopeGrid}><div className={styles.scopeCard}><strong><ToolOutlined /> Skill（技能/工具）访问范围</strong><p>范围：项目级（当前项目）</p><p>包含：语言能力、框架工具、API 客户端、测试工具、CI/CD 工具等。</p><p>说明：所有 Agent 可按需使用项目级 Skill 资源池。</p></div><div className={styles.scopeCard}><strong><RobotOutlined /> Memory（记忆/知识）访问范围</strong><p>范围：项目级（当前项目）</p><p>包含：需求文档、设计文档、技术规范、历史决策、代码知识等。</p><p>说明：所有 Agent 可按需读取已批准的项目级 Memory。</p></div></div></section>
    <Modal title={editingAgent ? '编辑 Agent' : '添加 Agent'} open={modalOpen} onCancel={() => setModalOpen(false)} okText="保存" cancelText="取消" onOk={() => form.submit()} confirmLoading={createMutation.isPending || updateMutation.isPending}><Form form={form} layout="vertical" onFinish={submitForm}><Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入 Agent 名称' }]}><Input /></Form.Item><Form.Item name="avatar" label="头像"><Input placeholder="头像 URL（可选）" /></Form.Item><Form.Item name="role" label="角色" rules={[{ required: true }]}><Select options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))} /></Form.Item><Form.Item name="capabilities" label="能力" rules={[{ required: true, message: '至少填写一项能力' }]}><Select mode="tags" placeholder="输入能力后回车" /></Form.Item><Form.Item name="prompt" label="Prompt" rules={[{ required: true, message: '请输入 Prompt' }]}><Input.TextArea rows={5} /></Form.Item></Form></Modal>
  </div>
}

function AgentRow({ agent, selected, onSelect }: { agent: AgentSummary; selected: boolean; onSelect: (id: string) => void }) {
  const p = presentationOf(agent)
  const statusClass = agent.availability === 'RUNNING' ? styles.statusRunning : agent.availability === 'IDLE' ? styles.statusIdle : styles.statusArchived
  return <tr className={selected ? styles.selected : undefined} onClick={() => onSelect(agent.id)}><td><div className={styles.agentCell}><Avatar src={agent.avatar ?? undefined} className={styles.avatar}>{initials(agent.name)}</Avatar><div><div className={styles.agentName}>{agent.name}</div><div className={styles.description}>{agent.description ?? agent.capabilities.join(' / ')}</div></div></div></td><td data-label="类型"><Tag className={styles.tag}>{roleLabels[agent.role]}</Tag></td><td data-label="状态"><Tag className={`${styles.status} ${statusClass}`}>{statusLabel(agent.availability)}</Tag></td><td data-label="并发上限" className={styles.stat}>{p.concurrencyLimit ?? '暂无'}</td><td data-label="需求群分配" className={styles.stat}>{p.requirementUsage ? `${p.requirementUsage.used}/${p.requirementUsage.total}` : '暂无'}</td><td data-label="工作流分配" className={styles.stat}>{p.workflowUsage ? `${p.workflowUsage.used}/${p.workflowUsage.total}` : '暂无'}</td><td data-label="Skill 访问范围">{p.skillScope === 'UNKNOWN' ? '暂无' : `${p.skillScope}级`}</td><td data-label="Memory 访问范围">{p.memoryScope === 'UNKNOWN' ? '暂无' : `${p.memoryScope}级`}</td></tr>
}

function AgentDetailPane({ agent, detail, activeTab, setActiveTab, onClose, onEdit, onPublish, onUnpublish, onArchive, onBind, skillOptions }: { agent: AgentSummary; detail?: AgentDetail; activeTab: AgentDetailTab; setActiveTab: (tab: AgentDetailTab) => void; onClose: () => void; onEdit: () => void; onPublish: () => void; onUnpublish: () => void; onArchive: () => void; onBind: (ids: string[]) => void; skillOptions: Array<{ id: string; name: string; scope: 'PROJECT' | 'TEAM' | 'PRIVATE'; available: boolean }> }) {
  const current = detail ?? agent
  const p = presentationOf(current)
  const [skillIds, setSkillIds] = useState<string[]>(detail?.skillBindings?.map((skill) => skill.skillId) ?? [])
  const canEdit = current.permissions.canEdit
  return <aside className={styles.detailPane}><div className={styles.detailHeader}><div className={styles.detailTitle}><Avatar src={current.avatar ?? undefined} className={styles.avatar}>{initials(current.name)}</Avatar><span className={styles.detailName}>{current.name}</span><Tag className={`${styles.status} ${current.availability === 'RUNNING' ? styles.statusRunning : current.availability === 'IDLE' ? styles.statusIdle : styles.statusArchived}`}>{statusLabel(current.availability)}</Tag></div><Button className={styles.detailClose} type="text" icon={<CloseOutlined />} aria-label="关闭详情" onClick={onClose} /></div><nav className={styles.tabs}>{tabs.map((tab) => <button type="button" key={tab.key} className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}</nav><div className={styles.detailBody}>{activeTab === 'overview' ? <><div className={styles.actionRow}>{canEdit ? <Button icon={<EditOutlined />} onClick={onEdit}>编辑</Button> : null}{current.permissions.canPublish && current.visibility === 'PRIVATE' ? <Button type="primary" onClick={onPublish}>发布为 TEAM_SHARED</Button> : null}{current.permissions.canUnpublish && current.visibility === 'TEAM_SHARED' ? <Button onClick={onUnpublish}>取消发布</Button> : null}{current.permissions.canArchive && current.availability !== 'ARCHIVED' ? <Button danger onClick={onArchive}>归档</Button> : null}</div><h3 className={styles.sectionTitle}>Agent 信息</h3><dl className={styles.infoGrid}><dt>名称</dt><dd>{current.name}</dd><dt>类型</dt><dd><Tag>{roleLabels[current.role]}</Tag></dd><dt>描述</dt><dd className={styles.descriptionText}>{current.description ?? current.capabilities.join(' / ')}</dd><dt>可见性</dt><dd>{visibilityLabel(current.visibility)}</dd><dt>并发上限</dt><dd>{p.concurrencyLimit ?? '暂无正式接口字段'}</dd></dl><div className={styles.usageCard}><h3 className={styles.sectionTitle}>当前使用情况</h3><div className={styles.usageGrid}><div><div className={styles.usageLabel}>需求群聊</div><div className={styles.usageValue}>{p.requirementUsage ? `${p.requirementUsage.used}/${p.requirementUsage.total}` : '暂无'}</div></div><div><div className={styles.usageLabel}>工作流</div><div className={styles.usageValue}>{p.workflowUsage ? `${p.workflowUsage.used}/${p.workflowUsage.total}` : '暂无'}</div></div><div><div className={styles.usageLabel}>状态</div><div className={`${styles.usageValue} ${styles.success}`}>{statusLabel(current.availability)}</div></div></div></div><div className={styles.detailCard}><h3 className={styles.sectionTitle}>能力与工具</h3>{current.capabilities.map((capability) => <Tag key={capability}>{capability}</Tag>)}<p className={styles.descriptionText}>{current.permissions.canViewPrivateConfig ? `Prompt：${detail?.prompt ?? '暂无'}` : 'Prompt 为私有配置，当前用户无权查看。'}</p></div></> : activeTab === 'assignments' ? <div className={styles.detailCard}><h3 className={styles.sectionTitle}>分配详情</h3>{p.assignmentDetails.length ? <ul className={styles.detailList}>{p.assignmentDetails.map((item) => <li key={item}>{item}</li>)}</ul> : <div className={styles.tabsEmpty}>暂无正式分配详情接口数据</div>}</div> : activeTab === 'config' ? <div className={styles.detailCard}><h3 className={styles.sectionTitle}>配置</h3>{current.permissions.canViewPrivateConfig && detail?.config ? <ul className={styles.detailList}>{Object.entries(detail.config).map(([key, value]) => <li key={key}>{key}：{String(value ?? '暂无')}</li>)}</ul> : <div className={styles.tabsEmpty}>配置仅对创建者开放，当前用户不可查看。</div>}</div> : activeTab === 'capabilities' ? <div className={styles.detailCard}><h3 className={styles.sectionTitle}>能力与工具</h3><p className={styles.descriptionText}>{current.capabilities.join('、') || '暂无能力信息'}</p>{current.permissions.canBindSkills ? <><Select mode="multiple" value={skillIds} onChange={setSkillIds} options={skillOptions.filter((skill) => skill.available).map((skill) => ({ value: skill.id, label: `${skill.name}（${skill.scope}）` }))} placeholder="选择项目可用 Skill" style={{ width: '100%' }} /><Button style={{ marginTop: 12 }} onClick={() => onBind(skillIds)}>保存绑定</Button></> : <div className={styles.tabsEmpty}>当前用户无权绑定项目 Skill。</div>}</div> : <div className={styles.detailCard}><h3 className={styles.sectionTitle}>运行记录</h3>{p.runRecords.length ? <ul className={styles.detailList}>{p.runRecords.map((run) => <li key={run.id}>{run.title} · {run.status}</li>)}</ul> : <div className={styles.tabsEmpty}>暂无运行记录接口数据</div>}</div>}</div></aside>
}
