import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Avatar, Button, Form, Input, Modal, Select, Spin, Tag, Typography } from 'antd'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { projectApi } from '@/api'
import { useAgent, useAgentSkillBindings, useAgents, useArchiveAgent, useCreateAgent, usePublishAgent, useUnpublishAgent, useUpdateAgent } from '@/hooks'
import type { AgentDetail, AgentRole, CreateAgentPayload } from '@/types'
import { canPerformAgentAction } from '@/utils/agentActions'
import styles from './AgentTeamPage.module.scss'

const roles: AgentRole[] = ['ORCHESTRATOR', 'PLANNER', 'DEVELOPER', 'TESTER', 'REVIEWER', 'GENERAL']
const { Title, Text } = Typography
const unavailable = '暂无数据'

export function AgentTeamPage() {
  const { projectId = '' } = useParams<{ projectId: string }>(); const location = useLocation(); const navigate = useNavigate(); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<AgentDetail | null>(null); const [form] = Form.useForm<CreateAgentPayload>()
  const project = useQuery({ queryKey: ['qgents', 'projects', projectId], queryFn: () => projectApi.getById(projectId), enabled: Boolean(projectId) }); const teamId = project.data?.teamId ?? ''
  const list = useAgents(projectId, teamId); const agentId = new URLSearchParams(location.search).get('agentId'); const selected = list.data?.data.find((agent) => agent.id === agentId) ?? null; const detail = useAgent(projectId, teamId, selected?.id ?? null); const current = detail.data ?? selected
  const skillBindings = useAgentSkillBindings(projectId, selected?.id ?? null)
  const create = useCreateAgent(projectId, teamId); const update = useUpdateAgent(projectId, teamId); const publish = usePublishAgent(projectId, teamId); const unpublish = useUnpublishAgent(projectId, teamId); const archive = useArchiveAgent(projectId, teamId)
  useEffect(() => { if (!agentId && list.data?.data[0]) navigate(`?agentId=${encodeURIComponent(list.data.data[0].id)}`, { replace: true }) }, [agentId, list.data, navigate])
  if (project.isLoading || list.isLoading) return <div className={styles.page}><Spin /></div>
  if (project.isError || list.isError) return <div className={styles.page}><Alert type="error" message="Agent 数据加载失败" /></div>
  const invalid = Boolean(agentId && !selected)
  const save = async (values: CreateAgentPayload) => { const saved = editing ? await update.mutateAsync({ agentId: editing.id, payload: values }) : await create.mutateAsync(values); setOpen(false); navigate(`?agentId=${encodeURIComponent(saved.id)}`) }
  const beginEdit = () => { if (!current || !canPerformAgentAction(current, 'edit')) return; const editable = detail.data; if (!editable) return; setEditing(editable); form.setFieldsValue({ name: editable.name, avatar: editable.avatar ?? undefined, role: editable.role, capabilities: editable.capabilities, prompt: editable.prompt ?? '' }); setOpen(true) }
  const skillsText = skillBindings.isError ? 'Skill 模块尚未接入' : skillBindings.data?.skills.length ? skillBindings.data.skills.map((skill) => skill.name).join('、') : '暂无 Skill 数据'
  return <div className={styles.page}><header className={styles.header}><Title level={2}>Agent 团队</Title><Button type="primary" onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ role: 'GENERAL', capabilities: [], prompt: '' }); setOpen(true) }}>添加 Agent</Button></header>{invalid ? <Alert type="warning" message="Agent 不存在或当前不可见" /> : null}<div className={styles.layout}><main className={styles.listPane}>{(list.data?.data ?? []).map((agent) => <button type="button" className={styles.agentCell} key={agent.id} onClick={() => navigate(`?agentId=${encodeURIComponent(agent.id)}`)}><Avatar src={agent.avatar ?? undefined}>{agent.name.slice(0, 2)}</Avatar><span>{agent.name}</span><Tag>{agent.status}</Tag></button>)}</main><aside className={styles.detailPane}>{current ? <><Title level={3}>{current.name}</Title><Text>状态：{current.status}</Text><Text>可见性：{current.visibility}</Text><Text>运行状态：{unavailable}</Text><Text>并发上限：{unavailable}</Text><Text>分配详情：{unavailable}</Text><Text>运行记录：{unavailable}</Text><Text>能力：{current.capabilities.join('、') || unavailable}</Text><Text>Skill：{skillsText}</Text><Text>Prompt：{detail.data?.prompt ?? '未提供或无权限查看'}</Text><div className={styles.actionRow}>{canPerformAgentAction(current, 'edit') ? <Button onClick={beginEdit}>编辑</Button> : null}{canPerformAgentAction(current, 'publish') ? <Button onClick={() => publish.mutate({ agentId: current.id }, { onError: () => void detail.refetch() })}>发布为 TEAM</Button> : null}{canPerformAgentAction(current, 'unpublish') ? <Button onClick={() => unpublish.mutate({ agentId: current.id }, { onError: () => void detail.refetch() })}>取消发布</Button> : null}{canPerformAgentAction(current, 'archive') ? <Button danger onClick={() => archive.mutate({ agentId: current.id }, { onError: () => void detail.refetch() })}>归档</Button> : null}</div></> : <Text>{unavailable}</Text>}</aside></div><Modal open={open} title={editing ? '编辑 Agent' : '添加 Agent'} onCancel={() => setOpen(false)} onOk={() => form.submit()}><Form form={form} layout="vertical" onFinish={save}><Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="avatar" label="头像"><Input /></Form.Item><Form.Item name="role" label="角色" rules={[{ required: true }]}><Select options={roles.map((role) => ({ value: role }))} /></Form.Item><Form.Item name="capabilities" label="能力" rules={[{ required: true }]}><Select mode="tags" /></Form.Item><Form.Item name="prompt" label="Prompt" rules={[{ required: true }]}><Input.TextArea /></Form.Item></Form></Modal></div>
}
