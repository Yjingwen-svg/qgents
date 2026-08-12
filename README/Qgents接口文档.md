**🤡版本**：v1.1.1

**状态**：未定案业务契约

**更新日期**：2026-08-10

## 1. 范围

本文定义 Qgents 的账号、团队、项目、群聊、Skill、Memory、Agent 编排、受控执行、交付物、Diff、测试与 MR 接口。

本轮 P0 闭环为：

```Plain
群聊讨论 -> 启动编排 -> 查看执行 -> 处理阻塞 -> 接收交付物
```

- 任务中心以 orchestrationRun 为聚合资源；其下包含 workPackage 与 taskRun，不新增平行的顶层 Task。
- 项目总群与需求群统一为 Group，使用 PROJECT_MAIN 与 REQUIREMENT 区分。
- 客户端只能发起受控执行、读取状态和查看产物；不得直接操作 Workspace、Sandbox、Git 凭据或宿主机文件系统。
- 当前 SQL 尚未覆盖统一群模型、编排运行、输入请求、交付物和执行日志等资源。实现前必须补齐迁移、授权校验与服务端状态机，不能据此宣称能力已上线。
- 持久通知中心、离线推送、会话个人偏好、搜索、分支查询和 Test Run / Dry Run 历史列表不在本轮范围。

## 2. 通用约定

基础地址：`https://api.qgents.example.com/api/v1`。请求和响应均为 JSON，时间为 UTC RFC 3339，所有资源 ID 为 UUID。

除注册、登录、刷新 Token、重置密码和 GitHub App 回调外，均需：

```HTTP
Authorization: Bearer <accessToken>
```

成功响应统一为：

```JSON
{
  "data": {},
  "requestId": "req_01J..."
}
```

失败响应统一为：

```JSON
{
  "error": {
    "code": "PROJECT_ADMIN_REQUIRED",
    "message": "需要项目 Admin 权限",
    "details": [{"field": "role", "reason": "PROJECT_MEMBER"}]
  },
  "requestId": "req_01J..."
}
```

`400` 参数错误，`401` 未认证或 Token 失效，`403` 权限不足，`404` 资源不存在或不可见，`409` 幂等/状态冲突，`422` 业务校验失败，`429` 限流，`500` 服务异常。

写操作必须支持 `Idempotency-Key`；同一用户在 24 小时内重复提交相同键与请求体时返回首次结果。相同键但请求体不同时返回 `409 IDEMPOTENCY_KEY_REUSED`。列表接口使用 `cursor`、`limit`，默认 `30`、最大 `100`：

```JSON
{
    "data": [], 
    "page": {"nextCursor": "cursor_...", "hasMore": true}, 
    "requestId": "req_..."
}
```

## 3. 权限与状态

### 3.1 角色


|                  |     |                                                                          |
| ---------------- | --- | ------------------------------------------------------------------------ |
| 角色               | 作用域 | 主要权限                                                                     |
| `TEAM_OWNER`     | 团队  | 创建/归档项目；邀请、移除团队成员；管理团队级 GitHub App 集成；跨项目兜底管理                            |
| `TEAM_MEMBER`    | 团队  | 仅可访问被添加的项目                                                               |
| `PROJECT_ADMIN`  | 项目  | 管理项目成员（含其他 `PROJECT_ADMIN`）；绑定仓库；配置分支策略、Testset、门禁；审核 Skill/Memory；合并 MR |
| `PROJECT_MEMBER` | 项目  | 参与需求群聊；创建 Skill/Memory 草稿；使用已发布 Skill 和已批准 Memory；查看项目内配置和 MR 状态         |


服务端从 Token 和资源归属判断权限，客户端传入的 `userId`、`role` 不得作为授权依据。Project Admin 只能将已在项目中的成员提升为 Project Admin；最后一名 Project Admin 不能被移除或降级。Project Admin 不能直接邀请团队外用户，团队邀请仅由 Team Owner 完成。

### 3.2 状态枚举


|         |                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 资源      | 状态与约束                                                                                                                               |
| 团队邀请    | `PENDING -> ACCEPTED/ REVOKED / EXPIRED`                                                                                            |
| 项目      | `ACTIVE -> ARCHIVED`                                                                                                                |
| Skill   | `DRAFT -> PENDING_REVIEW -> PUBLISHED/ REJECTED / ARCHIVED`                                                                         |
| Memory  | `DRAFT -> PENDING_REVIEW -> APPROVED/REJECTED / ARCHIVED`                                                                           |
| Testset | `ENABLED/ DISABLED`                                                                                                                 |
| 质量检查    | `PENDING/ RUNNING / PASSED / FAILED`                                                                                                |
| Group   | `PROJECT_MAIN` 或 `REQUIREMENT`；仅 `REQUIREMENT` 可归档，`PROJECT_MAIN` 永远保持 `ACTIVE`                                                     |
| 编排运行    | `QUEUED -> PLANNING -> RUNNING -> SUCCEEDED / FAILED`；可进入 `WAITING_INPUT`、`WAITING_APPROVAL`、`BLOCKED` 或 `CANCELLING -> CANCELLED`  |
| 工作包     | `PLANNING -> READY -> RUNNING -> SUCCEEDED / FAILED / CANCELLED`，可由 `RUNNING -> PAUSED -> RUNNING`；运行中取消先进入 `CANCELLING`            |
| 子任务     | `PENDING -> RUNNING -> SUCCEEDED / FAILED / SKIPPED`                                                                                |
| 任务运行    | `QUEUED -> RUNNING -> SUCCEEDED / FAILED`；可进入 `WAITING_INPUT`、`WAITING_APPROVAL`、`BLOCKED`；取消时 `RUNNING -> CANCELLING -> CANCELLED` |
| 交付物     | `PENDING_REVIEW -> ACCEPTED / REJECTED`                                                                                             |
| 试运行     | `QUEUED -> RUNNING -> PASSED / FAILED / CANCELLED`                                                                                  |


