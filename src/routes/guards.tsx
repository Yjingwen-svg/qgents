import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'

/**
 * 需登录才能访问的路由守卫
 * TODO[后端联调]: 结合 token 过期、refresh、bootstrap()
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to={PATHS.LOGIN} replace />
  }

  return <Outlet />
}

/**
 * 已登录用户访问 /login 时重定向，统一按 hasTeam 判断跳「我的团队」或「欢迎页」。
 *
 * 注意：不读 location.state.from 做回跳 —— 之前的 from 逻辑会在注册/登录后用
 * 残留的旧路径（如 /app/teams/xxx?as=owner）抢跳，导致注册成功却跳进旧团队详情。
 * GitHub 回调回跳非本期必需，暂舍弃。
 */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { isAuthenticated, hasTeam } = useAuth()

  if (isAuthenticated) {
    return <Navigate to={hasTeam ? PATHS.MY_TEAMS : PATHS.WELCOME} replace />
  }
  return children
}
