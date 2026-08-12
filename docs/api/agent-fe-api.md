# Agent FE-API 待确认记录

> 本文件记录 Agent 团队页面对 v1.1.1 正式接口的前端补充约定；后端确认后应合并回正式接口文档。

## FE-API-AGENT-001：Agent 展示摘要字段

- 相关接口：`GET /teams/{teamId}/agents`、`GET /teams/{teamId}/agents/{agentId}`
- 原型需要但 v1.1.1 未定义：`availability`、`permissions`、`concurrencyLimit`、需求群/工作流使用统计、Skill/Memory 访问范围、分配详情、运行任务、运行记录、项目级绑定状态。
- 当前前端 Mock DTO：`AgentPresentation`，仅用于 Query → 页面展示，不作为创建或编辑请求字段。
- 需要后端确认：列表与详情的字段边界、可操作权限返回结构、分页响应是否固定使用 `{ data, page, requestId }`。

## FE-API-AGENT-002：Agent 详情隐私字段

- `prompt`、配置和凭据不得出现在其他成员的列表或只读详情响应中。
- 当前前端约定：仅后端返回 `permissions.canViewPrivateConfig=true` 时展示 `prompt`/`config`；组件不从列表摘要推断或补全私有字段。
- 需要后端确认：创建者编辑时允许读取的配置字段清单，以及私有 Agent 被其他成员访问时的 403/404 语义。

## FE-API-AGENT-003：项目 Skill 绑定响应

- 相关接口：`GET /projects/{projectId}/skills`、`PUT /projects/{projectId}/agent-skill-bindings/{agentId}`。
- 当前前端约定：可绑定选项由项目 Skill Query 提供，绑定请求只提交 `skillIds`；响应返回更新后的 Agent 详情。
- 需要后端确认：Skill 可用性、scope 枚举和绑定冲突时的 409/422 错误码。
