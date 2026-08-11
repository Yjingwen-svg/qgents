import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { PersonalCenterProvider } from '@/context/PersonalCenterContext'
import { queryClient } from '@/query'
import { qgAntdTheme } from '@/theme/antdTheme'

/**
 * 应用级 Provider 聚合（唯一入口）
 * - Ant Design 主题 + 中文 + 静态方法容器
 * - React Query 共享 queryClient
 * - Auth / PersonalCenter 业务上下文
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={qgAntdTheme} locale={zhCN}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PersonalCenterProvider>{children}</PersonalCenterProvider>
          </AuthProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  )
}
