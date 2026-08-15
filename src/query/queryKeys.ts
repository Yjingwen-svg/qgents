import type { AgentAssignmentsFilters } from '@/types/agent'

export const queryKeys = {
  all: ['qgents'] as const,
  projects: (projectId: string) => ['qgents', 'projects', projectId] as const,
  agents: {
    all: (projectId: string, teamId = '') => ['qgents', 'projects', projectId, 'teams', teamId, 'agents'] as const,
    list: (projectId: string, teamId = '', scenario?: string) =>
      ['qgents', 'projects', projectId, 'teams', teamId, 'agents', 'list', scenario ?? null] as const,
    detail: (projectId: string, teamId: string, agentId?: string) =>
      agentId === undefined
        ? ['qgents', 'projects', '', 'teams', projectId, 'agents', teamId] as const
        :
      ['qgents', 'projects', projectId, 'teams', teamId, 'agents', agentId] as const,
    skillBindings: (projectId: string, agentId: string) =>
      ['qgents', 'projects', projectId, 'agent-skill-bindings', agentId] as const,
    assignments: (projectId: string, agentId: string, filters: AgentAssignmentsFilters = {}) =>
      ['qgents', 'projects', projectId, 'agents', agentId, 'assignments', filters] as const,
    runtime: (projectId: string, agentId: string) =>
      ['qgents', 'projects', projectId, 'agents', agentId, 'runtime'] as const,
    taskRuns: (projectId: string, agentId: string, filters: { status?: string; cursor?: string; limit?: number } = {}) =>
      ['qgents', 'projects', projectId, 'task-runs', 'agent', agentId, filters] as const,
  },
  projectSkills: (projectId: string) => ['qgents', 'projects', projectId, 'skills'] as const,
  // 标记「这个团队的 GitHub App 安装列表」这份接口数据的缓存地址
  githubInstallations: (teamId: string) =>
    ['qgents', 'teams', teamId, 'github', 'installations'] as const,
  githubTeamRepositories: (teamId: string) =>
    ['qgents', 'teams', teamId, 'github', 'repositories'] as const,
  teamProjects: (teamId: string) => ['qgents', 'teams', teamId, 'projects'] as const,
  projectRepositories: (projectId: string) =>
    ['qgents', 'projects', projectId, 'repositories'] as const,
} as const
// queryKey 是一层一层的数组路径，就像电脑文件夹路径！React Query 靠这串路径区分缓存，还能按「父文件夹」批量刷新缓存
