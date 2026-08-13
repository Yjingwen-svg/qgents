import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Form, Input } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { projectApi } from '@/api'
import { PATHS } from '@/routes/paths'
import type { CreateProjectPayload } from '@/types'

/**
 * 创建项目弹窗 —— 复用给团队详情页 / 个人中心
 *
 * 表单字段对齐接口文档 v1.1.8 §5.2：
 * - name 必填
 * - description 选填
 * 创建成功后跳转到项目总群（项目详情根路径，由 ProjectDetailLayout 落到总群）
 */
export function CreateProjectModal({
  teamId,
  open,
  onClose,
}: {
  teamId: string
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [form] = Form.useForm<CreateProjectPayload>()

  const createProject = useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectApi.create(payload),
    onSuccess: (project) => {
      form.resetFields()
      onClose()
      navigate(PATHS.projectDetail(project.id), { replace: true })
    },
  })

  // 弹窗打开时重置表单
  useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  return (
    <Modal
      title="创建项目"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={createProject.isPending}
      okText="创建"
      cancelText="取消"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => createProject.mutate({ ...values, teamId })}
      >
        <Form.Item
          name="name"
          label="项目名称"
          rules={[{ required: true, message: '请输入项目名称' }]}
        >
          <Input placeholder="例如：Qgents Web" maxLength={50} />
        </Form.Item>
        <Form.Item name="description" label="项目简介（可选）">
          <Input.TextArea
            placeholder="描述项目用途与协作方向"
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={200}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