## 4. 认证与账户


|         |                                 |      |                      |
| ------- | ------------------------------- | ---- | -------------------- |
| 方法      | 路径                              | 权限   | 说明                   |
| `POST`  | `/auth/register`                | 匿名   | 邮箱注册平台账号             |
| `POST`  | `/auth/login`                   | 匿名   | 邮箱密码登录               |
| `POST`  | `/auth/refresh`                 | 匿名   | 轮换 refresh token     |
| `POST`  | `/auth/logout`                  | 登录用户 | 使当前 refresh token 失效 |
| `POST`  | `/auth/password-reset-requests` | 匿名   | 发起找回密码邮件             |
| `POST`  | `/auth/password-resets`         | 匿名   | 使用重置令牌设置新密码          |
| `GET`   | `/me`                           | 登录用户 | 当前账户、团队和项目角色摘要       |
| `PATCH` | `/me`                           | 登录用户 | 修改昵称和头像              |


注册请求：

```JSON
{"email":"member@example.com","passwordKeyId":"rsa-2026-08","password":"Base64(RSA-PKCS1-v1_5(password))","displayName":"Lin"}
```

登录响应：

```JSON
{
  "data": {
    "accessToken":"eyJ...",
    "accessTokenExpiresIn":900,
    "refreshToken":"rt_...",
    "refreshTokenExpiresIn":2592000,
    "user":{"id":"user-uuid","email":"member@example.com","displayName":"Lin"}
  }
}
```

### 4.1 密码传输与存储

当前演示环境没有可用域名，认证接口允许通过 HTTP 暴露；因此注册、登录和重置密码请求中的 `password`、`newPassword` 必须为前端使用平台 RSA 公钥加密后的 Base64 密文，账号、邮箱等非敏感标识可保持明文。客户端不得自行生成密钥。


|       |                             |     |                           |
| ----- | --------------------------- | --- | ------------------------- |
| 方法    | 路径                          | 权限  | 说明                        |
| `GET` | `/auth/password-public-key` | 匿名  | 获取当前 RSA 公钥、`keyId` 与加密算法 |


```JSON
{
  "data": {
    "keyId": "rsa-2026-08",
    "algorithm": "RSA/ECB/PKCS1Padding",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----"
  }
}
```

认证请求中的密码字段示例：

```JSON
{"email":"member@example.com","passwordKeyId":"rsa-2026-08","password":"Base64(RSA-PKCS1-v1_5(password))","displayName":"Lin"}
```

服务端使用与 `keyId` 对应的私钥解密，解密失败、`keyId` 不存在或明文提交均返回 `400 INVALID_ENCRYPTED_PASSWORD`；禁止为兼容旧客户端而回退接收明文。解密后的明文仅在内存中用于复杂度校验和密码验证，随后使用 Argon2id 或 BCrypt 加盐哈希后存储。密码、私钥、重置令牌和 Token 不得写入日志、群聊内容或后续 Agent 上下文。GitHub OAuth 登录不属于本期必需能力。

> RSA 加密仅降低演示环境中密码明文直接出现在请求体或普通网络日志中的风险，不能替代 HTTPS：HTTP 页面与公钥响应仍可能被篡改。部署具备域名与证书条件后，必须迁移到 HTTPS，并保留服务端密码哈希。

## 5. 团队、项目与成员

### 5.1 团队与邀请


|               |                                              |                 |                         |
| ------------- | -------------------------------------------- | --------------- | ----------------------- |
| 方法            | 路径                                           | 权限              | 说明                      |
| `POST`        | `/teams`                                     | 登录用户            | 创建团队，创建者成为 `TEAM_OWNER` |
| `GET`         | `/teams`                                     | 登录用户            | 获取我加入的团队                |
| `GET`/`PATCH` | `/teams/{teamId}`                            | 团队成员/Team Owner | 获取/修改团队资料               |
| `GET`         | `/teams/{teamId}/members`                    | 团队成员            | 团队成员列表                  |
| `POST`        | `/teams/{teamId}/invitations`                | Team Owner      | 按邮箱创建团队邀请               |
| `GET`         | `/teams/{teamId}/invitations`                | Team Owner      | 查询邀请状态                  |
| `POST`        | `/team-invitations/{token}/accept`           | 登录用户            | 接受邀请并加入团队               |
| `DELETE`      | `/teams/{teamId}/invitations/{invitationId}` | Team Owner      | 撤销未接受邀请                 |
| `PATCH`       | `/teams/{teamId}/members/{userId}`           | Team Owner      | 调整团队角色                  |
| `DELETE`      | `/teams/{teamId}/members/{userId}`           | Team Owner      | 移除团队成员                  |


邀请请求：

```JSON
{"email":"new-member@example.com","role":"TEAM_MEMBER","expiresInDays":7}
```

受邀邮箱尚未注册时，系统发送注册链接和邀请令牌；用户以相同邮箱注册后可接受邀请。

### 5.2 项目与项目成员


