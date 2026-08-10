import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@/types'
import { authApi, teamApi } from '@/api'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  /** 是否已加入至少一个团队（决定进 Welcome 还是主应用） */
  hasTeam: boolean
  /** 框架阶段：登录仅做前端状态切换，真正请求见 authApi */
  loginDemo: (user?: Partial<User>) => void
  logout: () => void
  setHasTeam: (v: boolean) => void
  /**
   * TODO[后端联调]:
   * - 启动时调 authApi.me() 恢复会话
   * - 调 teamApi.listMine() 判断 hasTeam
   */
  bootstrap: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const DEMO_USER: User = {
  id: 'demo-user',
  email: 'chen@example.com',
  displayName: '陈同学',
  avatarChar: '陈',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // 框架阶段默认未登录；联调后改为从 token 恢复
  const [user, setUser] = useState<User | null>(null)
  const [hasTeam, setHasTeam] = useState(false)

  const loginDemo = useCallback((partial?: Partial<User>) => {
    setUser({ ...DEMO_USER, ...partial })
    // 模拟：新用户尚无团队 → 进入 Welcome
    setHasTeam(false)
    localStorage.setItem('qgents_access_token', 'demo-token')
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setHasTeam(false)
    localStorage.removeItem('qgents_access_token')
    // TODO: await authApi.logout()
  }, [])

  const bootstrap = useCallback(async () => {
    // TODO[后端联调] 示例：
    // const me = await authApi.me()
    // setUser(me)
    // const teams = await teamApi.listMine()
    // setHasTeam(teams.length > 0)
    void authApi
    void teamApi
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      hasTeam,
      loginDemo,
      logout,
      setHasTeam,
      bootstrap,
    }),
    [user, hasTeam, loginDemo, logout, bootstrap],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
