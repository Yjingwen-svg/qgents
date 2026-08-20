# 打通 Dry Run + MR 链路：后端需要补充的改动清单（基于现有后端代码分析）

> 编写日期：2026-08-20
> 分析依据：`Qgents/src/main/java/**` 现有代码 + `web/README/统一创建MR自动预检修改计划(3).md` + 当前前端代码（`web/src/**`，已经按照修改计划完成）

**结论先行：前端改动已经按照修改计划完成，只要关掉 mock、后端补齐下面列出的缺口，即可完成完整的 "申请MR → 预检 → Dry Run → CQ+1 → 自动/人工创建 GitHub MR → GitHub 跳转 + 合并MR" 链路，不需要再改前端。**

---

## 1. 现有后端代码已具备的能力（✅ 已就绪）

| 模块 | 文件位置 | 能力 |
|---|---|---|
| 预检门禁查询 & CQ 盖章 | `service/PreflightGateService.java` + `controller/TestRunController.java` (L121-145) | `GET /tasks/{taskId}/repositories/{repositoryId}/preflight` 可查询单个仓库的 Dry Run + CQ 摘要；`POST /dry-runs/{dryRunId}/cq-approvals/rejections` 可通过或拒绝 CQ+1 |
| 自动 Dry Run 调度 | `service/TestRunService#createAutomaticDryRun(...)` | 已实现目标分支刷新、Testset 快照、活动运行幂等和失败重试 |
| MR_FIRST 自动预检编排器 | `service/MrFirstAutomationService.java` | 监听 `MrFirstPreflightRequestedDomainEvent` 自动为 MR_FIRST 任务逐仓库创建 Dry Run；监听 `PreflightCqApprovedDomainEvent` CQ 通过后自动调用 `MergeRequestService#create` 建真实 MR；带定时补偿 |
| 真实 GitHub PR 创建服务 | `service/MergeRequestService#create(...)` | 已具备 claim+幂等 lease+远端查询+创建+轮询 mergeability+quality gate hooks 的完整流程；创建前会 `requirePreflightGates().requireReady()` 校验 DryRun+CQ 通过 |
| MR CRUD Controller | `controller/MergeRequestController.java` | GET 列表、GET 详情、质量门禁、评论、同步、CQ 真MR审查、合并、POST 创建真实 MR（当前为直接创建，见下缺口） |
| Dry Run / CQ 审查表 | `entity/DryRunEntity.java` + `entity/PreflightCqReviewEntity.java` | 已持久化真实运行和审查事实 |

---

## 2. 当前完成不了的流程 + 原因 + 修改方式（❌ 需补充）

### ❌ 缺口 1：缺少公开的"申请预检" Controller 入口

**完成不了的流程**：
- 人工模式（DIFF_FIRST）下用户在 MR 列表点「申请MR」，前端调用 `POST /projects/{pid}/merge-requests/preflight`。
- 自动模式（MR_FIRST 确认交付后）前端在页面自动触发 `POST /projects/{pid}/merge-requests/preflight`。
- 兼容模式（旧客户端仍调用）`POST /projects/{pid}/merge-requests` 需要改为"申请预检"语义。

**为什么完成不了**：
- `MergeRequestController.java` 中没有 `POST /merge-requests/preflight` endpoint（全文件搜不到 `preflight`）。
- 现有 `POST /merge-requests` (L49-55) 直接调用 `MergeRequestService#create(...)`，而 `MergeRequestService.create()` 在 L410 执行 `requirePreflightGates().requireReady(...)`：如果 **Dry Run / CQ 任何一个没通过就直接抛异常返回错误**，**不会自动创建 Dry Run**，完全不符合申请预检的新语义。