|               |                                          |                            |                                        |
| ------------- | ---------------------------------------- | -------------------------- | -------------------------------------- |
| 方法            | 路径                                       | 权限                         | 说明                                     |
| `POST`        | `/teams/{teamId}/projects`               | Team Owner                 | 创建项目                                   |
| `GET`         | `/teams/{teamId}/projects`               | 团队成员                       | 仅返回我有权限访问的项目                           |
| `GET`/`PATCH` | `/projects/{projectId}`                  | 项目成员/`PROJECT_ADMIN`       | 获取/修改项目资料                              |
| `POST`        | `/projects/{projectId}/archive`          | Team Owner 或 Project Admin | 归档项目                                   |
| `POST`        | `/projects/{projectId}/restore`          | Team Owner 或 Project Admin | 恢复项目                                   |
| `GET`         | `/projects/{projectId}/members`          | 项目成员                       | 项目成员与角色                                |
| `POST`        | `/projects/{projectId}/members`          | Project Admin              | 将现有团队成员加入项目                            |
| `PATCH`       | `/projects/{projectId}/members/{userId}` | Project Admin              | 在 `PROJECT_MEMBER`/`PROJECT_ADMIN` 间调整 |
| `DELETE`      | `/projects/{projectId}/members/{userId}` | Project Admin              | 从项目移除成员                                |


创建项目：

```JSON
{"name":"Qgents Web","description":"Web client","memberIds":["user-uuid"]}
```

添加项目成员时 `userId` 必须已属于该团队。项目创建者自动成为 `PROJECT_ADMIN`；Team Owner 对本团队项目具有兜底管理权限。

## 6. GitHub App 与项目仓库

GitHub App 授权是团队级代码访问授权，不等同于 Qgents 的成员角色。仓库无需属于 `PROJECT_ADMIN`；只要组织/仓库管理员已为团队安装并授权 Qgents GitHub App，`PROJECT_ADMIN` 即可绑定该仓库。


|          |                                                                      |                            |                      |
| -------- | -------------------------------------------------------------------- | -------------------------- | -------------------- |
| 方法       | 路径                                                                   | 权限                         | 说明                   |
| `POST`   | `/teams/{teamId}/integrations/github/installations`                  | Team Owner                 | 生成 GitHub App 安装跳转地址 |
| `GET`    | `/integrations/github/callback`                                      | GitHub/浏览器                 | 接收安装或授权回调            |
| `GET`    | `/teams/{teamId}/integrations/github/installations`                  | Team Owner                 | 团队已安装的 GitHub App 列表 |
| `DELETE` | `/teams/{teamId}/integrations/github/installations/{installationId}` | Team Owner                 | 解除团队安装记录             |
| `GET`    | `/teams/{teamId}/integrations/github/repositories`                   | Team Owner 或 Project Admin | 查询该团队被授权的仓库          |
| `GET`    | `/projects/{projectId}/repositories`                                 | 项目成员                       | 获取项目已绑定仓库            |
| `POST`   | `/projects/{projectId}/repositories`                                 | Project Admin              | 绑定团队已授权仓库            |
| `PATCH`  | `/projects/{projectId}/repositories/{repositoryId}`                  | Project Admin              | 更新默认分支或显示名           |
| `DELETE` | `/projects/{projectId}/repositories/{repositoryId}`                  | Project Admin              | 解绑仓库                 |


发起安装返回：

```JSON
{"data":{"installationUrl":"https://github.com/apps/qgents/installations/new?state=...","expiresAt":"2026-08-10T11:00:00Z"}}
```

绑定仓库请求：

```JSON
{"installationId":"github-installation-id","repositoryId":"github-repository-id","defaultBranch":"main","displayName":"qgents-web"}
```

回调仅保存 installation 元数据和授权仓库范围。GitHub App 私钥、安装访问令牌和用户 PAT 永不通过前端 API 返回；未来代码操作需要时由服务端临时签发安装令牌。

### 6.1 分支策略与质量门禁


|             |                                                                              |                    |              |
| ----------- | ---------------------------------------------------------------------------- | ------------------ | ------------ |
| 方法          | 路径                                                                           | 权限                 | 说明           |
| `GET`/`PUT` | `/projects/{projectId}/repositories/{repositoryId}/branch-policies/{branch}` | 项目成员/Project Admin | 查询/配置受保护分支策略 |
| `GET`/`PUT` | `/projects/{projectId}/repositories/{repositoryId}/quality-gates/{branch}`   | 项目成员/Project Admin | 查询/配置目标分支的门禁 |


质量门禁示例：

```JSON
{
  "requirePullRequest": true,
  "requiredChecks": ["TESTSET", "AI_REVIEW", "DRY_RUN", "CQ_PLUS_ONE"],
  "requiredTestsetIds": ["testset-uuid"],
  "minimumHumanApprovals": 1,
  "allowDirectPush": false
}
```

`requiredTestsetIds` 是不可被普通成员绕过的强制测试集。门禁规则定义期望条件，检查的实际运行和回写由后续执行/同步服务处理。

## 7. 统一 Group 与消息

项目可有一个项目主讨论群和多个需求群，统一建模为 Group。创建项目时服务端自动创建唯一的 `PROJECT_MAIN` Group；它不可归档或删除。`REQUIREMENT` Group 是上下文与协作边界，可引用多个仓库；它不代表 Git `main`，也不天然生成或绑定分支。


