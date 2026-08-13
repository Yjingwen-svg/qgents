# GitHub 集成联调：前端正式确认回复

> 回复对象：后台组  
> 依据：`GitHub集成前后端联调确认.md` 第 9 节及全文  
> 前端现状：已具备 `src/api/github.ts`、`src/types/github.ts` 及集成/授权仓/绑定相关页面；联调前将按本回复调整字段映射与文案。  
> 目的：双方冻结接口契约后开始正式联调。

---

## 一、对第 9 节确认事项的逐条回复

### 1. 本地 `id` 与 `providerInstallationId` / `providerRepositoryId` 分离

**接受。**

- 业务写入（绑定、PATCH、DELETE、按安装过滤）只使用 **Qgents 本地 UUID**。
- `providerInstallationId` / `providerRepositoryId` 仅用于展示或排查，前端不写入绑定请求。

**请后端补充约定：**

| 后端列表字段 | 前端业务使用含义 | 绑定请求 body 字段名 |
|---|---|---|
| installation 的 `id` | 本地安装记录 ID | `installationId` |
| repository 的 `id` | 本地仓库镜像 ID | `repositoryId` |
| projectRepository 的 `id` | 项目绑定记录 ID | 路径参数 `{projectRepositoryId}` |

请在接口文档中明确：**请求里的 `installationId` / `repositoryId` = 列表里的本地 `id`，不是 GitHub 数字 ID。**  
若后端希望请求体也改名为 `id`，请一并说明；否则前端按上表做映射。

---

### 2. 绑定请求只传本地 installation UUID 与 repository UUID

**接受。**

第一版绑定请求体继续为：

```json
{
  "installationId": "<installation 本地 UUID>",
  "repositoryId": "<repository 本地 UUID>",
  "defaultBranch": "main",
  "displayName": "qgents-web"
}
```

其中 `defaultBranch` / `displayName` 策略见第 7 条。  
**不要**传 `providerInstallationId` / `providerRepositoryId`。

---

### 3. GitHub 集成页：方案 A 还是团队级绑定汇总

**采用方案 A：团队总览 + 选择项目。**

现有前端路径已接近方案 A：

1. 团队级查看 installation；  
2. 查看该安装 / 团队下授权仓库；  
3. 绑定时进入「选择项目」页（或对团队内未绑定项目发起绑定）。

**第一版不要求**新增「团队级绑定汇总」接口。  
单项目接口 `GET /projects/{projectId}/repositories` 不需要强行带 `boundProjectId` / `boundProjectName`（项目上下文已在路径中）。

若后续产品必须一页展示「全团队所有项目的绑定」，再单独立项汇总接口。

---

### 4. 删除项目绑定上的代码向 `syncStatus`，改为元数据更新时间

**同意（项目绑定层）。**

- 项目绑定 DTO：**不返回**笼统的代码 `syncStatus` / `lastSyncedAt` / `syncError`。  
- 改为展示 **`metadataSyncedAt`（仓库信息更新于）**。  
- 「刷新同步」若有，语义改为 **「刷新授权仓库 / 刷新 GitHub 元数据」**，挂在 installation / 授权仓区域，而不是暗示 Workspace 已 clone 完成。

**补充对齐（授权仓库列表）：**

- 授权仓同样不要用 `SYNCED | SYNCING | FAILED` 冒充代码同步。  
- 建议授权仓返回：`metadataSyncedAt`、`authorizationStatus`（如 `AUTHORIZED` 等）。  
- Workspace 代码准备状态（如 `PROVISIONING / READY / FAILED`）由 **Workspace 接口**返回，不复用 GitHub 绑定字段。

前端会同步改掉相关文案与类型，避免用户误解。

---

### 5. 状态使用 `ACTIVE` / `SUSPENDED` / `DELETED`，不使用 `EXPIRED`

**同意。**

| 状态 | 前端文案（暂定） |
|---|---|
| `ACTIVE` | 已启用 / 已安装 |
| `SUSPENDED` | 已暂停 |
| `DELETED` | 已卸载 / 授权失效 |
| 列表为空数组 | 尚未安装 → 引导「请先安装」 |

前端将移除对 `EXPIRED` 的依赖。

**请一并统一 `accountType` 枚举写法**（当前文档示例为 `ORGANIZATION`，前端曾用 `Organization`）。建议冻结为：

- `USER` / `ORGANIZATION`  
或  
- `User` / `Organization`  

二选一写进文档即可，前端按冻结值映射展示「个人 / 组织」。

---

### 6. callback 正式回跳路径

**确认。** 正式路径为：

```text
{FRONTEND_URL}/app/integrations/github?teamId={teamId}&installed=1
```

前端将：

1. 读取 `teamId`、`installed`；  
2. 一次性提示安装成功；  
3. 刷新 installation / 授权仓库列表；  
4. 清理 URL 中的一次性参数，避免刷新重复提示。

请保证 302 时 **一定带上 `teamId` 与 `installed=1`**，仅确认路径不够。

---

### 7. 第一版默认分支：可否任意修改

**第一版建议：先只用 GitHub 仓库的默认分支。**

