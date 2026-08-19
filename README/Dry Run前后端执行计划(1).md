# Dry Run 前后端执行计划

## 1. 目标与决策

本计划用于把 Qgents 的 Dry Run 从“已有代码骨架”落实为可稳定联调、可作为 MR 前门禁事实的完整能力。

决策优先级：

1. `Qgents题目.md`：必须支持 Agent 完成开发、测试并形成可追溯交付；需要 MR 时必须经过 Dry Run 和 CQ+1。
2. 用户体验：状态可理解、失败可定位、重复点击不重复执行、断线后可恢复。
3. `Qgents 接口文档v2.0.12.md`：接口、状态、事件和错误码必须与实现一致；如实现确需改变，先更新文档再联调。

本计划采用以下固定语义：

- `TestRun` 是用户主动发起的诊断测试，用户指定 `testsetIds`。
- `DryRun` 是 MR 前合并预演，由服务端固定 `headCommit`、目标分支和 `targetCommit`，自动加载目标分支绑定的必选 Testset。
- Dry Run 通过不等于 MR 已创建，也不等于 MR 已合并。
- `MR_FIRST` 在代码 `commit/push` 后进入 `WAITING_PREFLIGHT`，Dry Run 通过且独立成员 CQ+1 后，服务端才幂等创建 MR。
- `DIFF_FIRST` 不强制进入 Dry Run；只有用户后续明确创建 MR 时才进入同一套预检门禁。
- 失败记录不可覆盖、不可伪造；重试创建新的执行尝试并保留来源关系。

## 2. 当前代码盘点

### 2.1 已有能力

后端已经具备以下基础：

- `POST /api/v1/projects/{projectId}/dry-runs` 受理 Dry Run，返回 `QUEUED`。
- `GET /api/v1/projects/{projectId}/dry-runs/{dryRunId}/report` 查询报告。
- `TestRunService.createDryRun()` 会校验仓库、Task Workspace、目标分支，并刷新目标分支后固定目标 SHA。
- Dry Run 创建时会快照目标分支绑定的 Testset 定义，不依赖客户端传入 `testsetIds`。
- `TestRunExecutionService.executeDryRun()` 已有“合并预演成功后执行 Testset”的主流程。
- 数据库已有 `dry_runs` 的执行快照、租约、领取次数和恢复索引。
- 已有 `dry-run.updated`、`preflight.updated` 事件及预检查询/CQ+1接口。
- `PreflightGateService` 已按源提交、目标分支和目标提交匹配 Dry Run/CQ+1。
- `MrFirstAutomationService` 已有 CQ+1 后自动创建 MR 的接缝。
- `SandboxWorkerClient` 已提供 Git resolve、merge preview、Testset 执行能力。

### 2.2 必须在联调前确认或修复的问题

- Worker 的 `mergePreview` 请求必须明确区分“目标分支名”和“已解析目标 SHA”。当前 Dry Run 执行应使用固定目标 SHA，不能让 Worker 再次隐式解析到其他基线。
- Worker 返回的 `resolvedHeadCommit`、`resolvedTargetCommit` 必须与数据库快照逐一比对，任何不一致都只能失败，不能写入 `PASSED`。
- Dry Run 的 Testset 结果必须包含 `testsetId/status/exitCode/durationMs/failureCode`，异常还要有脱敏 `message`，方便前端和重试上下文使用。
- Worker、GitHub、Git 基线缺失和超时要落稳定错误码，不能统一成没有操作价值的 `EXECUTION_FAILED`。
- `QUEUED/RUNNING` 租约过期后只能由恢复调度器重新领取；同一 Dry Run 不能被多个实例并行执行。
- Dry Run 失败时不能创建 MR；冲突结果必须是 `tests.status=SKIPPED`，并明确 `MERGE_CONFLICT`。
- 目标分支推进、Workspace HEAD 推进或 Testset 配置改变后，旧 Dry Run/CQ+1 必须失效。
- 多仓库 Task 必须每个仓库单独 Dry Run、单独预检、单独创建 MR，不能把一个仓库的通过结果复用于另一个仓库。
- 失败后重试要保留原运行事实，并将失败摘要作为结构化 `RetryContext` 带入后续 Agent，而不是把完整日志直接塞进 Prompt。

## 3. 目标流程

### 3.1 手动 Dry Run

