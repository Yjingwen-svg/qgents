import { useEffect, useRef, useState } from 'react'
import { Alert, Form, Input, Modal, Radio, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/api'
import { useCreateOrchestrationRun } from '@/hooks'
import { PATHS } from '@/routes/paths'
import type { CreateOrchestrationRunInput, StartMode } from '@/types'

const WORKFLOW_ID = 'system-default-code-delivery' as const

export interface TaskTriggerModalProps {
  open: boolean
  projectId: string
  groupId: string
  initialInstruction: string
  onClose: () => void
}

interface TaskTriggerFormValues {
  instruction: string
  startMode: StartMode
}

function errorMessage(error: Error | null): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    if (error.status === 403) return '暂无权限从该需求群发起任务。'
    if (error.status === 409) return '任务状态或幂等请求发生冲突，请刷新后重试。'
    if (error.status === 422) return '任务说明或启动参数未通过校验，请检查后重试。'
  }
  return '任务创建失败，请稍后重试。'
}

export function TaskTriggerModal({
  open,
  projectId,
  groupId,
  initialInstruction,
  onClose,
}: TaskTriggerModalProps) {
  const [form] = Form.useForm<TaskTriggerFormValues>()
  const navigate = useNavigate()
  const mutation = useCreateOrchestrationRun(projectId)
  const { reset: resetMutation } = mutation
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitLockRef = useRef(false)
  const failureMessage = errorMessage(mutation.error)

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({ instruction: initialInstruction, startMode: 'AUTO' })
    resetMutation()
  }, [form, initialInstruction, open, resetMutation])

  async function handleFinish(values: TaskTriggerFormValues) {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setIsSubmitting(true)
    const input: CreateOrchestrationRunInput = {
      groupId,
      instruction: values.instruction.trim(),
      workflowId: WORKFLOW_ID,
      startMode: values.startMode,
    }

    try {
      const run = await mutation.mutateAsync(input)
      onClose()
      navigate(PATHS.projectTaskDetail(projectId, run.id))
    } catch {
      submitLockRef.current = false
      setIsSubmitting(false)
    }
  }

  const pending = isSubmitting || mutation.isPending

  return (
    <Modal
      open={open}
      title="从需求群发起任务"
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="创建任务"
      cancelText="取消"
      confirmLoading={pending}
      okButtonProps={{ disabled: pending }}
      maskClosable={!pending}
      closable={!pending}
    >
      {failureMessage ? <Alert role="alert" type="error" showIcon message={failureMessage} /> : null}
      <Form<TaskTriggerFormValues>
        form={form}
        layout="vertical"
        initialValues={{ instruction: initialInstruction, startMode: 'AUTO' }}
        onFinish={handleFinish}
        disabled={pending}
      >
        <Form.Item label="当前需求群">
          <Input value={groupId} readOnly />
        </Form.Item>
        <Form.Item
          label="任务说明"
          name="instruction"
          rules={[{ validator: (_, value: unknown) => typeof value === 'string' && value.trim().length > 0
            ? Promise.resolve()
            : Promise.reject(new Error('请输入任务说明')) }]}
        >
          <Input.TextArea rows={5} placeholder="描述希望交付的任务" />
        </Form.Item>
        <Form.Item label="启动方式" name="startMode">
          <Radio.Group>
            <Radio value="AUTO">AUTO：计划完成后自动启动</Radio>
            <Radio value="MANUAL">MANUAL：只生成计划，后续手动启动 WorkPackage</Radio>
          </Radio.Group>
        </Form.Item>
        <Typography.Text type="secondary">
          工作流：{WORKFLOW_ID}。当前没有正式 Testset 数据，因此不选择 Testset。
        </Typography.Text>
      </Form>
    </Modal>
  )
}
