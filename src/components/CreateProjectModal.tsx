import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Form, Input, Select, Empty, Radio, Switch, Typography, Upload, Avatar, Button, Space } from 'antd'
import { CameraOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectApi, teamApi, githubApi } from '@/api'
import { useProjectAvatarUpload } from '@/hooks/useProjectAvatarUpload'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'
import { isGithubRepoBindable } from '@/types/github'
import type { CreateProjectPayload, NewProjectRepositoryInput } from '@/types'

const { Text, Link: TextLink } = Typography

interface CreateProjectFormValues extends Omit<CreateProjectPayload, 'teamId' | 'newRepository'> {
  newRepository?: NewProjectRepositoryInput
}

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
  const { user } = useAuth()
  const [form] = Form.useForm<CreateProjectFormValues>()
  const [repositoryMode, setRepositoryMode] = useState<'existing' | 'new'>('existing')
  // 项目头像（v2.0.6：创建时可选；项目创建成功后才直传并回写）
  const { uploading: avatarUploading, uploadAvatar } = useProjectAvatarUpload(teamId)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  // 预览 URL 生命周期：弹窗关闭/重选时释放，避免内存泄漏
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

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
  const activeInstallations = installations.filter((installation) => installation.status === 'ACTIVE')

  const createProject = useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectApi.create(payload),
    // 跳转/头像上传统一在 onFinish 的 mutateAsync 后处理（头像需要先拿到 project.id）
  })

  // 弹窗打开时重置表单
  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({ newRepository: { isPrivate: true } })
      setRepositoryMode('existing')
      setAvatarFile(null)
      setAvatarPreview(null)
    }
  }, [open, form])

  // 选择头像：仅暂存文件与本地预览，项目创建成功后才直传 OSS 并回写
  function handleAvatarSelect(file: File): boolean {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    return false
  }

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
        onFinish={async (values) => {
          const newRepository = values.newRepository
          try {
            // 先创建项目（拿到 project.id），再直传头像回写，最后跳转项目总群
            const project = await createProject.mutateAsync({
              teamId,
              name: values.name,
              description: values.description,
              memberIds: values.memberIds,
              repositoryIds: repositoryMode === 'existing' ? values.repositoryIds : undefined,
              newRepository: repositoryMode === 'new' && newRepository
                ? {
                    name: newRepository.name.trim(),
                    description: newRepository.description?.trim() || undefined,
                    isPrivate: newRepository.isPrivate ?? true,
                    installationId: activeInstallations.length === 1
                      ? undefined
                      : newRepository.installationId,
                    displayName: newRepository.displayName?.trim() || undefined,
                  }
                : undefined,
            })
            if (avatarFile) {
              await uploadAvatar(project.id, avatarFile)
            }
            form.resetFields()
            setAvatarFile(null)
            setAvatarPreview(null)
            onClose()
            queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'projects'] })
            navigate(PATHS.projectDetail(project.id), { replace: true })
          } catch {
            // mutateAsync 抛错由 useMutation 的 onError 兜底提示（此处保持弹窗打开，用户可修正后重试）
          }
        }}
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
        {/* 项目头像（v2.0.6）：创建时可选，创建成功后再直传回写；项目主群会话头像跟随项目头像 */}
        <Form.Item label="项目头像（可选）">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar size={48} src={avatarPreview ?? undefined} icon={<CameraOutlined />} style={{ flexShrink: 0 }} />
            <Upload accept="image/*" showUploadList={false} beforeUpload={handleAvatarSelect}>
              <Button icon={<UploadOutlined />} loading={avatarUploading}>
                {avatarFile ? '重新选择' : '选择头像'}
              </Button>
            </Upload>
            {avatarFile ? (
              <Button type="text" onClick={() => { setAvatarFile(null); setAvatarPreview(null) }}>
                移除
              </Button>
            ) : null}
          </div>
        </Form.Item>
        <Form.Item name="memberIds" label="初始成员（可选）">
          <Select
            mode="multiple"
            placeholder="从团队成员中选择，选中即加入项目"
            // 创建者自动成为项目成员，前端过滤自己避免误选
            options={teamMembers
              .filter((m) => m.userId !== user?.id)
              .map((m) => ({
                value: m.userId,
                // label 用 ReactNode：选项显示头像 + 昵称（无头像显示昵称首字）
                label: (
                  <Space size={6}>
                    <Avatar size={20} src={m.avatarUrl} style={{ background: '#3b82f6' }}>
                      {(m.displayName || m.userId).slice(0, 1)}
                    </Avatar>
                    {m.displayName || m.userId}
                  </Space>
                ),
                // ReactNode label 无法直接按文本过滤，用 searchText 兜底
                searchText: m.displayName || m.userId,
              }))}
            filterOption={(input, option) =>
              String((option as { searchText?: string } | undefined)?.searchText ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            allowClear
          />
        </Form.Item>
        <Form.Item label="GitHub 仓库来源">
          <Radio.Group
            value={repositoryMode}
            onChange={(event) => {
              const mode = event.target.value as 'existing' | 'new'
              setRepositoryMode(mode)
              if (mode === 'existing') form.setFieldsValue({ newRepository: { isPrivate: true } })
              else form.setFieldValue('repositoryIds', undefined)
            }}
            options={[
              { value: 'existing', label: '绑定已有仓库' },
              { value: 'new', label: '自动新建仓库' },
            ]}
          />
        </Form.Item>
        {/* GitHub 仓库 —— 创建时可选，一并绑定 */}
        <Form.Item
          name="repositoryIds"
          label="GitHub 仓库"
          hidden={repositoryMode !== 'existing'}
          rules={repositoryMode === 'existing' ? [{ required: true, message: '请至少绑定一个 GitHub 仓库' }] : []}
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
        {repositoryMode === 'new' ? <>
          <Form.Item name={['newRepository', 'name']} label="新仓库名称" rules={[{ required: true, pattern: /^[a-z0-9][a-z0-9._-]*$/, message: '仅支持小写字母、数字、-、_、.' }]}>
            <Input placeholder="例如 qgents-web" maxLength={100} />
          </Form.Item>
          <Form.Item name={['newRepository', 'description']} label="仓库描述（可选）">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={200} />
          </Form.Item>
          <Form.Item name={['newRepository', 'displayName']} label="项目内显示名称（可选）">
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name={['newRepository', 'isPrivate']} label="私有仓库" valuePropName="checked">
            <Switch />
          </Form.Item>
          {activeInstallations.length > 1 ? <Form.Item name={['newRepository', 'installationId']} label="GitHub 安装记录" rules={[{ required: true, message: '请选择用于创建仓库的 GitHub 安装记录' }]}>
            <Select options={activeInstallations.map((installation) => ({ value: installation.id, label: installation.accountLogin }))} />
          </Form.Item> : null}
          {activeInstallations.length === 0 ? <Text type="danger">当前团队没有可用的 GitHub App 安装记录，无法自动创建仓库。</Text> : null}
        </> : null}
        <Form.Item noStyle hidden={repositoryMode !== 'existing'}>
          <Text type="secondary" style={{ fontSize: 12, marginTop: -16 }}>
            创建项目需绑定至少一个 GitHub 仓库；若列表为空请先完成团队 GitHub App 授权
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  )
}