```text
Project Member 选择仓库、sourceRef、targetBranch
  -> POST /projects/{projectId}/dry-runs
  -> 服务端校验项目/仓库/Task归属
  -> 刷新目标分支并固定 targetCommit
  -> 解析并固定 source headCommit
  -> 查询目标分支必选 Testset
  -> 固化 Testset snapshot
  -> DryRun = QUEUED
  -> SSE dry-run.updated
  -> Worker merge preview
      ├─ 冲突：FAILED + tests=SKIPPED(MERGE_CONFLICT)
      └─ 可合并：在合并结果上执行全部 Testset
          ├─ 任一失败：FAILED
          └─ 全部通过：PASSED
  -> SSE dry-run.updated
  -> GET /dry-runs/{id}/report 查看结果
```

### 3.2 MR_FIRST 自动预检

```text
Agent 完成开发
  -> 所有仓库 commit/push 成功
  -> Task = WAITING_PREFLIGHT
  -> 每个仓库创建/复用一条当前 head + target 的 Dry Run
  -> Dry Run 全部 PASSED
  -> 独立项目成员对每条 Dry Run 提交 CQ+1
  -> preflight.updated
  -> 每个仓库幂等创建 MR
  -> 全部 MR 创建成功：Task = SUCCEEDED
```

任一仓库失败时，其他仓库的结果仍需保留；不得假装整个 Task 已成功。前端显示“部分预检/交付完成”，并提供可重试的具体仓库和错误码。

### 3.3 Dry Run 失败后的重试

```text
Dry Run = FAILED
  -> 前端展示结构化失败原因
  -> 用户点击重试（仅瞬时基础设施失败）
  -> 创建新的 attempt 或重新领取同一 QUEUED 运行，按错误类型决定
  -> 若是业务/Testset断言失败，不能自动绕过门禁
  -> 用户明确要求 Agent 修复时，创建 continuation Task
  -> 新 head 产生后必须重新 Dry Run、重新 CQ+1
```

## 4. 后端实施计划

### 阶段 A：基础契约和配置（P0）

1. 固定状态和错误码。
   - Dry Run：`QUEUED/RUNNING/PASSED/FAILED`。
   - Testset 结果：`NOT_REQUIRED/SKIPPED/PASSED/FAILED`。
   - 错误码至少区分：`DRY_RUN_CONTEXT_MISMATCH`、`DRY_RUN_TEST_CONTEXT_MISMATCH`、`GIT_BASE_REF_NOT_FOUND`、`SANDBOX_WORKER_UNAVAILABLE`、`TESTSET_DEFINITION_INVALID`、`TESTSET_FAILED`、`DRY_RUN_TIMEOUT`、`DRY_RUN_RETRY_EXHAUSTED`。
2. 确认 Worker 运行配置。
   - 生产/联调必须使用真实 Docker 沙箱，不得使用 `SANDBOX_RUNTIME=fake`。
   - Worker 健康检查、Git Store 同步、目标分支 resolve 和 merge preview 均纳入启动检查。
3. 校验迁移脚本在空库和已有库均可执行。
   - 重点检查 `dry_runs` 的快照、租约、索引和历史数据回填。
   - 不允许重复执行迁移导致 `Duplicate column`；部署时使用 Flyway 版本管理，禁止手工反复执行同一 ALTER。

### 阶段 B：Dry Run 受理和上下文冻结（P0）

涉及：

- `TestRunController`
- `TestRunService`
- `GitStoreSyncService`
- `DryRunEntity/Mapper`

实现要求：

1. 校验 `repositoryId` 属于当前项目且处于可用状态。
2. 若带 `taskId`，校验 Task 属于当前项目、Workspace 包含该仓库、Task HEAD 已推送且 `sourceRef` 与当前 HEAD 一致。
3. `targetBranch` 规范化，拒绝 SHA、`refs/heads/`、路径穿越和空白值。
4. 刷新目标分支并固定 `resolvedTargetCommit`。
5. 解析源引用并固定 `headCommit`，不能依赖执行时再次解析分支名。
6. 按 `repositoryId + targetBranch` 查询启用且有效的门禁 Testset，固化不可变 snapshot。
7. 用稳定幂等键避免重复受理；相同 Task/仓库/head/target 的活动 Dry Run 返回已有运行或明确冲突。
8. 事务提交后再投递异步执行，接口返回 `202` 语义，不能在 HTTP 请求线程同步调用 Worker。

### 阶段 C：Worker 合并预演和 Testset 执行（P0）

涉及：

- `TestRunExecutionService.executeDryRun()`
- `SandboxWorkerClient`
- `sandbox-worker` 的 merge preview、workspace、test execution 模块

执行顺序固定为：