- 绑定请求中的 `defaultBranch`：优先使用授权仓列表返回的 `defaultBranch`；若暂时缺失，前端可临时回退 `"main"`，但以后端返回为准。  
- **第一版可不开放**「用户任意改默认分支」的产品能力；若后端仍保留 `PATCH`，可作后续版本，不阻塞本轮冻结。  
- 若产品强制第一版可改分支，请明确 PATCH 路径参数为 **绑定记录 id**，并给出请求/响应示例。

请后台按「第一版只用 GitHub 默认分支」实现联调环境即可。

---

### 8. 使用 `visibility`，不再要求 `private`

**接受。**

- 授权仓使用：`visibility: "PUBLIC" | "PRIVATE" | "INTERNAL"`。  
- 前端不再依赖布尔字段 `private`。  
- UI 自行映射标签（含 `INTERNAL`）。

---

## 二、请后台在冻结前再确认 / 补充的内容

### 1. 字段命名对照表（强烈建议写入正式接口文档）

| 资源 | 后端建议字段 | 前端业务用途 |
|---|---|---|
| Installation | `id` | 本地安装 ID（映射为请求里的 `installationId`） |
| Installation | `providerInstallationId` | 仅展示 |
| Installation | `accountLogin` / `accountType` / `status` / `installedAt` | 卡片展示 |
| Installation | `authorizedRepositoryCount` 或等价字段 | 授权仓数量（可选） |
| Repository | `id` | 本地仓 ID（映射为请求里的 `repositoryId`） |
| Repository | `installationId` | 必须：按安装过滤、构造绑定 |
| Repository | `fullName` / `githubUrl` / `defaultBranch` / `visibility` | 列表展示与绑定 |
| Repository | `metadataSyncedAt` / `authorizationStatus` | 元数据/授权状态 |
| ProjectRepository | `id` | PATCH/DELETE 路径参数 |
| ProjectRepository | `repositoryId` / `installationId` | 判断是否已绑定 |
| ProjectRepository | `fullName` / `githubUrl` / `defaultBranch` / `displayName` / `boundAt` | 展示 |

### 2. 安装跳转接口（第 9 节未单列，但前端依赖）

`POST /teams/{teamId}/integrations/github/installations` 成功响应继续为：

```json
{
  "data": {
    "installationUrl": "https://github.com/apps/.../installations/new?state=...",
    "expiresAt": "2026-08-10T11:00:00Z"
  },
  "requestId": "..."
}
```

写操作支持 `Idempotency-Key`。

### 3. 绑定成功响应

`POST /projects/{projectId}/repositories` 成功后请返回完整绑定对象（至少含服务端生成的绑定 `id`），否则前端无法可靠 DELETE。

### 4. DELETE / PATCH 路径参数

确认路径中的 `{projectRepositoryId}` = 绑定记录的本地 `id`，**不是** GitHub 数字仓库 ID，也不是仓库镜像 `repositoryId`。

### 5. 幂等键范围

请确认以下写接口均需前端传唯一 `Idempotency-Key`：

- 生成安装链接；  
- 绑定项目仓库；  
- 修改项目仓库（若第一版开放）；  
- 解绑项目仓库（若后端要求）。

同一次用户重试复用原 key；新操作换新 key。

### 6. 手动「刷新授权仓库」（可选但建议第一版有）

文档已提到 Webhook 不阻塞第一轮。请给出：

- 刷新接口路径与权限（Team Owner？）；  
- 成功后前端应重新 GET 的列表。

### 7. （可选，非阻塞）按仓库反查已绑定项目

当前前端可能对团队下每个项目各打一次 `GET .../repositories`。若有「按 `repositoryId` 查绑定」的批量接口，可后续优化，不挡本轮冻结。

### 8. 文档过时表述

请将联调文档中「前端仍使用 Mock、尚未建立 github.ts」等表述更新为：前端已具备 API 层与页面，按本确认调整字段与文案后联调。

---

## 三、前端下一步（确认冻结后）

1. 按本回复调整 `types/github.ts` 字段与枚举（`id` 映射、`visibility`、安装状态、去掉绑定层代码 `syncStatus` 等）。  
2. 映射层统一：列表 `id` ↔ 请求 `installationId` / `repositoryId`；DELETE 使用绑定 `id`。  
3. 同步 UI 文案：「仓库信息更新于」/「刷新授权仓库」等。  
4. 用正式后端（或更新后的契约）替换本地演示假设，完成安装 → 授权仓 → 选项目绑定 → 解绑闭环。

---

## 四、总结

| 序号 | 结论 |
|---|---|
| 1 | 接受 ID 分离 |
| 2 | 接受绑定只传本地 UUID |
| 3 | 采用方案 A，暂不要求团队绑定汇总 |
| 4 | 同意绑定层去掉代码 `syncStatus`，改元数据时间 |
| 5 | 同意 `ACTIVE/SUSPENDED/DELETED`，不用 `EXPIRED` |
| 6 | 确认回跳 `/app/integrations/github?teamId=&installed=1` |
| 7 | 第一版先用 GitHub 默认分支 |
| 8 | 接受 `visibility`，不再要求 `private` |

请后台确认以上回复及「第二节补充项」后，双方冻结接口并提供最终请求/响应示例与错误码，前端据此改类型与页面后开始联调。
