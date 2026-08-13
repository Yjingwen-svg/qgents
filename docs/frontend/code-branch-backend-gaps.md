# 「代码与 Branch」页：后端需补充的接口数据

> 对象：后端  
> 日期：2026-08-13  
> 页面：项目详情 → 代码与 Branch（`/app/projects/{projectId}/code`）  
> 依据：`docs/前后端联调.md` v1.1.9、`README/Qgents接口文档.md`、前端当前页面实现  
> 说明：下列枚举与字段名是**前端演示页已经在用的**，尚未冻结。请后端确认或给出等价字段，不要让前端继续猜。

---

## 0. 先回答：§6.1「分支策略与质量门禁」跟这页有没有关系？

**有关系，但只覆盖这页里很小一块，找不到这页真正缺的数据。**

§6.1 现有接口：

| 方法 | 路径 | 实际含义 |
| --- | --- | --- |
| `GET`/`PUT` | `/projects/{projectId}/repositories/{projectRepositoryId}/branch-policies/{branch}` | 查询/配置**某一条已经知道名字的**分支的保护策略 |
| `GET`/`PUT` | `/projects/{projectId}/repositories/{projectRepositoryId}/quality-gates/{branch}` | 查询/配置**某一条已经知道名字的**分支的合入门禁 |

质量门禁示例只描述「合进这条分支之前必须满足什么」：

```json
{
  "requirePullRequest": true,
  "requiredChecks": ["TESTSET", "AI_REVIEW", "DRY_RUN", "CQ_PLUS_ONE"],
  "requiredTestsetIds": ["testset-uuid"],
  "minimumHumanApprovals": 1,
  "allowDirectPush": false
}
```

和本页的对应关系：

| 本页 UI | §6.1 能否提供 | 说明 |
| --- | --- | --- |
| 仓库卡片（绑定了哪些仓） | 否 | 用的是 §6 `GET /projects/{projectId}/repositories` |
| 每个仓下面有哪些 Branch | **否** | 路径里的 `{branch}` 要前端先知道分支名；文档第 1 节写明「分支查询不在本轮范围」 |
| 蓝色「受保护」标签 | **部分能** | 有了分支名之后，可以再调 `branch-policies`。但 **`branch-policies` 的响应体文档没有给示例**，不知道哪个字段表示「受保护」 |
| 状态列：正常 / 落后基线 / 冲突 / 已合并 | **否** | 门禁是「合入规则」，不是分支健康状态 |
| 关联 Task、提交数、Diff +/-、MR 数 | **否** | 门禁配置里没有这些 |
| Testset 列：通过 / 运行中 / 失败 / 未跑 | **否** | `requiredTestsetIds` 是「必须跑哪些测试」，不是「这条分支最近一次跑完没有」 |
| 抽屉里的最新提交、创建者、Workspace、产物 | **否** | 与策略/门禁无关 |
| 抽屉底部「创建 MR」 | 间接有关 | 创建 MR 走 §13；合并时才读目标分支的 quality-gates。**不能从 §6.1 列出可创建 MR 的分支** |

结论：§6.1 是「已知 `main` / `release` 之后，去配保护规则和合入检查」。本页需要的是「先列出这个仓库当前有哪些工作分支」。两件事顺序相反，**不能用 §6.1 代替分支列表接口**。

另外：`branch-policies` 本身也缺响应字段定义，前端现在无法从它解析 `protected`。

---

## 1. 本页已经能对上的现有接口（不要求新做）

| 页面位置 | 现有接口 | 备注 |
| --- | --- | --- |
| 仓库卡片标题、`fullName`、GitHub 链接、默认分支 | `GET /projects/{projectId}/repositories` | 已冻结。`id` = `project_repositories.id` |
| 需求过滤（需求群标题） | `GET /projects/{projectId}/groups` | 文档有；前端目前仍用本地占位 |
| 关联 Task 的 UUID 与标题 | `GET /projects/{projectId}/tasks` | 有 `id`、`title`、`requirementGroupId`、`repositories[].sourceBranch` |
| Diff `+n / -n` | `GET /projects/{projectId}/diffs` | 有 `changeStats`、`sourceBranch`、`repositoryId` |
| MR 数量 | `GET /projects/{projectId}/merge-requests` | 有 `sourceBranch`、`repositoryId`、`status` |
| 创建 MR | `POST /projects/{projectId}/merge-requests` | 前提是已接受的 Diff；本页按钮仍是占位 |

