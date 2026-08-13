import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Alert, Avatar, Button, Card, Empty, Select, Spin, Tag, Typography } from 'antd'
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  RightOutlined,
  RobotOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { agentApi, projectApi } from '@/api'
import { useAgents } from '@/hooks/agents'
import { useInfiniteTasks, useTask, useTaskRuns, useTaskSteps } from '@/hooks/task-model'
import { queryKeys } from '@/query'
import type { AgentDetail, AgentSummary } from '@/types'
import type { Task, TaskRunSummary, TaskStep } from '@/types/task-model'
import { buildWorkflowGraph, type WorkflowGraphNode } from './runtime'
import { mapTaskRunStatus, mapTaskStepStatus, type WorkflowDisplayStatus, workflowStatusLabels } from './status'
import styles from './WorkflowViewerPage.module.scss'

const { Title, Text, Paragraph } = Typography
const EMPTY_TASK_STEPS: TaskStep[] = []
const EMPTY_TASK_RUNS: TaskRunSummary[] = []

const statusIcons: Record<WorkflowDisplayStatus, React.ReactNode> = {
  NOT_STARTED: <ClockCircleOutlined />,
  PLANNING: <ApartmentOutlined />,
  QUEUED: <ClockCircleOutlined />,
  RUNNING: <ApartmentOutlined spin />,
  WAITING_INPUT: <InfoCircleOutlined />,
  WAITING_APPROVAL: <WarningOutlined />,
  COMPLETED: <CheckCircleOutlined />,
  FAILED: <CloseCircleOutlined />,
  CANCELLED: <CloseCircleOutlined />,
  SKIPPED: <RightOutlined />,
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败，请稍后重试。'
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '暂无'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || 'A'
}

function StatusTag({ status }: { status: WorkflowDisplayStatus }) {
  return <Tag className={`${styles.statusTag} ${styles[`status_${status}`]}`} icon={statusIcons[status]}>{workflowStatusLabels[status]}</Tag>
}

function EmptyValue({ children = '暂无' }: { children?: string }) {
  return <span className={styles.emptyValue}>{children}</span>
}

function taskStatus(task: Task): WorkflowDisplayStatus {
  switch (task.status) {
    case 'PLANNING': return 'PLANNING'
    case 'PENDING': return 'QUEUED'
    case 'RUNNING': return 'RUNNING'
    case 'SUCCEEDED': return 'COMPLETED'
    case 'FAILED': return 'FAILED'
    case 'CANCELLING': return 'CANCELLED'
    case 'CANCELLED': return 'CANCELLED'
  }
}

function nodeStatus(node: WorkflowGraphNode): WorkflowDisplayStatus {
  return node.latestRun ? mapTaskRunStatus(node.latestRun.status) : mapTaskStepStatus(node.step.status)
}

function agentName(agent: AgentSummary | undefined, agentId: string | null): string {
  return agent?.name ?? (agentId ? agentId : '暂无 Agent')
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className={styles.detailRow}><span className={styles.detailLabel}>{label}</span><span className={styles.detailValue}>{children}</span></div>
}

function NodeCard({
  node,
  agent,
  selected,
  onSelect,
  onRunSelect,
}: {
  node: WorkflowGraphNode
  agent: AgentSummary | undefined
  selected: boolean
  onSelect: () => void
  onRunSelect: (run: TaskRunSummary) => void
}) {
  const status = nodeStatus(node)
  return (
    <div className={`${styles.nodeGroup} ${selected ? styles.nodeSelectedGroup : ''}`}>
      <button type="button" className={`${styles.nodeButton} ${selected ? styles.nodeSelected : ''}`} onClick={onSelect}>
        <div className={styles.nodeTopline}><span className={styles.nodeIcon}><RobotOutlined /></span><span className={styles.nodeKind}>TaskStep</span></div>
        <span className={styles.nodeLabel}>{node.step.role}</span>
        <span className={styles.nodeAgent}>{agentName(agent, node.step.agentId)}</span>
        <span className={styles.nodeStatus}><StatusTag status={status} /></span>
        <span className={styles.nodeMeta}>{node.runs.length} 次运行</span>
      </button>
      {node.runs.length > 0 ? <div className={styles.runHistory} aria-label={`${node.step.id} 运行历史`}>
        {node.runs.map((run) => <Button key={run.id} type="link" size="small" onClick={() => onRunSelect(run)}>{run.id} · {workflowStatusLabels[mapTaskRunStatus(run.status)]}</Button>)}
      </div> : null}
    </div>
  )
}

