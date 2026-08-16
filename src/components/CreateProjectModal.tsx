import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Form, Input, Select, Empty, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi, teamApi, githubApi } from '@/api'
import { PATHS } from '@/routes/paths'
import { isGithubRepoBindable } from '@/types/github'
import type { CreateProjectPayload } from '@/types'

const { Text, Link: TextLink } = Typography

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
  const queryClient=useQueryClient()
  const [form] = Form.useForm<CreateProjectPayload>()

  // 团队成员列表（作为「初始成员」多选候选）
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => teamApi.listMembers(teamId),
    enabled: !!teamId && open,
  })

  // 团队已授权 GitHub 仓库（创建时必选，用于一并绑定）
  const { data: teamRepos = [], isLoading: reposLoading } = useQuery({
    queryKey: ['teams', teamId, 'github', 'repositories'],
    queryFn: () => githubApi.listTeamRepositories(teamId),
    enabled: !!teamId && open,
  })
  // 安装列表：用于判断仓库对应 installation 是否 ACTIVE
  const { data: installations = [] } = useQuery({
    queryKey: ['teams', teamId, 'github', 'installations'],
    queryFn: () => githubApi.listInstallations(teamId),
    enabled: !!teamId && open,
  })
  // 仅列出可绑定的授权仓库（已授权、未归档、默认分支非空、安装 ACTIVE）
  const bindableRepos = teamRepos.filter((r) =>
    isGithubRepoBindable(r, installations.find((i) => i.id === r.installationId)),
  )

  const createProject = useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectApi.create(payload),
    onSuccess: (project) => {
      form.resetFields()
      onClose()
      queryClient.invalidateQueries({queryKey:['teams',teamId,'projects']})
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
        <Form.Item name="memberIds" label="初始成员（可选）">
          <Select
            mode="multiple"
            placeholder="从团队成员中选择，选中即加入项目"
            options={teamMembers.map((m) => ({
              value: m.userId,
              label: m.displayName || m.userId,
            }))}
            optionFilterProp="label"
            allowClear
          />
        </Form.Item>
        {/* GitHub 仓库 —— 创建时必选，一并绑定 */}
        <Form.Item
          name="repositoryIds"
          label="GitHub 仓库"
          rules={[{ required: true, message: '请至少绑定一个 GitHub 仓库' }]}
        >
          <Select
            mode="multiple"
            placeholder="选择要绑定的仓库（可多选）"
            loading={reposLoading}
            notFoundContent={
              bindableRepos.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span>
                      暂无已授权的 GitHub 仓库，请先
                      <TextLink onClick={() => { onClose(); navigate(PATHS.githubIntegration(teamId)) }}>去授权</TextLink>
                    </span>
                  }
                />
              ) : undefined
            }
            options={bindableRepos.map((r) => ({
              value: r.id,
              label: r.fullName,
            }))}
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item noStyle>
          <Text type="secondary" style={{ fontSize: 12, marginTop: -16 }}>
            创建项目需绑定至少一个 GitHub 仓库；若列表为空请先完成团队 GitHub App 授权
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  )
}
