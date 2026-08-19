import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, Form, Select, Input, App, Typography, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { githubApi } from '@/api'
import { useCreateDryRun } from '@/hooks'
import { queryKeys } from '@/query'
import type { DryRunReport, ProjectBoundRepository } from '@/types'
import type { CreateDryRunPayload } from '@/types/testset'

const { Text } = Typography

interface DryRunCreateModalProps {
  open: boolean
  projectId: string
  repositories: ProjectBoundRepository[]
  onClose: () => void
  onCreated?: (report: DryRunReport) => void
}

/**
 * Dry Run 创建表单 —— 手动触发 MR 前合并预演
 * 文档：Dry Run前后端执行计划 §5.1
 * 表单字段：仓库、源引用、目标分支、关联 Task（可选）
 * 不展示 testsetIds 选择器 —— 服务端会按目标分支门禁自动加载 Testset
 */
export default function DryRunCreateModal({
  open,
  projectId,
  repositories,
  onClose,
  onCreated,
}: DryRunCreateModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<CreateDryRunPayload>()
  const [repoId, setRepoId] = useState<string>('')

  // 稳定的查询参数引用，避免每次渲染都生成新 queryKey 导致无限重获取
  const branchFilters = useMemo(() => ({ limit: 50 }), [])

  // 加载当前仓库的远程分支列表（作为源引用/目标分支候选）
  const { data: remoteBranches = [] } = useQuery({
    queryKey: queryKeys.remoteBranches.list(projectId, repoId, branchFilters),
    queryFn: () => githubApi.listRemoteBranches(projectId, repoId, branchFilters),
    enabled: Boolean(projectId && repoId),
  })

  const createMutation = useCreateDryRun(projectId)

  const targetBranchOptions = useMemo(() => remoteBranches.map((b) => ({
    value: b.name,
    label: (
      <span>
        {b.name}
        {b.isProjectDefault ? <Tag color="blue" style={{ marginLeft: 4 }}>项目默认</Tag> : null}
        {b.isGithubDefault ? <Tag color="gray" style={{ marginLeft: 4 }}>GitHub 默认</Tag> : null}
      </span>
    ),
  })), [remoteBranches])

  const sourceRefOptions = useMemo(() => remoteBranches.map((b) => ({
    value: b.name,
    label: (
      <span>
        {b.name}
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          {b.headCommit ? b.headCommit.slice(0, 7) : ''}
        </Text>
      </span>
    ),
  })), [remoteBranches])

  // 表单初始化：当仓库变化时，自动选中项目默认分支作为目标
  useEffect(() => {
    if (open && repositories.length > 0 && !repoId) {
      setRepoId(repositories[0].id)
    }
  }, [open, repositories, repoId])

  useEffect(() => {
    if (open && repoId && remoteBranches.length > 0) {
      const defaultBranch = remoteBranches.find((b) => b.isProjectDefault)
      if (defaultBranch) {
        form.setFieldsValue({ targetBranch: defaultBranch.name })
      }
    }
  }, [open, repoId, remoteBranches, form])

  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields()
      const payload: CreateDryRunPayload = {
        repositoryId: values.repositoryId,
        sourceRef: values.sourceRef,
        targetBranch: values.targetBranch,
      }
      if (values.taskId) {
        payload.taskId = values.taskId
      }

      createMutation.mutate(payload, {
        onSuccess: (report) => {
          message.success(`Dry Run 已创建（状态: ${report.status}）`)
          onCreated?.(report)
          handleClose()
        },
        onError: (err) => {
          message.error(`创建失败: ${err.message}`)
        },
      })
    } catch {
      // 表单验证失败
    }
  }, [form, createMutation, message, onCreated])

  function handleClose() {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="新建 Dry Run"
      open={open}
      onOk={() => void handleOk()}
      onCancel={handleClose}
      confirmLoading={createMutation.isPending}
      destroyOnHidden
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ repositoryId: repoId }}
      >
        <Form.Item
          label="仓库"
          name="repositoryId"
          rules={[{ required: true, message: '请选择仓库' }]}
        >
          <Select
            placeholder="选择仓库"
            showSearch
            optionFilterProp="label"
            onChange={(value) => setRepoId(value)}
          >
            {repositories.map((r) => (
              <Select.Option key={r.id} value={r.id}>
                {r.displayName || r.fullName}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="源引用"
          name="sourceRef"
          rules={[{ required: true, message: '请选择源分支或提交引用' }]}
          extra="Dry Run 将从此分支/提交合并到目标分支"
        >
          <Select
            placeholder="选择源分支"
            showSearch
            optionFilterProp="value"
            options={sourceRefOptions}
            loading={Boolean(repoId) && remoteBranches.length === 0}
          />
        </Form.Item>

        <Form.Item
          label="目标分支"
          name="targetBranch"
          rules={[{ required: true, message: '请选择目标分支' }]}
          extra="服务端会自动加载该分支绑定的必选 Testset"
        >
          <Select
            placeholder="选择目标分支"
            showSearch
            optionFilterProp="value"
            options={targetBranchOptions}
            loading={Boolean(repoId) && remoteBranches.length === 0}
          />
        </Form.Item>

        <Form.Item
          label="关联 Task（可选）"
          name="taskId"
          extra="如指定，将校验 Task 归属与 HEAD 一致性"
        >
          <Input placeholder="Task ID（可选）" allowClear />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ⚠️ Dry Run 创建后立即返回 QUEUED 状态，不代表已通过。合并预演和 Testset 执行将在后台完成。
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  )
}