function NodeDetail({ node, agent, agentDetail, projectId, taskId, onRunSelect }: {
  node: WorkflowGraphNode
  agent: AgentSummary | undefined
  agentDetail: AgentDetail | undefined
  projectId: string
  taskId: string
  onRunSelect: (run: TaskRunSummary) => void
}) {
  const navigate = useNavigate()
  const status = nodeStatus(node)
  return (
    <aside className={styles.detailPane} aria-label="TaskStep 详情">
      <div className={styles.detailHeading}><div><Text className={styles.detailEyebrow}>TaskStep</Text><Title level={4} className={styles.detailTitle}>{node.step.role}</Title></div><StatusTag status={status} /></div>
      <Paragraph className={styles.detailDescription}>{node.step.acceptanceNotes ?? '暂无验收说明'}</Paragraph>
      <div className={styles.detailSection}>
        <DetailRow label="TaskStep ID">{node.step.id}</DetailRow>
        <DetailRow label="Agent">{agent ? <span className={styles.agentValue}><Avatar size={24}>{initials(agent.name)}</Avatar>{agent.name}</span> : <EmptyValue>{node.step.agentId ?? '暂无 Agent'}</EmptyValue>}</DetailRow>
        <DetailRow label="Skill">{agentDetail?.skillBindings?.length ? agentDetail.skillBindings.map((skill) => skill.name).join('、') : <EmptyValue>暂无 Skill</EmptyValue>}</DetailRow>
        <DetailRow label="依赖">{node.step.dependencies.length ? node.step.dependencies.join('、') : <EmptyValue>无依赖</EmptyValue>}</DetailRow>
        <DetailRow label="仓库">{node.step.repositoryId ?? <EmptyValue />}</DetailRow>
        <DetailRow label="Testset">{node.step.testsetIds.length ? node.step.testsetIds.join('、') : <EmptyValue>暂无 Testset</EmptyValue>}</DetailRow>
        <DetailRow label="运行次数">{node.runs.length}</DetailRow>
      </div>
      {node.missingDependencyIds.length ? <Alert className={styles.detailAlert} type="warning" showIcon message={`缺失依赖：${node.missingDependencyIds.join('、')}`} /> : null}
      {node.runs.length ? <div className={styles.historyList}><Text strong>运行历史</Text>{node.runs.map((run) => <Button key={run.id} type="link" onClick={() => onRunSelect(run)}>{run.id} · {workflowStatusLabels[mapTaskRunStatus(run.status)]} · {formatTime(run.createdAt)}</Button>)}</div> : <Alert className={styles.detailAlert} type="info" showIcon message="尚未运行" />}
      {node.latestRun ? <button type="button" className={styles.executionLink} onClick={() => navigate(`/app/projects/${projectId}/tasks/${taskId}/executions/${node.latestRun?.id}`)}><FileSearchOutlined /> 查看最新执行详情</button> : null}
    </aside>
  )
}