|               |                                                   |                         |                        |
| ------------- | ------------------------------------------------- | ----------------------- | ---------------------- |
| 方法            | 路径                                                | 权限                      | 说明                     |
| `GET`         | `/projects/{projectId}/groups`                    | 项目成员                    | 项目总群与需求群列表，按最近活跃排序     |
| `POST`        | `/projects/{projectId}/groups`                    | 项目成员                    | 创建 `REQUIREMENT` Group |
| `GET`/`PATCH` | `/projects/{projectId}/groups/{groupId}`          | 项目成员/创建者或 Project Admin | 获取/修改需求群标题、描述和关联仓库     |
| `POST`        | `/projects/{projectId}/groups/{groupId}/archive`  | 创建者或 Project Admin     | 归档需求群                  |
| `GET`         | `/projects/{projectId}/groups/{groupId}/messages` | 项目成员                    | 游标拉取消息                 |
| `POST`        | `/projects/{projectId}/groups/{groupId}/messages` | 项目成员                    | 发送文本、代码块、图片、文件或引用      |
| `POST`        | `/projects/{projectId}/attachments`               | 项目成员                    | 创建对象存储直传凭证             |


创建需求群：

```JSON
{"title":"登录功能","description":"讨论账号与登录体验","repositoryIds":["repo-uuid"],"type":"REQUIREMENT"}
```

`POST /groups` 只接受 `REQUIREMENT` 或省略 `type`；传入 `PROJECT_MAIN` 返回 `422 SYSTEM_GROUP_MANAGED`。项目总群可收发消息，但仅用于项目级讨论和结构化动态；编排请求中的 `groupId` 必须指向同一项目下状态为 `ACTIVE` 的 `REQUIREMENT` Group。

发送消息：

```JSON
{
  "type":"TEXT",
  "content":{"text":"登录接口需要支持邮箱和密码。"},
  "mentions":["user-uuid"],
  "replyToId":null,
  "clientMessageId":"cmsg_01J..."
}
```

消息 `type` 为 `TEXT`、`CODE`、`IMAGE`、`FILE`、`SYSTEM` 或 `QUOTE`。服务端写入单调递增 `sequence`；`clientMessageId` 在同一需求群内唯一，断线重试返回原消息。好友、私聊和 Agent 好友不在本期范围。

## 8. 共享 Skill

Skill 是项目需求群内可复用的能力片段，例如规范、提示词、操作指引或工具调用约束。成员先创建自己的 `PRIVATE` Skill，并可装配给自己拥有的 Agent；Project Admin 可将其发布为 `PROJECT_SHARED`，供该项目成员的 Agent 使用。Skill 不是 Memory，不能承载未经确认的客观事实。


|               |                                                        |                         |                    |
| ------------- | ------------------------------------------------------ | ----------------------- | ------------------ |
| 方法            | 路径                                                     | 权限                      | 说明                 |
| `GET`         | `/projects/{projectId}/skills`                         | 项目成员                    | 查询 Skill，支持状态、标签过滤 |
| `POST`        | `/projects/{projectId}/skills`                         | 项目成员                    | 创建草稿 Skill         |
| `GET`/`PATCH` | `/projects/{projectId}/skills/{skillId}`               | 项目成员/创建者或 Project Admin | 获取/编辑草稿或审核中内容      |
| `POST`        | `/projects/{projectId}/skills/{skillId}/submit-review` | 创建者或 Project Admin      | 提交审核               |
| `POST`        | `/projects/{projectId}/skills/{skillId}/approve`       | Project Admin           | 发布 Skill           |
| `POST`        | `/projects/{projectId}/skills/{skillId}/reject`        | Project Admin           | 拒绝并给出原因            |
| `POST`        | `/projects/{projectId}/skills/{skillId}/archive`       | Project Admin           | 下线已发布 Skill        |


```JSON
{
  "name":"Java API 规范",
  "content":"Controller 仅处理 HTTP 协议，业务逻辑放入 Service。",
  "tags":["java","backend"],
  "visibility":"PRIVATE"
}
```

被共享的 Skill 在后续执行时可由 Agent 卡片或工作流节点引用；Agent 仅获得其当前项目中有权使用的 Skill，归档后不再装配到新执行中。

## 9. 共享 Memory

Memory 是经人工确认后供项目复用的知识，不是原始聊天记录。AI 可以根据多条消息生成草稿，但不得直接批准或发布；后续 Agent 只能按相关性和标签检索已批准的 Memory，不能默认注入全部内容。


|               |                                                           |                         |                          |
| ------------- | --------------------------------------------------------- | ----------------------- | ------------------------ |
| 方法            | 路径                                                        | 权限                      | 说明                       |
| `GET`         | `/projects/{projectId}/memories`                          | 项目成员                    | 查询 Memory，默认仅 `APPROVED` |
| `POST`        | `/projects/{projectId}/memories`                          | 项目成员                    | 手动创建草稿                   |
| `POST`        | `/projects/{projectId}/memories/drafts`                   | 项目成员                    | 根据选中的群聊消息生成 AI 草稿        |
| `GET`/`PATCH` | `/projects/{projectId}/memories/{memoryId}`               | 项目成员/创建者或 Project Admin | 获取/编辑草稿或审核中内容            |
| `POST`        | `/projects/{projectId}/memories/{memoryId}/submit-review` | 创建者或 Project Admin      | 提交审核                     |
| `POST`        | `/projects/{projectId}/memories/{memoryId}/approve`       | Project Admin           | 批准并发布                    |
| `POST`        | `/projects/{projectId}/memories/{memoryId}/reject`        | Project Admin           | 拒绝并给出原因                  |
| `POST`        | `/projects/{projectId}/memories/{memoryId}/archive`       | Project Admin           | 归档 Memory                |


手动草稿：

```JSON
{
  "title":"密码存储约定",
  "content":"密码仅存储 bcrypt 哈希，登录时使用 bcrypt.compare 校验。",
  "category":"ENGINEERING_DECISION",
  "tags":["auth","security"]
}
```

群聊生成草稿：

