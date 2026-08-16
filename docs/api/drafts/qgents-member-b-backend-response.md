# Qgents 后端4 对「成员 B 后端接口补充与确认清单」的回复

> **状态：Backend Confirmed（契约冻结，实现待排期）**
> **日期：2026-08-15**
> **回复对象：`docs/temp/qgents-member-b-backend-requirements.md`**
> **基线：后端现状（`docs/Qgents 接口文档v1.7.0.md` + develop 分支代码）**
> 本回复只做契约确认，**未改动任何代码**；P0/P1 新接口的实现与「正式接口文档合入」将在开发排期后落地（目标版本 v1.8.0）。

---

## 0. 三个决策点（后端4 已确认）

| 决策点 | 结论 |
| --- | --- |
| CODE 资源聚合边界 | **接受**：`delivery-items` 一次性聚合 CODE / MEMORY / SKILL 三类。CODE 部分**只读消费**现有 DiffReviewBatch / Diff / MR 数据（仅展示摘要），不新增写接口；CODE 写操作继续走现有 Task 级 DiffReview confirm/reject/retry-delivery 正式接口。 |
| 执行顺序 | **接受**：先 P0 全量（delivery 列表 + 统计 + DTO/SSE 冻结），再 P1 接口逐项落地，P2 导出延期。 |
| N01–N06 初步结论 | **接受**：按本回复 §4 冻结。其中 N04 采纳前端建议的显式 `openTarget`；N05 `displayStatus` 由后端统一派生；N06 只返回数量 `pendingForCurrentUser`，不返回 `pendingItems[]`。 |

---

## 1. 状态总表（B01–B07）

| 项目 | 状态 | 文档位置/版本 | 备注 |
| --- | --- | --- | --- |
| B01 Delivery 列表 `delivery-items` | **接受** | 本回复 §2.1；实现后合入 v1.8.0 | P0，阻塞联调 |
| B02 Delivery 统计 `delivery-summary` | **接受** | 本回复 §2.2 | P0，阻塞联调 |
| Delivery DTO 与 openTarget | **接受**（采纳前端建议） | 本回复 §2.1 | `openTarget` 四态冻结；`resourceId` 不再被多义解释 |
| Delivery SSE | **接受**（部分新增） | 本回复 §2.3 | CODE 事件沿用；MEMORY/SKILL 新增 4 类事件 |
| B04 Agent assignments | **接受** | 本回复 §3.1 | P1；WORKFLOW 数据源需进一步确认（见 §3.1 说明） |
| B05 Agent TaskRun | **接受** | 本回复 §3.2 | P1 |
| B06 Agent runtime | **接受**（微调） | 本回复 §3.3 | `skillAccessScope`/`memoryAccessScope` 语义见 §3.3 |
| B07 Task attention 关联 | **接受** | 本回复 §3.4 | P1 |
| N01–N06 | **已逐项确认** | 本回复 §4 | |
| Owner 权限映射 | **已确认** | 本回复 §5 | |

---

## 2. P0 详细确认

### 2.1 `GET /api/v1/projects/{projectId}/delivery-items`（B01）

**接受**，契约要点冻结如下：

1. **统一 cursor envelope**：`{ data, page: { nextCursor, hasMore }, requestId }`；`limit` 默认 30、最大 100（沿用 §2 全局分页）。
2. **Union 结构**：`DeliveryItem` 以 `resourceType`（`CODE|MEMORY|SKILL`）为 discriminator，三类专属字段不进公共字段。
3. **`openTarget` 四态（采纳前端建议，替代对 `resourceId` 的多义解释）**：
   ```ts
   type DeliveryOpenTarget =
     | { kind: "TASK_DIFF_REVIEW"; taskId: string; diffReviewBatchId: string }
     | { kind: "DIFF"; taskId: string; diffId: string }
     | { kind: "MEMORY"; memoryId: string }
     | { kind: "SKILL"; skillId: string };
   ```
   - CODE 项：`openTarget.kind = "TASK_DIFF_REVIEW"`（主入口）；`diffId` 单独出现在 CODE 专属字段，不参与跳转歧义。
   - MEMORY / SKILL 项：直接指向 `memoryId` / `skillId`。
