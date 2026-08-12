import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { PATHS } from '@/routes/paths'
import { RedirectIfAuthed, RequireAuth } from '@/routes/guards'

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
import { CreateProjectPage } from '@/pages/CreateProject/CreateProjectPage'
import { TeamAuthorizedReposPage } from '@/pages/GitHubIntegration/TeamAuthorizedReposPage'
import { ProjectDetailLayout } from '@/pages/ProjectDetail/ProjectDetailLayout'
import { RequirementChatPage } from '@/pages/ProjectDetail/RequirementChatPage'
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
              <Route path="teams/:teamId" element={<TeamDetailPage />} />
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
                {/* 默认进入「登录功能」需求群聊 */}
                <Route index element={<Navigate to="req-chat/login" replace />} />
                <Route path="overview" element={<OverviewPage />} />

                {/*
                  需求群聊：每个需求独立路由，IM 外壳相同、会话按 reqId 隔离
                */}
                <Route path="req-chat/:reqId" element={<RequirementChatPage />} />
                <Route path="req-chat" element={<Navigate to="login" replace />} />

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
    </BrowserRouter>
  )
}
