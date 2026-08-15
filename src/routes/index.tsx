import { PageLoader } from '@/components/PageLoader'

import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { PATHS } from '@/routes/paths'
import { RedirectIfAuthed, RequireAuth, RequireTeam } from '@/routes/guards'

// ✅ 登录页首屏直接加载
import { LoginPage } from '@/pages/Login/LoginPage'

// ✅ sections 统一导入保持不变
import {
  OverviewPage,
  SkillsPage,
  MemoryPage,
  CodePage,
  TestsetPage,
  MembersPage,
  SettingsPage,
} from '@/pages/ProjectDetail/sections'

// ✅ 其他所有独立页面用懒加载
const WelcomePage = lazy(() => import('@/pages/Welcome/WelcomePage'))
const CreateTeamPage = lazy(() => import('@/pages/CreateTeam/CreateTeamPage'))
const JoinTeamPage = lazy(() => import('@/pages/JoinTeam/JoinTeamPage'))
const MyTeamsPage = lazy(() => import('@/pages/MyTeams/MyTeamsPage'))
const ChatWorkspacePage = lazy(() => import('@/pages/ChatWorkspace/ChatWorkspacePage'))
const GitHubIntegrationPage = lazy(() => import('@/pages/GitHubIntegration/GitHubIntegrationPage'))
const GithubInstallationReposPage = lazy(() => import('@/pages/GitHubIntegration/GithubInstallationReposPage'))
const BindRepoToProjectPage = lazy(() => import('@/pages/GitHubIntegration/BindRepoToProjectPage'))
const TeamDetailPage = lazy(() => import('@/pages/TeamDetail/TeamDetailPage'))
const TeamSettingsPage = lazy(() => import('@/pages/TeamDetail/TeamSettingsPage'))
const TeamActivitiesPage = lazy(() => import('@/pages/TeamDetail/TeamActivitiesPage'))
const CreateProjectPage = lazy(() => import('@/pages/CreateProject/CreateProjectPage'))
const TeamAuthorizedReposPage = lazy(() => import('@/pages/GitHubIntegration/TeamAuthorizedReposPage'))
const ProjectDetailLayout = lazy(() => import('@/pages/ProjectDetail/ProjectDetailLayout'))
const RequirementChatPage = lazy(() => import('@/pages/ProjectDetail/RequirementChatPage'))
const DiffReviewPage = lazy(() => import('@/pages/ProjectDetail/DiffReviewPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'))
const TaskDetailPage = lazy(() => import('@/pages/ProjectDetail/TaskDetail/TaskDetailPage'))
const TaskRunDetailPage = lazy(() => import('@/pages/ProjectDetail/TaskRunDetail/TaskRunDetailPage'))
const TaskCenterPage = lazy(() => import('@/pages/ProjectDetail/TaskCenter/TaskCenterPage'))
const DiffCenterPage = lazy(() => import('@/pages/ProjectDetail/DiffCenter/DiffCenterPage'))
const DeliveryCenterPage = lazy(() => import('@/pages/ProjectDetail/DeliveryCenter/DeliveryCenterPage'))
const WorkflowViewerPage = lazy(() => import('@/pages/ProjectDetail/Workflow/WorkflowViewerPage'))
const AgentTeamPage = lazy(() => import('@/pages/ProjectDetail/AgentTeam/AgentTeamPage'))

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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

              <Route element={<RequireTeam />}>
                <Route path="teams/:teamId" element={<TeamDetailPage />} />
                <Route path="teams/:teamId/settings" element={<TeamSettingsPage />} />
                <Route path="teams/:teamId/activities" element={<TeamActivitiesPage />} />
                <Route path="teams/:teamId/projects/create" element={<CreateProjectPage />} />
                <Route
                  path="teams/:teamId/github/authorized-repos"
                  element={<TeamAuthorizedReposPage />}
                />
                <Route path="chat" element={<ChatWorkspacePage />} />
                <Route path="integrations/github" element={<GitHubIntegrationPage />} />
                <Route
                  path="integrations/github/installations/:installationId/repositories"
                  element={<GithubInstallationReposPage />}
                />
                <Route path="integrations/github/bind-repo" element={<BindRepoToProjectPage />} />

                <Route path="projects/:projectId" element={<ProjectDetailLayout />}>
                  <Route index element={<Navigate to="req-chat" replace />} />
                  <Route path="overview" element={<OverviewPage />} />

                  <Route path="req-chat/:groupId" element={<RequirementChatPage />} />
                  <Route path="req-chat" element={<RequirementChatPage />} />

                  <Route path="tasks" element={<TaskCenterPage />} />
                  <Route path="tasks/:taskId/executions/:taskRunId" element={<TaskRunDetailPage />} />
                  <Route path="tasks/:taskId" element={<TaskDetailPage />} />
                  <Route path="diffs" element={<DeliveryCenterPage />} />
                  <Route path="diffs/:diffId" element={<DiffCenterPage />} />
                  <Route path="workflow" element={<WorkflowViewerPage />} />
                  <Route path="agents" element={<AgentTeamPage />} />

                  <Route path="skills" element={<SkillsPage />} />
                  <Route path="memory" element={<MemoryPage />} />
                  <Route path="code/diff/:branchId" element={<DiffReviewPage />} />
                  <Route path="code" element={<CodePage />} />
                  <Route path="testset" element={<TestsetPage />} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="/403" element={<ForbiddenPage />} />
          </Route>

          <Route path="/" element={<Navigate to={PATHS.LOGIN} replace />} />
          <Route path="*" element={<Navigate to={PATHS.LOGIN} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}