4. **`capabilities` 后端派生**：按「正式资源接口的状态规则 + 当前用户角色」计算，前端不猜。六项能力与 `disabledReasons` 一一对应，缺失能力返回 `false` + 稳定错误码（复用现有 `DIFF_REVIEW_*` / `SKILL_*` / `MEMORY_*` 错误码体系）。
5. **`displayStatus` 后端派生**（前端不维护映射），映射草案：
   | resourceType | 真实状态 | displayStatus |
   | --- | --- | --- |
   | CODE | reviewStatus=PENDING_CONFIRMATION | `PROCESSING` |
   | CODE | reviewStatus=ACCEPTED 且 deliveryStatus=DELIVERED | `DELIVERED` |
   | CODE | reviewStatus=ACCEPTED 且 deliveryStatus=PARTIALLY_DELIVERED/FAILED | `FAILED` |
   | CODE | reviewStatus=REJECTED | `REJECTED` |
   | MEMORY | status=DRAFT / PENDING_REVIEW / APPROVED / REJECTED / ARCHIVED | `DRAFT` / `PENDING_REVIEW` / `ACCEPTED` / `REJECTED` / `ARCHIVED` |
   | SKILL | status=DRAFT / PENDING_REVIEW / PUBLISHED / REJECTED / ARCHIVED | `DRAFT` / `PENDING_REVIEW` / `ACCEPTED` / `REJECTED` / `ARCHIVED` |
6. **空集合**：`repositories`、`repositoryDeliveries`、`tags`、`sources` 无数据返回 `[]`，不返回 `null`；真实不存在的关联（无任务、无 MR、无群）返回 `null`。
7. **敏感隔离**：聚合列表**不返回**完整 Memory/Skill 内容、Prompt、Token、凭据、环境变量、代码 Patch；`summary` 为 ≤200 字符脱敏摘要。
8. **MEMORY 项补充说明**：`visibility` 字段——当前 `memories` 表无 visibility 列（APPROVED 即项目共享），交付项统一返回 `"PROJECT_SHARED"`（实现时冻结）；`category`/`tags`/`sources` 按现有实体返回。
9. **SKILL 项补充说明**：`capabilitySummary` 无现成数据源，返回 `null`（实现时冻结）；`visibility` 返回现有 `PRIVATE`/`PROJECT_SHARED`。

### 2.2 `GET /api/v1/projects/{projectId}/delivery-summary`（B02）

**接受**，要点冻结：

1. 统计**针对完整筛选数据集**（不按当前分页推导）；筛选条件与列表一致（groupId / type / status / repositoryId / createdBy）。
2. `countsByType` 恒含 `CODE/MEMORY/SKILL` 三 key（值为 0 也返回）。
3. `pendingForCurrentUser`：后端按「当前用户 + capabilities（canApprove/canSubmitReview 等）」统计待处理项数量。
4. **N06 结论：不返回 `pendingItems[]`**，前端只消费数量（前端清单 §3.2 的 `pendingItems: []` 字段废弃）。
5. `repositorySummaries[]`：repository id/name、total、accepted、pending、failed、deliveryStatus、可空 MR 摘要（无 MR 为 `null`）。
6. `requirementGroupSummaries[]`：requirementGroupId/name、total、pending；无需求群来源时返回空数组（前端清单允许的两个字段 `null` 场景在本项目以「该群有资源即返回条目」为准，实现时冻结）。

### 2.3 Delivery 写操作复用规则

**确认**：聚合页写操作继续复用正式资源接口，不新建重复写接口：

