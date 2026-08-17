# 测试集（Testset / Test Run / Dry Run）— 后端需给出的内容

> 对象：后端  
> 日期：2026-08-17  
> 页面：项目详情 → 测试集（`/app/projects/{projectId}/testset`）  
> 依据：`README/Qgents接口文档.md` §10 / §12.4 / §21 Q3–Q5；联调实抓 `GET .../test-runs/{id}`  
> 目的：让前端能正确展示「排队 / 运行中 / 失败原因」，避免页面只显示「失败」却看不出发生了什么

---

## 0. 一句话结论

配方 CRUD 与发起运行已基本可用。当前最大缺口是：**`GET /test-runs/{id}` 的 `summary` 实际是结构化对象，但契约未写清形状；页面因此无法展示 `exitCode` / `failureCode`。**  
本轮可以继续不给用例明细与报告 URL，但请**冻结并保证返回**「按 Testset 的执行结果摘要」。

---

## 1. 已冻结（本轮可不给 / 前端按空态）

以下与接口文档 §21 Q4 / Q5 一致，前端已按空态处理，**不要当成联调 Bug**：

| 项 | 本轮约定 |
| --- | --- |
| `caseSummary` | 不给 → 结果总览显示「本轮不提供用例摘要」 |
| `cases[]` | 不给 → 用例详情 Tab 空表 |
| `reportUrl` / `pdfUrl` / `artifacts[]` | 不给 → 报告 Tab 空态 |
| `sandboxId` | 不给 → 显示「本轮不提供」 |
| `startedAt` / `finishedAt` | 不给 → 开始/结束/时长显示 `—` |
| `GET /test-runs`、`GET /dry-runs` 列表 | 本轮不做 → 右侧历史仅本机 localStorage |
| Dry-run report 本轮最小 | `id` / `status` / `createdAt`（其余可空） |

---

## 2. 本轮必须给出（请冻结形状）

### 2.1 Testset 配方（列表 / 详情 / 创建响应同一套）

路径：`GET|POST|PATCH /projects/{projectId}/testsets`，以及 enable / disable / delete。

| 字段 | 要求 |
| --- | --- |
| `id` / `projectId` / `name` / `repositoryId` | 必有；`repositoryId` = `project_repositories.id` |
| `status` | 只用 `ENABLED \| DISABLED`（不读 `enabled` 布尔） |
| `command` / `timeoutSeconds` / `passRule` / `acceptanceNotes` | 顶层扁平字段（§10）；已确认 |
| `scopeTags` | **需补**：创建请求有，响应请回传（§21 Q3 已记） |
| `createdAt` / `updatedAt` | 管理卡片展示用 |

`GET /testsets` 请继续支持 query：`repositoryId`、`status=ENABLED|DISABLED`。

### 2.2 发起运行

| 接口 | 必须 |
| --- | --- |
| `POST /projects/{projectId}/test-runs` | 立即返回至少 `id`；请求体：`repositoryId` + `testsetIds` +（`taskId` **或** `ref` 之一） |
| `POST /projects/{projectId}/dry-runs` | 立即返回至少 `id`；请求体：`repositoryId` + `sourceRef` + `targetBranch`，可选 `taskId` |
| Idempotency-Key | 文档要求的写操作继续带 |

`testsetIds` 必须属于该仓库且为 `ENABLED`。

### 2.3 `GET /projects/{projectId}/test-runs/{testRunId}`（当前运行主数据）

本轮最小字段（文档 Q4）仍是：

`id` / `projectId` / `repositoryId` / `ref` / `testsetIds` / `status` / `summary` / `createdBy` / `createdAt`

请额外书面冻结下面两点（联调已踩坑）：

#### A. `status` 枚举

`QUEUED | RUNNING | PASSED | FAILED | CANCELLED`  
（不要用 Task 的 `SUCCEEDED` 顶替；若只给 `SUCCEEDED`，前端会映射成 `PASSED`。）

#### B. `summary` 请冻结为「结构化执行摘要」，不是纯字符串

联调实抓示例（2026-08-17，`01a00fd6-…`）：