1. 原子领取 Dry Run，写入 `claim_token`、`lease_expires_at`、`attempt_count`。
2. Worker 按固定 `headCommit + targetCommit` 创建隔离预演工作区。
3. 校验 Worker 返回的两个 SHA 与数据库快照完全一致。
4. 若冲突，持久化：

   ```json
   {
     "failureCode": "GIT_MERGE_CONFLICT",
     "mergeable": false,
     "conflicts": ["path/to/file"],
     "tests": {"status": "SKIPPED", "reason": "MERGE_CONFLICT", "results": []}
   }
   ```

5. 若可合并，在合并结果工作区执行 snapshot 中的全部 Testset。
6. Testset 结果逐项持久化到 Dry Run report；不得只保存总状态。
7. 所有 Testset 通过才写 `PASSED`；任何失败写 `FAILED`，并保留失败项。
8. 执行完成或失败后清理临时工作区；清理失败交给 janitor，不覆盖真实执行结果。
9. 所有完成状态都发布 `dry-run.updated`，事件只携带资源 ID、状态、head/target 摘要和时间戳。

### 阶段 D：恢复、重试和失败上下文（P1）

1. 恢复调度器扫描 `QUEUED` 和租约过期的 `RUNNING`，采用数据库 CAS 重新领取。
2. 可重试错误：Worker 连接失败、网络超时、GitHub 临时不可用、沙箱创建超时。
3. 不应通过后端盲重试解决的错误：Testset 断言失败、代码编译失败、合并冲突、Testset 定义非法、权限不足、目标分支不存在。
4. 每次重试增加 `attempt_count`，达到上限后写 `DRY_RUN_RETRY_EXHAUSTED`，停止自动放大。
5. 新增内部 `TaskRetryContextService`：
   - 读取失败 Dry Run 的结构化 report；
   - 脱敏并限长；
   - 生成 `failureCode/failureSummary/failures/modifiedFiles/instruction`；
   - 注入后续 `AgentInput.retryContext`。
6. 原 Dry Run 不修改；续跑 Task/TaskRun 通过来源关系追溯，不能重置为 `QUEUED` 伪装成首次运行。

### 阶段 E：预检门禁和自动创建 MR（P0/P1）

1. `PreflightGateService` 按以下完整键匹配：Task、仓库、headCommit、targetBranch、targetCommit。
2. Dry Run 必须是 `PASSED`；Testset 为 `NOT_REQUIRED` 时仅在该目标分支确实没有必选 Testset 的情况下成立。
3. CQ+1 必须来自非 Task 发起人/非 MR 作者的独立项目成员，且审查的 head/target 与 Dry Run 一致。
4. 目标分支或 Workspace HEAD 变化后，旧 Dry Run/CQ 自动失效，返回 `PREFLIGHT_CONTEXT_STALE`。
5. `MrFirstAutomationService` 在 CQ+1 事件后再次执行最终预检，不能只相信事件 payload。
6. 多仓库逐仓库创建 MR；同一仓库创建操作使用幂等键和远端查询防重复。
7. MR 创建失败时 Task 保持 `WAITING_PREFLIGHT` 或进入明确的交付失败子状态，不得标记 `SUCCEEDED`。
8. MR 创建成功不等于合并；分支锁定只有收到 GitHub `MERGED` 同步事实后解除。

### 阶段 F：可观测性和运维（P1）

日志必须包含：`requestId/projectId/taskId/dryRunId/repositoryId/headCommit/targetCommit/attemptCount/failureCode`。

禁止记录：Token、GitHub 凭据、完整命令中的密钥、宿主机敏感路径、完整原始日志。

增加指标：

- Dry Run 受理数、成功率、失败率、平均耗时；
- merge conflict 数；
- Testset 失败按 Testset ID 聚合；
- Worker 不可用和重试次数；
- 预检阻塞原因；
- 自动创建 MR 成功/失败/重复幂等命中数。

## 5. Web 前端执行计划

### 5.1 手动创建 Dry Run

1. 只允许项目成员操作。
2. 表单字段：仓库、源引用、目标分支、关联 Task（可选）。
3. 不展示 `testsetIds` 选择器作为 Dry Run 必填项，明确说明服务端会按目标分支门禁自动加载 Testset。
4. 提交后立即显示 `QUEUED`，禁止把受理响应显示为已通过。
5. 使用稳定 `Idempotency-Key`，按钮在请求完成前禁用。

### 5.2 报告和失败展示

报告至少展示：

- 源 `headCommit`、目标分支和 `targetCommit`；
- 合并是否可行；
- 冲突文件；
- Testset 总体状态；
- 每个 Testset 的名称/ID、状态、退出码、耗时、脱敏失败原因；
- 当前是否可提交 CQ+1、是否已过期。

失败类型使用不同操作提示：