- CODE → `POST /tasks/{taskId}/diff-review/confirm | reject | retry-delivery`（携带 `Idempotency-Key`）；
- MEMORY → 现有 `submit-review | approve | reject | archive`；
- SKILL → 现有 `submit-review | approve | reject | archive`（**发布状态正式名称为 `PUBLISHED`**，前端按 `PUBLISHED` 消费，不再使用旧 `APPROVED`）。

### 2.4 Delivery 相关 SSE（P0 冻结）

事件名与 payload 冻结如下（沿用 §12.1 项目级单连接 / Bearer / `Last-Event-ID` / `EVENT_CURSOR_EXPIRED` 规则；前端收到事件只失效 Query，不写入实体缓存）：

| 事件 | 覆盖场景 | 状态 |
| --- | --- | --- |
| `diff-review.created` / `diff-review.confirmed` / `diff-review.rejected` / `diff-review.skipped` | CODE 批次状态变化 | ✅ 已存在，payload 沿用 §15.6.4 |
| `delivery.repository.updated` / `delivery.completed` / `delivery.failed` / `task.diff-review.failed` | CODE 逐仓库交付 / 总体交付 | ✅ 已存在 |
| `merge-request.updated` | CODE MR 摘要变化 | ✅ 已存在（触发点：MR 创建/状态同步；payload 含 `projectId`、`mergeRequestId`、`number`、`status`、`webUrl`，实现合入文档时补齐示例） |
| `memory.submit-review` / `memory.approved` / `memory.rejected` / `memory.archived` | MEMORY 审批流转 | 🆕 新增（实现时发布） |
| `skill.submit-review` / `skill.published` / `skill.rejected` / `skill.archived` | SKILL 审批流转 | 🆕 新增（实现时发布） |

**统一 payload 基座**（新增的 MEMORY/SKILL 事件按此实现；CODE 事件保持现有 payload 不动）：

```ts
interface DeliveryEventPayload {
  projectId: string;
  resourceType: "CODE" | "MEMORY" | "SKILL";
  resourceId: string;          // memoryId / skillId / diffReviewBatchId
  taskId?: string;
  diffId?: string;
  diffReviewBatchId?: string;
  repositoryId?: string;
  eventVersion: number;        // 事件契约版本，首版为 1
  updatedAt: string;           // RFC 3339 UTC
}
```

---

## 3. P1 详细确认

### 3.1 `GET /api/v1/projects/{projectId}/agents/{agentId}/assignments`（B04）

**接受**，注意两点：

- `REQUIREMENT_GROUP`：数据源为 `group_agents` 表（Agent 参与的需求群），`resourceName` 取群名，`status` 由群状态（ACTIVE/ARCHIVED）派生；
- `WORKFLOW`：**当前无数据源**（团队工作流模板非本版本范围，接口文档 §14）。第一版 `type=WORKFLOW` 返回空数组 + `hasMore:false`，不伪造；前端可先隐藏该 Tab 或按空态展示。
- 统一 cursor envelope；`type` 省略时返回全部两类。

### 3.2 `GET /api/v1/projects/{projectId}/task-runs?agentId=`（B05）

**接受**：新增项目级 TaskRun 查询（当前仅有按 Task 查询）。`agentId` 必填，列表项复用/增强现有 `TaskRunListItemResponse`，补齐：Task 摘要（displayCode/title）、TaskStep 摘要（title/role）、RequirementGroup 摘要、Repository 摘要。筛选 `status` 可选，`cursor/limit` 沿用全局规则。

### 3.3 Agent runtime/usage（B06）

**接受（微调）**：

- `status`：`IDLE | RUNNING`（按该 Agent 的 `activeRunCount > 0` 派生）；
- `concurrencyLimit`：当前无并发限制配置，**首版返回 `null`**（不伪造数值）；
- `assignmentUsage.workflows`：无数据源，`assignedCount=0`、`assignableCount=0`；
- `skillAccessScope` / `memoryAccessScope`：本项目的 Skill/Memory 均为**项目维度**隔离，首版返回固定 `"PROJECT"` 字符串（实现时冻结，如需更细粒度请前端再提）。

### 3.4 Task `attention` 扩展（B07）