以上接口**都不是按「一个仓库的分支列表」返回的**。若坚持不增加分支查询，前端只能拉全量 Task / Diff / MR 再自己按 `sourceBranch` 聚合，且仍然拼不出提交数、最新 commit message、分支健康状态。

---

## 2. 请后端补充的核心接口（本页空缺的根因）

文档第 1 节：搜索、**分支查询**、Test Run / Dry Run **历史列表**不在本轮范围。  
本页表格的每一行都是「分支」，所以需要一条**按项目仓库绑定列出工作分支**的接口。

建议（路径名可改，语义不要改）：

```http
GET /api/v1/projects/{projectId}/repositories/{projectRepositoryId}/branches
```

- `{projectRepositoryId}` = 项目绑定记录 `id`（`project_repositories.id`），与 §6 一致  
- 权限：项目成员  
- 只返回 Qgents 工作分支（Task / Workspace 产生的 `sourceBranch` + 默认分支），不要扫 GitHub 上全部远程分支  
- 建议支持 query：`requirementGroupId`（对应本页需求过滤）

### 2.1 列表项建议字段（对应前端 `ProjectBranchRow`）

前端当前演示结构如下，**有空缺的都列在表里**。标了「需新增」的，现有文档里找不到。

```json
{
  "id": "branch-record-uuid",
  "projectRepositoryId": "project-repository-binding-uuid",
  "name": "feat/login-api",
  "protected": false,
  "branchStatus": "HEALTHY",
  "relatedTask": {
    "id": "task-uuid",
    "displayCode": "T-1024",
    "title": "登录接口开发"
  },
  "requirementGroupId": "group-uuid",
  "requirementTitle": "登录功能",
  "workspaceId": "workspace-uuid",
  "workspaceName": "ws-login-api",
  "createdBy": {
    "id": "user-uuid",
    "displayName": "张同学"
  },
  "createdAt": "2026-05-16T10:30:00Z",
  "commitCount": 18,
  "diffAdditions": 230,
  "diffDeletions": 12,
  "mrCount": 1,
  "testStatus": "PASSED",
  "latestCommit": {
    "sha": "a1b2c3d",
    "message": "feat: 邮箱登录接口"
  },
  "artifact": {
    "name": "auth-service-login.zip",
    "published": true
  }
}
```

默认分支（如 `main`）建议同样出现在列表里：`protected=true`，`relatedTask` 可为 `null`。

---

## 3. 前端已在用、文档尚未给出的枚举（请确认或改名后冻结）

### 3.1 `branchStatus`（表格「状态」列）

**不是** GitHub 受保护，**不是** Testset，**不是** MR 状态。  
含义：这条分支相对默认分支 / 交付链路，现在还能不能继续开发。

```text
branchStatus = HEALTHY | BEHIND | CONFLICT | MERGED
```

| 值 | 页面文案 | 建议语义 |
| --- | --- | --- |
| `HEALTHY` | 正常 | 相对默认分支无冲突、可继续提交 / 开 MR |
| `BEHIND` | 落后基线 | 落后于仓库 `defaultBranch`，需要先同步 |
| `CONFLICT` | 冲突 | 与基线存在合并/变基冲突 |
| `MERGED` | 已合并 | 已合入目标分支 |

§6.1 的 quality-gates **不能**替代本枚举。

### 3.2 `testStatus`（表格「Testset」列）

表示**这条分支最近一次测试结果**，不是门禁配置里的 `requiredTestsetIds`。

```text
testStatus = PASSED | RUNNING | FAILED | PENDING
```

| 值 | 页面文案 |
| --- | --- |
| `PASSED` | 通过 |
| `RUNNING` | 运行中 |
| `FAILED` | 失败 |
| `PENDING` | 未跑 |

文档有 `POST/GET .../test-runs`，但 **Test Run 历史列表不在本轮范围**，前端无法自己算出这颗药丸。请在分支列表里带最新 `testStatus`，或提供「按 `repositoryId` + `ref` 取最新一次 test-run」。

### 3.3 `protected`（Branch 列蓝色「受保护」）

