import { useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd'
import { isTestsetEnabled } from '@/api/testset'
import { useBranchPolicy, useQualityGate, useUpdateBranchPolicy, useUpdateQualityGate } from '@/hooks/qualityGate'
import { formatApiError } from '@/utils/formatApiError'
import type { ProjectBoundRepository } from '@/types/github'
import type { Testset } from '@/types/testset'
import type { BranchPolicyUpdateInput, QualityGateUpdateInput } from '@/types/qualityGate'
import styles from './TestsetPage.module.scss'

const { Text } = Typography

/**
 * 分支策略与质量门禁配置。
 * 入口：Testset 页右上「分支策略与门禁」。
 * 仅 PROJECT_ADMIN 可编辑；普通成员只读展示（或后端 403 时提示无权限）。
 * 强制 Testset（requiredTestsetIds）候选仅为同一仓库、已启用的 Testset。
 */
export function QualityGateConfigDrawer({
  open,
  onClose,
  projectId,
  isAdmin,
  repositories,
  testsets,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  isAdmin: boolean
  repositories: ProjectBoundRepository[]
  testsets: Testset[]
}) {
  const { message } = App.useApp()
  const [repositoryId, setRepositoryId] = useState<string | undefined>()
  const [branch, setBranch] = useState('main')

  const policyQuery = useBranchPolicy(projectId, repositoryId ?? '', branch)
  const gateQuery = useQualityGate(projectId, repositoryId ?? '', branch)
  const updatePolicy = useUpdateBranchPolicy(projectId)
  const updateGate = useUpdateQualityGate(projectId)

  const [policyForm] = Form.useForm<BranchPolicyUpdateInput>()
  const [gateForm] = Form.useForm<QualityGateUpdateInput>()

  // 换仓库时用默认分支作为目标分支
  function handleRepoChange(value: string | undefined): void {
    setRepositoryId(value)
    const repo = repositories.find((item) => item.id === value)
    setBranch(repo?.defaultBranch?.trim() || 'main')
  }

  useEffect(() => {
    if (!open) return
    if (!repositoryId && repositories.length > 0) {
      const first = repositories[0]
      console.log('[QualityGate] 选择仓库', {
        id: first.id,
        repositoryId: first.repositoryId,
        fullName: first.fullName,
      })
      setRepositoryId(first.id)
      setBranch(first.defaultBranch?.trim() || 'main')
    }
  }, [open, repositories, repositoryId])

  useEffect(() => {
    if (!policyQuery.data) return
    policyForm.setFieldsValue({
      requirePullRequest: policyQuery.data.requirePullRequest,
      minimumHumanApprovals: policyQuery.data.minimumHumanApprovals,
      allowDirectPush: policyQuery.data.allowDirectPush,
    })
  }, [policyQuery.data, policyForm])

  useEffect(() => {
    if (!gateQuery.data) return
    gateForm.setFieldsValue({ requiredTestsetIds: gateQuery.data.requiredTestsetIds })
  }, [gateQuery.data, gateForm])

  async function savePolicy(values: BranchPolicyUpdateInput): Promise<void> {
    if (!repositoryId || !branch) return
    try {
      await updatePolicy.mutateAsync({ repositoryId, branch, input: values })
      message.success('已保存分支策略')
    } catch (error) {
      message.error(formatApiError(error))
    }
  }

  async function saveGate(values: QualityGateUpdateInput): Promise<void> {
    if (!repositoryId || !branch) return
    try {
      await updateGate.mutateAsync({
        repositoryId,
        branch,
        input: { requiredTestsetIds: values.requiredTestsetIds ?? [] },
      })
      message.success('已保存质量门禁')
    } catch (error) {
      message.error(formatApiError(error))
    }
  }

  const enabledTestsets = testsets.filter((item) => item.repositoryId === repositoryId && isTestsetEnabled(item))
  const loading = Boolean(repositoryId && branch) && (policyQuery.isLoading || gateQuery.isLoading)
  const readOnly = !isAdmin

  return (
    <Drawer
      title="分支策略与质量门禁"
      placement="right"
      size={560}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space wrap>
          <Select
            style={{ minWidth: 220 }}
            placeholder="选择仓库"
            value={repositoryId}
            onChange={handleRepoChange}
            options={repositories.map((repo) => ({ value: repo.id, label: repo.displayName || repo.fullName || repo.id }))}
          />
          <Input
            style={{ width: 180 }}
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            placeholder="目标分支，如 main"
            addonBefore="分支"
          />
        </Space>

        {!repositoryId ? (
          <Alert type="info" showIcon message="请先选择仓库" />
        ) : null}

        {!isAdmin ? (
          <Alert type="info" showIcon message="你以成员身份查看；仅 Project Admin 可编辑分支策略与门禁。" />
        ) : null}

        {loading ? (
          <div className={styles.state} role="status">
            <Spin description="正在加载分支策略与门禁" />
          </div>
        ) : null}

        {!loading && repositoryId && branch ? (
          <>
            <Card size="small" title="分支策略">
              {policyQuery.isError ? (
                <Alert type="error" showIcon message={formatApiError(policyQuery.error)} />
              ) : (
                <Form<BranchPolicyUpdateInput>
                  form={policyForm}
                  layout="vertical"
                  disabled={readOnly}
                  initialValues={{
                    requirePullRequest: policyQuery.data?.requirePullRequest ?? false,
                    minimumHumanApprovals: policyQuery.data?.minimumHumanApprovals ?? 0,
                    allowDirectPush: policyQuery.data?.allowDirectPush ?? false,
                  }}
                  onFinish={(values) => void savePolicy(values)}
                >
                  <Form.Item name="requirePullRequest" label="要求 Pull Request" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="minimumHumanApprovals" label="最少人工审批数">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="allowDirectPush" label="允许直接推送" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  {isAdmin ? (
                    <Button type="primary" htmlType="submit" loading={updatePolicy.isPending}>
                      保存分支策略
                    </Button>
                  ) : null}
                </Form>
              )}
            </Card>

            <Card size="small" title="质量门禁">
              {gateQuery.isError ? (
                <Alert type="error" showIcon message={formatApiError(gateQuery.error)} />
              ) : (
                <Form<QualityGateUpdateInput>
                  form={gateForm}
                  layout="vertical"
                  disabled={readOnly}
                  initialValues={{ requiredTestsetIds: gateQuery.data?.requiredTestsetIds ?? [] }}
                  onFinish={(values) => void saveGate(values)}
                >
                  <div className={styles.columnTitle}>
                    <Text strong>MR 后必过检查（只读）</Text>
                  </div>
                  <Space wrap size={[4, 4]} style={{ marginBottom: 12 }}>
                    {(gateQuery.data?.requiredChecks ?? []).map((check) => (
                      <Tag key={check}>{check}</Tag>
                    ))}
                    {(gateQuery.data?.requiredChecks ?? []).length === 0 ? (
                      <Text type="secondary">无</Text>
                    ) : null}
                  </Space>

                  <Form.Item
                    name="requiredTestsetIds"
                    label="强制 Testset（该分支 Dry Run 必跑）"
                    extra="仅同一仓库、已启用的 Testset 可作为候选；普通成员不可绕过。"
                  >
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="选择强制 Testset"
                      options={enabledTestsets.map((item) => ({ value: item.id, label: item.name }))}
                    />
                  </Form.Item>
                  {isAdmin ? (
                    <Button type="primary" htmlType="submit" loading={updateGate.isPending}>
                      保存门禁
                    </Button>
                  ) : null}
                </Form>
              )}
            </Card>
          </>
        ) : null}
      </Space>
    </Drawer>
  )
}
