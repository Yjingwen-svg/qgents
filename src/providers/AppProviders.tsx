import { ConfigProvider } from 'antd'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { PersonalCenterProvider } from '@/context/PersonalCenterContext'
import { queryClient } from '@/query'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#0d9b8a', borderRadius: 10 } }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PersonalCenterProvider>{children}</PersonalCenterProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  )
}
