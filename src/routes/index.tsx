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
import { ProjectDetailPage } from '@/pages/ProjectDetail/ProjectDetailPage'

/**
 * 应用路由总表
 *
 * 流程：
 * 1. /login           登录注册
 * 2. /welcome         无团队 → 创建/加入
 * 3. /app/*           主壳 Banner
 *    - teams          团队首页
 *    - teams/create   创建团队
 *    - teams/join     加入团队
 *    - chat           项目群聊工作台外壳
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
              <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to={PATHS.LOGIN} replace />} />
          <Route path="*" element={<Navigate to={PATHS.LOGIN} replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
