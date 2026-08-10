import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { MainLayout } from '@/layouts/MainLayout'
import { PATHS } from '@/routes/paths'
import { RedirectIfAuthed, RequireAuth } from '@/routes/guards'

import { LoginPage } from '@/pages/Login/LoginPage'
import { WelcomePage } from '@/pages/Welcome/WelcomePage'
import { CreateTeamPage } from '@/pages/CreateTeam/CreateTeamPage'
import { JoinTeamPage } from '@/pages/JoinTeam/JoinTeamPage'
import { MyTeamsPage } from '@/pages/MyTeams/MyTeamsPage'
import { ChatWorkspacePage } from '@/pages/ChatWorkspace/ChatWorkspacePage'
import { ProjectDetailLayout } from '@/pages/ProjectDetail/ProjectDetailLayout'
import { BranchChatPage } from '@/pages/ProjectDetail/BranchChatPage'
import {
  OverviewPage,
  TasksPage,
  WorkflowPage,
  AgentsPage,
  SkillsPage,
  MemoryPage,
  CodePage,
  TestsetPage,
  MembersPage,
  SettingsPage,
} from '@/pages/ProjectDetail/sections'

/**
 * 应用路由总表
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path={PATHS.LOGIN}
            element={
              <RedirectIfAuthed>
                <LoginPage />
              </RedirectIfAuthed>
            }
          />

          <Route element={<RequireAuth />}>
            <Route path={PATHS.WELCOME} element={<WelcomePage />} />

            <Route path={PATHS.APP} element={<MainLayout />}>
              <Route index element={<Navigate to={PATHS.MY_TEAMS} replace />} />
              <Route path="teams" element={<MyTeamsPage />} />
              <Route path="teams/create" element={<CreateTeamPage />} />
              <Route path="teams/join" element={<JoinTeamPage />} />
              <Route path="chat" element={<ChatWorkspacePage />} />

              {/* 项目详情：左侧导航每一项独立子路由 */}
              <Route path="projects/:projectId" element={<ProjectDetailLayout />}>
                <Route index element={<Navigate to="branch-chat" replace />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="branch-chat" element={<BranchChatPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="workflow" element={<WorkflowPage />} />
                <Route path="agents" element={<AgentsPage />} />
                <Route path="skills" element={<SkillsPage />} />
                <Route path="memory" element={<MemoryPage />} />
                <Route path="code" element={<CodePage />} />
                <Route path="testset" element={<TestsetPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Navigate to={PATHS.LOGIN} replace />} />
          <Route path="*" element={<Navigate to={PATHS.LOGIN} replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
