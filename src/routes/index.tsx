import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { PATHS } from '@/routes/paths'
import { RedirectIfAuthed, RequireAuth, RequireTeam } from '@/routes/guards'

import { LoginPage } from '@/pages/Login/LoginPage'
import { WelcomePage } from '@/pages/Welcome/WelcomePage'
import { CreateTeamPage } from '@/pages/CreateTeam/CreateTeamPage'
import { JoinTeamPage } from '@/pages/JoinTeam/JoinTeamPage'
import { MyTeamsPage } from '@/pages/MyTeams/MyTeamsPage'
import { ChatWorkspacePage } from '@/pages/ChatWorkspace/ChatWorkspacePage'
import { GitHubIntegrationPage } from '@/pages/GitHubIntegration/GitHubIntegrationPage'
import { GithubInstallationReposPage } from '@/pages/GitHubIntegration/GithubInstallationReposPage'
import { BindRepoToProjectPage } from '@/pages/GitHubIntegration/BindRepoToProjectPage'
import { TeamDetailPage } from '@/pages/TeamDetail/TeamDetailPage'
import { TeamSettingsPage } from '@/pages/TeamDetail/TeamSettingsPage'
import { TeamActivitiesPage } from '@/pages/TeamDetail/TeamActivitiesPage'
import { CreateProjectPage } from '@/pages/CreateProject/CreateProjectPage'
import { TeamAuthorizedReposPage } from '@/pages/GitHubIntegration/TeamAuthorizedReposPage'
import { ProjectDetailLayout } from '@/pages/ProjectDetail/ProjectDetailLayout'
import { RequirementChatPage } from '@/pages/ProjectDetail/RequirementChatPage'
import { DiffReviewPage } from '@/pages/ProjectDetail/DiffReviewPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { TaskDetailPage } from '../pages/ProjectDetail/TaskDetail/TaskDetailPage'
import { TaskRunDetailPage } from '../pages/ProjectDetail/TaskRunDetail/TaskRunDetailPage'
import { TaskCenterPage } from '../pages/ProjectDetail/TaskCenter/TaskCenterPage'
import { DiffCenterPage } from '../pages/ProjectDetail/DiffCenter/DiffCenterPage'
import { DeliveryCenterPage } from '../pages/ProjectDetail/DeliveryCenter/DeliveryCenterPage'
import { WorkflowViewerPage } from '../pages/ProjectDetail/Workflow/WorkflowViewerPage'
import { AgentTeamPage } from '../pages/ProjectDetail/AgentTeam/AgentTeamPage'
import {
  OverviewPage,
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

              {/* 需已加入至少一个团队才能访问的业务路由（无团队时拦回欢迎页） */}
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
                  {/* 默认进入项目总群（由 ProjectDetailLayout 根据群列表跳转） */}
                  <Route index element={<Navigate to="req-chat" replace />} />
                  <Route path="overview" element={<OverviewPage />} />

                  {/*
                    群聊：每个群独立路由，IM 外壳相同、会话按 groupId 隔离
                    req-chat 无参数时由 ProjectDetailLayout 重定向到项目总群
                  */}
                  <Route path="req-chat/:groupId" element={<RequirementChatPage />} />
                  <Route path="req-chat" element={<RequirementChatPage />} />

                  {/* B 的任务模块 */}
                  <Route path="tasks" element={<TaskCenterPage />} />
                  <Route path="tasks/:taskId/executions/:taskRunId" element={<TaskRunDetailPage />} />
                  <Route path="tasks/:taskId" element={<TaskDetailPage />} />
                  <Route path="diffs" element={<DeliveryCenterPage />} />
                  <Route path="diffs/:diffId" element={<DiffCenterPage />} />
                  <Route path="workflow" element={<WorkflowViewerPage />} />
                  <Route path="agents" element={<AgentTeamPage />} />

                  {/* 其他子页 */}
                  <Route path="skills" element={<SkillsPage />} />
                  <Route path="memory" element={<MemoryPage />} />
                  <Route path="code/diff/:branchId" element={<DiffReviewPage />} />
                  <Route path="code" element={<CodePage />} />
                  <Route path="testset" element={<TestsetPage />} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>

              {/* 已登录用户 → 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* 403 页面 */}
            <Route path="/403" element={<ForbiddenPage />} />
          </Route>

          <Route path="/" element={<Navigate to={PATHS.LOGIN} replace />} />
          <Route path="*" element={<Navigate to={PATHS.LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
