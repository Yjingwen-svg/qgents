# 后端任务状态机与自动 Dry Run 实施指南

> 版本：v1.0  
> 更新日期：2026-08-20  
> 适用范围：`Qgents/Qgent-Back` 后端  
> 关联文档：`web/README/Dry Run前后端执行计划(1).md`、`web/README/Qgents接口文档.md`、`web/README/TestRun和DryRun列表接口后端开发任务.md`

---

## 0. 文档目的与背景

### 0.1 现状

`Qgent-Back` 当前只有 Spring Boot 启动入口 `DemoApplication.java`，**未实现任何任务状态机、Dry Run、Preflight、CQ+1、自动创建 MR 的业务逻辑**。

但 **前端已经 100% 完成对接**：所有 API、类型、Hook、SSE 事件处理、UI 组件均已就位，前端会按 `task.status === 'WAITING_PREFLIGHT'` 自动加载 `PreflightPanel`，并按 SSE 事件自动刷新。后端只要按本文档实现对应接口与事件，前端即可直接联调通过。

### 0.2 本文档目标

为后端开发者提供完整实施指南，包含：

1. 任务状态机定义与转换规则
2. 自动创建 Dry Run 的触发链路
3. 必须实现的 6 个 RESTful 接口契约
4. 必须发布的 6 类 SSE 事件契约
5. 数据库表设计与 Flyway 迁移脚本
6. 7 个关键服务类与 Java 代码示例
7. 验收清单

后端开发者照本文档实现即可，**不需要修改前端任何代码**。

---

## 1. 前端对接现状（后端开发者对照清单）

前端已对接的代码与本文档对应关系：

| 前端文件 | 对接内容 | 对应章节 |
|---|---|---|
| `web/src/types/task-model.ts` | `TaskStatus` 枚举（11 个值）、`TaskDeliveryMode` | §2 |
| `web/src/types/testset.ts` | `DryRunStatus`、`DryRunReport`、`CreateDryRunPayload` | §5.1、§5.2、§6.1 |
| `web/src/types/qualityGate.ts` | `Preflight`、`PreflightBlockerCode`、`PreflightCqPlusOne` | §5.4、§6.4 |
| `web/src/api/testset.ts` | `createDryRun` / `getDryRunReport` / `listDryRuns` 实现 | §6.1-6.3 |
| `web/src/api/qualityGate.ts` | `preflightApi.get` / `dryRunCqApi.approve|reject` | §6.4-6.6 |
| `web/src/hooks/testset.ts` | `useCreateDryRun` / `useDryRunReport` / `useDryRuns` | §6.1-6.3 |
| `web/src/hooks/qualityGate.ts` | `useApproveDryRunCq` / `useRejectDryRunCq` | §6.5-6.6 |
| `web/src/realtime/eventParser.ts` | SSE 事件白名单 + 必填字段校验 | §7 |
| `web/src/realtime/queryInvalidation.ts` | SSE 事件 → React Query 缓存失效映射 | §7 |
| `web/src/pages/ProjectDetail/PreflightPanel.tsx` | 按仓库展示 Dry Run + CQ+1 状态的 UI | §1 整体验证 |
| `web/src/pages/ProjectDetail/TaskDetail/TaskDetailPage.tsx:177` | `task.status === 'WAITING_PREFLIGHT'` 时渲染 PreflightPanel | §3 整体流程 |

---

## 2. 任务状态机

### 2.1 TaskStatus 枚举（与前端 `task-model.ts:1-13` 完全一致）

```
PLANNING                    任务创建中（前端已发送创建请求，服务端尚未物化计划）
PENDING                     已物化计划，等待启动
RUNNING                     任务执行中（有进行中的 TaskRun）
WAITING_DIFF_CONFIRMATION   等待用户确认 Diff Review
WAITING_PREFLIGHT           MR_FIRST 模式：代码已 push，等待 Dry Run + CQ+1
DIFF_REJECTED               Diff Review 被拒绝
DELIVERING                  交付中（DIFF_FIRST 推送分支 / MR_FIRST 创建 MR）
DELIVERY_FAILED             交付失败
SUCCEEDED                   交付成功
FAILED                      任务失败
CANCELLING                  取消中
CANCELLED                   已取消
```

### 2.2 TaskDeliveryMode 枚举（前端 `task-model.ts:41`）

```
DIFF_FIRST   直接交付 Diff（不强制走 MR 前门禁）
MR_FIRST     必须走 Dry Run + CQ+1 + 自动创建 MR
```

### 2.3 状态转换矩阵

| 当前状态 | 触发条件 | 目标状态 | 发布事件 |
|---|---|---|---|
| `PLANNING` | 计划物化完成 | `PENDING` | `task.updated` |
| `PENDING` | 启动 TaskRun | `RUNNING` | `task.updated` + `task-run.created` |
| `RUNNING` | TaskRun 成功 + `deliveryMode=DIFF_FIRST` | `WAITING_DIFF_CONFIRMATION` | `task.awaiting-diff-confirmation` + `task.updated` |
| `RUNNING` | TaskRun 成功 + `deliveryMode=MR_FIRST` | `WAITING_PREFLIGHT` | `task.updated` |
| `RUNNING` | TaskRun 失败 | `FAILED` | `task.updated` |
| `WAITING_DIFF_CONFIRMATION` | 用户确认 Diff | `DELIVERING` | `diff-review.confirmed` + `delivery.started` + `task.updated` |
| `WAITING_DIFF_CONFIRMATION` | 用户拒绝 Diff | `DIFF_REJECTED` | `diff-review.rejected` + `task.updated` |
| `WAITING_PREFLIGHT` | 所有仓库 Dry Run PASSED + CQ+1 APPROVED + MR 创建成功 | `DELIVERING` | `delivery.started` + `merge-request.updated` + `task.updated` |
| `WAITING_PREFLIGHT` | 任一仓库 MR 创建失败且不可重试 | `DELIVERY_FAILED` | `delivery.failed` + `task.updated` |
| `DELIVERING` | 所有 MR 合并（GitHub MERGED webhook） | `SUCCEEDED` | `delivery.completed` + `task.updated` |
| `DELIVERING` | MR 创建/合并失败 | `DELIVERY_FAILED` | `delivery.failed` + `task.updated` |
| 任意非终态 | 用户取消 | `CANCELLING` → `CANCELLED` | `task.updated` |

### 2.4 关键不变量

1. **不可逆转换**：`SUCCEEDED` / `FAILED` / `CANCELLED` 为终态，不接受任何后续转换。
2. **MR_FIRST 必经预检**：`RUNNING → DELIVERING` 不能跳过 `WAITING_PREFLIGHT`。
3. **DIFF_FIRST 不强制预检**：用户后续显式发起 MR 时才进入预检门禁。
4. **状态变更必须发布 `task.updated` SSE 事件**，前端依赖此事件重新查询 task 详情并决定渲染哪个面板。

---

## 3. 整体流程：MR_FIRST 自动化链路

