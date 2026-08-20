 MR 列表待创建占位记录

本节补充 GET /api/v1/projects/{projectId}/merge-requests 与既有
POST /api/v1/projects/{projectId}/merge-requests 的待创建 MR 展示契约。
本次不新增接口，不新增数据库表或 MergeRequestEntity.status 状态；待创建记录仅由列表接口按条件临时生成。

43.1 待创建记录的适用范围

当 Task 已进入 WAITING_PREFLIGHT、Workspace repository 存在有效 sourceBranch 和 headCommit，且同一项目仓库与源分支不存在未合并真实 MR 时，默认 MR 列表会注入一条待创建占位记录。

占位记录表示“当前存在待创建 MR 候选”，不代表已经 commit、push、创建 GitHub Pull Request 或通过质量门禁。用户可以点击“创建”发起既有创建流程，但真实 MR 创建仍必须通过服务端预检和其他交付校验。

43.2 MR 列表状态筛选

GET /api/v1/projects/{projectId}/merge-requests 的 status 参数行为如下：

status 参数
返回内容
未传或空串
返回真实 MR，并注入处于 WAITING_PREFLIGHT 且尚无未合并 MR 的任务占位记录
PENDING_CREATE
返回所有尚无未合并真实 MR 的任务占位记录，不限 Task 当前状态
OPEN
只返回真实进行中的 MR
MERGED
只返回真实已合并 MR
CLOSED
只返回真实已关闭且未合并 MR

占位记录不写入 MR 表。对同一 (repositoryId, sourceBranch)，如果已存在 OPEN 或其他未合并真实 MR，则不再生成占位记录；MERGED 和 CLOSED 记录不阻止新的占位记录生成。

43.3 MR 列表响应新增字段

列表中的真实 MR 和待创建占位记录都可以返回以下字段：

字段
类型
说明
taskId
UUID 字符串/null
关联 Task ID。任务驱动的真实 MR 或占位记录返回该值；与任务无关的人工 MR 可以为 null
createMode
MANUAL/SYSTEM/UNKNOWN
MR 创建来源。任务驱动的系统流程为 SYSTEM；可识别为用户发起的任务 MR 为 MANUAL；无法判断时为 UNKNOWN

占位记录至少返回以下固定值：

{
  "id": "deterministic-placeholder-uuid",
  "repositoryId": "project-repository-uuid",
  "provider": "GITHUB",
  "number": 0,
  "sourceBranch": "feat/task-uuid",
  "targetBranch": "main",
  "status": "PENDING_CREATE",
  "headCommit": "workspace-head-sha",
  "mergeable": null,
  "mergeableState": null,
  "qualityGate": {
    "status": "PENDING",
    "requiredChecks": []
  },
  "title": "实现登录功能",
  "webUrl": null,
  "taskId": "task-uuid",
  "createMode": "SYSTEM"
}

说明：

- PENDING_CREATE 是列表投影状态，不是数据库中的 MR 状态；
- number=0 和 webUrl=null 表示 GitHub 尚未创建真实 MR，不得当作真实 PR 编号或链接；
- id 为稳定的占位标识，同一 Task 和仓库刷新列表时应保持不变；
- 占位记录的 targetBranch 优先取 Workspace repository 的 baseRef，缺失时回退项目仓库默认分支；
- qualityGate 仅表示当前列表投影的门禁状态，详细 Dry Run/CQ+1 结果仍通过既有预检、Dry Run 和检查接口查询；
- 前端不得根据占位 id 调用真实 MR 详情、同步、评论或合并接口。
  
43.4 用户点击“创建”

前端识别 status=PENDING_CREATE 后，可使用占位记录中的 taskId、repositoryId、targetBranch 和 title 调用既有接口：

POST /api/v1/projects/{projectId}/merge-requests
Idempotency-Key: <unique-key>
Content-Type: application/json

{
  "taskId": "task-uuid",
  "repositoryId": "project-repository-uuid",
  "targetBranch": "main",
  "title": "实现登录功能"
}

服务端根据 Task 所属 Workspace repository 读取并校验 sourceBranch、当前 headCommit、已接受 Diff、推送事实和项目权限；客户端不得提交或覆盖 sourceBranch、Git SHA、provider number、GitHub Token 或门禁结果。

创建成功后，服务端落库真实 MR 并返回真实 MR 摘要；前端应重新请求 MR 列表，原 PENDING_CREATE 占位记录将不再出现，并由真实 OPEN MR 记录替代。

创建失败时不得把占位记录改写为真实 MR。服务端应返回稳定错误码，例如 MR_PREFLIGHT_NOT_PASSED、GIT_PUSH_FAILED 或 GITHUB_API_UNAVAILABLE，前端保留占位记录并按错误码提示用户重试或先完成对应门禁。

43.5 向后兼容

- 未识别 taskId、createMode 的旧客户端仍可按原有字段展示真实 MR；
- 旧客户端将 PENDING_CREATE 当作未知状态时，不得据此执行合并或删除操作；
- 服务端不得要求客户端先创建占位记录，列表注入和真实 MR 创建保持幂等。