**建议修改方式（按修改计划 §A/A2）**：
1. **新增 3 个 endpoints**（路径严格匹配前端；前缀沿用 `/api/v1/projects/{projectId}/merge-requests`）：
   ```http
   POST  /api/v1/projects/{projectId}/merge-requests/preflight         <- 新增：申请预检
   GET   /api/v1/projects/{projectId}/merge-requests/preflight/{id}    <- 新增：查询单条预检
   GET   /api/v1/projects/{projectId}/tasks/{taskId}/merge-request-preflight  <- 新增：按任务查全部仓库预检
   ```
   请求体（前端只传 taskId + repositoryId，不要信任前端传的 targetBranch/sourceBranch/headCommit）：
   ```json
   { "taskId": "uuid", "repositoryId": "uuid", "idempotencyKey": "uuid-可选" }
   ```

2. **POST /merge-requests 兼容改造（§C3）**：把 L49-55 的 `create` 调用改为**转发到申请预检**，标记 `@Deprecated`，禁止再直接调用真实创建方法。

3. **新增独立 Service**（例如 `MrPreflightService` 或直接加在 MergeRequestService 里），提供：
   ```java
   MergeRequestPreflightResponse requestPreflight(
       UUID projectId, UUID userId, String taskId, String repositoryId, String idempotencyKey)
   ```
   内部要做的事（按修改计划 §A2）：
   - 校验 Task、Workspace、Repository 归属当前项目；存在 sourceBranch、headCommit；head 是已接受并已 push 的交付事实
   - targetBranch 从 `worktree.baseRef` 取，空回退到 `repository.defaultBranch`，**不能用前端传入**
   - 刷新并解析 targetCommit
   - 无未合并 MR 锁定分支
   - 触发 `testRuns.createAutomaticDryRun(projectId, taskId, repositoryId, targetBranch)` → 复用现有自动 Dry Run 能力
   - （推荐）持久化 `MrPreflightRequest` 记录到新表 `mr_preflight_requests`（见缺口 2）；如果暂时不建表，用 `(project_repository_id, source_branch, target_branch, head_commit)` + `dry_runs` 最新记录临时推导预检状态
   - 发布 `MrFirstPreflightRequestedDomainEvent` 或直接执行 Dry Run 创建（DIFF_FIRST 和 MR_FIRST 统一）
   - 返回统一的 `MergeRequestPreflightResponse`（见缺口 3）

---

### ❌ 缺口 2：缺少预检申请的持久化实体（MrPreflightRequest）

**完成不了的流程**：
- 前端刷新页面时，通过 `GET /tasks/{taskId}/merge-request-preflight` 恢复"之前申请过预检、当前 Dry Run 跑到什么状态"。没有持久化的"预检申请"记录就无法区分：
  - 用户从没点过「申请MR」（按钮应为「申请MR」）
  - 用户已经点过「申请MR」，但 Dry Run 还在跑（应显示「预检中」）
- 无法支持"失败重试"的失败码和原因持久化。
- 多个 Task 共用同一 source branch 时，无法区分当前 MR 分支级预检覆盖了哪些 coveredTaskIds / coveredDiffIds（前端 UI 需要展示）。

**为什么完成不了**：
- `entity/` 目录下没有 `MrPreflightRequestEntity`；schema.sql（`resources/db/qgents_schema.sql`）没有 `mr_preflight_requests` 表。
- 当前只能从 `dry_runs` 表倒推最近一次 Dry Run 的状态，但 Dry Run 可能不是因为"申请 MR"才跑的（比如之前还有人工创建 Dry Run 的入口），无法做语义归因。

**建议修改方式（按修改计划 §5）**：
- 新建表 `mr_preflight_requests`（字段按 §A1）：`id, project_id, task_id, project_repository_id, workspace_id, source_branch, head_commit, target_branch, target_commit, status, dry_run_id, requested_by, idempotency_key, failure_code, failure_reason, branch_lock_status, is_branch_level, merge_request_id, created_at, updated_at`
- 新建关联表 `mr_preflight_tasks`（或 diff）存 `coveredTaskIds / coveredDiffIds`，支持分支级预检的任务覆盖关系
- 新建 `MrPreflightRequestEntity` + `MrPreflightRequestMapper`
- 建立唯一键 `(project_repository_id, source_branch, target_branch, head_commit, target_commit)`，实现分支级幂等
- 后续 `requestPreflight` 先查同上下文是否已有进行中的预检，有则直接返回而非重复创建 Dry Run

