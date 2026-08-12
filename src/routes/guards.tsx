import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'

/**
 * 需登录才能访问的路由守卫
 * TODO[后端联调]: 结合 token 过期、refresh、bootstrap()
 *
 * 未登录时带上 state.from，登录页可回跳（GitHub 回调集成页等）
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to={PATHS.LOGIN} replace state={{ from: location }} />
  }

  return <Outlet />
}

/**
 * 已登录用户访问 /login 时重定向
 * 若带有 from（例如回调被踢来后又已恢复登录），优先回原页
 */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { isAuthenticated, hasTeam } = useAuth()
  const location = useLocation()
  const from =
    (location.state as { from?: { pathname?: string; search?: string } } | null)?.from

  if (isAuthenticated) {
    if (from?.pathname) {
      return <Navigate to={`${from.pathname}${from.search || ''}`} replace />
    }
    return <Navigate to={hasTeam ? PATHS.MY_TEAMS : PATHS.WELCOME} replace />
  }
  return children
}
