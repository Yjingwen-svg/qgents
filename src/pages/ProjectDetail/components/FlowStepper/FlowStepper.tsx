import { Tooltip } from 'antd'
import {
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { PATHS } from '@/routes/paths'
import styles from './FlowStepper.module.scss'

export type FlowStep = 'gate' | 'cq' | 'create_mr'

export interface FlowStepStatus {
  gate: 'pending' | 'passed' | 'failed'
  cq: 'pending' | 'approved' | 'rejected'
  createMr: boolean
}

interface FlowStepperProps {
  projectId: string
  status: FlowStepStatus
  /** 点击"质量门禁"节点 */
  onClickGate?: () => void
  /** 点击"CQ+1"节点 */
  onClickCq?: () => void
  /** 点击"创建 MR"节点 */
  onClickCreateMr?: () => void
}

export function FlowStepper({
  projectId,
  status,
  onClickGate,
  onClickCq,
  onClickCreateMr,
}: FlowStepperProps) {
  const canCreateMr = status.gate === 'passed' && status.cq === 'approved'

  return (
    <div className={styles.stepper}>
      {/* 连接线 1: gate → cq */}
      <div
        className={`${styles.connector} ${status.gate === 'passed' ? styles.connectorPassed : ''}`}
      />

      {/* 连接线 2: cq → createMr */}
      <div
        className={`${styles.connector} ${styles.connectorSecond} ${
          status.cq === 'approved' ? styles.connectorPassed : ''
        }`}
      />

      {/* 节点 1: 质量门禁 */}
      <StepNode
        aria-label="步骤：质量门禁"
        label="质量门禁"
        status={status.gate === 'pending' ? 'pending' : status.gate === 'passed' ? 'passed' : 'failed'}
        description={stepDescription('gate', status.gate)}
        onClick={onClickGate}
        href={onClickGate ? undefined : PATHS.projectTestset(projectId)}
      />

      {/* 节点 2: CQ+1 */}
      <StepNode
        aria-label="步骤：CQ+1"
        label="CQ+1"
        status={
          status.cq === 'pending' ? 'pending' : status.cq === 'approved' ? 'passed' : 'failed'
        }
        description={stepDescription('cq', status.cq)}
        onClick={onClickCq}
      />

      {/* 节点 3: 创建 MR */}
      <StepNode
        aria-label="步骤：创建 MR"
        label="创建 MR"
        status={canCreateMr ? 'active' : 'disabled'}
        description={canCreateMr ? '可以创建 MR' : '等待质量门禁和 CQ+1 通过'}
        onClick={canCreateMr ? onClickCreateMr : undefined}
        isAction
      />
    </div>
  )
}

function stepDescription(step: FlowStep, status: FlowStepStatus[FlowStep]): string {
  if (step === 'gate') {
    if (status === 'passed') return '已通过'
    if (status === 'failed') return '未通过'
    return '待检查'
  }
  if (step === 'cq') {
    if (status === 'approved') return '已盖章'
    if (status === 'rejected') return '已拒绝'
    return '待盖章'
  }
  return ''
}

type NodeStatus = 'pending' | 'passed' | 'failed' | 'active' | 'disabled'

interface StepNodeProps {
  ariaLabel?: string
  label: string
  status: NodeStatus
  description: string
  href?: string
  onClick?: () => void
  isAction?: boolean
}

function StepNode({ ariaLabel, label, status, description, href, onClick, isAction }: StepNodeProps) {
  const icon = nodeIcon(status)
  const className = [
    styles.node,
    styles[`node_${status}`],
    href || onClick ? styles.nodeClickable : '',
    isAction ? styles.nodeAction : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (href && !onClick) {
    return (
      <Tooltip title={description}>
        <a href={href} className={className} aria-label={ariaLabel}>
          <div className={styles.nodeCircle}>{icon}</div>
          <div className={styles.nodeLabel}>{label}</div>
          <div className={styles.nodeDesc}>{description}</div>
        </a>
      </Tooltip>
    )
  }

  if (!onClick) {
    return (
      <Tooltip title={description}>
        <div className={className} aria-label={ariaLabel}>
          <div className={styles.nodeCircle}>{icon}</div>
          <div className={styles.nodeLabel}>{label}</div>
          <div className={styles.nodeDesc}>{description}</div>
        </div>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={status === 'disabled' ? description : undefined}>
      <button
        type="button"
        aria-label={ariaLabel}
        className={className}
        onClick={onClick}
        disabled={status === 'disabled'}
      >
        <div className={styles.nodeCircle}>{icon}</div>
        <div className={styles.nodeLabel}>{label}</div>
        <div className={styles.nodeDesc}>{description}</div>
      </button>
    </Tooltip>
  )
}

function nodeIcon(status: NodeStatus): React.ReactNode {
  if (status === 'passed' || status === 'active') {
    return <CheckCircleFilled />
  }
  if (status === 'failed') {
    return <CloseCircleFilled />
  }
  if (status === 'pending') {
    return <ClockCircleFilled />
  }
  if (status === 'disabled') {
    return <QuestionCircleOutlined />
  }
  return null
}