---

### ❌ 缺口 3：缺少 `MergeRequestPreflightResponse` DTO 和列表 DTO

**完成不了的流程**：
- 申请预检成功后，前端需要拿到 9 状态枚举（REQUESTED / DRY_RUN_QUEUED / DRY_RUN_RUNNING / WAITING_CQ / CQ_REJECTED / CREATING_MR / MR_CREATED / FAILED / STALE）、blockers、failureCode、coveredTaskIds、mergeRequest 内嵌对象等字段。当前后端没有任何一个 DTO 返回这种组合结构。
- 按任务查询时返回列表 `TaskMergeRequestPreflightList`，每项包含 `repositoryId, dryRunStatus, cqStatus, headCommit, targetBranch, status, mergeRequest` 等。

**为什么完成不了**：
- `dto/` 目录下搜索不到 `MergeRequestPreflight*Response`、`PreflightRepositoryStatus`、`TaskMergeRequestPreflight*`。
- 现有的 `PreflightGateResponse`（PreflightGateService 返回的）只包含 `{id, repositoryId, status, blockers[], dryRun{id,status,...}, cqPlusOne{status,reviewerUserId,...}, qualityGateDto}`，与前端期望的 MergeRequestPreflight 结构字段不一致（缺少 sourceBranch、headCommit、taskId、mergeRequest、coveredTaskIds 等），也没有 9 状态枚举，只有一个 PASS/PENDING 的综合 status。

**建议修改方式（按修改计划 §C1/C2）**：

1. **新增 `MergeRequestPreflightResponse`**（字段完全按前端 `types/task-model.ts#MergeRequestPreflight` 定义）：
   ```java
   @Data public class MergeRequestPreflightResponse {
       private String id;
       private String taskId;                     // 可能 null（分支级）
       private String repositoryId;
       private String sourceBranch;
       private String headCommit;
       private String targetBranch;
       private String targetCommit;
       private String status;                     // 枚举：REQUESTED / DRY_RUN_QUEUED / DRY_RUN_RUNNING / WAITING_CQ / CQ_REJECTED / CREATING_MR / MR_CREATED / FAILED / STALE
       private String dryRunId;
       private List<String> blockers;
       private String failureCode;
       private String failureReason;
       private List<String> coveredTaskIds;
       private List<String> coveredDiffIds;
       private String branchLockStatus;           // UNLOCKED / LOCKED
       private Boolean isBranchLevel;
       private MergeRequestSummary mergeRequest;  // 未创建为 null
       private String createdAt;
       private String updatedAt;
   }
   ```
   *状态映射逻辑（组装响应时）*：
   ```
   若无 MrPreflightRequest 记录 → REQUESTED
   Dry Run entity status = QUEUED → DRY_RUN_QUEUED；RUNNING → DRY_RUN_RUNNING
   Dry Run PASSED + latest CQ review is null → WAITING_CQ
   Dry Run PASSED + latest CQ review = REJECTED → CQ_REJECTED
   Dry Run PASSED + latest CQ review = APPROVED + MR entity null / DELIVERY_OP status=RUNNING → CREATING_MR
   Dry Run PASSED + CQ=APPROVED + MR entity exists (status != null) → MR_CREATED
   Dry Run FAILED / CONFLICT → FAILED；head/target SHA 与申请时不同 → STALE
   ```

