import { create } from 'zustand'

interface AppUiStore {
  sidebarCollapsed: boolean
  taskPanelOpen: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setTaskPanelOpen: (open: boolean) => void
  toggleTaskPanel: () => void
}

export const useAppUiStore = create<AppUiStore>((set) => ({
  sidebarCollapsed: false,
  taskPanelOpen: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTaskPanelOpen: (taskPanelOpen) => set({ taskPanelOpen }),
  toggleTaskPanel: () => set((state) => ({ taskPanelOpen: !state.taskPanelOpen })),
}))

export const useSidebarCollapsed = () => useAppUiStore((state) => state.sidebarCollapsed)
export const useTaskPanelOpen = () => useAppUiStore((state) => state.taskPanelOpen)
