# Qgents 前端交接（新对话请先读本文件）

> 用途：上下文额度用尽后开新 Agent，用 `@web/docs/HANDOFF.md` 挂载即可续作。  
> 工作区：`c:\Users\www35\Desktop\末期项目\web`（只改前端 `web/src`，不动后端）

---

## 1. 最高优先级规则

1. **接口 / 字段 / 前后端约定**，以下列文档为准，**优先级 > 现有代码注释**：
   - `docs/frontend/tech-stack.md`
   - `docs/frontend/github-backend-fields-needed.md`（后端最终确认，契约已冻结）
   - `docs/前后端联调.md`（v1.1.9，第 6 节 GitHub 已冻结）
   - 参考：`docs/GitHub集成联调-前端确认回复.md`（前端曾发后台的确认稿）
2. **ID 映射**：本地 UUID 与 `providerInstallationId` / `providerRepositoryId` **严格分离**。  
   绑定请求**只传本地** installation / repository UUID，**禁止**传 GitHub 原生数字 ID。
3. 文档与代码冲突时：**以文档为准**，先向用户确认，不要自行推断接口。
4. 改代码时 **不得删除用户原有注释**；需要时可在旁补充「已冻结见 docs」说明。
5. 技术栈：React + TS + Ant Design；请求走 `src/api/client.ts`；类型复用 / 对齐 `src/types/github.ts`。

---

## 2. 技术栈摘要（详见 tech-stack.md）

- 服务端数据：TanStack Query；`queryKey` 含资源归属（如 `teamId` / `projectId`）
- 跨页 UI 状态：Zustand（勿放接口资源列表）
- UI：Ant Design 6 + `@ant-design/icons`
- Mock：MSW，`VITE_USE_MOCK=true`
- 禁止 Axios / Redux / Tailwind / `any`

---

## 3. GitHub 冻结契约要点（对齐用）

| 主题 | 冻结结论 |
|------|----------|
| Installation / Repository 主键 | 响应字段本地 `id`；另有 `providerInstallationId` / `providerRepositoryId`（仅展示） |
| 绑定 body | `{ installationId, repositoryId, displayName? }` = **列表项本地 id**；`defaultBranch` 第一版以 GitHub 默认为准，**禁止前端回退 `"main"`** |
| 解绑 / PATCH 路径 | `{projectRepositoryId}` = **绑定记录** `id` |
| Installation.status | `ACTIVE \| SUSPENDED \| DELETED`（不用 `EXPIRED`） |
| accountType | `USER \| ORGANIZATION` |
| 可见性 | `visibility: PUBLIC \| PRIVATE \| INTERNAL`（不要 `private` 布尔） |
| 同步语义 | 用 `metadataSyncedAt`；**项目绑定 DTO 不要**代码向 `syncStatus` / `lastSyncedAt` / `syncError` |
| 产品方案 | 团队总览 + 选择项目；不做团队级绑定汇总接口 |
| 回调 | `/app/integrations/github?teamId={teamId}&installed=1` |
| 写接口 | 需 `Idempotency-Key`（安装、绑定、解绑等） |

绑定成功后，下游 Task 的 `repositoryIds` 语义是 **`project_repositories.id`（绑定 id）**，不是 GitHub 数字 ID，也不是仓库镜像 id。

---

## 4. 当前进度

### 已完成

- GitHub 集成相关页面与 `src/api/github.ts`、`src/types/github.ts`（**字段尚未按冻结文档改完**）
- Banner 动态「**项目详情**」页签：仅点击群聊页「进入项目详情」后出现；与「团队首页」「项目群聊」并排显示文字（已去掉 Menu 溢出「…」）
  - 状态：`src/store/appUiStore.ts`（`projectDetailNav` + sessionStorage）
  - UI：`src/layouts/MainLayout/Banner.tsx`
  - 入口：`src/pages/ChatWorkspace/ChatWorkspacePage.tsx`
- 本地演示服 / 公网联调曾切换过；`.env.local` 与 `vite.config.ts` proxy 以当前文件为准

### 未完成（下一棒优先）

按冻结文档对齐前端类型与 API / 页面 / MSW：

1. `types/github.ts`：`id` + provider 字段、枚举、`visibility`、去掉绑定层代码 `syncStatus` 等（**保留原注释**）
2. `api/github.ts`：响应映射；绑定只传本地 UUID；补 sync（若文档有）；写接口补齐 `Idempotency-Key`
3. MSW fixture 同步
4. 页面：`GitHubIntegration*`、`useGithubInstall` — Tag/列/绑定校验；`installed=1` 后 **invalidate 列表**；去掉 `defaultBranch \|\| 'main'`
5. Banner：本轮可不改，除非产品要求「绑仓成功后打开项目详情页签」

---

## 5. 已知文档 vs 代码冲突（动手前曾列出、待用户拍板）

请新 Agent **先问用户确认**，再改代码：

1. **类型命名**：A) TS 改成文档字面量 `id`；B) TS 继续用 `installationId`/`repositoryId`，仅在 api 层从响应 `id` 映射？
2. **`TeamAuthorizedReposPage` 一键绑全部项目**：保留 / 改成只跳选项目页 / 先隐藏？（文档是方案 A：选项目）
3. **原「同步状态」列**：改为 `metadataSyncedAt` / `authorizationStatus` / 删列？是否要第一版「刷新授权仓库」按钮？
4. **绑定成功后**：是否 `openProjectDetailNav(projectId)` 并进项目详情？还是留在 GitHub 流？
5. **绑定 body 的 `defaultBranch`**：省略字段，还是传授权仓真实值？
6. **旧 `TODO[后端联调]` 注释**：原样保留 / 旁注「已冻结见 docs」？（不删原文）

---

## 6. 关键文件索引

| 路径 | 说明 |
|------|------|
| `src/types/github.ts` | GitHub DTO（待对齐） |
| `src/api/github.ts` | GitHub API |
| `src/api/client.ts` | fetch 封装（错误体应只读一次 text） |
| `src/query/queryKeys.ts` | 含 github* keys |
| `src/hooks/useGithubInstall.ts` | 安装跳转 / 状态推导 |
| `src/pages/GitHubIntegration/*` | 集成 / 授权仓 / 绑定页 |
| `src/layouts/MainLayout/Banner.tsx` | 动态项目详情页签 |
| `src/store/appUiStore.ts` | `projectDetailNav` |
| `src/mocks/handlers.ts`（及 handlers） | MSW |
| `docs/frontend/*`、`docs/前后端联调.md` | 契约与规范 |

---

## 7. 给新 Agent 的启动指令（可粘贴）

```text
请先阅读 @web/docs/HANDOFF.md 以及其中列出的 3 份契约文档。
按 HANDOFF 规则：文档优先、本地 UUID 绑定、冲突先问我、不删我的注释。
当前请从「§5 待拍板」向我确认，确认后再改 web/src，先给 diff 预览再落盘。
```