- 合并冲突：等待代码解决冲突并重新推送；
- Testset 失败：查看失败项，明确修复后重新 Dry Run；
- Worker/GitHub 临时故障：显示“重试”，不引导用户修改业务代码；
- 配置/权限/上下文错误：显示具体处理建议。

### 5.3 MR_FIRST 自动流程

监听并重新 GET 详情：

- `task.updated`
- `dry-run.updated`
- `preflight.updated`
- `merge-request.updated`
- `work-branch.updated`

前端不自行计算门禁、不自行判断当前用户是否可 CQ+1、不依据本地状态显示“MR 已创建”。SSE 断线、游标过期或事件乱序时，重新拉取 Task、Dry Run、预检和 MR 详情。

## 6. 移动端执行计划

移动端复用同一套接口和状态语义，不复制门禁判断：

1. Dry Run 创建页只选择仓库、源引用和目标分支。
2. Dry Run 详情页显示合并结果、Testset 列表和失败原因。
3. `QUEUED/RUNNING` 显示进度态，`PASSED` 显示可 CQ+1，`FAILED` 显示可操作原因。
4. MR_FIRST 任务显示“等待 Dry Run/CQ+1/创建 MR”的阶段，而不是笼统显示失败。
5. 对 `409 PREFLIGHT_CONTEXT_STALE` 提示用户刷新并重新运行，不复用旧报告。
6. 对重复提交、无权限、活动运行和重试上限使用后端错误码映射文案。
7. SSE 断线后主动刷新，不能依赖进程内缓存恢复状态。

## 7. 接口文档修改计划

以 `Qgents 接口文档v2.0.12.md` 为基线，需修改或确认以下小节：

1. **§12.4 Test Run 与 Dry Run**
   - 明确 Dry Run 请求返回 `202` 和初始 `QUEUED`。
   - 补充 `headCommit/targetCommit/testsetSnapshot` 的冻结语义。
2. **§12.5 TestRun 与 Dry Run 的测试集执行语义**
   - 明确 merge preview 成功后才执行 Testset。
   - 明确冲突时 `tests.status=SKIPPED`，不得创建 MR。
   - 补充逐 Testset 失败字段和错误码。
3. **§3.2 状态枚举**
   - 核对 Dry Run、Testset、Task 的状态是否与代码完全一致。
   - 不为重试随意新增状态，优先复用 `QUEUED/RUNNING/FAILED` + `attemptCount`。
4. **§27.10 MR_FIRST 自动预检与创建 MR**
   - 明确自动 Dry Run 的触发时机、每仓库一条、目标分支 Testset 自动加载、CQ+1 后自动创建 MR。
   - 明确失败不创建 MR，MR 创建不等于合并。
5. **预检查询和 CQ+1 小节**
   - 补充 `DRY_RUN_FAILED`、`DRY_RUN_CONTEXT_STALE`、`DRY_RUN_RETRY_EXHAUSTED` 等阻塞原因。
6. **§12.1 实时事件流**
   - 冻结 `dry-run.updated` payload，说明客户端收到事件后必须重新 GET 报告。
7. **新增“Dry Run 失败重试”小节**
   - 区分基础设施重试、代码修复后新 Dry Run、不可重试配置错误。
   - 说明失败事实不可覆盖，重试通过 attempt/source 关系追踪。

接口请求不新增客户端 `testsetIds`，也不允许客户端直接提交 `PASSED`、`targetCommit` 或质量检查结果。

## 8. 数据库和迁移计划

### 8.1 复用现有表

- `dry_runs`：状态、源引用、源 SHA、目标 SHA、Testset snapshot、report、claim token、lease、attempt count。
- `preflight_cq_reviews`：Dry Run 对应的 CQ+1、审查者、审查时 source/target SHA。
- `quality_check_results`：只在现有 MR 级质量检查逻辑确实需要时写入；Dry Run 本身不伪造不存在的 MR TESTSET 检查。

### 8.2 只有发现缺口时才新增字段

若现有表无法追踪重试来源，再新增版本化迁移字段：

- `dry_runs.retry_of_dry_run_id`；
- `dry_runs.retry_reason_code`。

如果通过 `attempt_count`、事件日志和 TaskRun 关系已经能完整追溯，则不新增字段。

所有迁移必须：

- 使用唯一 Flyway 版本；
- 可在已执行环境安全判断字段/索引是否存在；
- 为查询键建立索引；
- 不修改历史 `PASSED` 事实。

## 9. 测试计划

### 9.1 后端单元测试

