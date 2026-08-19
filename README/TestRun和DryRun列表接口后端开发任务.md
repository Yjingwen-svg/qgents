# Test Run / Dry Run 列表接口 — 后端开发任务（P1+）

> 本文档描述前端目前缺失、需要后端补充的两个列表查询接口。
> 文档 `Qgents接口文档.md §21 Q5` 已声明本轮（P0）不做，归入 P1+。
> 前端目前用 `localStorage` 临时维护运行历史，仅本机可见、不跨设备、无权威性。
> 补齐后可让「质量门禁页」展示完整历史，并替换本地存储方案。

---

## 1. 任务背景

### 1.1 现状

| 接口 | 状态 | 备注 |
|------|------|------|
| `POST /projects/{projectId}/test-runs` | ✅ 已实现 | 创建 Test Run |
| `GET /projects/{projectId}/test-runs/{testRunId}` | ✅ 已实现 | 查询单条详情 |
| `POST /projects/{projectId}/dry-runs` | ✅ 已实现 | 创建 Dry Run |
| `GET /projects/{projectId}/dry-runs/{dryRunId}/report` | ✅ 已实现 | 查询单条报告 |
| **`GET /projects/{projectId}/test-runs`** | ❌ **未实现** | **本任务** |
| **`GET /projects/{projectId}/dry-runs`** | ❌ **未实现** | **本任务** |

### 1.2 为什么需要

前端「质量门禁页」需要展示：

1. **当前运行**：状态为 `QUEUED` 或 `RUNNING` 的最近一条记录（跨设备可见）
2. **本设备最近运行**：按时间倒序的历史运行列表（跨设备可见，替换 localStorage）
3. **任务详情页关联**：从 Task 详情页跳转查看其触发的 Dry Run

当前 localStorage 方案有三个硬伤：
- 换浏览器/换设备看不到历史
- 用户清缓存后记录丢失
- 不能看到其他成员发起的运行

---

## 2. 接口规格

### 2.1 GET `/projects/{projectId}/test-runs`

**权限**：Project Member（项目成员可读，不含用例详情/产物 URL）

#### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `repositoryId` | string | 否 | 按仓库过滤；值为 `project_repositories.id` |
| `taskId` | string | 否 | 按关联 Task 过滤 |
| `status` | string | 否 | 按状态过滤，逗号分隔多值，如 `QUEUED,RUNNING` |
| `createdByUserId` | string | 否 | 按发起人过滤 |
| `limit` | int | 否 | 默认 `20`，最大 `100` |
| `cursor` | string | 否 | 上一页响应的 `nextCursor`，用于翻页 |

#### 响应（200 OK）

```json
{
  "data": [
    {
      "id": "test-run-uuid",
      "projectId": "proj-uuid",
      "repositoryId": "project-repo-uuid",
      "testsetIds": ["testset-uuid-1", "testset-uuid-2"],
      "taskId": "task-uuid",
      "ref": "feat/login-api",
      "status": "PASSED",
      "createdBy": "user-uuid",
      "createdAt": "2026-08-19T08:00:00.000Z",
      "startedAt": "2026-08-19T08:00:02.000Z",
      "finishedAt": "2026-08-19T08:00:30.000Z"
    }
  ],
  "nextCursor": "base64-encoded-cursor",
  "hasMore": false
}
```

#### 字段说明

| 字段 | 类型 | 必返 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | Test Run UUID |
| `projectId` | string | ✅ | 所属项目 ID |
| `repositoryId` | string | ✅ | `project_repositories.id`（不是 GitHub repo id） |
| `testsetIds` | string[] | ✅ | 本次执行的测试集 ID 列表 |
| `taskId` | string \| null | ✅ | 关联 Task；无则 null |
| `ref` | string \| null | ✅ | 源引用（分支/commit） |
| `status` | enum | ✅ | `QUEUED` \| `RUNNING` \| `PASSED` \| `FAILED` \| `CANCELLED` |
| `createdBy` | string \| null | ✅ | 发起人 user UUID |
| `createdAt` | ISO8601 | ✅ | 创建时间 |
| `startedAt` | ISO8601 \| null | ✅ | 开始执行时间 |
| `finishedAt` | ISO8601 \| null | ✅ | 结束时间 |