```text
Agent 完成 TaskRun 全部步骤
  └─ TaskRunService 标记 TaskRun.status = SUCCEEDED
      └─ TaskCompletionHandler.onTaskRunSucceeded(taskId, taskRunId)
          ├─ 读取 task.delivery_mode
          │
          ├─ DIFF_FIRST:
          │   └─ TaskStateMachineService.markWaitingDiffConfirmation(taskId)
          │   └─ 发布 task.awaiting-diff-confirmation + task.updated
          │
          └─ MR_FIRST:
              ├─ TaskStateMachineService.markWaitingPreflight(taskId)
              │   └─ 发布 task.updated (status=WAITING_PREFLIGHT)
              │
              └─ DryRunService.createForTaskAndRepositories(taskId)
                  │
                  └─ 对每个 task.repositories[i]:
                      ├─ 解析 head_commit（必须已 push 到远端）
                      ├─ 规范化 target_branch（取 task.repositories[i].baseRef）
                      ├─ 刷新 target_branch 并固定 target_commit
                      ├─ 按 (taskId, repositoryId, head_commit, target_branch) 查幂等键
                      │   └─ 已有活动 Dry Run → 返回已有运行
                      │   └─ 无 → 创建新 DryRun(status=QUEUED)
                      └─ 投递异步执行任务到队列
                          │
                          └─ DryRunExecutionWorker.claimAndExecute()
                              ├─ CAS 领取（写 claim_token, lease_expires_at, attempt_count++）
                              ├─ SandboxWorkerClient.mergePreview(head, target)
                              ├─ 校验 Worker 返回的 SHA == 数据库快照
                              ├─ 冲突 → FAILED + tests=SKIPPED(MERGE_CONFLICT)
                              ├─ 可合并 → 执行 Testset snapshot
                              ├─ 全 PASSED → DryRun.status = PASSED
                              ├─ 任一 FAILED → DryRun.status = FAILED
                              └─ 发布 dry-run.updated
                                  │
                                  └─ 前端收到事件 → 自动刷新 PreflightPanel
                                  │
                                  └─ PreflightGateService.evaluate(taskId, repoId, target)
                                      └─ 返回 Preflight{ status, blockers[], dryRun, cqPlusOne }
                                          │
                                          └─ 用户在 PreflightPanel 点 "通过 CQ+1"
                                              │
                                              └─ POST /dry-runs/{id}/cq-approvals
                                                  ├─ 校验非作者、Dry Run PASSED
                                                  ├─ 写 dry_run_cq_plus_ones(decision=APPROVED)
                                                  ├─ 发布 preflight.updated
                                                  │
                                                  └─ MrFirstAutomationService.onCqPlusOneApproved(dryRunId)
                                                      ├─ PreflightGateService.evaluate() 最终预检
                                                      ├─ 创建 MR（幂等键 + 远端查询防重复）
                                                      ├─ TaskStateMachineService.markDelivering(taskId)
                                                      └─ 发布 delivery.started + merge-request.updated
                                                          │
                                                          └─ GitHub MERGED webhook → task → SUCCEEDED
                                                              └─ 发布 delivery.completed + task.updated
```

---

## 4. 自动创建 Dry Run 触发链路设计

### 4.1 触发条件

- **MR_FIRST 模式**：`TaskRun.status = SUCCEEDED` 且 `task.delivery_mode = MR_FIRST`
- **DIFF_FIRST 模式**：不自动触发；用户后续显式 `POST /dry-runs` 时才创建

### 4.2 多仓库逐仓库创建

`task.repositories` 可能含多个仓库。`DryRunService.createForTaskAndRepositories(taskId)` 必须：

1. 读取 `task.repositories` 列表
2. 对每个 `repository` 并行创建一条 Dry Run（互不影响）
3. 任一仓库创建失败不影响其他仓库；失败仓库的状态在 PreflightPanel 单独展示
4. 严禁一个仓库的通过结果复用于另一个仓库

### 4.3 幂等设计

幂等键：`(task_id, repository_id, head_commit, target_branch)`

- 相同幂等键且存在 `status IN (QUEUED, RUNNING, PASSED)` 的 DryRun → 返回已有运行（HTTP 200，不重复创建）
- 相同幂等键且只有 `FAILED` DryRun → 创建新 DryRun（保留旧的失败记录作为历史）
- `target_branch` 推进、`head_commit` 变化 → 视为新幂等键，旧 DryRun/CQ+1 标记为失效（`PREFLIGHT_CONTEXT_STALE`）

### 4.4 上下文冻结（必须）

创建 DryRun 时必须冻结以下信息到 `dry_runs` 表：

- `head_commit` CHAR(40) — 从 `source_ref` 解析并固定
- `target_commit` CHAR(40) — 刷新目标分支后固定
- `testset_snapshot` JSON — 按 `repositoryId + target_branch` 查询启用且有效的必选 Testset，固化不可变

执行时不能让 Worker 再次隐式解析分支名，必须使用数据库快照。

---

## 5. 数据类型契约（与前端类型完全一致）

### 5.1 DryRunStatus（前端 `testset.ts:20`）

```
QUEUED | RUNNING | PASSED | FAILED | CONFLICT | CANCELLED
```

> 注意：`CONFLICT` 前端用作展示派生；后端落库只用 `FAILED` + `failure_code=GIT_MERGE_CONFLICT`，列表/详情接口返回时若 `failure_code=GIT_MERGE_CONFLICT` 则映射为 `CONFLICT`。

### 5.2 DryRunReport（前端 `testset.ts:172-195`，后端响应 JSON 必须包含全部字段）

```json
{
  "id": "string",
  "projectId": "string",
  "repositoryId": "string",
  "sourceRef": "string",
  "targetBranch": "string",
  "taskId": "string|null",
  "status": "QUEUED|RUNNING|PASSED|FAILED|CONFLICT|CANCELLED",
  "report": {
    "targetCommit": "string|null",
    "mergeable": "boolean|null",
    "conflicts": [{ "path": "string", "message": "string" }],
    "tests": {
      "status": "QUEUED|RUNNING|PASSED|FAILED|NOT_REQUIRED|SKIPPED",
      "resolvedHeadCommit": "string|null",
      "results": [{
        "testsetId": "string",
        "status": "PASSED|FAILED",
        "exitCode": "number|null",
        "durationMs": "number|null",
        "failureCode": "string|null"
      }]
    } | null,
    "failureCode": "string|null"
  },
  "conflicts": [{ "path": "string", "message": "string" }],
  "createdBy": "string|null",
  "caseSummary": { "passed": 0, "failed": 0, "blocked": 0, "skipped": 0, "total": 0 } | null,
  "cases": [],
  "reportUrl": "string|null",
  "pdfUrl": "string|null",
  "startedAt": "string|null",
  "finishedAt": "string|null",
  "createdAt": "string",
  "durationSeconds": "number|null",
  "sandboxId": "string|null",
  "testsetIds": ["string"]
}
```

### 5.3 错误码枚举（DryRun）

```
DRY_RUN_CONTEXT_MISMATCH        Worker 返回 SHA 与快照不一致
DRY_RUN_TEST_CONTEXT_MISMATCH  Testset 上下文不一致
GIT_BASE_REF_NOT_FOUND         目标分支或源分支不存在
GIT_MERGE_CONFLICT             合并冲突（tests.status=SKIPPED, reason=MERGE_CONFLICT）
SANDBOX_WORKER_UNAVAILABLE     Worker 不可用（可重试）
TESTSET_DEFINITION_INVALID     Testset 定义非法
TESTSET_FAILED                 Testset 断言失败（不可重试）
DRY_RUN_TIMEOUT                执行超时
DRY_RUN_RETRY_EXHAUSTED        重试次数耗尽
```

### 5.4 Preflight 数据结构（前端 `qualityGate.ts:82-92`）

```json
{
  "taskId": "string",
  "repositoryId": "string",
  "targetBranch": "string",
  "sourceCommit": "string|null",
  "targetCommit": "string|null",
  "status": "PENDING|PASSED|FAILED|STALE",
  "blockers": [
    { "code": "string", "message": "string" }
  ],
  "dryRun": {
    "id": "string|null",
    "status": "QUEUED|RUNNING|PASSED|FAILED|CONFLICT|CANCELLED",
    "sourceCommit": "string|null",
    "targetCommit": "string|null"
  } | null,
  "cqPlusOne": {
    "status": "MISSING|APPROVED|REJECTED",
    "reviewerUserId": "string|null",
    "reviewerName": "string|null",
    "reason": "string|null",
    "reviewedAt": "string|null"
  } | null
}
```

### 5.5 PreflightBlockerCode 白名单（前端 `qualityGate.ts:46-55`）

```
TASK_NOT_READY              任务不在 WAITING_PREFLIGHT
DRY_RUN_MISSING             没有对应 DryRun
DRY_RUN_QUEUED              DryRun 在 QUEUED
DRY_RUN_RUNNING             DryRun 在 RUNNING
DRY_RUN_FAILED              DryRun 失败
CQ_PLUS_ONE_MISSING        缺少 CQ+1 审批
CQ_PLUS_ONE_REJECTED       CQ+1 被拒绝
PREFLIGHT_CONTEXT_STALE    head/target 已变化
MR_SOURCE_HEAD_CHANGED     MR 源 head 已变化
```

后端可扩展新 code，但前端只能对上述 code 给精准文案；其他 code 按 `string` 兜底显示。

---

## 6. RESTful 接口契约（必须实现）

> 统一前缀：`/api/v1`  
> 统一响应外壳：`{ "data": <T>, "requestId": "<uuid>" }`  
> 统一错误格式：`{ "error": { "code": "<CODE>", "message": "<msg>", "details": [...] } }`

