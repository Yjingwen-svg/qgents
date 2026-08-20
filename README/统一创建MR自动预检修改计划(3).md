# 统一创建 MR 自动预检修改计划

## 1. 目标

统一所有由 Qgents 创建并推送到 GitHub 的功能分支的 MR 流程：

```text
功能分支已由 Qgents commit/push
    + Workspace 中存在明确 targetBranch/baseRef
    + 当前分支没有未合并 MR 锁定
        |
        v
用户点击“创建 MR”
        |
        v
后端创建并执行 Dry Run
        |
        v
Dry Run 自动加载 targetBranch 绑定的 Testset
        |
        +-- FAILED/CONFLICT --> 不创建 MR，展示失败原因，可重试
        |
        v
等待独立成员 CQ+1
        |
        +-- REJECTED --> 不创建 MR，展示审查意见，可重新预检
        |
        v
后端幂等创建真实 GitHub MR
```

`MR_FIRST` 与 `DIFF_FIRST` 的区别只在“启动入口”：

```text
DIFF_FIRST:
  开发完成 -> 用户确认 Diff -> commit/push -> 用户点击“创建 MR” -> 自动预检

MR_FIRST:
  开发完成 -> 用户确认交付 -> commit/push -> 后端自动启动预检
```

两种模式从 Dry Run 开始使用同一套预检、CQ+1、MR 创建和重试逻辑。

## 2. 当前实现与问题

### 2.1 后端现状

- `MergeRequestController#create` 调用 `MergeRequestService#create`。
- `MergeRequestService#create` 当前把 `POST /merge-requests` 当作“立即创建真实 MR”，先执行 `requirePreflightGates()`。
- 缺少 Dry Run 或 CQ+1 时直接返回 `MR_PREFLIGHT_NOT_PASSED`，不会自动创建 Dry Run。
- `MrFirstAutomationService` 只在 `MR_FIRST` 交付事件后自动启动 Dry Run。
- `MrFirstAutomationService#createMergeRequest` 在 CQ+1 后调用现有 MR 创建服务，但公开创建入口和内部真实创建入口尚未完全分离。
- `TestRunService#createAutomaticDryRun` 已具备目标分支刷新、Testset 快照、活动运行幂等和部分失败重试能力，应复用，不要重新实现 Dry Run 执行逻辑。

### 2.2 前端现状

- `useCreateMergeRequest` 直接调用 `mergeRequestsApi.create`，假设返回真实 `MergeRequestSummary`。
- `DiffReviewPage`、`TaskDetailPage`、`PreflightPanel` 等页面需要同时处理 Diff 交付、Dry Run、CQ+1 和 MR 展示。
- 当前“创建 MR”动作的语义偏向立即创建，无法明确表达“已受理预检、正在等待 CQ+1”。
- 前端已有 Dry Run、预检、CQ+1 类型和组件，但需要把按钮触发改为统一的预检申请，不允许前端自行拼装 targetBranch 或 Testset。

### 2.3 契约问题

接口文档 v2.0.19 的 §27.10 已规定 `MR_FIRST` 自动预检，但旧章节仍将 `POST /merge-requests` 描述为“基于已接受 Diff 创建 MR”，与新的统一流程冲突。

必须明确：

- 用户公开调用只负责“申请创建 MR/启动预检”。
- 真实 GitHub MR 只能由服务端在 Dry Run 通过且独立 CQ+1 通过后创建。
- `POST /merge-requests` 不得成为绕过 Dry Run/CQ+1 的直接创建路径。

### 2.4 多个 DIFF_FIRST 任务共用同一功能分支

同一项目中可能先后完成多个 `DIFF_FIRST` 任务，并将它们连续提交到同一个
`sourceBranch`。因此 Task 与 MR 不是一对一关系：

```text
Task 1 -> commit A ┐
Task 2 -> commit B ├─ sourceBranch -> 一个 MR
Task 3 -> commit C ┘
```

必须同时保留两类事实：