export function WorkflowViewerPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const taskId = new URLSearchParams(location.search).get('taskId')?.trim() ?? ''
  const projectQuery = useQuery({ queryKey: queryKeys.projects(projectId), queryFn: () => projectApi.getById(projectId), enabled: Boolean(projectId) })
  const tasksQuery = useInfiniteTasks(projectId, { limit: 20 })
  const taskQuery = useTask(projectId, taskId)
  const stepsQuery = useTaskSteps(projectId, taskId)
  const runsQuery = useTaskRuns(projectId, taskId)
  const tasks = useMemo(() => tasksQuery.data?.pages.flatMap((page) => page.data) ?? [], [tasksQuery.data])
  const selectedTask = taskQuery.data
  const steps = stepsQuery.data?.data ?? EMPTY_TASK_STEPS
  const runs = runsQuery.data?.data ?? EMPTY_TASK_RUNS
  const graph = useMemo(() => buildWorkflowGraph(steps, runs), [steps, runs])
  const [selectedStepId, setSelectedStepId] = useState('')
  useEffect(() => { setSelectedStepId(graph.nodes[0]?.step.id ?? '') }, [taskId, graph.nodes])
  const selectedNode = graph.nodes.find((node) => node.step.id === selectedStepId) ?? graph.nodes[0]
  const graphLevels = useMemo(() => {
    const levels = new Map<number, WorkflowGraphNode[]>()
    for (const node of graph.nodes) levels.set(node.level, [...(levels.get(node.level) ?? []), node])
    return [...levels.entries()].sort(([left], [right]) => left - right).map(([, nodes]) => nodes)
  }, [graph.nodes])
  const agentsQuery = useAgents(projectQuery.data?.teamId ?? '')
  const agents = agentsQuery.data?.data ?? []
  const agentIds = useMemo(() => [...new Set(steps.map((step) => step.agentId).filter((id): id is string => Boolean(id)))], [steps])
  const agentDetails = useQueries({ queries: agentIds.map((agentId) => ({ queryKey: queryKeys.agents.detail(projectQuery.data?.teamId ?? '', agentId), queryFn: () => agentApi.get(projectQuery.data?.teamId ?? '', agentId), enabled: Boolean(projectQuery.data?.teamId) })) })
  const agentDetailById = new Map(agentIds.map((agentId, index) => [agentId, agentDetails[index]?.data]))

  function selectTask(nextTaskId: string | undefined) {
    const search = nextTaskId ? `?taskId=${encodeURIComponent(nextTaskId)}` : ''
    navigate({ pathname: location.pathname, search })
  }

  function selectRun(run: TaskRunSummary) {
    navigate(`/app/projects/${projectId}/tasks/${run.taskId}/executions/${run.id}`)
  }

  if (!projectId) return <div className={styles.page}><Alert type="error" showIcon message="缺少项目上下文，无法加载工作流。" /></div>
  if (projectQuery.isPending || tasksQuery.isPending) return <div className={styles.loading}><Spin /></div>
  if (projectQuery.isError) return <div className={styles.page}><Alert type="error" showIcon message={`项目上下文加载失败：${messageOf(projectQuery.error)}`} /></div>

  return <main className={styles.page}>
    <header className={styles.header}><div><div className={styles.titleLine}><ApartmentOutlined /><Title level={2} className={styles.title}>工作流查看</Title><Tag color="blue">只读</Tag></div><Paragraph className={styles.subtitle}>{selectedTask?.title ?? '选择一个任务查看实际执行计划'}</Paragraph></div></header>
    <Card className={styles.runBar} variant="borderless"><div className={styles.runLabel}><CodeOutlined /><span>任务</span></div><Select className={styles.runSelect} placeholder="选择任务" allowClear value={taskId || undefined} onChange={selectTask} options={tasks.map((task) => ({ value: task.id, label: `${task.title} · ${task.id}` }))} /><span className={styles.runHint}>{selectedTask ? <StatusTag status={taskStatus(selectedTask)} /> : '未选择任务'}</span></Card>
    {tasksQuery.isError ? <Alert className={styles.alert} type="error" showIcon message={`任务列表加载失败：${messageOf(tasksQuery.error)}`} /> : null}
    {taskId && taskQuery.isError ? <Alert className={styles.alert} type="warning" showIcon message="任务不存在或当前用户无权访问。" /> : null}
    {taskId && taskQuery.isPending ? <div className={styles.inlineLoading}><Spin size="small" /> 正在加载任务…</div> : null}
    {!taskId ? <div className={styles.emptyRun}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择一个任务查看实际执行计划" /></div> : null}
    {taskId && taskQuery.data ? <>
      {stepsQuery.isError ? <Alert className={styles.alert} type="warning" showIcon message={`TaskStep 加载失败：${messageOf(stepsQuery.error)}`} /> : null}
      {runsQuery.isError ? <Alert className={styles.alert} type="warning" showIcon message={`TaskRun 加载失败：${messageOf(runsQuery.error)}`} /> : null}
      {graph.cycleNodeIds.length ? <Alert className={styles.alert} type="warning" showIcon message={`检测到循环依赖：${graph.cycleNodeIds.join('、')}`} /> : null}
      {agentsQuery.isError ? <Alert className={styles.alert} type="warning" showIcon message="Agent 摘要加载失败，仍显示 Agent ID。" /> : null}
      <section className={styles.workflowLayout}>
        <div className={styles.canvasPane}>
          {steps.length === 0 ? <div className={styles.emptyRun}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该任务暂无 TaskStep" /></div> : <div className={styles.flowScroll}><div className={styles.flowLevels}>{graphLevels.map((level, levelIndex) => <div className={styles.flowLevelWrap} key={`level-${levelIndex}`}><div className={styles.flowLevel}>{level.map((node) => <div className={styles.flowItem} key={node.step.id}><NodeCard node={node} agent={agents.find((agent) => agent.id === node.step.agentId)} selected={selectedNode?.step.id === node.step.id} onSelect={() => setSelectedStepId(node.step.id)} onRunSelect={selectRun} /></div>)}</div>{levelIndex < graphLevels.length - 1 ? <span className={styles.connector} aria-hidden="true"><RightOutlined /></span> : null}</div>)}</div></div>}
          {selectedTask ? <div className={styles.runSummary}><span><InfoCircleOutlined /> 任务需求</span><Text ellipsis={{ tooltip: selectedTask.requirement }}>{selectedTask.requirement}</Text></div> : null}
        </div>
        {selectedNode ? <NodeDetail node={selectedNode} agent={agents.find((agent) => agent.id === selectedNode.step.agentId)} agentDetail={agentDetailById.get(selectedNode.step.agentId ?? '')} projectId={projectId} taskId={taskId} onRunSelect={selectRun} /> : null}
      </section>
    </> : null}
  </main>
}