### 6.1 POST /projects/{projectId}/dry-runs

**用途**：手动或自动创建 Dry Run。

**Request Body**：
```json
{
  "repositoryId": "string (必填，project_repositories.id)",
  "sourceRef": "string (必填，分支名/SHA/refs/heads/...)",
  "targetBranch": "string (必填，规范化分支名)",
  "taskId": "string (可选，MR_FIRST 自动触发时必传)",
  "testsetIds": ["string"] (可选，省略则服务端按目标分支门禁自动加载)"
}
```

**Response**：`202 Accepted`，body = `DryRunReport`（前端 `mapDryRunReport` 会接受）

**幂等行为**：
- 当 `taskId` 提供时，按 `(taskId, repositoryId, head_commit, target_branch)` 去重
- 已有 `QUEUED/RUNNING/PASSED` 的运行 → 返回已有 DryRun（HTTP 200 / 202 均可，前端只看 body）
- 只有 `FAILED` 的历史 → 创建新 DryRun

**校验顺序**（必须按此顺序，前端 `PreflightPanel.tsx` 错误处理依赖这些 code）：
1. `repositoryId` 属于当前项目且可用 → 404 `REPOSITORY_NOT_FOUND`
2. 若带 `taskId`：Task 属于当前项目、Workspace 包含该仓库、HEAD 已推送、`sourceRef` 与 HEAD 一致 → 404 `TASK_NOT_FOUND` / 409 `DRY_RUN_TASK_HEAD_NOT_PUSHED`
3. `targetBranch` 规范化（拒绝 SHA、`refs/heads/`、路径穿越、空白值）→ 400 `DRY_RUN_INVALID_TARGET_BRANCH`
4. 刷新目标分支并固定 `target_commit` → 404 `GIT_BASE_REF_NOT_FOUND`
5. 解析 `sourceRef` 并固定 `head_commit`
6. 按 `repositoryId + targetBranch` 查询必选 Testset → 若有则固化 snapshot
7. 写库（含幂等键），事务提交后再投递异步执行
8. 不能在 HTTP 请求线程同步调用 Worker

**关键错误码**：
- 400 `DRY_RUN_INVALID_TARGET_BRANCH`
- 404 `REPOSITORY_NOT_FOUND` / `TASK_NOT_FOUND` / `GIT_BASE_REF_NOT_FOUND`
- 409 `DRY_RUN_DUPLICATE` / `DRY_RUN_CONTEXT_MISMATCH`

### 6.2 GET /projects/{projectId}/dry-runs/{dryRunId}/report

**Response**：`200`，body = `DryRunReport`（QUEUED/RUNNING 时 `report` 字段可空）

### 6.3 GET /projects/{projectId}/dry-runs

**Query**：`status`（可选，按状态过滤）、`limit`（可选，默认 50）

**Response**：`200`，body = `DryRunReport[]`

### 6.4 GET /projects/{projectId}/tasks/{taskId}/repositories/{repositoryId}/preflight?targetBranch={branch}

**用途**：前端在 `task.status === 'WAITING_PREFLIGHT'` 时按仓库查询预检状态。

**Response**：`200`，body = `Preflight`

**实现要点**：
- Task 不在 `WAITING_PREFLIGHT` 时返回 `status=PENDING` + `blockers=[{code:'TASK_NOT_READY', ...}]`
- 查找最新通过/进行中的 DryRun：按 `(task_id, repository_id, target_branch)` 排序 `created_at DESC`
- 若 DryRun 缺失：`status=PENDING` + `blockers=[{code:'DRY_RUN_MISSING', ...}]`、`dryRun=null`
- 若 DryRun 在 QUEUED/RUNNING：`status=PENDING` + 对应 blocker code
- 若 DryRun FAILED：`status=FAILED` + `blockers=[{code:'DRY_RUN_FAILED', ...}]`
- 若 DryRun PASSED 且无 CQ+1：`blockers=[{code:'CQ_PLUS_ONE_MISSING', ...}]`
- 若 CQ+1 REJECTED：`blockers=[{code:'CQ_PLUS_ONE_REJECTED', ...}]`
- 若 DryRun PASSED + CQ+1 APPROVED + head/target 仍一致：`status=PASSED`，`blockers=[]`
- 若 head/target 已变化：`status=STALE` + `blockers=[{code:'PREFLIGHT_CONTEXT_STALE', ...}]`

### 6.5 POST /projects/{projectId}/dry-runs/{dryRunId}/cq-approvals

**用途**：独立项目成员对 DryRun 盖 CQ+1 通过章。

**Request Body**：
```json
{ "reason": "string (可选)" }
```

**Response**：`200`，body = `DryRunCqResult`
```json
{
  "dryRunId": "string",
  "decision": "APPROVED",
  "reviewerUserId": "string|null",
  "reviewerName": "string|null",
  "reason": "string|null",
  "reviewedAt": "string"
}
```

**校验与错误码**：
- DryRun 必须存在 → 404 `DRY_RUN_NOT_FOUND`
- DryRun 必须 `status=PASSED` → 409 `DRY_RUN_NOT_PASSED`
- 申请人不能是 Task 创建人 / MR 作者 → 403 `PREFLIGHT_CQ_AUTHOR_FORBIDDEN`
- Task 必须在 `WAITING_PREFLIGHT` → 409 `PREFLIGHT_TASK_NOT_READY`
- head/target 已变化 → 409 `PREFLIGHT_CONTEXT_STALE`
- 已有 APPROVED → 幂等返回已有记录（不报错）

**完成后**：
1. 写 `dry_run_cq_plus_ones(dry_run_id, reviewer_user_id, decision=APPROVED, reason, reviewed_at)`
2. 发布 `preflight.updated` 事件
3. 异步调用 `MrFirstAutomationService.onCqPlusOneApproved(dryRunId)`

### 6.6 POST /projects/{projectId}/dry-runs/{dryRunId}/cq-rejections

**Request Body**：
```json
{ "reason": "string (必填)" }
```

**Response**：`200`，body = `DryRunCqResult`（`decision=REJECTED`）

**校验**：同 6.5，但 `reason` 必填 → 400 `REASON_REQUIRED`

**完成后**：
1. 写 `dry_run_cq_plus_ones(decision=REJECTED)`
2. 发布 `preflight.updated` 事件
3. **不**触发 MR 创建

---

## 7. SSE 事件契约（必须发布）

> 订阅端点：`GET /api/v1/projects/{projectId}/events`（SSE）  
> 每个事件格式：`event: <type>\ndata: <json>\n\n`  
> payload 必含 `projectId` 字段

前端 `eventParser.ts` 严格校验每个事件类型的必填字段，**缺字段的事件会被前端丢弃**。

### 7.1 task.updated

```json
{
  "projectId": "string",
  "taskId": "string",
  "status": "TaskStatus",
  "deliveryMode": "DIFF_FIRST|MR_FIRST|null",
  "deliveryReason": "string|null",
  "updatedAt": "ISO8601"
}
```

**触发时机**：每次 Task 状态变更。

**前端行为**（来自 `queryInvalidation.ts:74-80`）：刷新 `task` 列表与详情、工作分支视图。

### 7.2 dry-run.updated

```json
{
  "projectId": "string",
  "dryRunId": "string",
  "taskId": "string (强烈建议带，前端会按 taskId+repoId+targetBranch 精准刷新预检)",
  "repositoryId": "string (强烈建议带)",
  "targetBranch": "string (强烈建议带)",
  "status": "QUEUED|RUNNING|PASSED|FAILED|CONFLICT|CANCELLED",
  "headCommit": "string",
  "targetCommit": "string",
  "attemptCount": 0,
  "failureCode": "string|null",
  "updatedAt": "ISO8601"
}
```

**必填字段**（前端 `eventParser.ts:105`）：仅 `dryRunId`。  
**强烈建议**带上 `taskId/repositoryId/targetBranch`，否则前端只能按 dryRunId 刷新报告，无法精准刷新关联 Preflight（见 `queryInvalidation.ts:209-223`）。

### 7.3 preflight.updated

