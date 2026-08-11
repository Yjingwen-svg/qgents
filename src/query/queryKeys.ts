import type {
  OrchestrationRunFilters,
  CursorPageFilters,
  TaskRunFilters,
  WorkPackageFilters,
} from '@/types'

export const queryKeys = {
  all: ['qgents'] as const,
  projects: (projectId: string) => ['qgents', 'projects', projectId] as const,
  orchestrationRuns: {
    all: (projectId: string) => ['qgents', 'projects', projectId, 'orchestration-runs'] as const,
    list: (projectId: string, filters: OrchestrationRunFilters = {}) =>
      ['qgents', 'projects', projectId, 'orchestration-runs', 'list', filters] as const,
    infinite: (projectId: string, filters: Omit<OrchestrationRunFilters, 'cursor'> = {}) =>
      ['qgents', 'projects', projectId, 'orchestration-runs', 'infinite', filters] as const,
    detail: (projectId: string, runId: string) =>
      ['qgents', 'projects', projectId, 'orchestration-runs', runId] as const,
  },
  workPackages: {
    all: (projectId: string) => ['qgents', 'projects', projectId, 'work-packages'] as const,
    list: (projectId: string, filters: WorkPackageFilters = {}) =>
      ['qgents', 'projects', projectId, 'work-packages', 'list', filters] as const,
    detail: (projectId: string, workPackageId: string) =>
      ['qgents', 'projects', projectId, 'work-packages', workPackageId] as const,
  },
  taskRuns: {
    all: (projectId: string) => ['qgents', 'projects', projectId, 'task-runs'] as const,
    list: (projectId: string, workPackageId: string, filters: TaskRunFilters = {}) =>
      ['qgents', 'projects', projectId, 'task-runs', 'work-packages', workPackageId, 'list', filters] as const,
    infinite: (projectId: string, workPackageId: string, filters: Omit<TaskRunFilters, 'cursor'> = {}) =>
      ['qgents', 'projects', projectId, 'task-runs', 'work-packages', workPackageId, 'infinite', filters] as const,
    detail: (projectId: string, taskRunId: string) =>
      ['qgents', 'projects', projectId, 'task-runs', taskRunId] as const,
    steps: (projectId: string, taskRunId: string, filters: CursorPageFilters = {}) =>
      ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'steps', filters] as const,
    stepsInfinite: (projectId: string, taskRunId: string, filters: Omit<CursorPageFilters, 'cursor'> = {}) =>
      ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'steps', 'infinite', filters] as const,
    logs: (projectId: string, taskRunId: string, cursor?: string, limit?: number) =>
      ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'logs', { cursor, limit }] as const,
    logsInfinite: (projectId: string, taskRunId: string, filters: Omit<CursorPageFilters, 'cursor'> = {}) =>
      ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'logs', 'infinite', filters] as const,
    executionContext: (projectId: string, taskRunId: string) =>
      ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'execution-context'] as const,
    inputRequests: {
      all: (projectId: string, taskRunId: string) =>
        ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'input-requests'] as const,
      list: (projectId: string, taskRunId: string, filters: CursorPageFilters = {}) =>
        ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'input-requests', 'list', filters] as const,
    },
  },
  deliverables: {
    all: (projectId: string) => ['qgents', 'projects', projectId, 'deliverables'] as const,
    list: (projectId: string, workPackageId: string, filters: CursorPageFilters = {}) =>
      ['qgents', 'projects', projectId, 'deliverables', 'work-packages', workPackageId, filters] as const,
    detail: (projectId: string, deliverableId: string) =>
      ['qgents', 'projects', projectId, 'deliverables', deliverableId] as const,
  },
} as const