2. **新增 `TaskMergeRequestPreflightList`**：
   ```java
   @Data public class TaskMergeRequestPreflightListResponse {
       private String taskId;
       private List<RepositoryStatus> items;

       @Data public static class RepositoryStatus {
           private String repositoryId;
           private String preflightId;        // 可为 null
           private String status;             // 9 枚举 + 空
           private String dryRunId;           // 可为 null
           private String dryRunStatus;       // QUEUED/RUNNING/PASSED/FAILED 等
           private String cqStatus;           // PENDING/APPROVED/REJECTED
           private String headCommit;
           private String targetBranch;
           private String failureCode;
           private String failureReason;
           private MergeRequestSummary mergeRequest; // 可为 null
       }
   }
   ```

3. Controller 中两个 GET 接口都返回上述 DTO。

---

### ❌ 缺口 4：`MrFirstAutomationService` 只支持 MR_FIRST，不支持 DIFF_FIRST

**完成不了的流程**：
- 人工模式（DIFF_FIRST）用户点「申请MR」 → 预检成功 → Dry Run 跑完 → CQ+1 通过 → **后端应自动创建真实 MR（SYSTEM 模式）或允许前端再点一次"创建MR"后创建（MANUAL 模式）**。
- 但 `MrFirstAutomationService.onCqApproved(...)` (L69-71) 在 L135 检查：
  ```java
  if (task == null || !projectId.equals(task.getProjectId())
      || !"MR_FIRST".equals(task.getDeliveryMode())   // ← 只支持 MR_FIRST！
      || !"WAITING_PREFLIGHT".equals(task.getStatus())
      || task.getCreatedBy() == null) return;
  ```
  **任何 deliveryMode != MR_FIRST 的任务，CQ 通过后都不会自动调用 mrService.create 创建真实 MR。**

**同时还要注意**：用户新的流程语义里区分 SYSTEM 和 MANUAL：
- **SYSTEM**：CQ+1 通过 → 后端自动创建 GitHub PR（现有 MrFirstAutomationService 的行为，但要去掉 MR_FIRST 限制）
- **MANUAL**：CQ+1 通过 → **不自动创建**，等用户点「创建MR」按钮 → 再次调预检申请接口时后端识别"当前 WAITING_CQ + CQ 通过，推进到创建 MR"

**建议修改方式（按修改计划 §B / §B2-3）**：
1. 在申请预检时（缺口 1 的 requestPreflight），把**当前 placeholder MR 的 createMode 字段**带入预检申请：SYSTEM = 后端自动创建；MANUAL = 等待用户再次点击才创建。（如果没有建表，可以临时在识别 createMode：placeholder MR.status=PENDING_CREATE 且 createMode=SYSTEM 则自动，否则手动。）

2. **扩写 `MrFirstAutomationService`**：
   - 类名或注释改为通用的预检编排器（§B1）
   - `onCqApproved` 去掉 `!"MR_FIRST".equals(task.getDeliveryMode())` 判断，改为根据"当前申请的 createMode=SYSTEM？"才自动调用 `mrService.create`
   - 如果没有持久化 createMode，可改为查询：
     ```
     placeholder MR（status=PENDING_CREATE + taskId + repositoryId）.createMode == SYSTEM
     或者 MergeRequestDeliveryOperation 已 RUNNING（即已有正在创建的进程），或 createMode=UNKNOWN 时（保持默认 MR_FIRST 自动），其他 deliveryMode（DIFF_FIRST）默认按照 MANUAL 语义：不自动创建，返回等待。
     ```
   - 补偿定时 `recover()`（L77-94）同样去掉 `eq(TaskEntity::getDeliveryMode, "MR_FIRST")` 限制，但要额外判断"自动创建的预检"，避免误创建 MANUAL 的 MR。

3. **新增"MANUAL 创建 MR"的触发路径**：当 `POST /merge-requests/preflight` 二次调用，且当前上下文是 WAITING_CQ + CQ APPROVED + createMode=MANUAL，直接推进到 `MergeRequestService#create`（由 requestPreflight 服务方法内部判断后调用），并返回 `status=MR_CREATED` 和嵌套 `mergeRequest` 信息。

---

### ❌ 缺口 5：`MergeRequestService#create` 需拆分"公开申请入口"和"内部真实创建入口"（按 §A3）