**接受**，冻结为：

```ts
interface TaskAttention {
  kind: string;
  title: string;
  summary: string | null;
  taskRunId: string | null;
  inputRequestId: string | null;
  diffReviewBatchId: string | null;   // 🆕
  repositoryId: string | null;        // 🆕
}
```

- `taskRunId` / `inputRequestId` 现有已返回；
- `DIFF_CONFIRMATION_REQUIRED` 时返回 `diffReviewBatchId`；`DELIVERY_FAILED` 时返回 `diffReviewBatchId` + 首个失败仓库的 `repositoryId`；
- 无对应关联返回 `null`；前端不按标题/数组位置/Mock ID 推断跳转。

---

## 4. N01–N06 逐项确认

| 编号 | 待确认项 | 结论 |
| --- | --- | --- |
| N01 | TaskStep 列表响应 | 现状为裸数组（`{data:[...]}`）。**调整**：统一为 cursor envelope `{data,page:{nextCursor,hasMore},requestId}`（与全站一致），实现时落地。 |
| N02 | TaskRun `artifactSummary` | **已确认**：正式 shape 为 `{total, diffCount}`（total=执行产物数，diffCount=该运行产出 Diff 数）；旧 `{diffs:{count,byStatus}}` 已废弃，不保留兼容。 |
| N03 | DiffReview nullable | 冻结：批次不存在时查询返回 `404 DIFF_REVIEW_NOT_FOUND`（不是 null 数组）；批次内每个 `diffId` 恒非空；`requirementGroupId` 由 Task 派生，Task 恒存在故正常业务恒有值（防御性代码允许 null）；`reviewReason` 仅在 REJECTED 时非 null。 |
| N04 | Delivery 资源 ID | **采纳显式 `openTarget`**（§2.1）：`resourceId` = CODE 批次 ID / MEMORY id / SKILL id；`diffReviewId`（=批次 ID）与 `diffId` 严格区分，前端不得混用。 |
| N05 | `displayStatus` 归属 | **后端统一派生**并返回（映射见 §2.1 表格），前端不维护映射、不做转换。 |
| N06 | 待当前用户处理统计 | **只返回 `pendingForCurrentUser` 数量**，不返回 `pendingItems[]`。 |

---

## 5. 权限与状态规则确认

| 产品术语 | 后端结论 |
| --- | --- |
| “Owner 批准 Memory/Skill” | = `PROJECT_ADMIN`（`access.requireProjectAdmin`） |
| `TEAM_OWNER` 是否自动继承项目审批权 | **是**：`ProjectAccessService` 对 Team Owner 做项目内 Admin 兜底（现有 `isOwnerOrAdmin` / `requireProjectAdmin` 已覆盖） |
| 普通项目成员 | 只能创建/提交审核，不能 approve/reject/archive；可见性遵循 PRIVATE / 已发布可见规则 |
| Memory 审批后共享状态 | `APPROVED`（项目共享，无独立 visibility 字段） |
| Skill 审批后正式状态 | `PUBLISHED`（前端按 `PUBLISHED` 消费；旧 `APPROVED` 不作为 Skill 状态） |
| 前端如何判断操作权 | **不解析成员角色**，统一消费后端返回的 `capabilities` |

---

## 6. P2 导出接口

**延期**：`GET /delivery-items/export`（CSV + `Content-Disposition`）不阻塞首轮联调，待 P0/P1 稳定后实现。导出范围仍限列表摘要，不含完整内容/Prompt/凭据/Patch。

---

## 7. 后续节奏

1. 本回复为**契约确认**，未改代码；
2. 后端按 P0 → P1 顺序开发；每个接口完成后同步更新正式接口文档（目标 v1.8.0），并将文档位置回填到 B01–B07 状态表；
3. 前端可先按本回复的冻结契约更新 Types → API → Query → Mock → 页面；
4. 若实现过程中发现契约需要微调，以正式接口文档 v1.8.0 为准并通知前端。
