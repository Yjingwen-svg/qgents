import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Avatar, Card, Empty, Select, Spin, Tag, Typography } from 'antd'
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
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { projectApi } from '@/api'
import { useAgents, useWorkflowRuntime } from '@/hooks'
import { queryKeys } from '@/query'
import { PATHS } from '@/routes/paths'
import type { AgentSummary, WorkflowDisplayStatus, WorkflowNodeRuntime } from '@/types'
import { agentForRuntime, buildWorkflowNodeRuntime } from './runtime'
import { mapRunStatus, workflowStatusLabels } from './status'
import { DEFAULT_WORKFLOW_DEFINITION } from './workflowDefinition'
import styles from './WorkflowViewerPage.module.scss'

const { Title, Text, Paragraph } = Typography

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

function formatTime(value: string | null): string {
  if (!value) return '暂无'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || 'A'
}

function runLabel(run: { id: string; instruction: string; createdAt: string }): string {
  const title = run.instruction.trim() || '未命名运行'
  return `${title} · ${formatTime(run.createdAt)}`
}

function StatusTag({ status }: { status: WorkflowDisplayStatus }) {
  return (
    <Tag className={`${styles.statusTag} ${styles[`status_${status}`]}`} icon={statusIcons[status]}>
      {workflowStatusLabels[status]}
    </Tag>
  )
}

function EmptyValue({ children = '暂无数据' }: { children?: string }) {
  return <span className={styles.emptyValue}>{children}</span>
}