**完成不了的流程**：
- 如果直接把 Controller 的 `POST /merge-requests/preflight` 调 `MergeRequestService.create`，会先 `requirePreflightGates().requireReady()`（L410），不通过直接抛错 → 而申请预检的本意就是启动 Dry Run，此时 Dry Run 尚未开始，必然抛错。
- 另外 CQ 通过后 MrFirstAutomationService 调用的 `mrService.create`（缺口 4 需要扩展支持 DIFF_FIRST）与前端点击直接创建混用同一方法，缺乏"公开入口 vs 内部入口"的权限/校验区分，容易绕过预检。

**建议修改方式（按 §A3）**：
1. 把 `MergeRequestService#create` **重命名并改为 private/包级**，例如 `createActualMergeRequestAfterCq(MergeRequestCreateRequest, UUID actor)`：仍然保留 claimCreate、verifyRemoteCreationContext、createRemote、finalizeCreate 整套完整创建流程。
2. 新增公开入口 `requestPreflight(...)`，在缺口 1 所述的新 Service 或 MergeRequestService 自身提供：只做校验 + 触发 Dry Run，绝不触 GitHub API。
3. 外部能调用真实创建 MR 的**唯一入口**只能是：
   - `MrFirstAutomationService#onCqApproved`（SYSTEM 模式 CQ 通过后）
   - `MrFirstAutomationService#recover` 补偿任务
   - requestPreflight 内部识别 MANUAL + CQ 已通过时
4. `MergeRequestController#create` 原方法整体改为转发 `requestPreflight`，返回 `MergeRequestPreflightResponse`（§C3 兼容策略），并在接口上加 `@Deprecated`。

---

## 3. 前端代码 vs 后端接口契约对齐表（不需要改前端）

以下表说明前端当前写好的代码要什么、后端给什么字段就能对得上（不需要再改前端）。

### 3.1 预检申请接口

```http
POST /projects/{projectId}/merge-requests/preflight
Idempotency-Key: <UUID>

Request (前端已写好):
{
  "taskId": "task-UUID",
  "repositoryId": "repo-UUID"
}

Response 202 (前端 mapPreflightResponse 需要以下字段，缺一就是 null/默认值，不会崩):
{
  "id": "preflight-id",
  "taskId": "task-UUID",
  "repositoryId": "repo-UUID",
  "sourceBranch": "feat/x",
  "headCommit": "a1b2c3d",
  "targetBranch": "main",
  "targetCommit": "e5f6...",
  "status": "DRY_RUN_RUNNING",              # 9 枚举字符串
  "dryRunId": "dryrun-uuid",
  "blockers": ["DRY_RUN_RUNNING"],
  "failureCode": null,
  "failureReason": null,
  "coveredTaskIds": ["task-uuid"],
  "coveredDiffIds": ["diff-uuid"],
  "branchLockStatus": "UNLOCKED",
  "isBranchLevel": true,
  "mergeRequest": null  # 或真实 MR Summary
}
```

### 3.2 按 Task 查询全部仓库预检

```http
GET /projects/{projectId}/tasks/{taskId}/merge-request-preflight

Response 200:
{
  "items": [
    {
      "repositoryId": "...",
      "preflightId": "...",
      "status": "WAITING_CQ",
      "dryRunId": "...",
      "dryRunStatus": "PASSED",
      "cqStatus": "APPROVED",
      "headCommit": "sha",
      "targetBranch": "main",
      "failureCode": null,
      "failureReason": null,
      "mergeRequest": null
    }
  ]
}
```

### 3.3 枚举值（前端已写死，后端必须精确一致，大小写敏感）