- **Task 交付事实**：每个 Task 自己的 Diff、commit、push 结果和审计关系；
- **分支级 MR 流程**：同一 `repositoryId + sourceBranch + targetBranch` 的累计差异、Dry Run、CQ+1 和真实 MR。

用户从任意一个 Task 点击“创建 MR”时，默认使用当前 source branch 相对 target branch 的完整累计差异，并返回本次 MR 覆盖的全部 Task/Diff；不能只提交中间 Task 的单个 Diff 而遗漏前置提交。若以后需要部分合并，必须显式选择连续任务范围并建立固定 branch snapshot。

推荐规则：多个已交付 DIFF_FIRST 任务可以在开 MR 前汇总成一个分支级 MR；真实 MR 创建后锁定该 source branch，后续新需求必须创建新分支。

## 3. 后端修改计划

### 阶段 A：拆分公开申请与内部真实创建

#### A1. 新增预检申请领域模型

新增 `MrPreflightRequest` 概念，至少包含：

- `id`
- `projectId`
- `taskId`（触发申请的任务；分支级重试可为空）
- `projectRepositoryId`
- `workspaceId`
- `sourceBranch`
- `headCommit`
- `targetBranch`
- `targetCommit`
- `status`
- `dryRunId`
- `requestedBy`
- `idempotencyKey`
- `coveredTaskIds` / `coveredDiffIds`（建议使用关联表保存）
- `failureCode`
- `failureReason`
- `createdAt` / `updatedAt`

状态建议：

```text
REQUESTED
DRY_RUN_QUEUED
DRY_RUN_RUNNING
WAITING_CQ
CQ_REJECTED
CREATING_MR
MR_CREATED
FAILED
STALE
```

预检的幂等上下文必须是分支级，而不是单 Task：

```text
(project_repository_id, source_branch, target_branch, head_commit, target_commit)
```

对同一分支上下文重复申请应返回已有进行中的预检记录。不同 head 的新提交会创建新的预检上下文，并使旧 Dry Run/CQ+1 失效。Task 与预检通过关联表建立多对多关系。

#### A2. 新增“申请预检”服务方法

在 `MergeRequestService` 或独立的 `MrPreflightService` 中新增：

```java
requestPreflight(projectId, userId, taskId, repositoryId, idempotencyKey)
```

申请时必须校验：

1. Task、Workspace 和项目仓库属于当前项目。
2. Workspace repository 存在 `sourceBranch`、`headCommit`、`baseRef`。
3. 当前 head 是 Qgents 已接受并已 commit/push 的交付事实。
4. 目标分支来自 Workspace 的 `baseRef`，为空时才回退项目默认分支；不能信任前端传入的 targetBranch。
5. 目标分支能够被 Git Store 刷新并解析为当前 `targetCommit`。
6. 同一 source branch 不存在未合并 MR；已有 MR 时返回明确的分支锁定错误。申请成功后将分支置为 `MR_PREFLIGHT_LOCKED`，预检期间禁止继续 push 改变 head。
7. Task 没有取消、失败或正在执行互斥操作。

申请成功后：

- 持久化预检请求；
- 调用已有 `TestRunService#createAutomaticDryRun`；
- 返回 `202 Accepted` 和 `MrPreflightResponse`；
- 不调用 GitHub 创建 MR。

#### A3. 分离真实 MR 创建方法

将现有 `MergeRequestService#create` 拆为两个职责：

```text
requestPreflight(...)                 // 公开入口，启动 Dry Run
createActualMergeRequestAfterCq(...)  // 内部入口，只允许 CQ+1 事件/补偿任务调用
```

内部创建方法仍需再次执行最终上下文校验：

- Dry Run 状态必须为 `PASSED`；
- CQ+1 必须来自非 Task 发起人、非 MR 作者、非代表 Agent 的独立项目成员；
- Dry Run 的 `headCommit`、`targetBranch`、`targetCommit` 必须和当前 Workspace/远端一致；
- 目标分支变化时返回 `PREFLIGHT_CONTEXT_STALE`，不得复用旧 CQ；
- 使用现有 delivery operation、远端查询和幂等键，防止重复创建 GitHub MR。