```JSON
{
  "sourceMessages":[
    {"groupId":"group-uuid","messageId":"message-uuid"},
    {"groupId":"group-uuid","messageId":"message-uuid-2"}
  ],
  "instruction":"沉淀为项目认证安全约定"
}
```

Memory 响应必须包含 `creator`、`reviewer`、`reviewedAt`、`category`、`tags` 与 `sources`。当前支持 `MANUAL`、`MESSAGE` 来源；未来任务/Diff 来源可扩展，但不在本版创建接口范围。

## 10. Testset

Testset 是项目自建、可复用的测试配置，而不是特殊语法。它可表示单元、接口或集成测试；本期只管理配置，实际执行由后续系统承担。


|               |                                                      |                    |                        |
| ------------- | ---------------------------------------------------- | ------------------ | ---------------------- |
| 方法            | 路径                                                   | 权限                 | 说明                     |
| `GET`         | `/projects/{projectId}/testsets`                     | 项目成员               | 查询 Testset，支持仓库与启用状态过滤 |
| `POST`        | `/projects/{projectId}/testsets`                     | Project Admin      | 创建 Testset             |
| `GET`/`PATCH` | `/projects/{projectId}/testsets/{testsetId}`         | 项目成员/Project Admin | 获取/修改配置                |
| `POST`        | `/projects/{projectId}/testsets/{testsetId}/enable`  | Project Admin      | 启用                     |
| `POST`        | `/projects/{projectId}/testsets/{testsetId}/disable` | Project Admin      | 禁用                     |
| `DELETE`      | `/projects/{projectId}/testsets/{testsetId}`         | Project Admin      | 删除未被门禁引用的 Testset      |


```JSON
{
  "name":"后端单元测试",
  "repositoryId":"repo-uuid",
  "scopeTags":["backend","unit"],
  "command":"./mvnw test",
  "timeoutSeconds":900,
  "passRule":{"type":"EXIT_CODE","expected":0},
  "acceptanceNotes":"登录成功、错误密码和不存在用户均需覆盖。"
}
```

Project Member 可查看并在未来任务计划中选择 `ENABLED` Testset；受保护分支的必选 Testset 以质量门禁配置为准，成员不能替换或跳过。

## 11. Agent、团队工作流与工作包

系统随每个团队提供不可修改的“新手大礼包”：`AgentOrchestrator`、`Planner`、`Developer`、`Tester`、`Reviewer` 及内置默认代码交付工作流。用户不配置任何内容时，在需求群中 @ `AgentOrchestrator` 即可运行该默认流程：`Planner` 生成工作包 → `Developer` 实现 → `Tester` 执行 Testset → `Reviewer` 审查 → 质量门禁汇总。

团队成员可创建仅自己可用的 Agent；发布后成为团队可用资源。产品界面至少展示每张 Agent 身份卡的昵称、头像、角色、能力标签、可用状态、创建者和可访问的 Skill 摘要；不得向其他成员泄露私有提示词或凭据。

### 11.1 个人与团队 Agent


|               |                                                        |                 |                                    |
| ------------- | ------------------------------------------------------ | --------------- | ---------------------------------- |
| 方法            | 路径                                                     | 权限              | 说明                                 |
| `GET`         | `/teams/{teamId}/agents`                               | 团队成员            | 查询系统 Agent、本人私有 Agent 和团队已发布 Agent |
| `POST`        | `/teams/{teamId}/agents`                               | 团队成员            | 创建自己的 `PRIVATE` Agent              |
| `GET`/`PATCH` | `/teams/{teamId}/agents/{agentId}`                     | 可见成员/创建者        | 获取 Agent 卡；创建者编辑自己的 Agent          |
| `POST`        | `/teams/{teamId}/agents/{agentId}/publish`             | 创建者             | 发布为 `TEAM_SHARED`，供团队成员使用          |
| `POST`        | `/teams/{teamId}/agents/{agentId}/unpublish`           | 创建者或 Team Owner | 收回为私有 Agent                        |
| `POST`        | `/teams/{teamId}/agents/{agentId}/archive`             | 创建者或 Team Owner | 下线 Agent，已运行任务不受影响                 |
| `PUT`         | `/projects/{projectId}/agent-skill-bindings/{agentId}` | Agent 创建者       | 为自己的 Agent 装配当前项目可用 Skill          |


创建 Agent：

```JSON
{
  "name":"Java 后端 Agent",
  "avatar":"https://cdn.example.com/avatars/java.png",
  "role":"DEVELOPER",
  "capabilities":["java","spring-boot","api"],
  "prompt":"遵循项目 API 规范和测试要求。"
}
```

`role` 为 `ORCHESTRATOR`、`PLANNER`、`DEVELOPER`、`TESTER`、`REVIEWER` 或 `GENERAL`。角色和能力是身份卡上的调度线索，不是权限绕过手段；工作流节点可按角色选择 Agent，调度器再从可用 Agent 中选择实际执行者。

### 11.2 团队工作流模板

本版本仅提供不可修改的 `system-default-code-delivery` 工作流。自定义团队工作流模板及其配置接口不在本版本范围。

### 11.3 编排与工作包

系统必须将代码实现、测试和审查分派给不同 Agent 角色；`AgentOrchestrator` 只负责规划、调度和汇总，禁止独自完成完整交付。


