import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@/types'
import { authApi, teamApi } from '@/api'
import { RSA_KEY_ID, encryptPassword } from '@/utils/rsaConfig'

interface AuthContextValue {
  /** 当前用户，null = 未登录 */
  user: User | null
  /** 是否已登录 */
  isAuthenticated: boolean
  /** 是否已加入至少一个团队 */
  hasTeam: boolean
  /** 是否正在初始化（bootstrap 阶段） */
  isBootstrapping: boolean

  /** 登录：返回 hasTeam，调用方据此决定跳转目标 */
  login: (email: string, password: string) => Promise<boolean>
  /** 注册：新用户一定没有团队，返回 false */
  register: (email: string, password: string, displayName: string) => Promise<boolean>
  /** 退出登录 */
  logout: () => Promise<void>
  /** 设置 hasTeam（创建/加入团队后调用） */
  setHasTeam: (v: boolean) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** localStorage key */
const ACCESS_TOKEN_KEY = 'qgents_access_token'
const REFRESH_TOKEN_KEY = 'qgents_refresh_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [hasTeam, setHasTeam] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  // ──── 启动时恢复登录态 ────
  // 每次挂载都执行 restore；用 cancelled 标志处理卸载竞态。
  // React StrictMode 开发模式下会「挂载 → 卸载 → 再挂载」，
  // 第一次 restore 因 cleanup 置 cancelled 而被丢弃，第二次挂载重新恢复。
  useEffect(() => {
    let cancelled = false

    async function restore() {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY)
      if (!token) {
        if (!cancelled) setIsBootstrapping(false)
        return
      }

      try {
        const me = await authApi.me()
        if (cancelled) return
        setUser(me)

        const teams = await teamApi.listMine()
        if (cancelled) return
        setHasTeam(teams.length > 0)
      } catch {
        // token 过期或无效 → 清掉
        if (!cancelled) {
          localStorage.removeItem(ACCESS_TOKEN_KEY)
          localStorage.removeItem(REFRESH_TOKEN_KEY)
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false)
      }
    }

    restore()

    return () => {
      cancelled = true
    }
  }, [])

  // ──── 登录（返回 hasTeam，调用方用于决定跳转目标）────
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // 使用硬编码的固定 RSA 公钥加密密码（mock 阶段 encryptPassword 直传明文）
    const encryptedPassword = await encryptPassword(password)

    const result = await authApi.login({
      email,
      password: encryptedPassword,
      passwordKeyId: RSA_KEY_ID,
    })

    localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken)
    setUser(result.user)

    // 登录后检查用户是否有团队
    try {
      const teams = await teamApi.listMine()
      const haveTeam = teams.length > 0
      setHasTeam(haveTeam)
      return haveTeam
    } catch {
      setHasTeam(false)
      return false
    }
  }, [])

  // ──── 注册（新用户没有团队，返回 false）────
  const register = useCallback(
    async (email: string, password: string, displayName: string): Promise<boolean> => {
      // 使用硬编码的固定 RSA 公钥加密密码（mock 阶段 encryptPassword 直传明文）
      const encryptedPassword = await encryptPassword(password)

      const result = await authApi.register({
        email,
        password: encryptedPassword,
        passwordKeyId: RSA_KEY_ID,
        displayName,
      })

      localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken)
      setUser(result.user)
      setHasTeam(false)
      return false
    },
    [],
  )

  // ──── 退出 ────
  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) ?? undefined
    try {
      await authApi.logout(refreshToken)
    } catch {
      // 即使接口失败也要清除本地状态
    }
    setUser(null)
    setHasTeam(false)
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      hasTeam,
      isBootstrapping,
      login,
      register,
      logout,
      setHasTeam,
    }),
    [user, hasTeam, isBootstrapping, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