公开 Controller 不得再直接调用内部真实创建方法。

### 阶段 B：统一自动编排器

将 `MrFirstAutomationService` 重构为通用的 `MrPreflightOrchestrator`，或保留类名但移除 MR_FIRST 限制。

#### B1. 两个触发入口

```text
MR_FIRST:
  Diff delivery accepted / commit-push completed
  -> publish MrPreflightRequestedDomainEvent
  -> startPreflight(taskId, all repositories)

DIFF_FIRST:
  POST /merge-requests/preflight
  -> resolve current sourceBranch head
  -> collect all accepted Task/Diff commits on that branch
  -> start one branch-level preflight per repository
```

多仓库任务必须逐仓库创建 Dry Run，不能只为第一个仓库启动流程。多个 Task 共享 source branch 时，每个仓库以该分支当前完整 head 为预检对象。

#### B2. Dry Run 完成后的推进

- `QUEUED/RUNNING`：预检请求保持对应运行状态。
- `PASSED`：转换为 `WAITING_CQ`，生成待审查提示和事件。
- `FAILED`：转换为 `FAILED`，持久化稳定失败码和用户可读原因，不创建 MR。
- `CONFLICT`：转换为 `FAILED` 或 `STALE`，明确展示冲突文件和需要重新开发/刷新基线的动作。

#### B3. CQ+1 后的推进

复用现有 `PreflightCqApprovedDomainEvent`：

```text
CQ+1 APPROVED
-> 再次校验上下文
-> 创建实际 MR
-> MR_CREATED
```

多仓库任务按仓库独立创建 MR；只有全部仓库真实 MR 创建成功后，Task 才进入最终成功状态。部分成功必须保留每个仓库的交付状态，允许只重试失败仓库。

分支级 MR 创建成功后，MR 详情必须返回 `repositoryId`、source/target branch、head/target SHA，以及覆盖的 `taskIds`、`diffIds` 和分支锁定状态。

#### B4. 失败与重试

至少覆盖：

- Worker 不可用、Git Store 同步失败；
- 目标分支不存在或刷新失败；
- Dry Run 测试失败；
- 合并冲突；
- CQ 被拒绝；
- 目标分支推进导致上下文过期；
- GitHub MR 创建失败；
- 重复点击、事件重复投递、服务重启恢复。

可复用现有 Dry Run retry，但重试必须创建新的 Dry Run ID，并让旧 CQ+1 失效。所有异步步骤都由补偿调度器恢复，不能依赖单次事件投递。

### 阶段 C：接口与 DTO

#### C1. 新增申请接口

推荐新增：

```http
POST /api/v1/projects/{projectId}/merge-requests/preflight
Idempotency-Key: <client-generated-key>
Content-Type: application/json

{
  "taskId": "task-uuid",
  "repositoryId": "project-repository-uuid"
}
```

`targetBranch`、`sourceBranch`、`headCommit` 均由后端从 Workspace 读取，不能由客户端覆盖。

响应 `202`：

```json
{
  "data": {
    "id": "preflight-uuid",
    "taskId": "task-uuid",
    "repositoryId": "repository-uuid",
    "sourceBranch": "feat/task-uuid",
    "headCommit": "source-sha",
    "targetBranch": "main",
    "targetCommit": "target-sha",
    "status": "DRY_RUN_QUEUED",
    "dryRunId": "dry-run-uuid",
    "blockers": ["DRY_RUN_RUNNING"],
    "mergeRequest": null
  },
  "requestId": "request-id"
}
```

#### C2. 查询接口

新增：

```http
GET /api/v1/projects/{projectId}/merge-requests/preflight/{preflightId}
GET /api/v1/projects/{projectId}/tasks/{taskId}/merge-request-preflight
```

第二个接口供任务详情页按 Task 获取全部仓库预检状态。

响应必须包含：