```json
{
  "projectId": "string",
  "taskId": "string",
  "repositoryId": "string",
  "targetBranch": "string",
  "status": "PENDING|PASSED|FAILED|STALE",
  "sourceCommit": "string|null",
  "targetCommit": "string|null",
  "dryRunId": "string|null",
  "cqPlusOne": { "status": "MISSING|APPROVED|REJECTED" }
}
```

**必填字段**（前端 `eventParser.ts:106`）：`taskId`、`repositoryId`、`targetBranch`。

**触发时机**：Preflight 评估结果变化（DryRun 完成后、CQ+1 提交后、head/target 失效后）。

### 7.4 delivery.started

```json
{
  "projectId": "string",
  "taskId": "string",
  "reviewBatchId": "string",
  "deliveryMode": "DIFF_FIRST|MR_FIRST",
  "operationId": "string"
}
```

**必填字段**（前端 `eventParser.ts:91`）：`taskId`、`reviewBatchId`、`deliveryMode`、`operationId`。

**触发时机**：开始交付（DIFF_FIRST 推送分支 / MR_FIRST 创建 MR）。

### 7.5 delivery.completed / delivery.failed

```json
{
  "projectId": "string",
  "taskId": "string",
  "reviewBatchId": "string",
  "deliveryStatus": "DELIVERED|PARTIALLY_DELIVERED|FAILED"
}
```

**必填字段**：`taskId`、`reviewBatchId`、`deliveryStatus`。

**触发时机**：所有 MR 合并完成 → `completed`；任一失败 → `failed`。

### 7.6 merge-request.updated

```json
{
  "projectId": "string",
  "mergeRequestId": "string",
  "number": 12,
  "status": "OPEN|READY_FOR_REVIEW|MERGED|CLOSED",
  "webUrl": "string|null",
  "taskId": "string (建议带，前端会顺带刷新 task 详情)"
}
```

**必填字段**（前端 `eventParser.ts:126`）：`mergeRequestId`、`number`(整数)、`status`、`webUrl`(可为 null 字符串)。

**触发时机**：MR 创建、状态变更、GitHub MERGED/CLOSED webhook。

---

## 8. 数据库表设计

### 8.1 tasks 表（扩展）

> 现有表添加列。如果 tasks 表不存在，按下方结构创建。

```sql
ALTER TABLE tasks
  ADD COLUMN delivery_mode VARCHAR(16) NULL COMMENT 'DIFF_FIRST | MR_FIRST',
  ADD COLUMN delivery_reason TEXT NULL COMMENT '服务端生成的模式选择原因',
  ADD COLUMN status_reason JSON NULL COMMENT '任务级失败原因',
  ADD INDEX idx_project_status (project_id, status),
  ADD INDEX idx_project_updated (project_id, updated_at);
```

### 8.2 dry_runs 表