|               |                                                              |                         |                                                |
| ------------- | ------------------------------------------------------------ | ----------------------- | ---------------------------------------------- |
| 方法            | 路径                                                           | 权限                      | 说明                                             |
| `POST`        | `/projects/{projectId}/orchestration-runs`                   | 项目成员                    | 从需求群 @ `AgentOrchestrator`，启动默认团队工作流           |
| `GET`        | `/projects/{projectId}/orchestration-runs`                   | 项目成员                    | 任务中心查询，支持 `groupId`、状态、发起人、游标过滤                |
| `GET`         | `/projects/{projectId}/orchestration-runs/{runId}`           | 项目成员                    | 获取计划、进度、工作包及执行摘要                               |
| `POST`        | `/projects/{projectId}/orchestration-runs/{runId}/cancel`    | 发起人或 Project Admin      | 取消尚未完成的编排                                      |
| `GET`         | `/projects/{projectId}/work-packages`                        | 项目成员                    | 查询工作包，支持需求群、状态、仓库过滤                            |
| `GET`/`PATCH` | `/projects/{projectId}/work-packages/{workPackageId}`        | 项目成员/发起人或 Project Admin | 获取工作包；修改尚未启动的标题、说明、优先级、Testset 或启动方式           |
| `POST`        | `/projects/{projectId}/work-packages/{workPackageId}/start`  | 项目成员                    | 手动启动处于 `READY` 的工作包                            |
| `POST`        | `/projects/{projectId}/work-packages/{workPackageId}/pause`  | 发起人或 Project Admin      | 暂停未进入不可中断步骤的工作包                                |
| `POST`        | `/projects/{projectId}/work-packages/{workPackageId}/resume` | 发起人或 Project Admin      | 恢复处于 `PAUSED` 的工作包                             |
| `POST`        | `/projects/{projectId}/work-packages/{workPackageId}/cancel` | 发起人或 Project Admin      | 取消 `PLANNING`、`READY`、`RUNNING` 或 `PAUSED` 工作包 |


触发默认编排：

```JSON
{
  "groupId":"group-uuid",
  "instruction":"实现邮箱登录，前后端都要支持，并完成测试。",
  "workflowId":"system-default-code-delivery",
  "startMode":"AUTO",
  "testsetIds":["testset-uuid"]
}
```

省略 `workflowId` 时默认使用 `system-default-code-delivery`。响应为 `202 Accepted`。服务端创建 `orchestrationRun`，Planner 将需求拆为一个或多个工作包；每个工作包绑定一个仓库、基准分支、开发分支、验收 Testset 和多个有依赖的子任务。`startMode=AUTO` 为默认值，所有无依赖工作包在计划生成后自动启动；`MANUAL` 时仅生成计划，用户可逐个调用 `/start` 发车。

工作包状态为 `PLANNING -> READY -> RUNNING -> SUCCEEDED | FAILED | CANCELLED`，可由 `RUNNING -> PAUSED -> RUNNING`。取消 `PLANNING` 或 `READY` 工作包时立即变为 `CANCELLED`；取消运行中或暂停中的工作包时先返回 `202 Accepted` 与 `CANCELLING`，服务端仅在安全检查点终止。子任务状态为 `PENDING -> RUNNING -> SUCCEEDED | FAILED | SKIPPED`。用户只能编辑未开始的工作包；运行中的代码任务若收到新需求，必须创建后续工作包或在安全暂停后继续，不能让多个写入 Agent 并发修改同一 Workspace。

每个代码子任务由服务端分配独立 Workspace；Workspace 是持久的 Git 工作目录，Sandbox 是临时读码、改码、调试和测试环境。Sandbox 结束后 Workspace 的文件和 Git 修改保留，后续同一工作包的增量修改可复用该 Workspace。前端通过编排和工作包详情查看状态、受控日志和产物摘要，不直接操作 Sandbox 或 Workspace。

## 12. 受控执行、交付物与实时事件

本节将编排产生的子任务实际执行记录为 `TaskRun`。`TaskRun` 不是新的顶层任务：它必须关联既有的 `orchestrationRun`、`workPackage` 和子任务，并继承其项目、需求群和仓库归属。客户端可发起重试、读取受控日志和查看产物，但不能直接创建、进入或操作 Workspace/Sandbox。

所有本节 `POST` 接口均要求 `Idempotency-Key`，成功受理时返回 `202 Accepted` 和资源摘要；列表接口复用第 2 节的 `cursor` 与 `limit`。服务端必须校验路径中的 `projectId`、关联资源与当前用户在同一项目中，禁止仅通过 UUID 查询资源。

### 12.1 实时事件流


|       |                                |                |                        |
| ----- | ------------------------------ | -------------- | ---------------------- |
| 方法    | 路径                             | 权限             | 说明                     |
| `GET` | `/projects/{projectId}/events` | Project Member | 建立项目级 SSE 连接，接收状态和产物事件 |


该接口的 `Content-Type` 为 `text/event-stream`，不套用 JSON 成功响应。客户端可通过 `Last-Event-ID` 断线续传；服务端每 15 秒发送心跳，并至少保留 24 小时事件。续传点过期时返回 `409 EVENT_CURSOR_EXPIRED`，客户端应重新拉取相关资源。

```Plain
id: evt_01J...
event: task-run.step.progress
data: {"projectId":"project-uuid","orchestrationRunId":"orchestration-run-uuid","workPackageId":"work-package-uuid","taskRunId":"task-run-uuid","node":"DEVELOPER","sequence":12,"content":"正在执行测试","timestamp":"2026-08-10T12:00:00Z"}
```

事件类型为 `message.created`、`group.updated`、`orchestration-run.updated`、`work-package.updated`、`task-run.updated`、`task-run.step.progress`、`task-run.input-required`、`task-run.approval-required`、`test-run.updated`、`dry-run.updated`、`deliverable.created`、`merge-request.updated`。事件最小 payload 必须包含 `projectId`、可选 `groupId`、关联运行 ID、`sequence` 与 `timestamp`；输入与审批事件还必须包含 `inputRequestId`。事件仅用于刷新界面；客户端恢复连接或收到乱序事件后必须以相应的查询接口为准。受控日志不得包含 Token、密码、GitHub 安装令牌、私钥或未脱敏的环境变量。

