export const queryKeys = {
  all: ['qgents'] as const,
  projects: (projectId: string) => ['qgents', 'projects', projectId] as const,
  projectTasks: (projectId: string) => ['qgents', 'projects', projectId, 'tasks'] as const,
  projectAgents: (projectId: string) => ['qgents', 'projects', projectId, 'agents'] as const,
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