function NodeCard({
  node,
  runtime,
  agent,
  selected,
  onSelect,
}: {
  node: typeof DEFAULT_WORKFLOW_DEFINITION.nodes[number]
  runtime: WorkflowNodeRuntime
  agent: AgentSummary | null
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button type="button" className={`${styles.nodeButton} ${selected ? styles.nodeSelected : ''}`} onClick={onSelect}>
      <div className={styles.nodeTopline}>
        <span className={`${styles.nodeIcon} ${node.kind === 'GATE' ? styles.gateIcon : ''}`}>
          {node.kind === 'GATE' ? <SafetyCertificateOutlined /> : <RobotOutlined />}
        </span>
        <span className={styles.nodeKind}>{node.kind === 'GATE' ? '门禁' : 'Agent 节点'}</span>
      </div>
      <span className={styles.nodeLabel}>{node.label}</span>
      <span className={styles.nodeAgent}>
        {node.kind === 'GATE' ? '基于运行结果汇总' : agent?.name ?? '暂无 Agent'}
      </span>
      <span className={styles.nodeStatus}><StatusTag status={runtime.status} /></span>
    </button>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className={styles.detailRow}><span className={styles.detailLabel}>{label}</span><span className={styles.detailValue}>{children}</span></div>
}

function NodeDetail({
  node,
  runtime,
  agent,
  projectId,
  runId,
}: {
  node: typeof DEFAULT_WORKFLOW_DEFINITION.nodes[number]
  runtime: WorkflowNodeRuntime
  agent: AgentSummary | null
  projectId: string
  runId: string | null
}) {
  const navigate = useNavigate()
  const taskRun = runtime.taskRun
  return (
    <aside className={styles.detailPane} aria-label="节点详情">
      <div className={styles.detailHeading}>
        <div>
          <Text className={styles.detailEyebrow}>{node.kind === 'GATE' ? '门禁汇总' : 'Agent 节点'}</Text>
          <Title level={4} className={styles.detailTitle}>{node.label}</Title>
        </div>
        <StatusTag status={runtime.status} />
      </div>
      <Paragraph className={styles.detailDescription}>{node.description}</Paragraph>
      <div className={styles.detailSection}>
        <DetailRow label="实际 Agent">{agent ? <span className={styles.agentValue}><Avatar size={24}>{initials(agent.name)}</Avatar>{agent.name}</span> : <EmptyValue />}</DetailRow>
        <DetailRow label="当前步骤">{runtime.currentStep ?? <EmptyValue />}</DetailRow>
        <DetailRow label="Skill">{runtime.skillNames.length ? runtime.skillNames.join('、') : <EmptyValue>暂无 Skill</EmptyValue>}</DetailRow>
        <DetailRow label="Testset">{runtime.testsetNames.length ? runtime.testsetNames.join('、') : <EmptyValue>暂无 Testset</EmptyValue>}</DetailRow>
        <DetailRow label="开始时间">{formatTime(runtime.startedAt)}</DetailRow>
        <DetailRow label="结束时间">{formatTime(runtime.finishedAt)}</DetailRow>
      </div>
      {runtime.errorMessage ? <Alert type="error" showIcon message={runtime.errorMessage} /> : null}
      {runtime.waitingMessage ? <Alert className={styles.detailAlert} type="warning" showIcon message={runtime.waitingMessage} /> : null}
      {node.kind === 'GATE' && !runId ? <Empty description="选择运行实例后显示门禁结果" /> : null}
      {taskRun && runId ? (
        <button
          type="button"
          className={styles.executionLink}
          onClick={() => navigate(PATHS.projectTaskRunDetail(projectId, runId, taskRun.id))}
        >
          <FileSearchOutlined /> 查看单次执行详情
        </button>
      ) : null}
    </aside>
  )
}

export function WorkflowViewerPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const runId = new URLSearchParams(location.search).get('runId')
  const [selectedNodeId, setSelectedNodeId] = useState(DEFAULT_WORKFLOW_DEFINITION.nodes[0]?.id ?? '')
  const projectQuery = useQuery({
    queryKey: queryKeys.projects(projectId),
    queryFn: () => projectApi.getById(projectId),
    enabled: Boolean(projectId),
  })
  const workflow = useWorkflowRuntime(projectId, runId)
  const agentsQuery = useAgents(projectQuery.data?.teamId ?? '')
  const agents = agentsQuery.data?.data ?? []
  const runs = workflow.runsQuery.data?.data ?? []
  const selectedRun = workflow.data.run
  const invalidRunId = Boolean(runId && workflow.runQuery.isError)
  const runtimeByNode = useMemo(() => new Map(
    DEFAULT_WORKFLOW_DEFINITION.nodes.map((node) => [
      node.id,
      buildWorkflowNodeRuntime(node, selectedRun, workflow.data.workPackages, workflow.data.taskRuns),
    ]),
  ), [selectedRun, workflow.data.taskRuns, workflow.data.workPackages])
  const selectedNode = DEFAULT_WORKFLOW_DEFINITION.nodes.find((node) => node.id === selectedNodeId) ?? DEFAULT_WORKFLOW_DEFINITION.nodes[0]
  const selectedRuntime = selectedNode ? runtimeByNode.get(selectedNode.id) : undefined
  const selectedAgent = selectedRuntime ? agentForRuntime(selectedRuntime, agents) : null

  const selectRun = (nextRunId: string) => {
    const search = nextRunId ? `?runId=${encodeURIComponent(nextRunId)}` : ''
    navigate({ pathname: location.pathname, search })
  }

  if (!projectId) return <div className={styles.page}><Alert type="error" showIcon message="缺少项目上下文，无法加载工作流。" /></div>
  if (projectQuery.isPending) return <div className={styles.loading}><Spin /></div>
  if (projectQuery.isError) return <div className={styles.page}><Alert type="error" showIcon message={`项目上下文加载失败：${messageOf(projectQuery.error)}`} /></div>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.titleLine}><ApartmentOutlined /><Title level={2} className={styles.title}>工作流查看</Title><Tag color="blue">只读</Tag></div>
          <Paragraph className={styles.subtitle}>{DEFAULT_WORKFLOW_DEFINITION.name} · {DEFAULT_WORKFLOW_DEFINITION.description}</Paragraph>
        </div>
      </header>

      <Card className={styles.runBar} variant="borderless">
        <div className={styles.runLabel}><CodeOutlined /><span>任务运行</span></div>
        <Select
          className={styles.runSelect}
          placeholder="选择当前项目中的 OrchestrationRun"
          value={runId ?? undefined}
          allowClear
          onChange={(value: string | undefined) => selectRun(value ?? '')}
          options={runs.map((run) => ({ value: run.id, label: runLabel(run) }))}
        />
        <span className={styles.runHint}>{selectedRun ? <StatusTag status={mapRunStatus(selectedRun.status)} /> : '未选择运行实例'}</span>
      </Card>

      {workflow.runsQuery.isError ? <Alert className={styles.alert} type="error" showIcon message={`运行列表加载失败：${messageOf(workflow.runsQuery.error)}`} /> : null}
      {invalidRunId ? <Alert className={styles.alert} type="warning" showIcon message="URL 中的 runId 无效或当前用户无权访问，已保留默认流程结构，未自动选择其他运行。" /> : null}
      {workflow.data.hasWorkPackageError ? <Alert className={styles.alert} type="warning" showIcon message="部分 WorkPackage 加载失败，工作流仍保留可查看的节点结构。" /> : null}
      {workflow.data.hasTaskRunError ? <Alert className={styles.alert} type="warning" showIcon message="部分 TaskRun 加载失败，节点详情中的缺失数据已明确标记。" /> : null}
      {runId && workflow.runQuery.isPending ? <div className={styles.inlineLoading}><Spin size="small" /> 正在加载运行实例…</div> : null}

      <section className={styles.workflowLayout}>
        <div className={styles.canvasPane}>
          {!runId ? <div className={styles.emptyRun}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择运行实例后查看节点运行状态" /></div> : null}
          <div className={styles.flowScroll}>
            <div className={styles.flowTrack}>
              {DEFAULT_WORKFLOW_DEFINITION.nodes.map((node, index) => {
                const runtime = runtimeByNode.get(node.id)
                if (!runtime) return null
                return <div className={styles.flowItem} key={node.id}>
                  <NodeCard node={node} runtime={runtime} agent={agentForRuntime(runtime, agents)} selected={selectedNode?.id === node.id} onSelect={() => setSelectedNodeId(node.id)} />
                  {index < DEFAULT_WORKFLOW_DEFINITION.nodes.length - 1 ? <span className={styles.connector} aria-hidden="true"><RightOutlined /></span> : null}
                </div>
              })}
            </div>
          </div>
          {selectedRun ? <div className={styles.runSummary}><span><InfoCircleOutlined /> 运行指令</span><Text ellipsis={{ tooltip: selectedRun.instruction }}>{selectedRun.instruction}</Text></div> : null}
        </div>
        {selectedNode && selectedRuntime ? <NodeDetail node={selectedNode} runtime={selectedRuntime} agent={selectedAgent} projectId={projectId} runId={runId} /> : null}
      </section>
    </main>
  )
}
