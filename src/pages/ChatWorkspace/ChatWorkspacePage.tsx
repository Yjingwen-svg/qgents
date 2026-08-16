import { useMemo, useState } from 'react'
import { Layout, Input, List, Avatar, Typography, Space, theme, Empty } from 'antd'
import { SearchOutlined, TeamOutlined } from '@ant-design/icons'
import { useQueries, useQuery } from '@tanstack/react-query'
import { teamApi, projectApi, groupApi } from '@/api'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { hasUnread, useUnreadStore } from '@/store/unreadStore'
import type { Group } from '@/types'

const { Text } = Typography

interface MainGroupSession {
  teamId: string
  teamName: string
  projectId: string
  projectName: string
  groupId: string
  groupTitle: string
  latestMessage?: Group['latestMessage']
  latestActivityAt?: string
}

/**
 * 项目群聊工作台 —— 左边聚合「所有项目的主群」，右边内嵌聊天面板。
 * 数据：teamApi.listMine → 各 team 的 projectApi.listByTeam → 各 project 的 groupApi.listByProject（取 PROJECT_MAIN）。
 */
export default function ChatWorkspacePage() {
  const { token } = theme.useToken()
  const readAt = useUnreadStore((state) => state.readAt)
  const [selected, setSelected] = useState<MainGroupSession | null>(null)
  const [keyword, setKeyword] = useState('')

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', 'mine'],
    queryFn: teamApi.listMine,
  })

  // 每个团队的项目列表
  const projectQueries = useQueries({
    queries: teams.map((t) => ({
      queryKey: ['teams', t.id, 'projects'],
      queryFn: () => projectApi.listByTeam(t.id),
      enabled: !!t.id,
    })),
  })

  // 扁平化所有项目
  const projects = useMemo(
    () => projectQueries.flatMap((q) => q.data ?? []),
    [projectQueries],
  )

  // teamId → 团队名，用于左侧群聊项显示所属团队
  const teamNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of teams) map.set(t.id, t.name)
    return map
  }, [teams])

  // 每个项目的主群
  const groupQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: ['groups', p.id],
      queryFn: () => groupApi.listByProject(p.id),
      enabled: !!p.id,
    })),
  })

  const sessions = useMemo<MainGroupSession[]>(() => {
    return projects
      .flatMap((p, i) => {
        const groups = groupQueries[i]?.data ?? []
        const main = groups.find((g) => g.type === 'PROJECT_MAIN') ?? groups[0]
        if (!main) return []
        return [
          {
            teamId: p.teamId,
            teamName: teamNameById.get(p.teamId) ?? '',
            projectId: p.id,
            projectName: p.name,
            groupId: main.id,
            groupTitle: main.title,
            latestMessage: main.latestMessage,
            latestActivityAt: main.latestActivityAt,
          },
        ]
      })
      .sort((a, b) => (b.latestActivityAt ?? '').localeCompare(a.latestActivityAt ?? ''))
  }, [projects, groupQueries, teamNameById])

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter(
      (s) =>
        s.projectName.toLowerCase().includes(q) ||
        s.groupTitle.toLowerCase().includes(q),
    )
  }, [sessions, keyword])

  return (
    <Layout style={{ height: 'calc(100vh - 56px)', background: token.colorBgBase }}>
      <Layout.Sider
        width={280}
        theme="dark"
        style={{
          borderRight: `1px solid ${token.colorBorder}`,
          background: token.colorBgContainer,
          overflow: 'auto',
        }}
      >
        <div style={{ padding: 12 }}>
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索项目群聊"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
            />
          </Space.Compact>

          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            项目主群
          </Text>

          {filtered.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无项目群聊" />
          ) : (
            <List
              dataSource={filtered}
              split={false}
              renderItem={(s) => (
                <List.Item
                  onClick={() => setSelected(s)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    background: selected?.groupId === s.groupId ? 'rgba(34, 197, 94, 0.12)' : undefined,
                    borderRadius: 8,
                    border: 'none',
                  }}
                >
                  <List.Item.Meta
                    avatar={<Avatar style={{ background: '#3b82f6' }} icon={<TeamOutlined />} size={36} />}
                    title={
                      <Space direction="vertical" size={0} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Text strong ellipsis style={{ maxWidth: 150 }}>
                            {s.projectName}
                          </Text>
                          {hasUnread(readAt, { id: s.groupId, latestActivityAt: s.latestActivityAt }) ? (
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#ef4444',
                                flexShrink: 0,
                              }}
                            />
                          ) : null}
                        </Space>
                        {s.teamName ? (
                          <Text type="secondary" ellipsis style={{ fontSize: 11, lineHeight: '16px' }}>
                            {s.teamName}
                          </Text>
                        ) : null}
                      </Space>
                    }
                    description={
                      <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                        {s.latestMessage
                          ? `${s.latestMessage.senderName ? `${s.latestMessage.senderName}: ` : ''}${s.latestMessage.text}`
                          : s.groupTitle}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      </Layout.Sider>

      {selected ? (
        <ChatPanel projectId={selected.projectId} groupId={selected.groupId} />
      ) : (
        <Layout style={{ background: token.colorBgBase }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Empty description="选择一个项目主群开始聊天" />
          </div>
        </Layout>
      )}
    </Layout>
  )
}
