import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Card, Divider, Form, Input, message, Modal, Select, Spin, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError, groupApi } from '@/api'
import { githubApi } from '@/api/github'
import { useCreateTask } from '@/hooks/task-model'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import type { TaskCreateInput } from '@/types/task-model'
import type { ProjectBoundRepository, RemoteBranch } from '@/types/github'

export interface TaskTriggerModalProps {
  open: boolean
  projectId: string
  groupId: string
  initialInstruction: string
  onClose: () => void
}

interface TaskTriggerFormValues {
  title: string
  requirement: string
  repositoryIds: string[]
}

function errorMessage(error: Error | null): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    if (error.status === 403) return '暂无权限从该需求群创建任务。'
    if (error.status === 409) return '任务状态或并发请求发生冲突，请刷新后重试。'
    if (error.status === 422) return '任务字段未通过校验，请检查后重试。'
  }
  return '任务创建失败，请稍后重试。'
}

/**
 * 把远程分支列表渲染为 Select 选项，并标注「项目默认 / GitHub 默认」。
 */
function branchOptions(branches: RemoteBranch[]) {
  return branches
    .slice()
    .sort((a, b) => {
      // 项目默认 → GitHub 默认 → 其它字母序
      const rankA = (a.isProjectDefault ? 0 : 2) + (a.isGithubDefault ? 0 : 1)
      const rankB = (b.isProjectDefault ? 0 : 2) + (b.isGithubDefault ? 0 : 1)
      if (rankA !== rankB) return rankA - rankB
      return a.name.localeCompare(b.name)
    })
    .map((branch) => ({
      value: branch.name,
      label: (
        <span>
          <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{branch.name}</span>
          {branch.isProjectDefault ? (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#1677ff' }}>项目默认</span>
          ) : null}
          {branch.isGithubDefault && !branch.isProjectDefault ? (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#8c8c8c' }}>GitHub 默认</span>
          ) : null}
          {branch.headCommit ? (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#8c8c8c' }}>
              {branch.headCommit.slice(0, 7)}
            </span>
          ) : null}
        </span>
      ),
    }))
}

