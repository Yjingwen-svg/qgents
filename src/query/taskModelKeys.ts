import type { DiffListFilters, PageFilters, TaskListFilters, TaskRunListFilters } from '@/types/task-model'

export const taskModelQueryKeys = {
  tasks: {
    all: (projectId: string) => ['qgents', 'projects', projectId, 'tasks'] as const,
    list: (projectId: string, filters: TaskListFilters = {}) => ['qgents', 'projects', projectId, 'tasks', 'list', filters] as const,
    infinite: (projectId: string, filters: Omit<TaskListFilters, 'cursor'> = {}) => ['qgents', 'projects', projectId, 'tasks', 'infinite', filters] as const,
    detail: (projectId: string, taskId: string) => ['qgents', 'projects', projectId, 'tasks', taskId] as const,
  },
  taskArtifacts: {
    root: (projectId: string) => ['qgents', 'projects', projectId, 'task-artifacts'] as const,
    all: (projectId: string, taskId: string) => ['qgents', 'projects', projectId, 'task-artifacts', taskId] as const,
  },
  taskDiffReview: {
    root: (projectId: string) => ['qgents', 'projects', projectId, 'task-diff-review'] as const,
    detail: (projectId: string, taskId: string) => ['qgents', 'projects', projectId, 'task-diff-review', taskId] as const,
  },
  taskSteps: {
    root: (projectId: string) => ['qgents', 'projects', projectId, 'task-steps'] as const,
    all: (projectId: string, taskId: string) => ['qgents', 'projects', projectId, 'tasks', taskId, 'steps'] as const,
    list: (projectId: string, taskId: string, filters: PageFilters = {}) => ['qgents', 'projects', projectId, 'tasks', taskId, 'steps', 'list', filters] as const,
    detail: (projectId: string, taskId: string, taskStepId: string) => ['qgents', 'projects', projectId, 'tasks', taskId, 'steps', taskStepId] as const,
  },
  taskRuns: {
    root: (projectId: string) => ['qgents', 'projects', projectId, 'task-runs'] as const,
    all: (projectId: string, taskId: string) => ['qgents', 'projects', projectId, 'tasks', taskId, 'task-runs'] as const,
    list: (projectId: string, taskId: string, filters: TaskRunListFilters = {}) => ['qgents', 'projects', projectId, 'tasks', taskId, 'task-runs', 'list', filters] as const,
    infinite: (projectId: string, taskId: string, filters: Omit<TaskRunListFilters, 'cursor'> = {}) => ['qgents', 'projects', projectId, 'tasks', taskId, 'task-runs', 'infinite', filters] as const,
    detail: (projectId: string, taskRunId: string) => ['qgents', 'projects', projectId, 'task-runs', taskRunId] as const,
    logs: (projectId: string, taskRunId: string, filters: PageFilters = {}) => ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'logs', filters] as const,
    executionContext: (projectId: string, taskRunId: string) => ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'execution-context'] as const,
    inputRequests: {
      all: (projectId: string, taskRunId: string) => ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'input-requests'] as const,
      list: (projectId: string, taskRunId: string, filters: PageFilters = {}) => ['qgents', 'projects', projectId, 'task-runs', taskRunId, 'input-requests', 'list', filters] as const,
    },
  },
  diffs: {
    all: (projectId: string) => ['qgents', 'projects', projectId, 'diffs'] as const,
    list: (projectId: string, filters: DiffListFilters = {}) => ['qgents', 'projects', projectId, 'diffs', 'list', filters] as const,
    infinite: (projectId: string, filters: Omit<DiffListFilters, 'cursor'> = {}) => ['qgents', 'projects', projectId, 'diffs', 'infinite', filters] as const,
    detail: (projectId: string, diffId: string) => ['qgents', 'projects', projectId, 'diffs', diffId] as const,
    files: (projectId: string, diffId: string, filters: PageFilters = {}) => ['qgents', 'projects', projectId, 'diffs', diffId, 'files', filters] as const,
    comments: (projectId: string, diffId: string, filters: PageFilters = {}) => ['qgents', 'projects', projectId, 'diffs', diffId, 'comments', filters] as const,
  },
} as const