- 非项目成员不能创建/查询 Dry Run。
- `repositoryId` 越界、Task 不属于项目、Task HEAD 未推送均被拒绝。
- 目标分支刷新后固定正确 SHA。
- 必选 Testset 自动加载，客户端传入的 Testset 列表不能绕过门禁。
- Testset snapshot 与后续配置修改隔离。
- Worker 返回不同 head/target SHA 时不能写 `PASSED`。
- 合并冲突产生 `FAILED + SKIPPED(MERGE_CONFLICT)`。
- Testset 全部通过才产生 `PASSED`。
- 单个 Testset 失败保留逐项结果和稳定错误码。
- Worker 不可用、超时、Git 基线不存在的错误正确分类。
- 租约过期可恢复，两个实例不会并行执行同一 Dry Run。
- 同一幂等键不会创建重复运行。
- 目标分支或 Workspace HEAD 变化后预检失效。
- CQ+1 不能由 Task 发起人提交。
- CQ+1 通过后 MR 创建幂等，重复事件不会创建多个 MR。

### 9.2 Worker 测试

- 固定 source SHA 和 target SHA 的 merge preview。
- source/target 不存在时返回稳定错误码。
- 目标分支冲突文件列表可脱敏返回。
- 合并结果工作区执行多个 Testset，单项失败不丢失其他结果。
- 超时、退出码、输出截断和工作区清理。
- Docker runtime 与 fake runtime 的配置校验。

### 9.3 前端测试

- `QUEUED -> RUNNING -> PASSED/FAILED` 状态渲染。
- Testset 逐项结果和失败提示。
- SSE 重复、乱序、断线、游标过期后的重新拉取。
- MR_FIRST 在 Dry Run 未通过或 CQ 缺失时不显示已创建 MR。
- 多仓库部分成功时按仓库分别展示。
- 重复点击和重复刷新不会触发重复请求。

### 9.4 真实联调验收

1. 单仓库、无必选 Testset：Dry Run 合并通过，报告为 `NOT_REQUIRED/PASSED`。
2. 单仓库、一个必选 Testset：合并通过后执行 Testset，结果为 `PASSED`。
3. Testset 失败：报告为 `FAILED`，不能创建 MR，错误可展示。
4. 合并冲突：不执行 Testset，不创建 MR，展示冲突文件。
5. 目标分支推进后：旧 Dry Run/CQ+1 失效，重新运行使用新 target SHA。
6. MR_FIRST：commit/push -> 自动 Dry Run -> 独立 CQ+1 -> 自动创建 MR。
7. 多仓库：一个仓库失败、另一个成功时状态和重试范围正确。
8. Worker 暂时停止：Dry Run 进入可恢复失败，恢复后按策略重试。
9. 用户重复点击创建/重试：只产生一条有效运行和一个 MR。
10. MR 创建成功但未合并：分支保持锁定；Webhook 确认合并后才解锁。

## 10. 实施顺序和交付物

### 第 1 批：单仓库 Dry Run 跑通

- 后端受理、快照、异步执行、报告和事件。
- Worker merge preview + Testset 执行。
- 完成 P0 单元测试和真实 Docker 联调。

### 第 2 批：预检门禁接通

- 固定 source/target 匹配。
- CQ+1 权限和幂等。
- Dry Run 通过后可查询 `preflight`，未通过禁止 MR。

### 第 3 批：MR_FIRST 自动化

- Task 完成后自动创建 Dry Run。
- CQ+1 事件触发幂等创建 MR。
- 多仓库逐仓库状态和部分失败补偿。

### 第 4 批：前端、移动端和异常体验

- Web/移动端报告、状态、SSE、错误码。
- 失败重试与 RetryContext。
- 文档、联调脚本和验收记录。

每批完成后才进入下一批，不在 Dry Run 基础链路未稳定时接入自动修复 Agent。

## 11. 最终验收标准

- Dry Run 使用不可变的 source/target SHA 和 Testset snapshot。
- 目标分支 Testset 全部通过前，任何路径都不能创建 MR。
- 合并冲突、测试失败、基础设施失败、配置失败能被区分并给出可操作提示。
- 同一运行不会被并发执行；超时和重启后可以恢复或明确终止。
- MR_FIRST 的自动流程不要求用户手动重复点击，但仍保留查询和人工补偿接口。
- 多仓库不互相污染，单仓库失败可单独重试。
- CQ+1 必须来自独立成员，且绑定同一 source/target 上下文。
- Dry Run、CQ+1、MR 创建和 MR 合并均可从事件与详情接口追溯。
- Web、移动端、后端错误码和接口文档的状态语义一致。
- 题目要求的 Agent 分工不被 Dry Run 绕过：Developer 负责修改，Tester 负责执行，Reviewer/CQ+1 负责审查。
