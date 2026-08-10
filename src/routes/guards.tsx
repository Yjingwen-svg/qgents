import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'

/**
 * 需登录才能访问的路由守卫
 * TODO[后端联调]: 结合 token 过期、refresh、bootstrap()
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
 */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { isAuthenticated, hasTeam } = useAuth()
  if (isAuthenticated) {
    return <Navigate to={hasTeam ? PATHS.MY_TEAMS : PATHS.WELCOME} replace />
  }
  return children
}