```json
{
  "id": "01a00fd6-21d0-73ce-9910-ba35f071a5dc",
  "projectId": "01a00ee7-4f34-7675-bcc2-2c6455d8c218",
  "repositoryId": "01a00ee7-4fa1-786c-825e-3ec80ee4e7de",
  "ref": null,
  "testsetIds": ["01a00fb1-3cfb-7a4b-9c67-c81746e23f6d"],
  "status": "FAILED",
  "summary": {
    "status": "FAILED",
    "results": [
      {
        "status": "FAILED",
        "exitCode": 254,
        "testsetId": "01a00fb1-3cfb-7a4b-9c67-c81746e23f6d",
        "durationMs": 279,
        "failureCode": "UNEXPECTED_EXIT_CODE"
      }
    ],
    "resolvedHeadCommit": "fc3a50234ba70b5121dc328decebe97dec915a83"
  },
  "createdBy": "01a00560-6d6d-7c56-b734-da6d02173e7e",
  "createdAt": "2026-08-17T13:08:06.736907Z"
}
```

请确认并写入契约：

```ts
summary: {
  status: 'PASSED' | 'FAILED' | ...  // 与顶层 status 对齐或说明关系
  resolvedHeadCommit: string | null
  results: Array<{
    testsetId: string
    status: 'PASSED' | 'FAILED' | ...
    exitCode: number | null
    durationMs: number | null
    failureCode: string | null   // 如 UNEXPECTED_EXIT_CODE
    // 建议补：failureReason?: string | null  // 脱敏短文案，给用户看
  }>
} | null
```

**前端诉求（本轮就能做）：** 结果总览直接展示每个 Testset 的 `exitCode` / `failureCode` / `durationMs` / `resolvedHeadCommit`，不再出现「只显示失败、像没跑过」。

若暂时不能给 `failureReason`，至少保证 `failureCode` + `exitCode` 稳定有值。

#### C. 建议补回（仍属本轮体验，非用例明细）

| 字段 | 原因 |
| --- | --- |
| `taskId` | 创建常用 Task 模式；详情若永远不回，页面 Ref/Task 会一直是 `—` |
| `startedAt` / `finishedAt` | 可选；没有则时长继续 `—`，但有 `results[].durationMs` 时可展示命令耗时 |

### 2.4 SSE（刷新通知，不是推完整报告）

| 事件 | payload 至少含 |
| --- | --- |
| `test-run.updated` | `projectId` + `testRunId` + `status`（文档写还可含 repositoryId / taskId / ref） |
| `dry-run.updated` | `projectId` + `dryRunId` + `status` |

事件只触发前端再 `GET` 详情；乱序 / 断线以查询接口为准。

---

## 3. 本轮明确不做（P1+，书面确认即可）

1. 逐用例 `cases[]` 与 `caseSummary` 计数卡片  
2. 报告产物 URL（HTML / PDF / artifacts）  
3. Test Run / Dry Run **历史列表接口**  
4. Sandbox 详情页跳转（无 `sandboxId` 即可）

---

## 4. 执行侧请后端自查（联调现象）

同一条 FAILED 响应里：

- `durationMs: 279` → 命令约 0.3 秒结束，**不是**完整 `npm test` 跑完  
- `exitCode: 254` + `failureCode: UNEXPECTED_EXIT_CODE` → 相对 `passRule.expected = 0` 判失败  
- `resolvedHeadCommit` 有值 → 已解析到提交并尝试执行  

请后端确认受控执行器环境：Node/npm 是否可用、工作目录、`command` 实际拼接方式、254 的语义（命令不存在 / 包装脚本失败等），并尽量在 `summary.results[]` 里带上脱敏 `failureReason`。

这不属于前端映射错误；前端目前只是**没展示**结构化 `summary`。

---

## 5. 请后端直接回复的问题

1. `summary` 是否按第 2.3 节实抓形状冻结？字段名是否稳定为 `results` / `exitCode` / `failureCode` / `durationMs` / `resolvedHeadCommit`？  
2. `failureCode` 枚举有哪些？能否补 `failureReason`（短文案）？  
3. 用 `taskId` 发起时，详情是否回传 `taskId`？`ref` 为 `null` 是否表示「仅 Task 模式」？  
4. Dry-run 的 `GET .../report` 本轮除 `id/status/createdAt` 外，冲突 `conflicts[]` 何时开始给？  
5. `scopeTags` 补回列表响应的排期？

---

## 6. 前端对接位置（便于联调对照）

- 页面：`src/pages/ProjectDetail/Testset/TestsetPage.tsx`  
- API / 映射：`src/api/testset.ts`（当前把 `summary` 当 **string** 读，结构化对象会被丢掉）  
- 类型：`src/types/testset.ts`  
- 历史：本机 localStorage（无列表接口属预期）

后端冻结 `summary` 形状后，前端会改映射与结果总览展示，把 `exitCode` / `failureCode` 直接画出来。