```sql
CREATE TABLE dry_runs (
  id              BIGINT       PRIMARY KEY AUTO_INCREMENT,
  project_id      VARCHAR(64)  NOT NULL,
  task_id         VARCHAR(64)  NULL,
  repository_id   VARCHAR(64)  NOT NULL,
  source_ref      VARCHAR(255) NOT NULL              COMMENT '用户传入的源引用',
  head_commit     CHAR(40)     NOT NULL              COMMENT '解析后固定的源 SHA',
  target_branch   VARCHAR(255) NOT NULL              COMMENT '规范化后的目标分支名',
  target_commit   CHAR(40)     NOT NULL              COMMENT '刷新后固定的目标 SHA',
  status          VARCHAR(16)  NOT NULL DEFAULT 'QUEUED',
  testset_snapshot JSON        NOT NULL              COMMENT '固化不可变的 Testset 列表',
  report          JSON         NULL                   COMMENT '执行后写入：mergeable/conflicts/tests',
  failure_code    VARCHAR(64)  NULL,
  created_by      VARCHAR(64)  NULL,
  claim_token     VARCHAR(64)  NULL                   COMMENT 'Worker 领取令牌',
  lease_expires_at TIMESTAMP   NULL                   COMMENT '租约过期时间',
  attempt_count   INT          NOT NULL DEFAULT 0,
  started_at      TIMESTAMP    NULL,
  finished_at     TIMESTAMP    NULL,
  sandbox_id      VARCHAR(64)  NULL,
  idempotency_key VARCHAR(128) NULL                   COMMENT '(task_id, repo_id, head, target_branch) hash',
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_idempotency (idempotency_key),
  KEY idx_task_repo_head_target (task_id, repository_id, head_commit, target_branch),
  KEY idx_status_lease (status, lease_expires_at),
  KEY idx_project_created (project_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 8.3 dry_run_cq_plus_ones 表

```sql
CREATE TABLE dry_run_cq_plus_ones (
  id                BIGINT      PRIMARY KEY AUTO_INCREMENT,
  dry_run_id        BIGINT      NOT NULL,
  reviewer_user_id  VARCHAR(64) NOT NULL,
  decision          VARCHAR(16) NOT NULL              COMMENT 'APPROVED | REJECTED',
  reason            TEXT        NULL,
  reviewed_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dry_run_decision (dry_run_id, decision) COMMENT '每个 DryRun 只能有一条 APPROVED 与一条 REJECTED',
  KEY idx_dry_run (dry_run_id),
  KEY idx_reviewer (reviewer_user_id, reviewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 8.4 preflight 视图（无需建表）

`Preflight` 由 `PreflightGateService` 实时聚合得出，**不落库**。聚合源：
- `tasks`（status / delivery_mode / repository_ids）
- `dry_runs`（按 task_id+repo_id+target_branch 取最新）
- `dry_run_cq_plus_ones`（按 dry_run_id 取 APPROVED / REJECTED）

### 8.5 merge_requests 表（如已存在则扩展）

```sql
CREATE TABLE merge_requests (
  id              BIGINT       PRIMARY KEY AUTO_INCREMENT,
  project_id      VARCHAR(64)  NOT NULL,
  task_id         VARCHAR(64)  NULL,
  repository_id   VARCHAR(64)  NOT NULL,
  dry_run_id      BIGINT       NULL,
  cq_plus_one_id  BIGINT       NULL,
  number          INT          NOT NULL              COMMENT 'GitHub PR number',
  status          VARCHAR(32)  NOT NULL              COMMENT 'OPEN | READY_FOR_REVIEW | MERGED | CLOSED',
  web_url         VARCHAR(512) NULL,
  idempotency_key VARCHAR(128) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_repo_number (repository_id, number),
  UNIQUE KEY uk_idempotency (idempotency_key),
  KEY idx_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 9. 关键服务类与 Java 代码示例

### 9.1 TaskStateMachineService

**职责**：封装 Task 状态转换，保证转换合法，发布 `task.updated` 事件。

```java
package qg.qgent.task.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import qg.qgent.task.entity.Task;
import qg.qgent.task.entity.TaskStatus;
import qg.qgent.task.repository.TaskRepository;
import qg.qgent.event.DomainEventPublisher;

@Service
public class TaskStateMachineService {

    private final TaskRepository taskRepository;
    private final DomainEventPublisher eventPublisher;

    public TaskStateMachineService(TaskRepository taskRepository,
                                   DomainEventPublisher eventPublisher) {
        this.taskRepository = taskRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void markWaitingPreflight(String taskId) {
        Task task = mustLoad(taskId);
        assertTransition(task, TaskStatus.WAITING_PREFLIGHT);
        task.setStatus(TaskStatus.WAITING_PREFLIGHT);
        taskRepository.save(task);
        eventPublisher.publishTaskUpdated(task);
    }

    @Transactional
    public void markDelivering(String taskId, String reviewBatchId, String operationId) {
        Task task = mustLoad(taskId);
        assertTransition(task, TaskStatus.DELIVERING);
        task.setStatus(TaskStatus.DELIVERING);
        taskRepository.save(task);
        eventPublisher.publishTaskUpdated(task);
        eventPublisher.publishDeliveryStarted(task, reviewBatchId, operationId);
    }

    @Transactional
    public void markSucceeded(String taskId, String reviewBatchId) {
        Task task = mustLoad(taskId);
        assertTransition(task, TaskStatus.SUCCEEDED);
        task.setStatus(TaskStatus.SUCCEEDED);
        taskRepository.save(task);
        eventPublisher.publishTaskUpdated(task);
        eventPublisher.publishDeliveryCompleted(task, reviewBatchId, "DELIVERED");
    }

    @Transactional
    public void markDeliveryFailed(String taskId, String reviewBatchId, String reason) {
        Task task = mustLoad(taskId);
        task.setStatus(TaskStatus.DELIVERY_FAILED);
        taskRepository.save(task);
        eventPublisher.publishTaskUpdated(task);
        eventPublisher.publishDeliveryFailed(task, reviewBatchId, "FAILED");
    }

    private Task mustLoad(String taskId) {
        return taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException(taskId));
    }

    private void assertTransition(Task task, TaskStatus target) {
        // 校验当前状态能否合法转换到 target；非法则抛 IllegalStateException
    }
}
```

### 9.2 TaskCompletionHandler

**职责**：监听 TaskRun 完成事件，按 `delivery_mode` 决定下一步。

```java
package qg.qgent.task.service;

import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import qg.qgent.taskrun.event.TaskRunSucceededEvent;
import qg.qgent.task.entity.TaskDeliveryMode;

@Component
public class TaskCompletionHandler {

    private final TaskStateMachineService stateMachine;
    private final DryRunService dryRunService;

    public TaskCompletionHandler(TaskStateMachineService stateMachine,
                                 DryRunService dryRunService) {
        this.stateMachine = stateMachine;
        this.dryRunService = dryRunService;
    }

    @Async
    @EventListener
    public void onTaskRunSucceeded(TaskRunSucceededEvent event) {
        String taskId = event.taskId();

        if (event.deliveryMode() == TaskDeliveryMode.MR_FIRST) {
            // MR_FIRST：进入预检，并自动为每个仓库创建 Dry Run
            stateMachine.markWaitingPreflight(taskId);
            dryRunService.createForTaskAndRepositories(taskId);
        } else {
            // DIFF_FIRST：等待用户确认 Diff Review
            stateMachine.markWaitingDiffConfirmation(taskId);
        }
    }
}
```

### 9.3 DryRunService

**职责**：受理 DryRun 创建、固定上下文、固定 Testset snapshot、投递异步执行。

```java
package qg.qgent.testrun.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import qg.qgent.testrun.entity.DryRun;
import qg.qgent.testrun.entity.DryRunStatus;
import qg.qgent.testrun.repository.DryRunRepository;
import qg.qgent.testset.service.TestsetQueryService;
import qg.qgent.git.service.GitResolveService;
import qg.qgent.task.entity.Task;
import qg.qgent.task.repository.TaskRepository;
import qg.qgent.event.DomainEventPublisher;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class DryRunService {

    private final DryRunRepository dryRunRepository;
    private final TaskRepository taskRepository;
    private final GitResolveService gitResolve;
    private final TestsetQueryService testsetQuery;
    private final DryRunExecutionQueue executionQueue;
    private final DomainEventPublisher eventPublisher;

    public DryRunService(/* ... */) { /* ... */ }

    @Transactional
    public DryRunReport create(String projectId, CreateDryRunPayload payload) {
        // 1. 校验 repositoryId 归属
        // 2. 若带 taskId：校验 Task 归属、Workspace 包含该仓库、HEAD 已推送、sourceRef 与 HEAD 一致
        // 3. targetBranch 规范化（拒绝 SHA / refs/heads/ / 路径穿越 / 空白）
        // 4. 刷新目标分支并固定 target_commit
        // 5. 解析 sourceRef 并固定 head_commit
        // 6. 按 repositoryId + targetBranch 查询必选 Testset，固化 snapshot
        // 7. 用幂等键去重：已有 QUEUED/RUNNING/PASSED 返回已有运行
        String idempotencyKey = buildIdempotencyKey(payload);
        DryRun existing = dryRunRepository
            .findByIdempotencyKeyAndStatusIn(idempotencyKey,
                List.of(DryRunStatus.QUEUED, DryRunStatus.RUNNING, DryRunStatus.PASSED))
            .orElse(null);
        if (existing != null) {
            return toReport(existing);
        }

        DryRun dryRun = new DryRun();
        dryRun.setProjectId(projectId);
        dryRun.setTaskId(payload.getTaskId());
        dryRun.setRepositoryId(payload.getRepositoryId());
        dryRun.setSourceRef(payload.getSourceRef());
        dryRun.setHeadCommit(gitResolve.resolveHead(projectId, payload.getRepositoryId(), payload.getSourceRef()));
        dryRun.setTargetBranch(payload.getTargetBranch());
        dryRun.setTargetCommit(gitResolve.resolveAndUpdateTarget(projectId, payload.getRepositoryId(), payload.getTargetBranch()));
        dryRun.setTestsetSnapshot(testsetQuery.snapshotRequiredTestsets(payload.getRepositoryId(), payload.getTargetBranch()));
        dryRun.setStatus(DryRunStatus.QUEUED);
        dryRun.setIdempotencyKey(idempotencyKey);
        dryRunRepository.save(dryRun);

        // 事务提交后再投递（避免 Worker 抢占未提交记录）
        executionQueue.enqueue(dryRun.getId());

        eventPublisher.publishDryRunUpdated(dryRun);
        return toReport(dryRun);
    }

    /**
     * MR_FIRST 自动触发：为 task 的每个仓库创建 Dry Run。
     * 失败仓库不影响其他仓库；前端 PreflightPanel 会单独展示。
     */
    @Transactional
    public void createForTaskAndRepositories(String taskId) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException(taskId));
        if (task.getDeliveryMode() != TaskDeliveryMode.MR_FIRST) {
            throw new IllegalStateException("createForTaskAndRepositories only for MR_FIRST");
        }
        for (TaskRepositorySummary repo : task.getRepositories()) {
            try {
                CreateDryRunPayload payload = CreateDryRunPayload.builder()
                    .repositoryId(repo.getRepositoryId())
                    .sourceRef(repo.getSourceBranch() != null ? repo.getSourceBranch() : repo.getHeadCommit())
                    .targetBranch(repo.getBaseRef())
                    .taskId(taskId)
                    .build();  // testsetIds 留空，服务端按目标分支门禁自动加载
                create(task.getProjectId(), payload);
            } catch (Exception ex) {
                // 记录失败，继续处理其他仓库；前端会显示该仓库 DRY_RUN_MISSING
                log.error("auto create dry run failed for task={} repo={}", taskId, repo.getRepositoryId(), ex);
            }
        }
    }

    private String buildIdempotencyKey(CreateDryRunPayload p) {
        return String.join("|", p.getTaskId(), p.getRepositoryId(), p.getSourceRef(), p.getTargetBranch());
    }
}
```

### 9.4 DryRunExecutionWorker

**职责**：原子领取 DryRun、调 Worker 执行、写报告、发事件。

```java
package qg.qgent.testrun.worker;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import qg.qgent.testrun.entity.DryRun;
import qg.qgent.testrun.entity.DryRunStatus;
import qg.qgent.testrun.repository.DryRunRepository;
import qg.qgent.sandbox.client.SandboxWorkerClient;
import qg.qgent.event.DomainEventPublisher;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
public class DryRunExecutionWorker {

    private final DryRunRepository dryRunRepository;
    private final SandboxWorkerClient sandbox;
    private final DomainEventPublisher eventPublisher;

    @Scheduled(fixedDelay = 2000)
    public void pollAndExecute() {
        List<DryRun> candidates = dryRunRepository
            .findTop10ByStatusOrderByCreatedAtAsc(DryRunStatus.QUEUED);
        for (DryRun dr : candidates) {
            tryClaimAndExecute(dr);
        }
    }

    @Scheduled(fixedDelay = 30000)
    public void recoverStaleRunning() {
        // 扫描 RUNNING 且 lease_expires_at < now 的记录，CAS 重置为 QUEUED
    }

    private void tryClaimAndExecute(DryRun dr) {
        String claimToken = UUID.randomUUID().toString();
        int updated = dryRunRepository.casClaim(dr.getId(), claimToken);
        if (updated == 0) return;  // 被其他实例抢走
        try {
            execute(dr, claimToken);
        } catch (Exception ex) {
            markFailed(dr, "SANDBOX_WORKER_UNAVAILABLE", ex);
        }
    }

