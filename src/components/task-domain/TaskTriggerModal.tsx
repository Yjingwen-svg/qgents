import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Form, Input, message, Modal, Select, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError, groupApi } from '@/api'
import { githubApi } from '@/api/github'
import { useCreateTask } from '@/hooks/task-model'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import type { TaskCreateInput } from '@/types/task-model'
import type { RemoteBranch } from '@/types/github'

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
  baseRef: string
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

  // 表单中当前选中的第一个仓库 ID；作为「远程分支列表」拉取的目标（多选时用第一个，
  // 因为 TaskCreateRequest.baseRef 是单值，跨多仓必须使用同名基线）。
  const [selectedFirstRepoId, setSelectedFirstRepoId] = useState<string | null>(null)

  // 拉取第一个选中仓库的真实 GitHub 远程分支列表，用作 baseRef Select 选项。
  // 只从"已存在"分支里选，避免用户手输一个不存在的分支提交到后端直到 Worker 启动才失败。
  const remoteBranchesQuery = useQuery({
    queryKey: queryKeys.remoteBranches.list(projectId, selectedFirstRepoId ?? '', {}),
    queryFn: () =>
      githubApi.listRemoteBranches(projectId, selectedFirstRepoId as string, {}),
    enabled: Boolean(projectId && selectedFirstRepoId && open),
  })

  const baseRefOptions = useMemo(
    () => branchOptions(remoteBranchesQuery.data ?? []),
    [remoteBranchesQuery.data],
  )

  // 需求群名称：已加载且命中时显示 title，否则保持只读回退为 groupId，保证抽屉中始终可见。
  const requirementGroupName =
    groupsQuery.data?.find((item) => item.id === groupId)?.title?.trim() || groupId
  const requirementGroupLoading = groupsQuery.isLoading

  function handleRepositoryChange(repositoryIds: string[]): void {
    const firstRepoId = repositoryIds[0] ?? null
    const repository = repositories.find((item) => item.id === firstRepoId)
    form.setFieldValue('repositoryIds', repositoryIds)
    setSelectedFirstRepoId(firstRepoId)
    // 先回落为绑定记录 defaultBranch（已有），等远程分支列表拉到后再次对齐
    if (repository?.defaultBranch) form.setFieldValue('baseRef', repository.defaultBranch)
    else form.setFieldValue('baseRef', '')
  }

  // 远程分支列表拉取后：如果当前 baseRef 空或不在返回列表里，默认选中「项目默认分支」或第一个
  useEffect(() => {
    if (!remoteBranchesQuery.data) return
    const currentBaseRef = form.getFieldValue('baseRef')
    const names = new Set(remoteBranchesQuery.data.map((b) => b.name))
    if (!currentBaseRef || !names.has(currentBaseRef)) {
      const picked =
        remoteBranchesQuery.data.find((b) => b.isProjectDefault) ??
        remoteBranchesQuery.data[0]
      if (picked) form.setFieldValue('baseRef', picked.name)
    }
  }, [remoteBranchesQuery.data, form])

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({ title: '', requirement: initialInstruction, repositoryIds: [], baseRef: '' })
    setSelectedFirstRepoId(null)
    resetMutation()
    submitLockRef.current = false
    setIsSubmitting(false)
  }, [form, initialInstruction, open, resetMutation])

  async function handleFinish(values: TaskTriggerFormValues) {
    if (submitLockRef.current || repositories.length === 0) return
    submitLockRef.current = true
    setIsSubmitting(true)
    const input: TaskCreateInput = {
      requirementGroupId: groupId,
      title: values.title.trim(),
      requirement: values.requirement.trim(),
      repositoryIds: values.repositoryIds,
      baseRef: values.baseRef.trim(),
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
  const baseRefLoading = selectedFirstRepoId ? remoteBranchesQuery.isLoading : false
  const baseRefDisabled =
    pending || repositoryUnavailable || !selectedFirstRepoId || baseRefLoading

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
      width={560}
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
        <Form.Item
          label="基准分支"
          name="baseRef"
          rules={[{ required: true, whitespace: true, message: '请选择基准分支' }]}
          extra={
            !selectedFirstRepoId
              ? '请先选择仓库，将展示该仓库真实存在的 GitHub 远程分支'
              : baseRefLoading
                ? '正在加载远程分支列表…'
                : '只能选择后端返回已存在的分支；新建任务的 Dry Run / MR 都将以此分支为目标基线'
          }
        >
          <Select
            showSearch
            optionFilterProp="value"
            placeholder={
              baseRefLoading
                ? '加载远程分支中…'
                : selectedFirstRepoId
                  ? '请选择基准分支'
                  : '请先选择仓库'
            }
            disabled={baseRefDisabled}
            loading={baseRefLoading}
            options={baseRefOptions}
            notFoundContent={
              remoteBranchesQuery.isError
                ? '远程分支加载失败，请稍后重试'
                : baseRefLoading
                  ? null
                  : '该仓库暂无可用远程分支'
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
