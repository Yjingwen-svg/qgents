import { useState } from 'react'
import { Alert, Avatar, Button, Empty, Spin, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAgentAssignments, useAgentSkillBindings, useAgentTaskRuns } from '@/hooks'
import type { AgentAssignmentSummary, AgentDetail, AgentDetailTab, AgentSummary, AgentTaskRunSummary } from '@/types'
import { PATHS } from '@/routes/paths'
import styles from './AgentDetailPanel.module.scss'

const { Text, Title } = Typography

const tabs: Array<{ key: AgentDetailTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'assignments', label: '分配详情' },
  { key: 'config', label: '配置' },
  { key: 'capabilities', label: '能力与工具' },
  { key: 'runs', label: '运行记录' },
]

interface AgentDetailPanelProps {
  projectId: string
  agent: AgentDetail | AgentSummary
  detail?: AgentDetail
  onEdit: () => void
  canEdit: boolean
  onPublish: () => void
  onUnpublish: () => void
  onArchive: () => void
  canPublish: boolean
  canUnpublish: boolean
  canArchive: boolean
}

export function AgentDetailPanel({ projectId, agent, detail, onEdit, canEdit, onPublish, onUnpublish, onArchive, canPublish, canUnpublish, canArchive }: AgentDetailPanelProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<AgentDetailTab>('overview')
  const current = detail ?? agent
  const assignmentsGroups = useAgentAssignments(projectId, current.id, 'REQUIREMENT_GROUP', activeTab === 'assignments')
  const assignmentsWorkflows = useAgentAssignments(projectId, current.id, 'WORKFLOW', activeTab === 'assignments')
  const runs = useAgentTaskRuns(projectId, current.id, undefined, activeTab === 'overview' || activeTab === 'runs')
  const skills = useAgentSkillBindings(projectId, current.id, activeTab === 'capabilities')
  const runtime = current.runtime
  const task = runs.data?.data.find((item) => ['QUEUED', 'RUNNING', 'WAITING_INPUT', 'WAITING_APPROVAL', 'BLOCKED', 'CANCELLING'].includes(item.status))

  return <aside className={styles.panel}>
    <header className={styles.header}>
      <div className={styles.identity}>
        <Avatar className={styles.avatar} src={current.avatar ?? undefined}>{current.name.slice(0, 2)}</Avatar>
        <div className={styles.identityText}><Title level={4} className={styles.name}>{current.name}</Title><Text type="secondary">{current.role}</Text></div>
      </div>
      <div className={styles.actions}>{canEdit ? <Button size="small" onClick={onEdit}>编辑</Button> : null}{canPublish ? <Button size="small" onClick={onPublish}>发布为 TEAM</Button> : null}{canUnpublish ? <Button size="small" onClick={onUnpublish}>取消发布</Button> : null}{canArchive ? <Button size="small" danger onClick={onArchive}>归档</Button> : null}</div>
    </header>
    <nav className={styles.tabs} aria-label="Agent 详情 Tab">
      {tabs.map((tab) => <button type="button" key={tab.key} className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
    </nav>
    <div className={styles.body}>
      {activeTab === 'overview' ? <Overview agent={current} runtime={runtime} task={task} /> : null}
      {activeTab === 'assignments' ? <Assignments groups={assignmentsGroups} workflows={assignmentsWorkflows} /> : null}
      {activeTab === 'config' ? <Config agent={current} /> : null}
      {activeTab === 'capabilities' ? <Capabilities agent={current} skills={skills} /> : null}
      {activeTab === 'runs' ? <Runs projectId={projectId} query={runs} navigate={navigate} /> : null}
    </div>
  </aside>
}

function Overview({ agent, runtime, task }: { agent: AgentDetail | AgentSummary; runtime: AgentSummary['runtime']; task?: AgentTaskRunSummary }) {
  return <div>
    <section className={styles.section}><Text className={styles.description}>{agent.description ?? '暂无描述'}</Text></section>
    <section className={styles.usageGrid} aria-label="Agent 运行使用量">
      <Usage label="实时状态" value={runtime.status} />
      <Usage label="并发使用量" value={`${runtime.activeRunCount}/${runtime.concurrencyLimit ?? '暂无'}`} />
      <Usage label="需求群分配" value={`${runtime.assignmentUsage.requirementGroups.assignedCount}/${runtime.assignmentUsage.requirementGroups.assignableCount}`} />
      <Usage label="Workflow 分配" value={`${runtime.assignmentUsage.workflows.assignedCount}/${runtime.assignmentUsage.workflows.assignableCount}`} />
    </section>
    <section className={styles.section}><Title level={5}>当前正在执行的 TaskRun</Title>{task ? <TaskRunSummaryCard run={task} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有正在执行的 TaskRun" />}</section>
  </div>
}

function Usage({ label, value }: { label: string; value: string }) { return <div className={styles.usage}><Text type="secondary">{label}</Text><strong>{value}</strong></div> }

function Assignments({ groups, workflows }: { groups: ReturnType<typeof useAgentAssignments>; workflows: ReturnType<typeof useAgentAssignments> }) {
  return <div className={styles.assignmentColumns}><AssignmentList title="已分配需求群" query={groups} /><AssignmentList title="已分配 Workflow" query={workflows} /></div>
}

function AssignmentList({ title, query }: { title: string; query: ReturnType<typeof useAgentAssignments> }) {
  if (query.isLoading) return <section className={styles.card}><Title level={5}>{title}</Title><Spin size="small" /></section>
  if (query.isError) return <section className={styles.card}><Title level={5}>{title}</Title><Alert type="error" showIcon message="分配详情加载失败" /></section>
  const items = query.data?.data ?? []
  return <section className={styles.card}><Title level={5}>{title}</Title>{items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分配" /> : <ul className={styles.list}>{items.map((item) => <AssignmentItem key={item.resourceId} item={item} />)}</ul>}</section>
}

function AssignmentItem({ item }: { item: AgentAssignmentSummary }) { return <li><span>{item.resourceName}</span><Tag>{item.status}</Tag></li> }

function Config({ agent }: { agent: AgentDetail | AgentSummary }) {
  return <section className={styles.card}><Title level={5}>现有配置</Title><dl className={styles.definition}><dt>可见性</dt><dd>{agent.visibility}</dd><dt>生命周期</dt><dd>{agent.status}</dd><dt>Prompt</dt><dd>{'prompt' in agent && agent.prompt ? agent.prompt : '未提供或无权限查看'}</dd></dl><Text type="secondary">当前保留自定义 Agent 入口与原有配置内容，本轮不新增保存字段。</Text></section>
}

function Capabilities({ agent, skills }: { agent: AgentDetail | AgentSummary; skills: ReturnType<typeof useAgentSkillBindings> }) {
  const tools = 'tools' in agent ? agent.tools ?? [] : []
  const memory = 'memoryAccess' in agent ? agent.memoryAccess ?? [] : []
  return <div><section className={styles.card}><Title level={5}>Agent capabilities</Title>{agent.capabilities.length ? <div className={styles.tags}>{agent.capabilities.map((item) => <Tag key={item}>{item}</Tag>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无能力数据" />}</section><section className={styles.card}><Title level={5}>已绑定 Skill</Title>{skills.isLoading ? <Spin size="small" /> : skills.isError ? <Alert type="error" showIcon message="Skill 数据加载失败" /> : skills.data?.skills.length ? <div className={styles.tags}>{skills.data.skills.map((skill) => <Tag key={skill.id}>{skill.name}</Tag>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Skill" />}</section><section className={styles.card}><Title level={5}>可用 Memory 范围</Title>{memory.length ? <ul className={styles.list}>{memory.map((item) => <li key={item}>{item}</li>)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Memory 范围数据" />}</section><section className={styles.card}><Title level={5}>工具摘要</Title>{tools.length ? <ul className={styles.list}>{tools.map((item) => <li key={item}>{item}</li>)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无正式工具信息" />}</section><Text type="secondary">TEAM_OWNER 可编辑共享 Skill/Memory；TEAM_MEMBER 仅使用。</Text></div>
}

function Runs({ projectId, query, navigate }: { projectId: string; query: ReturnType<typeof useAgentTaskRuns>; navigate: ReturnType<typeof useNavigate> }) {
  if (query.isLoading) return <Spin />
  if (query.isError) return <Alert type="error" showIcon message="运行记录加载失败" />
  const runs = query.data?.data ?? []
  if (runs.length === 0) return <Empty description="暂无运行记录" />
  return <div className={styles.runList}>{runs.map((run) => <button type="button" className={styles.runItem} key={run.id} onClick={() => navigate(PATHS.projectTaskRunDetail(projectId, run.taskId, run.id))}><div className={styles.runHeader}><strong>{run.task.displayCode ?? run.task.id}</strong><Tag>{run.status}</Tag></div><Text>{run.task.title}</Text><Text type="secondary">{run.taskStep.title} · {run.requirementGroup.name}</Text><Text type="secondary">{run.repository?.displayName ?? '暂无仓库'} · {formatDate(run.startedAt ?? run.createdAt)}</Text>{run.statusReason ? <Text type="secondary">{run.statusReason.summary}</Text> : null}</button>)}</div>
}

function TaskRunSummaryCard({ run }: { run: AgentTaskRunSummary }) { return <div className={styles.taskCard}><div><Text strong>{run.task.displayCode ?? run.task.id}</Text><Text> · {run.task.title}</Text></div><Text type="secondary">TaskStep：{run.taskStep.title}</Text><Text type="secondary">需求群：{run.requirementGroup.name}</Text><Text type="secondary">仓库：{run.repository?.displayName ?? '暂无仓库'}</Text><Tag>{run.status}</Tag><Text type="secondary">开始：{formatDate(run.startedAt)}</Text></div> }

function formatDate(value: string | null): string { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚未开始' }