- 每个仓库的 `repositoryId` 和仓库显示名；
- source/target branch 与 SHA；
- Dry Run 状态和 ID；
- Testset 执行摘要；
- CQ+1 状态、审查者和是否允许当前用户审查；
- 失败码、失败原因、是否可重试；
- 真实 MR 信息（未创建时为 `null`）。
- `coveredTaskIds`、`coveredDiffIds`，说明该分支级预检/MR 包含哪些已交付任务；
- `branchLockStatus` 和 `isBranchLevel`，用于前端展示分支锁定及累计 diff 语义。

#### C3. 保留旧接口的兼容策略

`POST /merge-requests` 建议保留一段兼容期，但语义改为转发到“申请预检”，不再直接创建真实 MR，并标记为 deprecated。

真实 MR 创建只能由内部服务方法完成。若必须保留旧客户端兼容，应在服务端按 `Idempotency-Key` 转换为预检申请，禁止旧请求绕过门禁。

#### C4. CQ 接口

继续使用：

```http
POST /api/v1/projects/{projectId}/dry-runs/{dryRunId}/cq-approvals
POST /api/v1/projects/{projectId}/dry-runs/{dryRunId}/cq-rejections
```

CQ+1 成功后返回预检状态和当前 MR 状态，不应假设响应中一定已有真实 MR；真实 MR 创建是异步动作，前端需通过事件或查询刷新。

## 4. 前端修改计划

### 4.1 API 与类型

修改或新增：

- `src/api/taskModel.ts`
  - 新增 `requestMergeRequestPreflight`；
  - 新增 `getTaskMergeRequestPreflight`；
  - 不再把“创建 MR”请求直接解释为已创建 MR。
- `src/api/taskModelMap.ts`
  - 映射预检状态、blockers、Dry Run、CQ 和真实 MR。
- `src/types/task-model.ts`
  - 新增 `MergeRequestPreflight`、`PreflightRepositoryStatus`、状态枚举和错误码类型。
- `src/hooks/task-model.ts`
  - 新增 `useRequestMergeRequestPreflight`；
  - 新增 `useTaskMergeRequestPreflight`；
  - 成功或收到事件后失效 Task、Dry Run、Preflight、MR 查询缓存。
- `src/hooks/qualityGate.ts`
  - “是否可以点击创建 MR”只依据分支已 push、存在 targetBranch、无未合并 MR 和后端 capabilities；
  - 不能再用 `DRY_RUN=PASSED` 或 `CQ+1=PASSED` 作为按钮显示条件，因为点击按钮的目的就是启动 Dry Run。

### 4.2 任务详情和 Diff 页面

修改：

- `src/pages/ProjectDetail/TaskDetail/TaskDetailPage.tsx`
- `src/pages/ProjectDetail/DiffReviewPage.tsx`
- `src/pages/ProjectDetail/PreflightPanel.tsx`
- `src/pages/ProjectDetail/preflightDisplay.ts`
- 必要时同步 `ProjectActivityPanel.tsx` 和 `MergeRequestTab.tsx`。

按钮规则：

```text
DIFF_FIRST + Diff 已确认并已 push + 无未合并 MR
  -> 显示“创建 MR”

MR_FIRST + 用户确认交付
  -> 不要求再次点击“创建 MR”，直接展示预检进度

预检已进行中
  -> 按钮变为“预检中”，禁止重复提交

Dry Run PASSED、等待 CQ+1
  -> 展示“等待独立成员 CQ+1”

CQ+1 PASSED、MR 创建中
  -> 展示“正在创建 MR”

MR_CREATED
  -> 展示真实 MR 链接和状态
```

前端不得在按钮点击时自行先调用 Dry Run 再调用 MR 创建；只调用统一的预检申请接口。

### 4.3 CQ+1 页面

修改：

- `src/pages/ProjectDetail/Testset/DryRunCqPanel.tsx`
- `src/pages/ProjectDetail/Testset/CqReviewPage.tsx`

要求：

