import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, Form, Select, Input, App, Typography, Tag } from 'antd'
import { useTestsets, useCreateTestRun } from '@/hooks'
import type { ProjectBoundRepository, Testset } from '@/types'
import type { CreateTestRunPayload, TestRun } from '@/types/testset'

const { Text } = Typography

interface TestRunCreateModalProps {
  open: boolean
  projectId: string
  repositories: ProjectBoundRepository[]
  onClose: () => void
  onCreated?: (run: TestRun) => void
}

/**
 * Test Run 创建表单 —— 用户主动发起诊断测试
 * 文档：接口文档 §12.4
 * 表单字段：仓库、Testset 列表、源引用、关联 Task（可选）
 *
 * 与 Dry Run 的区别：
 * - Test Run 由用户指定 testsetIds
 * - Dry Run 由服务端按目标分支门禁自动加载 Testset
 */
export default function TestRunCreateModal({
  open,
  projectId,
  repositories,
  onClose,
  onCreated,
}: TestRunCreateModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<CreateTestRunPayload & { testsetIds: string[] }>()
  const [repoId, setRepoId] = useState<string>('')
  const [selectedTestsets, setSelectedTestsets] = useState<Testset[]>([])

  // 稳定的空 filters 引用，避免每次渲染都生成新 queryKey
  const emptyFilters = useMemo(() => ({}), [])

  const { data: allTestsets = [] } = useTestsets(projectId, emptyFilters)

  // 过滤出当前仓库的 Testset
  const repoTestsets = useMemo(() => {
    if (!repoId) return []
    return allTestsets.filter((t) => t.repositoryId === repoId && t.status === 'ENABLED')
  }, [allTestsets, repoId])

  const createMutation = useCreateTestRun(projectId)

  const testsetOptions = useMemo(() => repoTestsets.map((t) => ({
    value: t.id,
    label: (
      <span>
        {t.name}
        <Tag color="blue" style={{ marginLeft: 4 }}>{t.scopeTags.length > 0 ? t.scopeTags.join(', ') : '无标签'}</Tag>
      </span>
    ),
  })), [repoTestsets])

  // 表单初始化
  useEffect(() => {
    if (open && repositories.length > 0 && !repoId) {
      setRepoId(repositories[0].id)
    }
  }, [open, repositories, repoId])

  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields()
      const payload: CreateTestRunPayload = {
        repositoryId: values.repositoryId,
        testsetIds: values.testsetIds,
      }
      if (values.ref) {
        payload.ref = values.ref
      }
      if (values.taskId) {
        payload.taskId = values.taskId
      }

      createMutation.mutate(payload, {
        onSuccess: (run) => {
          message.success(`Test Run 已创建（状态: ${run.status}）`)
          onCreated?.(run)
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
    setSelectedTestsets([])
    onClose()
  }

  return (
    <Modal
      title="运行测试"
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
            onChange={(value) => {
              setRepoId(value)
              form.setFieldsValue({ testsetIds: [] })
              setSelectedTestsets([])
            }}
          >
            {repositories.map((r) => (
              <Select.Option key={r.id} value={r.id}>
                {r.displayName || r.fullName}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="测试集"
          name="testsetIds"
          rules={[{ required: true, message: '请选择至少一个测试集', type: 'array' }]}
          extra={`已启用的测试集：${repoTestsets.length} 个`}
        >
          <Select
            mode="multiple"
            placeholder="选择要运行的测试集"
            showSearch
            optionFilterProp="label"
            options={testsetOptions}
            disabled={!repoId}
            onChange={(values: string[]) => {
              const selected = repoTestsets.filter((t) => values.includes(t.id))
              setSelectedTestsets(selected)
            }}
          />
        </Form.Item>

        {selectedTestsets.length > 0 ? (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f7fa', borderRadius: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              选中 {selectedTestsets.length} 个测试集：
            </Text>
            <div style={{ marginTop: 4 }}>
              {selectedTestsets.map((t) => (
                <Tag key={t.id} color="blue" style={{ marginBottom: 4 }}>
                  {t.name}（超时: {t.timeoutSeconds}s）
                </Tag>
              ))}
            </div>
          </div>
        ) : null}

        <Form.Item
          label="源引用（可选）"
          name="ref"
          extra="不填则使用项目默认分支"
        >
          <Input placeholder="分支名或 commit SHA（可选）" allowClear />
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
            ⚠️ Test Run 由用户手动发起，可指定具体测试集。运行结果将实时刷新页面。
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  )
}