前端现在是布尔值。  
§6.1 理论上有关，但：

1. 必须先有分支名才能调 `branch-policies/{branch}`  
2. **策略响应体未定义**，不知道用哪个字段映射 `protected`

请在分支列表项上直接返回 `protected: boolean`，或补全 `branch-policies` 响应示例。

---

## 4. 字段对照：页面有、接口缺

### 4.1 表格列

| 列 | 前端演示字段 | 文档现状 | 需要后端 |
| --- | --- | --- | --- |
| Branch 名 | `name` | 无分支列表；Task 仅有单条 `sourceBranch` | **新增**，列表核心 |
| 受保护 | `protected` | §6.1 路径存在，响应体未定义 | **新增或补全策略 DTO** |
| 状态 | `branchStatus` | 无此枚举 | **新增** |
| 关联 Task | `relatedTask.code` + `title` | 有 Task.`id`（UUID）和 `title`；**没有** `T-1024` 这种短编号 | `id`+`title` 可复用；短编号 `displayCode` **需新增**（没有就让前端只展示 UUID/title） |
| 提交 | `commitCount` | 无 | **新增** |
| Diff | `diffAdditions` / `diffDeletions` | Diff 列表有 `changeStats`，需前端按分支自己加总 | 建议列表直接带；否则前端可拼，但依赖先有分支名 |
| MR | `mrCount` | MR 列表可按 `sourceBranch` 计数 | 同上，建议列表直接带 |
| Testset | `testStatus` | 无「分支最新测试结果」 | **新增** |

### 4.2 右侧抽屉（点行尾三个点，不是新页面）

| 抽屉项 | 前端演示字段 | 文档现状 | 需要后端 |
| --- | --- | --- | --- |
| Branch / 状态 / 受保护 | 同上 | 同上 | 同上 |
| 关联 Task | `relatedTask` | Task 有 | 短编号缺 |
| 需求群 | `requirementGroupId` / `requirementTitle` | Group 有；Task 有 `requirementGroupId` | 列表里带上即可，不必新资源 |
| Workspace | `workspaceName` | 只有 `workspaceId`，没有展示名 | **新增展示名**，或允许前端只显示 id |
| 创建者 | `createdBy` 展示名 | Task 有 `createdBy`（user UUID），无分支创建者 | **新增**（分支谁拉出来的） |
| 创建时间 | `createdAt` | 无分支创建时间 | **新增** |
| 最新提交 | `latestCommit.sha` + `message` | Workspace 有 `baseCommit` / `headCommit`，**无 message** | **新增 message**；sha 可复用 headCommit |
| 构建产物 | `artifact.name` / `published` | TaskRun 仅有 `artifactSummary.diffs.count`，无 zip/发布状态 | **新增**；若本轮不做产物，请明确前端去掉这一项 |
| 提交数 / Diff / MR / Testset | 同表格 | 同表格 | 同表格 |

### 4.3 仓库卡片上的中文别名

前端演示有 `auth-service（认证服务）` 这种括号说明。  
绑定 DTO 只有 `displayName`、`fullName`，**没有**「认证服务」这类描述字段。  
有则补 `description` / `alias`；没有则前端只展示 `displayName` 或 `fullName`。

---

## 5. 和现有资源的 ID 约定（不要再混）

与 GitHub 冻结契约一致：

- 路径和列表里的仓库 ID 一律是 **`project_repositories.id`**
- 不要传 GitHub 数字 ID，也不要传 `github_repositories.id`
- 关联 Task 用 Task 的 UUID；若提供 `displayCode`（如 `T-1024`）请单独加字段，不要占用 `id`

---

## 6. 请后端拍板的三件事

1. **本轮是否增加「按绑定仓库列出工作分支」接口？**  
   不加的话，本页表格无法换成真实数据（§6.1 补不上）。
2. **`branchStatus` / `testStatus` 是否采用上文枚举？**  
   若语义不同，请给出最终字面量，前端再改展示文案。
3. **产物、短任务号、Workspace 展示名、分支创建者** 本轮做不做？  
   不做请在接口里标明「前端删除对应抽屉项」，避免联调时再空字段。

前端当前实现：`src/pages/ProjectDetail/CodePage.tsx`、`src/types/codeBranch.ts`。分支行在有真实接口前使用演示数据。
