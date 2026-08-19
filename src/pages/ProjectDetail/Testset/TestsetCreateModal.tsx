import { useEffect, useMemo, useState } from 'react'
import { Modal, Form, Select, Input, InputNumber, App, Space, Tag } from 'antd'
import type { ProjectBoundRepository, Testset } from '@/types'
import type { CreateTestsetPayload, UpdateTestsetPayload } from '@/types/testset'

const { TextArea } = Input

interface TestsetCreateModalProps {
  open: boolean
  projectId: string
  repositories: ProjectBoundRepository[]
  /** 编辑时传入；不传则为新建模式 */
  editing?: Testset | null
  onClose: () => void
  onSubmit: (payload: CreateTestsetPayload | UpdateTestsetPayload, testsetId?: string) => Promise<void>
}

/**
 * Testset 新建/编辑弹窗
 * 文档：接口文档 §11 Testset 管理
 */
export default function TestsetCreateModal({
  open,
  projectId: _projectId,
  repositories,
  editing,
  onClose,
  onSubmit,
}: TestsetCreateModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [tagInput, setTagInput] = useState('')

  const isEdit = Boolean(editing)

  // 初始化表单
  useEffect(() => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        repositoryId: editing.repositoryId,
        scopeTags: editing.scopeTags,
        command: editing.command,
        timeoutSeconds: editing.timeoutSeconds,
        expectedExitCode: editing.passRule.expected,
        acceptanceNotes: editing.acceptanceNotes,
      })
    } else if (repositories.length > 0) {
      form.setFieldsValue({
        repositoryId: repositories[0].id,
        timeoutSeconds: 900,
        expectedExitCode: 0,
        scopeTags: [],
      })
    }
    setTagInput('')
  }, [open, editing, repositories, form])

  const repoOptions = useMemo(() =>
    repositories.map((r) => ({
      value: r.id,
      label: r.displayName || r.fullName,
    })), [repositories])

  async function handleOk() {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (isEdit && editing) {
        const payload: UpdateTestsetPayload = {}
        if (values.name !== editing.name) payload.name = values.name
        if (values.repositoryId !== editing.repositoryId) payload.repositoryId = values.repositoryId
        payload.scopeTags = values.scopeTags ?? []
        if (values.command !== editing.command) payload.command = values.command
        if (values.timeoutSeconds !== editing.timeoutSeconds) payload.timeoutSeconds = values.timeoutSeconds
        payload.passRule = { type: 'EXIT_CODE', expected: values.expectedExitCode ?? 0 }
        payload.acceptanceNotes = values.acceptanceNotes ?? ''

        if (Object.keys(payload).length === 0) {
          message.info('没有变化需要保存')
          onClose()
          return
        }

        await onSubmit(payload, editing.id)
      } else {
        const payload: CreateTestsetPayload = {
          name: values.name,
          repositoryId: values.repositoryId,
          scopeTags: values.scopeTags ?? [],
          command: values.command,
          timeoutSeconds: values.timeoutSeconds ?? 900,
          passRule: { type: 'EXIT_CODE', expected: values.expectedExitCode ?? 0 },
          acceptanceNotes: values.acceptanceNotes ?? '',
        }
        await onSubmit(payload)
      }
      onClose()
    } catch {
      // 表单验证失败
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    form.resetFields()
    setTagInput('')
    onClose()
  }

  const appendTag = () => {
    const tag = tagInput.trim()
    if (!tag) return
    const current: string[] = form.getFieldValue('scopeTags') ?? []
    if (!current.includes(tag)) {
      form.setFieldsValue({ scopeTags: [...current, tag] })
    }
    setTagInput('')
  }

  return (
    <Modal
      title={isEdit ? '编辑测试集' : '新建测试集'}
      open={open}
      onOk={() => void handleOk()}
      onCancel={handleClose}
      confirmLoading={submitting}
      destroyOnHidden
      width={640}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          label="测试集名称"
          name="name"
          rules={[
            { required: true, message: '请输入测试集名称' },
            { max: 100, message: '名称最多 100 字符' },
          ]}
        >
          <Input placeholder="如：登录流程测试、支付核心路径..." />
        </Form.Item>

        <Form.Item
          label="所属仓库"
          name="repositoryId"
          rules={[{ required: true, message: '请选择仓库' }]}
        >
          <Select
            placeholder="选择仓库"
            showSearch
            optionFilterProp="label"
            options={repoOptions}
            disabled={repositories.length === 0}
          />
        </Form.Item>

        <Form.Item
          label="命令"
          name="command"
          rules={[{ required: true, message: '请输入测试命令' }]}
          extra="在受控 Sandbox 中执行的 Shell 命令"
        >
          <TextArea
            placeholder="如：npm test -- --watchAll=false"
            rows={2}
          />
        </Form.Item>

        <Form.Item
          label="超时（秒）"
          name="timeoutSeconds"
          rules={[{ required: true, message: '请输入超时时间' }]}
        >
          <InputNumber min={10} max={3600} style={{ width: 160 }} />
        </Form.Item>

        <Form.Item
          label="通过规则"
          name="expectedExitCode"
          rules={[{ required: true, message: '请输入预期退出码' }]}
          extra="当命令退出码等于此值时视为通过"
        >
          <InputNumber min={0} max={255} style={{ width: 160 }} />
        </Form.Item>

        <Form.Item
          label="范围标签"
          name="scopeTags"
          extra="用于 Dry Run / 测试运行时的过滤与分组"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item name="scopeTags" noStyle>
              <Select
                mode="tags"
                placeholder="输入标签后按回车添加"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Space>
              <Input
                placeholder="快速添加标签"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onPressEnter={appendTag}
                style={{ width: 200 }}
              />
              <Tag.CheckableTag checked={false} onClick={appendTag}>添加</Tag.CheckableTag>
            </Space>
          </Space>
        </Form.Item>

        <Form.Item
          label="验收说明"
          name="acceptanceNotes"
        >
          <TextArea
            placeholder="可选：描述验收标准、前置条件等"
            rows={3}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}