import { useEffect, useRef, useState } from 'react'
import { Alert, Form, Input, message, Modal, Select, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError, groupApi } from '@/api'
import { githubApi } from '@/api/github'
import { useCreateTask } from '@/hooks/task-model'
import { queryKeys } from '@/query/queryKeys'
import { PATHS } from '@/routes/paths'
import type { TaskCreateInput } from '@/types/task-model'

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
  // 需求群名称：已加载且命中时显示 title，否则保持只读回退为 groupId，保证抽屉中始终可见。
  const requirementGroupName =
    groupsQuery.data?.find((item) => item.id === groupId)?.title?.trim() || groupId
  const requirementGroupLoading = groupsQuery.isLoading

  function handleRepositoryChange(repositoryIds: string[]): void {
    const repository = repositories.find((item) => item.id === repositoryIds[0])
    form.setFieldValue('repositoryIds', repositoryIds)
    if (repository?.defaultBranch) form.setFieldValue('baseRef', repository.defaultBranch)
  }

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({ title: '', requirement: initialInstruction, repositoryIds: [], baseRef: '' })
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
        <Form.Item label="基准分支" name="baseRef" rules={[{ required: true, whitespace: true, message: '请输入基准分支' }]}>
          <Input placeholder="例如 main" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
