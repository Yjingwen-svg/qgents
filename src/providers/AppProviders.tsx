import { App as AntdApp, ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { PersonalCenterProvider } from '@/context/PersonalCenterContext'
import { queryClient } from '@/query'
import { qgAntdTheme } from '@/theme/antdTheme'

/**
 * 启动加载门控。
 * AuthProvider 内部自动完成 token 恢复，这里只读 isBootstrapping 决定展示 loading 还是 children。
 */
function BootstrapGate({ children }: { children: ReactNode }) {
  const { isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#0f172a',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  return <>{children}</>
}

/**
 * 应用级 Provider 聚合（唯一入口）
 * - Ant Design 主题 + 中文 + 静态方法容器
 * - React Query 共享 queryClient
 * - Auth / PersonalCenter 业务上下文
 * - BootstrapGate：启动时验证 token，显示 loading screen
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={qgAntdTheme} locale={zhCN}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PersonalCenterProvider>
              <BootstrapGate>{children}</BootstrapGate>
            </PersonalCenterProvider>
          </AuthProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  )
}