- Dry Run 未 `PASSED` 时不显示 CQ+1 提交按钮；
- Task 发起人不能提交自己的 CQ+1；
- 展示目标仓库、source/target branch、head/target SHA，避免审查错上下文；
- CQ+1 成功后显示“已通过，正在创建 MR”，不能立即伪造 MR 已创建；
- CQ 拒绝必须展示原因，并提供“重新运行预检”入口。

### 4.4 事件和刷新

收到以下事件时刷新对应查询：

- `task.updated`：任务进入预检或完成；
- `dry-run.updated`：Dry Run 排队、执行、通过、失败；
- `preflight.updated`：预检状态或 CQ+1 变化；
- `merge-request.updated`：真实 MR 创建或同步；
- `work-branch.updated`：分支锁定或合并解锁。

事件断线、游标过期或页面重新进入时，必须通过服务端查询恢复状态，不能只依赖本地按钮状态或 localStorage。

## 5. 数据库与迁移

推荐新增迁移：

```text
V202608XX__mr_preflight_request.sql
```

内容包括：

- `mr_preflight_requests` 主表；
- 上下文唯一键；
- `dry_run_id`、状态、失败信息和审计字段索引；
- 必要的外键和状态约束。

已有 `dry_runs`、`preflight_cq_reviews`、`merge_request_delivery_operations` 不删除：

- `dry_runs` 保存真实 Dry Run/Testset 事实；
- `preflight_cq_reviews` 保存独立 CQ+1 事实；
- `merge_request_delivery_operations` 保存真实 GitHub MR 创建幂等事实；
- `mr_preflight_requests` 保存“用户/交付事件申请创建 MR”这一业务流程事实。
- 新增 `mr_preflight_tasks`（或等价关联表），保存预检与 Task/Diff 的多对多关系；
- `merge_request_delivery_operations` 的幂等和查询维度改为 repository + sourceBranch + targetBranch，并通过关联表返回多个 Task。

如果评估后决定不新增表，至少必须为现有 `dry_runs` 增加可靠的预检申请幂等键和请求来源字段；不能只靠查询最新 Dry Run 推断用户是否点击过创建 MR。

## 6. 接口文档修改计划

以接口文档 v2.0.19 为基础，新增文档版本并修正以下章节：

1. §12.4：说明 Dry Run 既可由用户手动发起，也可由 MR_FIRST 交付事件自动发起；目标分支 Testset 由服务端加载。
2. §13：将 `POST /merge-requests` 的公开语义改为“申请 MR 预检”，或新增 `/merge-requests/preflight` 并将旧接口标记兼容/废弃。
3. §21/预检章节：明确 `DRY_RUN`、`CQ_PLUS_ONE` 和真实 MR 创建是三个连续阶段。
4. §27.8：统一 DIFF_FIRST 和 MR_FIRST 的后半段流程。
5. §27.10：改为“MR_FIRST 由确认交付自动申请预检；DIFF_FIRST 由用户点击创建 MR 申请预检”。
6. §32：补充按钮、状态、事件、错误码和异步响应处理。
7. 删除或改写旧的“POST 创建 MR 前必须已完成 Dry Run/CQ+1”描述，避免与新语义冲突。
8. 在文档末尾新增“统一创建 MR 自动预检流程”章节，明确真实 MR 只能由 CQ+1 通过后的后端内部动作创建。

## 7. 测试计划

### 7.1 后端单元测试

- `MrPreflightServiceTest`
  - 已 push 分支申请成功；
  - 无 source branch/head/baseRef 时拒绝；
  - 非 Qgents 交付的分支拒绝；
  - 未合并 MR 锁定时拒绝；
  - 重复 Idempotency-Key 返回同一预检；
  - 同一上下文并发点击只创建一条 Dry Run；
  - 多个已交付 DIFF_FIRST Task 共用 source branch 时只创建一个分支级预检，并返回完整 coveredTaskIds/coveredDiffIds；
  - 新 Task 追加提交导致 head 变化时，旧预检/CQ 失效并生成新上下文；
  - 已有未合并 MR 的分支不能继续申请或 push。