预检状态 `status`：`REQUESTED | DRY_RUN_QUEUED | DRY_RUN_RUNNING | WAITING_CQ | CQ_REJECTED | CREATING_MR | MR_CREATED | FAILED | STALE`
Dry Run 状态 `dryRunStatus`：`QUEUED | RUNNING | PASSED | FAILED | CONFLICT`（按现有后端 DryRunEntity.status 枚举即可）
CQ 状态 `cqStatus`：`PENDING | APPROVED | REJECTED`（已在 PreflightGateResponse.CqSummary 使用）
分支锁 `branchLockStatus`：`UNLOCKED | LOCKED`
MR 创建来源 `createMode`：`MANUAL | SYSTEM | UNKNOWN`（已在 MergeRequestSummaryResponse 使用）

---

## 4. 后端补充顺序建议（按计划 §8 的 P0/P1）

```
P0  1) 新增 MergeRequestPreflightResponse + TaskMergeRequestPreflightList DTO（缺口 3）
    2) 新增 MrPreflightRequest Entity + Mapper + 表（缺口 2，评估后如果先不建表，可以临时用 dry_runs + preflight_cq_reviews + merge_requests 三张表实时拼，但创建时间/idempotency/失败码会缺失）
    3) 实现 requestPreflight/getPreflight/getTaskPreflight 服务方法（缺口 1）
    4) 新增 Controller 3 个 endpoints；POST /merge-requests 转发预检兼容（缺口 1）
    5) 拆分 MergeRequestService.create：公开入口 → requestPreflight，内部入口 → createActualMergeRequestAfterCq（缺口 5）
P1  6) 扩展 MrFirstAutomationService：去掉 MR_FIRST 限制，根据 createMode 判断是否自动创建 MR（缺口 4）
    7) CQ 通过事件中，新增 MANUAL 模式时把预检状态推进到"等待前端用户点创建MR"（STALE？或新增 READY？）
    8) 数据库迁移脚本 V202608XX__mr_preflight_request.sql（如果建表）
```

**全部完成后**：前端关掉 mock（`VITE_USE_MOCK=false`），设置 `VITE_API_BASE_URL=http://<后端host>:<port>/api/v1`，即可完成完整链路。

---

## 5. 流程验收矩阵（前端已通过 mock 验证，后端按上面补齐后，应通过真实后端验证同样的点）

| # | 场景 | 前端期望行为 | 后端侧检查点 |
|---|---|---|---|
| 1 | SYSTEM 占位 MR 页面加载后自动发起预检 | 按钮变为「预检中」loading | requestPreflight 接口调通；Dry Run 被创建；预检 status 返回 DRY_RUN_* 或 WAITING_CQ |
| 2 | SYSTEM 预检 CQ 拒绝 / Dry Run 失败 | 按钮变为「申请失败」red | failureCode + failureReason 正确返回 |
| 3 | SYSTEM CQ 通过 | 操作列显示 GitHub + Admin 的 合并MR | CQ 通过事件 → 自动调用内部创建；预检响应 status=MR_CREATED、mergeRequest 字段有值 |
| 4 | MANUAL 用户点「申请MR」 | 按钮变为「预检中」 → CQ 通过后按钮变为「创建MR」可点 | 第一次 preflight 返回 WAITING_CQ + CQ 查为 APPROVED |
| 5 | MANUAL 用户再点「创建MR」 | 操作列显示 GitHub + 合并MR | 第二次 preflight 调用时后端识别上下文并调 createActualMergeRequestAfterCq |
| 6 | 质量门禁审查页「新建 Dry-run」已移除 | 只有「运行测试」按钮 | 前端已经做好，不需要后端改 |
| 7 | CQ+1 审查页 CQ 通过后触发事件 | 预检状态推进 | PreflightGateService.approve 发布 preflight.updated 事件；编排器监听正确 |

---

## 6. 一句话总结

**当前前端代码已经按修改计划完整实现，3 个 preflight API 的 URL、请求、响应字段、枚举值全按 `web/README/统一创建MR自动预检修改计划(3).md` 的 §C1/C2 写好，不会再动。后端只需要按照上面列出的 5 个缺口补齐 Controller + Service 拆分 + Automation 扩写 + DTO + 表，即可真实打通。**
