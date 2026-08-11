export const queryKeys = {
  all: ['qgents'] as const,
  projects: (projectId: string) => ['qgents', 'projects', projectId] as const,
  projectTasks: (projectId: string) => ['qgents', 'projects', projectId, 'tasks'] as const,
  projectAgents: (projectId: string) => ['qgents', 'projects', projectId, 'agents'] as const,
  projectSkills: (projectId: string) => ['qgents', 'projects', projectId, 'skills'] as const,
} as const