- `MrPreflightOrchestratorTest`
  - DIFF_FIRST 手动申请触发 Dry Run；
  - MR_FIRST 确认交付触发 Dry Run；
  - 多仓库逐仓库执行。
- `TestRunServiceTest`
  - Dry Run 自动加载目标分支 Testset；
  - 目标分支推进后不复用旧 Dry Run；
  - 失败重试创建新 Dry Run ID。
- `PreflightGateServiceTest`
  - Dry Run 未通过不能 CQ；
  - CQ 审查者不能是 Task 发起人；
  - CQ 通过后上下文变化会失效。
- `MergeRequestServiceTest`
  - 公开接口不会直接创建真实 MR；
  - 内部创建必须满足 Dry Run + CQ+1；
  - 重复事件不会创建重复 MR；
  - GitHub 创建失败可补偿重试。

### 7.2 前端测试

- API 请求路径和响应映射测试；
- “创建 MR”点击只调用预检申请接口；
- MR_FIRST 确认交付后不重复展示创建按钮；
- `DRY_RUN_QUEUED/RUNNING`、`WAITING_CQ`、`CQ_REJECTED`、`MR_CREATED` 状态展示；
- 发起人不可提交 CQ+1；
- 多仓库分别显示预检和 MR 状态；
- 重复点击、网络重试、SSE 断线后能恢复；
- 后端返回 `BRANCH_NOT_PUSHED`、`MR_BRANCH_LOCKED`、`PREFLIGHT_CONTEXT_STALE` 时展示可操作提示。

### 7.3 端到端验收

1. DIFF_FIRST：确认 Diff、push、点击创建 MR，观察 Dry Run 自动开始。
2. Dry Run 通过后，确认页面进入等待 CQ+1，而不是报“预检未通过”。
3. 独立成员 CQ+1 后，观察真实 GitHub MR 自动创建。
4. MR_FIRST：确认交付后验证无需再点创建 MR，自动进入同一流程。
5. Dry Run 失败时确认不创建 MR，用户可看到失败原因并能重试。
6. 目标分支推进后确认旧 Dry Run/CQ 失效，必须重新预检。
7. 多仓库任务确认每个仓库独立 Dry Run、CQ+1 和 MR 创建。
8. 多个 DIFF_FIRST 任务连续提交到同一 source branch，点击任一任务“创建 MR”，确认 Dry Run 覆盖分支累计 diff 和全部关联任务。
9. MR 创建后继续发起同分支开发，确认被 `MR_BRANCH_LOCKED` 拒绝；MR 合并或关闭后按产品规则解锁或要求新分支。
10. 重复点击、服务重启、事件重复投递确认不会产生重复 Dry Run 或重复 MR。

## 8. 实施顺序

```text
P0  明确接口契约并拆分 requestPreflight / createActualMergeRequestAfterCq
P0  后端统一预检编排，接入 DIFF_FIRST 手动入口和 MR_FIRST 确认交付入口
P0  持久化预检请求及幂等状态
P0  CQ+1 后只允许内部服务创建真实 MR
P1  前端按钮、状态面板、事件刷新和错误提示
P1  多仓库状态汇总与失败仓库重试
P1  接口文档更新和前后端 mock 更新
P1  单元、集成、端到端测试
```

## 9. 完成标准

- 用户点击“创建 MR”后，前端不再因为缺少 Dry Run/CQ+1 直接报错，而是进入预检状态。
- Dry Run 自动使用 Workspace 记录的 source/target 上下文和目标分支 Testset。
- Dry Run 未通过或上下文过期时绝不创建真实 MR。
- 独立 CQ+1 通过后由后端自动、幂等创建真实 GitHub MR。
- `MR_FIRST` 用户确认交付后自动进入同一套流程，不要求再次点击创建 MR。
- 所有状态、失败原因、仓库映射和下一步操作均可通过接口返回并被前端展示。
- 多个已交付 Task 共用 source branch 时，MR 以分支累计 diff 为准，并展示完整任务覆盖范围；MR 创建后分支被锁定，后续开发不会污染已通过门禁的 MR。