export function TaskTriggerModal({ open, projectId, groupId, initialInstruction, onClose }: TaskTriggerModalProps) {
  const [form] = Form.useForm<TaskTriggerFormValues>()
  const navigate = useNavigate()
  const mutation = useCreateTask(projectId)
  const repositoriesQuery = useQuery({
    queryKey: queryKeys.projectRepositories(projectId),
    queryFn: () => githubApi.listProjectRepositories(projectId),
    enabled: Boolean(projectId && open),
  })
  // 复用 ChatPanel 的缓存键，避免重复请求；展示需求群时优先用 title（需求群名称），仅在加载或查不到时回落为 groupId。
  const groupsQuery = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => groupApi.listByProject(projectId),
    enabled: Boolean(projectId && open),
  })
  const { reset: resetMutation } = mutation
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitLockRef = useRef(false)
  const failureMessage = errorMessage(mutation.error)
  const repositories = repositoriesQuery.data ?? []
  const repositoryOptions = repositories.map((repository) => ({
    value: repository.id,
    label: repository.fullName || repository.repositoryId || '暂无',
  }))

  const [selectedRepositoryIds, setSelectedRepositoryIds] = useState<string[]>([])
  const [baseRefs, setBaseRefs] = useState<Record<string, string>>({})

  // 需求群名称：已加载且命中时显示 title，否则保持只读回退为 groupId，保证抽屉中始终可见。
  const requirementGroupName =
    groupsQuery.data?.find((item) => item.id === groupId)?.title?.trim() || groupId
  const requirementGroupLoading = groupsQuery.isLoading

  function handleRepositoryChange(repositoryIds: string[]): void {
    form.setFieldValue('repositoryIds', repositoryIds)
    setSelectedRepositoryIds(repositoryIds)
    setBaseRefs((current) => Object.fromEntries(repositoryIds.map((id) => [id, current[id] ?? repositories.find((repo) => repo.id === id)?.defaultBranch ?? ''])))
  }

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({ title: '', requirement: initialInstruction, repositoryIds: [] })
    setSelectedRepositoryIds([])
    setBaseRefs({})
    resetMutation()
    submitLockRef.current = false
    setIsSubmitting(false)
  }, [form, initialInstruction, open, resetMutation])

  async function handleFinish(values: TaskTriggerFormValues) {
    if (submitLockRef.current || repositories.length === 0) return
    const repositoryRefs = values.repositoryIds.map((repositoryId) => ({
      repositoryId,
      baseRef: (baseRefs[repositoryId] ?? '').trim(),
    }))
    if (repositoryRefs.some((item) => !item.baseRef)) {
      message.error('请为每个已选仓库选择基准分支')
      return
    }
    // 选中仓库中如果存在未初始化仓库，提示并阻止提交
    const uninitializedRepos = repositories.filter(
      (r) => values.repositoryIds.includes(r.id) && !r.defaultBranch,
    )
    if (uninitializedRepos.length > 0) {
      message.error(
        `仓库 ${uninitializedRepos.map((r) => r.fullName).join(', ')} 尚未初始化，请先在 GitHub 端初始化并设置项目默认基准分支`,
      )
      return
    }
    submitLockRef.current = true
    setIsSubmitting(true)
    const input: TaskCreateInput = {
      requirementGroupId: groupId,
      title: values.title.trim(),
      requirement: values.requirement.trim(),
      repositoryIds: values.repositoryIds,
      repositoryRefs,
    }
    try {
      const task = await mutation.mutateAsync(input)
      onClose()
      message.success('任务已提交至云端，可以安全离开页面')
      navigate(`${PATHS.projectTasks(projectId)}?taskId=${encodeURIComponent(task.id)}`)
    } catch {
      submitLockRef.current = false
      setIsSubmitting(false)
    }
  }

  const pending = isSubmitting || mutation.isPending
  const repositoryUnavailable = !repositoriesQuery.isLoading && repositories.length === 0
  return (
    <Modal
      open={open}
      title="创建任务"
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="创建任务"
      cancelText="取消"
      confirmLoading={pending}
      okButtonProps={{ disabled: pending || repositoriesQuery.isLoading || repositoryUnavailable }}
      maskClosable={!pending}
      closable={!pending}
      width={720}
    >
      {failureMessage ? <Alert role="alert" type="error" showIcon message={failureMessage} /> : null}
      {repositoriesQuery.isError ? <Alert role="alert" type="error" showIcon message="项目仓库加载失败，请稍后重试。" /> : null}
      {repositoryUnavailable && !repositoriesQuery.isError ? <Alert type="info" showIcon message="当前项目暂无可用仓库，无法创建任务。" /> : null}
      <Form<TaskTriggerFormValues>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={pending || repositoryUnavailable}
      >
        <Form.Item label="需求群">
          <Spin size="small" spinning={requirementGroupLoading}>
            <Input value={requirementGroupName} readOnly />
          </Spin>
        </Form.Item>
        <Form.Item label="任务标题" name="title" rules={[{ required: true, whitespace: true, message: '请输入任务标题' }]}>
          <Input placeholder="请输入任务标题" />
        </Form.Item>
        <Form.Item label="需求说明" name="requirement" rules={[{ required: true, whitespace: true, message: '请输入需求说明' }]}>
          <Input.TextArea rows={5} placeholder="描述希望交付的任务" />
        </Form.Item>
        <Form.Item label="仓库" name="repositoryIds" rules={[{ required: true, type: 'array', min: 1, message: '至少选择一个仓库' }]}>
          <Select mode="multiple" options={repositoryOptions} placeholder="请选择仓库" onChange={handleRepositoryChange} />
        </Form.Item>
        {selectedRepositoryIds.length > 0 ? <>
          <Divider titlePlacement="start" plain>仓库基准分支</Divider>
          <Typography.Text type="secondary">每个仓库可以使用不同的基准分支；默认已填充该仓库的项目默认分支。</Typography.Text>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {selectedRepositoryIds.map((repositoryId) => <RepositoryBranchField key={repositoryId} projectId={projectId} repository={repositories.find((item) => item.id === repositoryId)} value={baseRefs[repositoryId] ?? ''} disabled={pending} onChange={(value) => setBaseRefs((current) => ({ ...current, [repositoryId]: value }))} />)}
          </div>
        </> : null}
      </Form>
    </Modal>
  )
}

function RepositoryBranchField({ projectId, repository, value, disabled, onChange }: { projectId: string; repository: ProjectBoundRepository | undefined; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const repositoryId = repository?.id ?? ''
  const query = useQuery({
    queryKey: queryKeys.remoteBranches.list(projectId, repositoryId, {}),
    queryFn: () => githubApi.listRemoteBranches(projectId, repositoryId, {}),
    enabled: Boolean(projectId && repositoryId),
  })
  const options = useMemo(() => branchOptions(query.data ?? []), [query.data])
  const unavailable = !repository?.defaultBranch
  useEffect(() => {
    if (!query.data || query.data.length === 0) return
    const names = new Set(query.data.map((branch) => branch.name))
    if (value && names.has(value)) return
    const picked = query.data.find((branch) => branch.isProjectDefault) ?? query.data[0]
    if (picked) onChange(picked.name)
  }, [onChange, query.data, value])

  return <Card size="small" title={repository?.fullName || '仓库'}>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 1fr)', gap: 12, alignItems: 'center' }}>
      <Typography.Text type="secondary">默认基准：{repository?.defaultBranch || '未设置'}</Typography.Text>
      <Select aria-label={`基准分支：${repository?.fullName || repositoryId}`} showSearch optionFilterProp="value" value={value || undefined} placeholder={unavailable ? '仓库未初始化' : query.isLoading ? '加载分支中…' : '请选择基准分支'} disabled={disabled || unavailable || query.isLoading || query.isError} loading={query.isLoading} options={options} onChange={onChange} notFoundContent={query.isError ? '远程分支加载失败' : '暂无可用远程分支'} />
    </div>
    {unavailable ? <Typography.Text type="danger">该仓库没有默认分支，无法创建任务。</Typography.Text> : query.isError ? <Typography.Text type="danger">远程分支加载失败，请稍后重试。</Typography.Text> : null}
  </Card>
}