### 12.2 子任务运行与执行上下文


|        |                                                                                  |                    |                                |
| ------ | -------------------------------------------------------------------------------- | ------------------ | ------------------------------ |
| 方法     | 路径                                                                               | 权限                 | 说明                             |
| `GET`  | `/projects/{projectId}/work-packages/{workPackageId}/task-runs`                  | Project Member     | 查询工作包下各子任务的运行记录                |
| `GET`  | `/projects/{projectId}/task-runs/{taskRunId}`                                    | Project Member     | 获取单次运行的状态、关联子任务和产物摘要           |
| `POST` | `/projects/{projectId}/task-runs/{taskRunId}/retry`                              | 发起人或 Project Admin | 为失败或已取消的运行创建一次新的 `TaskRun`     |
| `POST` | `/projects/{projectId}/task-runs/{taskRunId}/cancel`                             | 发起人或 Project Admin | 取消未完成运行，服务端仅在安全检查点终止           |
| `GET`  | `/projects/{projectId}/task-runs/{taskRunId}/steps`                              | Project Member     | 获取工作流节点状态                      |
| `GET`  | `/projects/{projectId}/task-runs/{taskRunId}/logs`                               | Project Member     | 游标读取已脱敏的执行日志                   |
| `GET`  | `/projects/{projectId}/task-runs/{taskRunId}/execution-context`                  | Project Member     | 读取 Workspace 与 Sandbox 的只读状态摘要 |
| `GET`  | `/projects/{projectId}/task-runs/{taskRunId}/input-requests`                     | Project Member     | 查询运行期间发起的人机输入请求                |
| `POST` | `/projects/{projectId}/task-runs/{taskRunId}/input-requests/{requestId}/reply`   | 发起人或 Project Admin | 回答 `WAITING_INPUT` 请求          |
| `POST` | `/projects/{projectId}/task-runs/{taskRunId}/input-requests/{requestId}/approve` | Project Admin      | 批准 `WAITING_APPROVAL` 请求       |
| `POST` | `/projects/{projectId}/task-runs/{taskRunId}/input-requests/{requestId}/reject`  | Project Admin      | 拒绝 `WAITING_APPROVAL` 请求       |


`retry` 只接受状态为 `FAILED`、`CANCELLED` 或 `BLOCKED` 的运行；原运行不可重置。响应中的新运行应包含 `retryOfTaskRunId`。输入请求最小响应包含 `id`、`taskRunId`、`kind`、`status`、`prompt`、可选 `options` 与 `createdAt`；回复请求为 `{"answer":{"value":"main"}}`，批准或拒绝请求为 `{"reason":"允许在受控 Sandbox 内执行测试"}`。回复或批准后服务端才可恢复 `RUNNING`；拒绝后服务端进入 `BLOCKED` 或安全取消，客户端不得直接改写运行状态。`execution-context` 仅返回 `workspaceId`、`sandboxStatus`、`repositoryId`、`baseRef`、`headRef`、`startedAt` 与 `expiresAt`，不得返回宿主机路径、容器控制入口或任何凭据。

步骤响应中的节点状态为 `PENDING`、`RUNNING`、`PASSED`、`FAILED`、`SKIPPED` 或 `CANCELLED`，并至少包含 `node`、`status`、`startedAt`、`finishedAt`、`durationMs` 与可选的 `errorCode`。运行中的工作包收到取消请求时，服务端仅在安全检查点停止；不可中断步骤结束前状态保持 `RUNNING` 或 `CANCELLING`。

### 12.3 交付物、Diff 与审查意见


|               |                                                                    |                    |                      |
| ------------- | ------------------------------------------------------------------ | ------------------ | -------------------- |
| 方法            | 路径                                                                 | 权限                 | 说明                   |
| `GET`         | `/projects/{projectId}/work-packages/{workPackageId}/deliverables` | Project Member     | 查询工作包产出的交付物          |
| `GET`         | `/projects/{projectId}/deliverables/{deliverableId}`               | Project Member     | 获取交付物、关联运行、分支和检查摘要   |
| `POST`        | `/projects/{projectId}/deliverables/{deliverableId}/accept`        | 发起人或 Project Admin | 接受通过必要检查的交付物         |
| `POST`        | `/projects/{projectId}/deliverables/{deliverableId}/reject`        | 发起人或 Project Admin | 拒绝交付物并给出退回原因         |
| `GET`         | `/projects/{projectId}/diffs/{diffId}`                             | Project Member     | 查询 Diff 的变更统计和关联提交   |
| `GET`         | `/projects/{projectId}/diffs/{diffId}/files`                       | Project Member     | 游标读取文件、hunk 和二进制文件摘要 |
| `GET`/`POST` | `/projects/{projectId}/diffs/{diffId}/comments`                    | Project Member     | 查询或添加 Diff 审查意见      |


创建交付物由受控执行服务完成，客户端不得伪造其关联的提交、测试结果或 Diff。`reject` 请求为 `{"reason":"请补充错误密码场景测试"}`；行级评论应包含 `path`、`side`、`line` 或 `hunkId`、`body`，并绑定提交 SHA，避免 Diff 更新后评论指向错误代码。`accept` 只表示业务方接受交付物，不绕过目标分支的质量门禁，也不等同于合并。