**列表接口不返回**：`executionSummary`、`caseSummary`、`cases`、`artifacts`、`reportUrl`、`pdfUrl`、`sandboxId`。这些字段在列表场景下体积过大，前端需要时调 `GET /test-runs/{id}` 获取。

---

### 2.2 GET `/projects/{projectId}/dry-runs`

**权限**：Project Member

#### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `repositoryId` | string | 否 | 按仓库过滤 |
| `taskId` | string | 否 | 按关联 Task 过滤 |
| `status` | string | 否 | 按状态过滤，逗号分隔，如 `PASSED,FAILED` |
| `targetBranch` | string | 否 | 按目标分支过滤 |
| `createdByUserId` | string | 否 | 按发起人过滤 |
| `limit` | int | 否 | 默认 `20`，最大 `100` |
| `cursor` | string | 否 | 翻页游标 |

#### 响应（200 OK）

```json
{
  "data": [
    {
      "id": "dry-run-uuid",
      "projectId": "proj-uuid",
      "repositoryId": "project-repo-uuid",
      "sourceRef": "feat/login-api",
      "targetBranch": "main",
      "taskId": "task-uuid",
      "status": "PASSED",
      "createdBy": "user-uuid",
      "createdAt": "2026-08-19T08:00:00.000Z",
      "startedAt": "2026-08-19T08:00:02.000Z",
      "finishedAt": "2026-08-19T08:01:15.000Z"
    }
  ],
  "nextCursor": "base64-encoded-cursor",
  "hasMore": false
}
```

#### 字段说明

| 字段 | 类型 | 必返 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | Dry Run UUID |
| `projectId` | string | ✅ | 所属项目 ID |
| `repositoryId` | string | ✅ | `project_repositories.id` |
| `sourceRef` | string | ✅ | 源分支/commit |
| `targetBranch` | string | ✅ | 目标分支 |
| `taskId` | string \| null | ✅ | 关联 Task |
| `status` | enum | ✅ | `QUEUED` \| `RUNNING` \| `PASSED` \| `FAILED` \| `CONFLICT` \| `CANCELLED` |
| `createdBy` | string \| null | ✅ | 发起人 user UUID |
| `createdAt` | ISO8601 | ✅ | 创建时间 |
| `startedAt` | ISO8601 \| null | ✅ | 开始时间 |
| `finishedAt` | ISO8601 \| null | ✅ | 结束时间 |

**列表接口不返回**：`report`（含 `mergeable`、`conflicts`、`tests`）、`caseSummary`、`cases`、`reportUrl`、`pdfUrl`、`durationSeconds`、`sandboxId`、`testsetIds`。需要详情时调 `GET /dry-runs/{id}/report`。

---

## 3. 设计要求

### 3.1 排序与分页

- **默认排序**：`createdAt DESC`（最新在前）
- **分页方式**：**Cursor-based**（推荐）或 Offset-based
  - Cursor 推荐格式：base64(`createdAt:{createdAt}|id:{id}`)，确保同时间戳稳定排序
  - 翻页参数名统一用 `cursor` 和 `nextCursor`
  - `hasMore: false` 时 `nextCursor` 可为 null

### 3.2 性能

- 列表查询必须走索引，建议 `(projectId, createdAt DESC)` 复合索引
- `limit` 最大 100，超过截断到 100
- 默认 20 条，避免全表扫描
- **不返回测试结果详情**（`cases`、`caseSummary`），避免响应体积过大

### 3.3 权限

- **Project Member** 可读列表（只能看自己项目的运行）
- 不暴露其他项目的运行记录
- 跨用户可见：A 发起的运行，B 也能在列表里看到（同项目内）

### 3.4 一致性

- 列表接口的 `status` 字段必须与单条详情接口 `GET /test-runs/{id}`、`GET /dry-runs/{id}/report` 的 `status` 一致
- `createdBy` 字段必须是 user UUID，前端用 `createdBy` 关联用户列表展示发起人姓名
- `repositoryId` 必须是 `project_repositories.id`，**不是** GitHub repo 数字 ID

