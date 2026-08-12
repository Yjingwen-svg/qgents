import type { WorkflowDefinition } from '@/types'

/** 系统配置：流程定义与运行实例分离，页面只读消费此定义。 */
export const DEFAULT_WORKFLOW_DEFINITION: WorkflowDefinition = {
  id: 'system-default-code-delivery',
  name: '标准代码交付流程',
  description: '系统默认的代码交付流程，按 Planner、Developer、Tester、Reviewer 顺序执行，最后汇总门禁结果。',
  nodes: [
    { id: 'planner', kind: 'AGENT', label: 'Planner', role: 'PLANNER', description: '规划需求、拆分工作包并生成执行计划' },
    { id: 'developer', kind: 'AGENT', label: 'Developer', role: 'DEVELOPER', description: '实现代码并补充必要的自测' },
    { id: 'tester', kind: 'AGENT', label: 'Tester', role: 'TESTER', description: '执行测试集并验证交付结果' },
    { id: 'reviewer', kind: 'AGENT', label: 'Reviewer', role: 'REVIEWER', description: '检查变更与交付质量（Agent role）' },
    { id: 'gate', kind: 'GATE', label: '门禁汇总', role: null, description: '汇总测试、审查与交付门禁结果' },
  ],
  edges: [
    { from: 'planner', to: 'developer' },
    { from: 'developer', to: 'tester' },
    { from: 'tester', to: 'reviewer' },
    { from: 'reviewer', to: 'gate' },
  ],
}
