import { create } from 'zustand'

interface AppUiStore {
  // ──── UI 开关 ────
  sidebarCollapsed: boolean
  taskPanelOpen: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setTaskPanelOpen: (open: boolean) => void
  toggleTaskPanel: () => void

  // ──── 全局上下文 ────
  /** 当前所在团队 ID，null = 尚未进入任何团队 */
  currentTeamId: string | null
  /** 当前所在项目 ID，null = 尚未进入任何项目 */
  currentProjectId: string | null
  setCurrentTeam: (teamId: string) => void
  setCurrentProject: (projectId: string) => void
  /** 退出登录或切换团队时清空 */
  clearContext: () => void
}

export const useAppUiStore = create<AppUiStore>((set) => ({
  // ──── UI 开关 ────
  sidebarCollapsed: false,
  taskPanelOpen: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTaskPanelOpen: (taskPanelOpen) => set({ taskPanelOpen }),
  toggleTaskPanel: () => set((state) => ({ taskPanelOpen: !state.taskPanelOpen })),

  // ──── 全局上下文 ────
  currentTeamId: null,
  currentProjectId: null,
  setCurrentTeam: (teamId) => set({ currentTeamId: teamId, currentProjectId: null }),
  setCurrentProject: (projectId) => set({ currentProjectId: projectId }),
  clearContext: () => set({ currentTeamId: null, currentProjectId: null }),
}))

export const useSidebarCollapsed = () => useAppUiStore((state) => state.sidebarCollapsed)
export const useTaskPanelOpen = () => useAppUiStore((state) => state.taskPanelOpen)
export const useCurrentTeamId = () => useAppUiStore((state) => state.currentTeamId)
export const useCurrentProjectId = () => useAppUiStore((state) => state.currentProjectId)