### 12.4 Test Run 与 Dry Run


|        |                                                    |                |                              |
| ------ | -------------------------------------------------- | -------------- | ---------------------------- |
| 方法     | 路径                                                 | 权限             | 说明                           |
| `POST` | `/projects/{projectId}/test-runs`                  | Project Member | 对指定提交或工作包发起已启用 Testset 的受控运行 |
| `GET`  | `/projects/{projectId}/test-runs/{testRunId}`      | Project Member | 获取测试运行状态、用例摘要和产物引用           |
| `POST` | `/projects/{projectId}/dry-runs`                   | Project Member | 针对源分支和目标分支发起合并前试运行           |
| `GET`  | `/projects/{projectId}/dry-runs/{dryRunId}/report` | Project Member | 获取试运行报告和冲突、测试摘要              |


`test-runs` 请求必须提供 `repositoryId`，并且提供 `workPackageId` 或 `ref` 之一；`testsetIds` 必须属于该仓库且为 `ENABLED`。`dry-runs` 请求必须提供 `repositoryId`、`sourceRef`、`targetBranch`，可选关联 `workPackageId`。受保护分支所需的 Testset 由第 6.1 节质量门禁决定，调用方不能通过传入较少的 `testsetIds` 跳过它们。

## 13. MR、审查与质量状态

MR 属于仓库，Qgents 将其镜像为项目内记录。创建、同步、人工 CQ 审查和合并均通过本节受控接口触发服务端操作；客户端不持有 GitHub 凭据，也不能直接写入检查结果或绕过分支策略。


|        |                                                                       |                     |                         |
| ------ | --------------------------------------------------------------------- | ------------------- | ----------------------- |
| 方法     | 路径                                                                    | 权限                  | 说明                      |
| `GET`  | `/projects/{projectId}/merge-requests`                                | Project Member      | 查询项目关联 MR，支持仓库、需求群、状态过滤 |
| `POST` | `/projects/{projectId}/merge-requests`                                | Project Member      | 基于已接受交付物创建 MR           |
| `GET`  | `/projects/{projectId}/merge-requests/{mergeRequestId}`               | Project Member      | 查询 MR、关联需求群、检查与审查摘要     |
| `GET`  | `/projects/{projectId}/merge-requests/{mergeRequestId}/checks`        | Project Member      | 查询门禁检查详情                |
| `GET`  | `/projects/{projectId}/merge-requests/{mergeRequestId}/reviews`       | Project Member      | 查询人工与 AI 审查摘要           |
| `POST` | `/projects/{projectId}/merge-requests/{mergeRequestId}/sync`          | Project Member      | 触发从 GitHub 同步 MR 最新状态   |
| `POST` | `/projects/{projectId}/merge-requests/{mergeRequestId}/cq-approvals`  | Project Member（非作者） | 提交一次 CQ1 审查             |
| `POST` | `/projects/{projectId}/merge-requests/{mergeRequestId}/cq-rejections` | Project Member（非作者） | 拒绝 CQ 并给出修改意见           |
| `POST` | `/projects/{projectId}/merge-requests/{mergeRequestId}/merge`         | Project Admin       | 通过质量门禁后执行合并             |


创建 MR 请求为 `{"deliverableId":"deliverable-uuid","targetBranch":"main","title":"实现邮箱登录"}`。服务端从交付物取得仓库、源分支和提交 SHA，并校验交付物已 `ACCEPTED`、分支仍存在且调用方有项目访问权；不接受客户端提交的 GitHub Token、提交 SHA 或门禁结果。`sync`、`merge` 和两个 CQ 写操作同样需要 `Idempotency-Key`。

CQ 审查者不得是 MR 作者、交付物创建者或代表其执行的 Agent；服务端须记录审查者、时间、所审查的 `headCommit` 和理由。新提交推送到 MR 后，旧 CQ1 是否失效由目标分支门禁配置决定，并反映到 `qualityGate`。

MR 详情的最小响应：

```JSON
{
  "data": {
    "id":"mr-uuid",
    "repositoryId":"repo-uuid",
    "groupIds":["group-uuid"],
    "provider":"GITHUB",
    "number":42,
    "sourceBranch":"feature/login-api",
    "targetBranch":"main",
    "status":"OPEN",
    "headCommit":"abc123",
    "qualityGate":{"status":"PENDING","requiredChecks":["TESTSET","AI_REVIEW","DRY_RUN","CQ_PLUS_ONE"]}
  }
}
```

正式合并前的业务规则为：关联 Diff/提交通过指定 Testset，AI 审查与 dryrun 通过，至少获得一次有效人工 `CQ+1`，且由 `PROJECT_ADMIN` 按仓库策略确认合并。是否满足这些规则由 `qualityGate.status` 表示。`merge` 在条件不满足时返回 `409 QUALITY_GATE_NOT_PASSED`；接口不存在跳过门禁、伪造检查结果或以手工结果覆盖自动检查的能力。

## 14. 后续接口边界

以下增强能力暂不提供公开接口，客户端不得假定其路径或字段：

- 自定义团队工作流模板及其节点配置；
- 用户直接操作 Workspace、Docker Engine、Sandbox 生命周期、文件读取/写入；
- Git 分支创建、推送和 Patch 应用的直接操作；
- 绕过质量门禁或手工改写 Testset、AI Review、Dry Run 结果；
- WebSocket、离线同步与移动端推送（SSE 见第 12.1 节）。

这些能力接入时必须复用本文件的项目、需求群、仓库、Testset、Memory、Skill、工作包和质量门禁资源模型，并遵循“不得由单一 Agent 独自完成完整交付”的产品约束。