    private void execute(DryRun dr, String claimToken) {
        MergePreviewResult preview = sandbox.mergePreview(
            dr.getRepositoryId(), dr.getHeadCommit(), dr.getTargetCommit());
        // SHA 一致性校验
        if (!preview.getResolvedHeadCommit().equals(dr.getHeadCommit())
            || !preview.getResolvedTargetCommit().equals(dr.getTargetCommit())) {
            markFailed(dr, "DRY_RUN_CONTEXT_MISMATCH", null);
            return;
        }
        DryRunReportBuilder report = DryRunReportBuilder.from(preview);
        if (!preview.isMergeable()) {
            report.testsStatus("SKIPPED").testsReason("MERGE_CONFLICT");
            markFailed(dr, "GIT_MERGE_CONFLICT", report.build());
            return;
        }
        // 执行 Testset snapshot
        TestsetExecutionResult tests = sandbox.executeTestsets(
            dr.getRepositoryId(), preview.getMergedTreeSha(), dr.getTestsetSnapshot());
        report.tests(tests);
        if (tests.allPassed()) {
            markPassed(dr, report.build());
        } else {
            markFailed(dr, "TESTSET_FAILED", report.build());
        }
    }

    private void markPassed(DryRun dr, Object reportBody) {
        dr.setStatus(DryRunStatus.PASSED);
        dr.setReport(reportBody);
        dryRunRepository.save(dr);
        eventPublisher.publishDryRunUpdated(dr);  // 含 taskId/repositoryId/targetBranch
    }

    private void markFailed(DryRun dr, String failureCode, Object reportBody) {
        dr.setStatus(DryRunStatus.FAILED);
        dr.setFailureCode(failureCode);
        dr.setReport(reportBody);
        dryRunRepository.save(dr);
        eventPublisher.publishDryRunUpdated(dr);
    }
}
```

### 9.5 PreflightGateService

**职责**：实时评估 Preflight，按完整键匹配。

```java
package qg.qgent.preflight.service;

import org.springframework.stereotype.Service;
import qg.qgent.task.entity.Task;
import qg.qgent.task.entity.TaskStatus;
import qg.qgent.testrun.entity.DryRun;
import qg.qgent.testrun.entity.DryRunStatus;
import qg.qgent.testrun.repository.DryRunRepository;
import qg.qgent.testrun.repository.DryRunCqPlusOneRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class PreflightGateService {

    private final TaskRepository taskRepository;
    private final DryRunRepository dryRunRepository;
    private final DryRunCqPlusOneRepository cqRepository;

    public Preflight evaluate(String taskId, String repositoryId, String targetBranch) {
        Task task = taskRepository.findById(taskId).orElseThrow(/* ... */);
        PreflightResult r = new PreflightResult(taskId, repositoryId, targetBranch);

        if (task.getStatus() != TaskStatus.WAITING_PREFLIGHT) {
            r.addBlocker("TASK_NOT_READY", "Task is not in WAITING_PREFLIGHT");
            return r.toView();
        }

        // 取最新 DryRun（按 task+repo+targetBranch + createdAt DESC）
        Optional<DryRun> latest = dryRunRepository
            .findTopByTaskIdAndRepositoryIdAndTargetBranchOrderByCreatedAtDesc(taskId, repositoryId, targetBranch);

        if (latest.isEmpty()) {
            r.addBlocker("DRY_RUN_MISSING", "Dry Run has not been created");
            return r.toView();
        }
        DryRun dr = latest.get();
        r.setDryRun(dr);

        // head/target 失效校验
        if (isStale(dr, task)) {
            r.markStale();
            r.addBlocker("PREFLIGHT_CONTEXT_STALE", "head or target has changed");
            return r.toView();
        }

        switch (dr.getStatus()) {
            case QUEUED:  r.addBlocker("DRY_RUN_QUEUED", "Dry Run is queued"); return r.toView();
            case RUNNING: r.addBlocker("DRY_RUN_RUNNING", "Dry Run is running"); return r.toView();
            case FAILED:  r.addBlocker("DRY_RUN_FAILED", "Dry Run failed: " + dr.getFailureCode()); return r.toView();
            case PASSED:  break;  // 继续查 CQ+1
            default:      return r.toView();
        }

        // DryRun PASSED → 查 CQ+1
        Optional<DryRunCqPlusOne> cq = cqRepository
            .findByDryRunIdAndDecision(dr.getId(), "APPROVED");
        if (cq.isEmpty()) {
            r.addBlocker("CQ_PLUS_ONE_MISSING", "Awaiting independent CQ+1");
            return r.toView();
        }
        // 检查是否有 REJECTED 在 APPROVED 之后
        Optional<DryRunCqPlusOne> rejected = cqRepository
            .findByDryRunIdAndDecision(dr.getId(), "REJECTED");
        if (rejected.isPresent() && rejected.get().getReviewedAt().isAfter(cq.get().getReviewedAt())) {
            r.addBlocker("CQ_PLUS_ONE_REJECTED", "CQ+1 was rejected after approval");
            return r.toView();
        }

        r.markPassed();
        return r.toView();
    }

    private boolean isStale(DryRun dr, Task task) {
        // 对比 task.workspace 当前 head_commit 与 dr.head_commit
        // 对比目标分支当前 head 与 dr.target_commit
        return false; // 实现略
    }
}
```

### 9.6 MrFirstAutomationService

**职责**：CQ+1 APPROVED 后自动创建 MR（幂等）。

```java
package qg.qgent.delivery.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import qg.qgent.testrun.event.CqPlusOneApprovedEvent;
import qg.qgent.task.entity.TaskStatus;
import qg.qgent.task.service.TaskStateMachineService;
import qg.qgent.preflight.service.PreflightGateService;
import qg.qgent.github.service.GitHubMrClient;

@Component
public class MrFirstAutomationService {

    private final PreflightGateService preflightGate;
    private final DryRunRepository dryRunRepository;
    private final MergeRequestRepository mrRepository;
    private final GitHubMrClient githubMr;
    private final TaskStateMachineService stateMachine;

    @Async
    @TransactionalEventListener
    public void onCqPlusOneApproved(CqPlusOneApprovedEvent event) {
        tryCreateMrForDryRun(event.dryRunId());
    }

    public void tryCreateMrForDryRun(Long dryRunId) {
        DryRun dr = dryRunRepository.findById(dryRunId).orElseThrow(/* ... */);
        Preflight pf = preflightGate.evaluate(dr.getTaskId(), dr.getRepositoryId(), dr.getTargetBranch());
        if (pf.getStatus() != PreflightStatus.PASSED) {
            // 上下文已变化或未通过；不创建 MR
            return;
        }

        // 幂等：相同幂等键的 MR 已存在则跳过
        String mrIdempotencyKey = "mr|" + dr.getTaskId() + "|" + dr.getRepositoryId() + "|" + dr.getHeadCommit() + "|" + dr.getTargetBranch();
        if (mrRepository.existsByIdempotencyKey(mrIdempotencyKey)) {
            return;
        }

        // 远端查询防重复（GitHub 已存在相同 source/target 的 OPEN PR）
        Integer existingPrNumber = githubMr.findOpenPrNumber(dr.getRepositoryId(),
            dr.getSourceRef(), dr.getTargetBranch());
        if (existingPrNumber != null) {
            // 同步到本地 merge_requests 表
            return;
        }

        // 创建 MR
        CreateMrResult result = githubMr.createMr(dr.getRepositoryId(),
            dr.getSourceRef(), dr.getTargetBranch(),
            "Task " + dr.getTaskId() + " delivery",
            "Auto-created after Dry Run PASSED + CQ+1 APPROVED");

        MergeRequest mr = new MergeRequest();
        mr.setProjectId(dr.getProjectId());
        mr.setTaskId(dr.getTaskId());
        mr.setRepositoryId(dr.getRepositoryId());
        mr.setDryRunId(dr.getId());
        mr.setNumber(result.getNumber());
        mr.setStatus("OPEN");
        mr.setWebUrl(result.getWebUrl());
        mr.setIdempotencyKey(mrIdempotencyKey);
        mrRepository.save(mr);

        // 标记 Task 进入 DELIVERING（仅当所有仓库都已创建 MR 时）
        if (allRepositoriesHaveMr(dr.getTaskId())) {
            stateMachine.markDelivering(dr.getTaskId(), dr.getReviewBatchId(), result.getOperationId());
        }
    }

