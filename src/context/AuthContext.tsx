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

const TOKEN_KEY = 'qgents_access_token'
const HAS_TEAM_KEY = 'qgents_has_team'

const DEMO_USER: User = {
  id: 'demo-user',
  email: 'chen@example.com',
  displayName: '陈同学',
  avatarChar: '陈',
}

/**
 * 从 localStorage 恢复会话（保留原注释意图：联调后改为从 token 恢复）
 * 说明：跳转 GitHub 是整页离开，回来会重新加载；若不恢复，RequireAuth 会踢回 /login
 */
function readStoredSession(): { user: User | null; hasTeam: boolean } {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return { user: null, hasTeam: false }
  return {
    user: DEMO_USER,
    hasTeam: localStorage.getItem(HAS_TEAM_KEY) === '1',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // 框架阶段默认未登录；联调后改为从 token 恢复
  const initial = readStoredSession()
  const [user, setUser] = useState<User | null>(initial.user)
  const [hasTeam, setHasTeamState] = useState(initial.hasTeam)

  const setHasTeam = useCallback((v: boolean) => {
    setHasTeamState(v)
    localStorage.setItem(HAS_TEAM_KEY, v ? '1' : '0')
  }, [])

  const loginDemo = useCallback((partial?: Partial<User>) => {
    setUser({ ...DEMO_USER, ...partial })
    // 模拟：新用户尚无团队 → 进入 Welcome
    // 若本地已有 hasTeam 标记（例如 GitHub 回跳后再进登录），则保留
    const knownTeam = localStorage.getItem(HAS_TEAM_KEY) === '1'
    setHasTeamState(knownTeam)
    localStorage.setItem(TOKEN_KEY, 'demo-token')
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setHasTeamState(false)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(HAS_TEAM_KEY)
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
    [user, hasTeam, loginDemo, logout, setHasTeam, bootstrap],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