---

## 4. 错误码

| HTTP | code | 含义 |
|------|------|------|
| 400 | `INVALID_CURSOR` | cursor 参数格式不合法 |
| 400 | `INVALID_STATUS_FILTER` | status 枚举值不合法 |
| 401 | `UNAUTHORIZED` | 未登录 |
| 403 | `PROJECT_MEMBER_REQUIRED` | 无项目成员权限 |
| 404 | `PROJECT_NOT_FOUND` | 项目不存在或已删除 |

---

## 5. 前端使用场景

### 5.1 质量门禁页 — 当前运行卡片

```
GET /projects/{projectId}/test-runs?status=QUEUED,RUNNING&limit=1
GET /projects/{projectId}/dry-runs?status=QUEUED,RUNNING&limit=1
```

合并展示，有则显示「运行中」状态 Tag，并通过单条接口轮询 4s 刷新状态。

### 5.2 质量门禁页 — 本设备最近运行

```
GET /projects/{projectId}/test-runs?limit=10
GET /projects/{projectId}/dry-runs?limit=10
```

前端合并两接口返回，按 `createdAt DESC` 排序，取前 10 条展示。

### 5.3 任务详情页 — 关联 Dry Run

```
GET /projects/{projectId}/dry-runs?taskId={taskId}&limit=5
```

任务进入 `WAITING_PREFLIGHT` 状态后，详情页用此查询找到后端自动发起的 Dry Run。

---

## 6. 验收标准

### 6.1 功能验收

- [ ] `GET /test-runs?limit=20` 返回最近 20 条 Test Run
- [ ] `GET /dry-runs?limit=20` 返回最近 20 条 Dry Run
- [ ] `?repositoryId=xxx` 只返回该仓库的运行
- [ ] `?taskId=xxx` 只返回该 Task 关联的运行
- [ ] `?status=QUEUED,RUNNING` 只返回运行中的
- [ ] 翻页：`cursor` 参数可正确获取下一页
- [ ] `hasMore=false` 时 `nextCursor` 为 null
- [ ] 列表只含本项目的运行，跨项目隔离

### 6.2 字段验收

- [ ] `repositoryId` 为 `project_repositories.id`
- [ ] `status` 枚举与单条接口一致
- [ ] 列表响应中不包含 `cases`、`caseSummary`、`report` 等大字段
- [ ] `createdAt` 为 ISO8601 UTC 时间

### 6.3 性能验收

- [ ] `limit=20` 查询 < 200ms（含索引）
- [ ] `limit=100` 查询 < 500ms
- [ ] 无 N+1 查询（关联 `createdBy` 用户名走 JOIN 或批量预加载）

---

## 7. 前端配合改动

后端实现后，前端需要做的改动（**这部分由前端完成，不需要后端配合**）：

1. 在 `src/hooks/testset.ts` 中：
   - 移除 `useTestRuns` / `useDryRuns` 调用本机 localStorage 的 fallback 逻辑
   - 改为直接调用 `GET /test-runs` / `GET /dry-runs`
2. 在 `src/pages/ProjectDetail/Testset/QualityGateReviewPage.tsx`：
   - 「本设备最近运行」改名为「最近运行」（去掉「本设备」字样）
   - 数据源从 `readRunHistory()` 改为 `useTestRuns()` + `useDryRuns()`
3. `src/api/testset.ts` 中的 `listTestRuns` / `listDryRuns` 已实现，等后端接口上线即可生效

---

## 8. 优先级

- **P1+**：与 P0 解耦，可在 P0 联调后开始
- 建议排期：P0 完成后 1-2 周内
- 阻塞场景：跨设备查看运行历史、任务详情页关联 Dry Run 展示

---

## 9. 参考文档

- `Qgents接口文档.md §12.4` — Test Run / Dry Run 单条接口定义
- `Qgents接口文档.md §21 Q5` — 本轮不做列表接口的声明
- `Dry Run前后端执行计划(1).md` — Dry Run 自动流程设计
- 前端代码 `src/api/testset.ts` — 已实现的列表查询函数（待后端接口上线）
