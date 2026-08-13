import { create } from 'zustand'

const PROJECT_DETAIL_NAV_KEY = 'qgents_banner_project_detail'

function readStoredProjectDetailNav(): { projectId: string } | null {
  try {
    const raw = sessionStorage.getItem(PROJECT_DETAIL_NAV_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { projectId?: string }
    if (!parsed.projectId) return null
    return { projectId: parsed.projectId }
  } catch {
    return null
  }
}

interface AppUiStore {
  sidebarCollapsed: boolean
  taskPanelOpen: boolean
  /**
   * Banner「项目详情」页签：仅在点击「进入项目详情」后出现；
   * 离开项目区（点团队首页 / 项目群聊）时清除。
   */
  projectDetailNav: { projectId: string } | null
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setTaskPanelOpen: (open: boolean) => void
  toggleTaskPanel: () => void
  openProjectDetailNav: (projectId: string) => void
  clearProjectDetailNav: () => void
}

export const useAppUiStore = create<AppUiStore>((set) => ({
  sidebarCollapsed: false,
  taskPanelOpen: false,
  projectDetailNav: readStoredProjectDetailNav(),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTaskPanelOpen: (taskPanelOpen) => set({ taskPanelOpen }),
  toggleTaskPanel: () => set((state) => ({ taskPanelOpen: !state.taskPanelOpen })),
  openProjectDetailNav: (projectId) => {
    const next = { projectId }
    sessionStorage.setItem(PROJECT_DETAIL_NAV_KEY, JSON.stringify(next))
    set({ projectDetailNav: next })
  },
  clearProjectDetailNav: () => {
    sessionStorage.removeItem(PROJECT_DETAIL_NAV_KEY)
    set({ projectDetailNav: null })
  },
}))

export const useSidebarCollapsed = () => useAppUiStore((state) => state.sidebarCollapsed)
export const useTaskPanelOpen = () => useAppUiStore((state) => state.taskPanelOpen)
export const useProjectDetailNav = () => useAppUiStore((state) => state.projectDetailNav)