    private boolean allRepositoriesHaveMr(String taskId) {
        // 检查 task 所有仓库都已创建 MR
        return true; // 实现略
    }
}
```

### 9.7 RecoveryScheduler

**职责**：扫描 QUEUED 与租约过期 RUNNING，CAS 重新领取。

```java
@Scheduled(fixedDelay = 30000)
public void recoverStaleRunning() {
    List<DryRun> stale = dryRunRepository
        .findByStatusAndLeaseExpiresAtBefore(DryRunStatus.RUNNING, Instant.now());
    for (DryRun dr : stale) {
        int updated = dryRunRepository.casResetToQueued(dr.getId(), dr.getClaimToken());
        if (updated > 0 && dr.getAttemptCount() >= MAX_ATTEMPTS) {
            dryRunRepository.markFailed(dr.getId(), "DRY_RUN_RETRY_EXHAUSTED", null);
            eventPublisher.publishDryRunUpdated(dr);
        }
    }
}
```

---

## 10. Flyway 迁移脚本

> 路径：`Qgent-Back/src/main/resources/db/migration/`  
> 注意：当前 `application.yaml` 中 `spring.flyway.enabled=false`，需先改为 `true`，或手动执行 SQL。

### V1__init_dry_runs.sql

```sql
CREATE TABLE dry_runs (
  id              BIGINT       PRIMARY KEY AUTO_INCREMENT,
  project_id      VARCHAR(64)  NOT NULL,
  task_id         VARCHAR(64)  NULL,
  repository_id   VARCHAR(64)  NOT NULL,
  source_ref      VARCHAR(255) NOT NULL,
  head_commit     CHAR(40)     NOT NULL,
  target_branch   VARCHAR(255) NOT NULL,
  target_commit   CHAR(40)     NOT NULL,
  status          VARCHAR(16)  NOT NULL DEFAULT 'QUEUED',
  testset_snapshot JSON        NOT NULL,
  report          JSON         NULL,
  failure_code    VARCHAR(64)  NULL,
  created_by      VARCHAR(64)  NULL,
  claim_token     VARCHAR(64)  NULL,
  lease_expires_at TIMESTAMP   NULL,
  attempt_count   INT          NOT NULL DEFAULT 0,
  started_at      TIMESTAMP    NULL,
  finished_at     TIMESTAMP    NULL,
  sandbox_id      VARCHAR(64)  NULL,
  idempotency_key VARCHAR(128) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_idempotency (idempotency_key),
  KEY idx_task_repo_head_target (task_id, repository_id, head_commit, target_branch),
  KEY idx_status_lease (status, lease_expires_at),
  KEY idx_project_created (project_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### V2__init_dry_run_cq_plus_ones.sql

```sql
CREATE TABLE dry_run_cq_plus_ones (
  id                BIGINT      PRIMARY KEY AUTO_INCREMENT,
  dry_run_id        BIGINT      NOT NULL,
  reviewer_user_id  VARCHAR(64) NOT NULL,
  decision          VARCHAR(16) NOT NULL,
  reason            TEXT        NULL,
  reviewed_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dry_run_decision (dry_run_id, decision),
  KEY idx_dry_run (dry_run_id),
  KEY idx_reviewer (reviewer_user_id, reviewed_at),
  CONSTRAINT fk_cq_dry_run FOREIGN KEY (dry_run_id) REFERENCES dry_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### V3__init_merge_requests.sql

```sql
CREATE TABLE merge_requests (
  id              BIGINT       PRIMARY KEY AUTO_INCREMENT,
  project_id      VARCHAR(64)  NOT NULL,
  task_id         VARCHAR(64)  NULL,
  repository_id   VARCHAR(64)  NOT NULL,
  dry_run_id      BIGINT       NULL,
  cq_plus_one_id  BIGINT       NULL,
  number          INT          NOT NULL,
  status          VARCHAR(32)  NOT NULL,
  web_url         VARCHAR(512) NULL,
  idempotency_key VARCHAR(128) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_repo_number (repository_id, number),
  UNIQUE KEY uk_idempotency (idempotency_key),
  KEY idx_task (task_id),
  CONSTRAINT fk_mr_dry_run FOREIGN KEY (dry_run_id) REFERENCES dry_runs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### V4__extend_tasks_with_delivery.sql

```sql
ALTER TABLE tasks
  ADD COLUMN delivery_mode VARCHAR(16) NULL COMMENT 'DIFF_FIRST | MR_FIRST',
  ADD COLUMN delivery_reason TEXT NULL,
  ADD COLUMN status_reason JSON NULL,
  ADD INDEX idx_project_status (project_id, status),
  ADD INDEX idx_project_updated (project_id, updated_at);
```

---

## 11. 验收清单

按以下顺序逐条验证。每条必须**真实执行**，不得虚构。

### 11.1 基础契约

- [ ] `POST /api/v1/projects/{projectId}/dry-runs` 返回 DryRunReport，含全部字段（id、status、report、conflicts、createdAt、durationSeconds、sandboxId、testsetIds 等）
- [ ] `GET /api/v1/projects/{projectId}/dry-runs/{dryRunId}/report` 在 QUEUED/RUNNING 时 `report` 字段为 null
- [ ] `GET /api/v1/projects/{projectId}/dry-runs?status=PASSED&limit=10` 正确过滤
- [ ] `GET /api/v1/projects/{projectId}/tasks/{taskId}/repositories/{repositoryId}/preflight?targetBranch=main` 返回 Preflight 结构
- [ ] `POST /api/v1/projects/{projectId}/dry-runs/{dryRunId}/cq-approvals` 与 `cq-rejections` 工作正常
- [ ] 所有响应使用 `{ "data": <T>, "requestId": "..." }` 外壳

### 11.2 任务状态机

- [ ] MR_FIRST Task：TaskRun SUCCEEDED → Task 自动转为 WAITING_PREFLIGHT
- [ ] DIFF_FIRST Task：TaskRun SUCCEEDED → Task 转为 WAITING_DIFF_CONFIRMATION
- [ ] 状态变更同时发布 `task.updated` SSE 事件
- [ ] 终态（SUCCEEDED / FAILED / CANCELLED）不接受后续转换

### 11.3 自动创建 Dry Run

- [ ] MR_FIRST Task 进入 WAITING_PREFLIGHT 后，每个仓库都创建一条 DryRun（QUEUED）
- [ ] 多仓库场景下任一仓库创建失败不影响其他仓库
- [ ] 重复触发（再次调 `createForTaskAndRepositories`）不创建重复 DryRun
- [ ] DryRun 创建后 `head_commit / target_commit / testset_snapshot` 不可变
- [ ] DryRun 创建后发布 `dry-run.updated` 事件

### 11.4 Dry Run 执行

- [ ] Worker 使用数据库快照的 head/target，不重新解析分支名
- [ ] Worker 返回 SHA 与快照不一致 → FAILED + `DRY_RUN_CONTEXT_MISMATCH`
- [ ] 合并冲突 → FAILED + `GIT_MERGE_CONFLICT` + `tests.status=SKIPPED, reason=MERGE_CONFLICT`
- [ ] 全部 Testset 通过 → PASSED
- [ ] 任一 Testset 失败 → FAILED + `TESTSET_FAILED`
- [ ] 完成状态都发布 `dry-run.updated`（含 taskId/repositoryId/targetBranch）
- [ ] 多实例并行执行同一 DryRun 不可能（CAS 领取）

### 11.5 预检门禁

- [ ] Task 不在 WAITING_PREFLIGHT → Preflight.status=PENDING + blocker=TASK_NOT_READY
- [ ] DryRun QUEUED/RUNNING → 对应 blocker code
- [ ] DryRun FAILED → blocker=DRY_RUN_FAILED
- [ ] DryRun PASSED + 无 CQ+1 → blocker=CQ_PLUS_ONE_MISSING
- [ ] CQ+1 REJECTED → blocker=CQ_PLUS_ONE_REJECTED
- [ ] head/target 已变化 → status=STALE + blocker=PREFLIGHT_CONTEXT_STALE
- [ ] DryRun PASSED + CQ+1 APPROVED → status=PASSED, blockers=[]

### 11.6 CQ+1 与自动创建 MR

- [ ] Task 发起人不能给自己的 DryRun 盖 CQ+1 → 403 `PREFLIGHT_CQ_AUTHOR_FORBIDDEN`
- [ ] DryRun 未 PASSED 时盖 CQ+1 → 409 `DRY_RUN_NOT_PASSED`
- [ ] head/target 变化后盖 CQ+1 → 409 `PREFLIGHT_CONTEXT_STALE`
- [ ] CQ+1 APPROVED 后自动创建 MR
- [ ] 重复 CQ+1 APPROVED → 幂等返回，不重复创建 MR
- [ ] MR 创建成功发布 `merge-request.updated` 与 `delivery.started`
- [ ] 所有仓库 MR 创建成功后 Task → DELIVERING

### 11.7 SSE 事件

- [ ] `task.updated` 携带 `taskId`、`status`
- [ ] `dry-run.updated` 必须携带 `dryRunId`；强烈建议带 `taskId/repositoryId/targetBranch`
- [ ] `preflight.updated` 必须携带 `taskId/repositoryId/targetBranch`
- [ ] `delivery.started` 必须携带 `taskId/reviewBatchId/deliveryMode/operationId`
- [ ] `delivery.completed|failed` 必须携带 `taskId/reviewBatchId/deliveryStatus`
- [ ] `merge-request.updated` 必须携带 `mergeRequestId/number(int)/status/webUrl(可null)`

### 11.8 真实联调

- [ ] 单仓库、无必选 Testset：DryRun PASSED，报告 `tests.status=NOT_REQUIRED`
- [ ] 单仓库、一个必选 Testset 通过：DryRun PASSED
- [ ] Testset 失败：DryRun FAILED + `TESTSET_FAILED`，前端 PreflightPanel 显示 blocker
- [ ] 合并冲突：DryRun FAILED + `GIT_MERGE_CONFLICT`，tests.status=SKIPPED
- [ ] 目标分支推进：旧 DryRun + CQ+1 失效（STALE）
- [ ] 多仓库部分失败：PreflightPanel 按仓库分别展示状态
- [ ] 用户重复点击 CQ+1：只产生一条 APPROVED
- [ ] MR 创建成功但未合并：分支保持锁定，Webhook MERGED 后解锁

---

## 12. 实施顺序建议

按以下顺序分批实施，每批完成后才进入下一批：

### 第 1 批：基础契约（P0）
- [ ] Flyway 迁移 V1-V4
- [ ] `POST /dry-runs` + `GET /dry-runs/{id}/report` + `GET /dry-runs` 接口
- [ ] `DryRunService.create` 与上下文冻结
- [ ] 单仓库 DryRun 跑通（PASSED / FAILED）

### 第 2 批：预检门禁（P0）
- [ ] `PreflightGateService.evaluate`
- [ ] `GET /preflight` 接口
- [ ] `POST /cq-approvals` + `cq-rejections` 接口
- [ ] `dry-run.updated` + `preflight.updated` SSE 事件

### 第 3 批：MR_FIRST 自动化（P0）
- [ ] `TaskStateMachineService` 与 `TaskCompletionHandler`
- [ ] `DryRunService.createForTaskAndRepositories` 自动触发
- [ ] `MrFirstAutomationService.onCqPlusOneApproved` 自动创建 MR
- [ ] `merge-request.updated` + `delivery.started|completed|failed` SSE 事件
- [ ] 多仓库逐仓库状态与部分失败补偿

### 第 4 批：恢复与重试（P1）
- [ ] `RecoveryScheduler` 处理租约过期
- [ ] 可重试 vs 不可重试错误分类
- [ ] `attempt_count` 上限与 `DRY_RUN_RETRY_EXHAUSTED`

### 第 5 批：可观测性（P1）
- [ ] 日志含 `requestId/projectId/taskId/dryRunId/repositoryId/headCommit/targetCommit/attemptCount/failureCode`
- [ ] 指标：DryRun 受理数、成功率、失败率、平均耗时、merge conflict 数

---

## 13. 前端代码引用清单

后端开发者联调时可直接对照以下前端文件验证字段与状态枚举：

### 13.1 类型定义
- `web/src/types/task-model.ts` — TaskStatus、TaskDeliveryMode、DiffReviewDeliveryStatus
- `web/src/types/testset.ts` — DryRunStatus、DryRunReport、CreateDryRunPayload、DryRunReportBody
- `web/src/types/qualityGate.ts` — Preflight、PreflightBlockerCode、PreflightCqPlusOne、DryRunCqInput

### 13.2 API 层（后端响应必须与这些 mapper 对齐）
- `web/src/api/testset.ts:115-127` — `mapDryRunStatus`（后端 CONFLICT 映射逻辑）
- `web/src/api/testset.ts:480-507` — `createDryRun / getDryRunReport / listDryRuns`
- `web/src/api/qualityGate.ts:121-156` — `mapPreflight / mapDryRunCqResult`
- `web/src/api/qualityGate.ts:194-220` — `preflightApi / dryRunCqApi`

### 13.3 SSE 事件层（后端事件必须满足这些校验）
- `web/src/realtime/eventParser.ts:3-42` — 事件类型白名单
- `web/src/realtime/eventParser.ts:67-138` — 每个事件类型的必填字段校验
- `web/src/realtime/queryInvalidation.ts:209-230` — dry-run.updated / preflight.updated 触发的查询失效

### 13.4 UI 层（联调时直接观察）
- `web/src/pages/ProjectDetail/PreflightPanel.tsx` — 按仓库展示 Dry Run + CQ+1 状态
- `web/src/pages/ProjectDetail/TaskDetail/TaskDetailPage.tsx:177-199` — WAITING_PREFLIGHT 时渲染 PreflightPanel

---

## 14. 已知陷阱与注意事项

1. **`CONFLICT` 状态映射**：前端 `mapDryRunStatus` 把后端的 `FAILED + failure_code=GIT_MERGE_CONFLICT` 映射为前端 `CONFLICT`。后端**不要**直接落库 `CONFLICT` 状态，只用 `FAILED + failure_code`。
2. **`dry-run.updated` 必须带 `taskId/repositoryId/targetBranch`**：否则前端无法精准刷新对应 Preflight，用户需要手动点"刷新全部"才能看到状态更新。
3. **CQ+1 申请人校验**：必须是 `非 Task 创建人` 且 `非 MR 作者` 的独立项目成员。校验必须在服务端做，**绝不信任客户端传的 userId/role**。
4. **GitHub 凭证不得交给 Agent**：GitHub MR 创建/查询必须通过受控服务，使用短期权限。
5. **幂等键不要漏**：DryRun 用 `(task_id, repo_id, head, target_branch)`；MR 用 `(task_id, repo_id, head, target_branch)`。重复点击/重发不能创建重复记录。
6. **不可覆盖失败记录**：失败 DryRun 不能被覆盖为 PASSED；重试创建新 DryRun，旧的作为历史。
7. **Sandbox 销毁不影响 Workspace**：Worker 临时工作区销毁后 Workspace 修改应保留；不要把 Workspace 修改写到 Sandbox。
8. **目标分支推进失效**：`target_commit` 必须在创建时刷新并固定；之后查询 Preflight 时若目标分支当前 HEAD 与 `target_commit` 不一致 → STALE。
9. **不要在 HTTP 请求线程同步调用 Worker**：DryRun 创建接口返回 202 后立即释放，执行交给 Worker 异步处理。
10. **Spring Profile 与 Flyway**：当前 `application.yaml` 中 `spring.flyway.enabled=false`，实施时改为 `true` 或手动执行 SQL；禁止手工反复执行同一 ALTER。

---

## 15. 与现有文档的关系

- **本文档**：聚焦"任务状态机 + 自动 Dry Run"的实施，提供可落地的接口契约、数据库脚本、代码示例。
- **`web/README/Dry Run前后端执行计划(1).md`**：整体规划与决策依据（阶段 A-F）。本文档是其"第 3 批：MR_FIRST 自动化"的落地实施。
- **`web/README/Qgents接口文档.md`**：权威 API 契约。如本文档与接口文档冲突，以接口文档为准；本文档用于补全接口文档未明示的状态机与触发链路。
- **`web/README/TestRun和DryRun列表接口后端开发任务.md`**：列表接口的实施任务（与本文档第 1 批重合）。

---

## 16. 修改记录

| 日期 | 版本 | 修改人 | 内容 |
|---|---|---|---|
| 2026-08-20 | v1.0 | - | 初版：基于前端已对接代码反推后端契约，提供完整实施指南 |
