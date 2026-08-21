# Qgents 前端实现链路与答辩说明

> 本文用于答辩准备，内容以当前前端代码为准。重点覆盖 A 负责的账号、团队/项目入口、项目详情布局、群聊、消息同步、@Agent 任务触发、附件、Skill、Memory 和项目动态等功能。

## 1. 技术架构总览

项目使用 React + TypeScript + Vite 构建，UI 组件使用 Ant Design，后端数据使用 TanStack Query 管理，全局 UI 状态使用 Zustand，组件内部交互使用 React `useState`。

整体调用链如下：

```text
用户操作
  -> React 页面/组件
  -> 业务 API 模块
  -> src/api/client.ts 统一请求层
  -> HTTP API
  -> TanStack Query 缓存
  -> 组件重新渲染
```

前端的职责是展示数据、组织用户操作、维护页面交互状态和同步后端数据；权限、任务执行、Git 操作、Workspace 和文件实际存储由后端负责。

## 2. 应用启动与路由

### 2.1 启动链路

```text
src/main.tsx
  -> React 根节点
  -> QueryClientProvider
  -> AuthProvider
  -> App / Router
  -> MainLayout
  -> 具体页面
```

`QueryClientProvider` 提供后端数据缓存；`AuthProvider` 维护当前登录用户和 Token；路由系统根据 URL 决定当前页面。

### 2.2 路由设计

路由路径集中定义在 `src/routes/paths.ts`，避免页面中散落魔法字符串。重要路径包括：

```text
/login                                  登录
/app/teams                              团队首页
/app/projects/:projectId/overview      项目概览
/app/projects/:projectId/req-chat/:id  项目群聊
/app/projects/:projectId/skills         共享 Skill
/app/projects/:projectId/memory         共享 Memory
/app/projects/:projectId/code           分支与 Diff
/app/projects/:projectId/tasks          任务中心
```

使用 `projectId`、`groupId`、`taskId` 等路由参数保证页面刷新后仍能恢复当前上下文。

## 3. 登录、Token 与统一请求

### 3.1 登录链路

```text
登录页输入邮箱和密码
  -> 前端按接口要求加密密码
  -> POST /auth/login
  -> 保存 accessToken / refreshToken
  -> 获取当前用户信息 /me
  -> 进入团队或项目页面
```

Token 保存于浏览器本地存储，后续请求由统一请求层读取。

### 3.2 统一 API 请求层

所有业务 API 都通过 `src/api/client.ts`，业务页面不直接拼接请求头。统一请求层负责：

- 拼接 API Base URL。
- 自动添加 `Authorization: Bearer <accessToken>`。
- 自动解析后端统一响应中的 `data`。
- 将错误转换为 `ApiError`。
- 写请求自动生成 `Idempotency-Key`。
- 收到 `401` 时使用 refreshToken 刷新并重试一次。
- 刷新失败时清除登录态并派发登录过期事件。

### 3.3 Mock 与真实接口

Mock 和真实接口使用同一套业务 API 调用链。页面只调用 `groupApi`、`skillApi`、`memoryApi` 等业务模块，不直接读取 Mock fixture。是否启用 Mock 由 `VITE_USE_MOCK` 控制。

## 4. 团队与项目进入链路

### 4.1 团队入口

用户登录后进入团队首页，前端通过 TanStack Query 获取用户所属团队和项目：

```text
GET /teams
  -> 展示团队列表
  -> 选择团队
  -> GET /teams/{teamId}/projects
  -> 展示可访问项目
```

项目列表由后端按照用户权限返回，前端不自行推断用户是否能访问项目。

### 4.2 项目详情布局

项目详情页面由 `ProjectDetailLayout` 统一包裹：

```text
ProjectDetailLayout
  ├── 左侧项目导航
  ├── 群聊列表
  ├── 中间 Outlet 内容区
  └── 项目总群下的项目动态面板
```

进入项目时会加载：

- 项目基本信息。
- 项目群列表。
- 当前用户可见的项目成员。
- 当前项目所在团队信息。

如果没有指定群聊，前端会自动找到 `PROJECT_MAIN` 项目总群并直接渲染，避免先进入空页面再跳转造成闪烁。

### 4.3 群列表功能

左侧群列表支持：

- 项目总群和需求群展示。
- 群聊搜索。
- 活跃群与归档群区分。
- 最近活跃时间排序。
- 当前用户置顶偏好。
- 未读数展示。
- 有人 @ 当前用户时展示提醒标记。
- 新建需求群。

置顶功能当前以后端字段为优先；后端未返回置顶字段时，前端使用按项目隔离的 `localStorage` 作为兜底。

## 5. 群聊消息功能

群聊核心组件是 `src/components/chat/ChatPanel.tsx`。

### 5.1 首次进入群聊

```text
打开 /req-chat/:groupId
  -> 获取群信息
  -> 获取群成员
  -> 获取项目和 Agent 信息
  -> 分页获取历史消息
  -> 按 sequence / createdAt 排序
  -> 渲染消息列表
  -> 标记当前群已读
```

消息列表使用 `useInfiniteQuery`，支持游标分页。向上滚动到顶部时加载更早历史，并通过滚动锚点保持用户当前阅读位置。

### 5.2 消息类型

当前支持的主要消息类型：

- `TEXT`：普通文本。
- `CODE`：代码块。
- `IMAGE`：图片消息。
- `FILE`：文件消息。
- `QUOTE`：回复或引用消息。
- `DIFF`：代码变更卡片。
- `TASK_STATUS`：任务状态卡片。
- `SYSTEM`：系统消息。

组件根据消息的 `senderType` 和 `type` 选择不同展示方式。用户消息靠右，其他成员和 Agent 消息靠左，系统消息居中弱化显示。

### 5.3 发送文本消息

```text
输入文本
  -> 计算有效 mentions
  -> 创建 pending 乐观消息
  -> POST /groups/{groupId}/messages
  -> 成功：真实消息替换 pending 消息
  -> 失败：移除 pending 消息并提示
```

乐观更新的目的，是让用户点击发送后立即看到消息，不需要等待网络请求完成。

发送框支持：

- Enter 发送。
- Shift + Enter 换行。
- 自动高度，最多扩展到数行。
- 窄屏下输入框自动收缩，附件和发送按钮保持可用。

### 5.4 @ 成员和 Agent

```text
用户输入 @
  -> 识别最后一个 @ 及查询词
  -> 从成员和 Agent 候选中筛选
  -> 用户选择候选项
  -> 显示名称写入输入框
  -> 记录 mention 类型和 ID
  -> 发送消息时提交 mentions
```

前端根据当前群类型限制 Agent 提及：只有活跃需求群可以通过 @Agent 触发任务，项目总群只支持普通成员交流。

此外，消息右键菜单提供“@该成员”入口，可以直接把消息发送者写入输入框。

### 5.5 回复和引用

点击消息的“回复”后：

```text
保存 replyTo 消息
  -> 输入区显示引用条
  -> 发送时 type=QUOTE
  -> 提交 quotedMessageId、quotedText、replyText
  -> 消息气泡展示回复正文和被引用内容
```

如果引用的是 Diff 卡片，前端会保留当前 Diff 的引用关系，后端可以据此创建增量任务。

### 5.6 有人 @ 我的跳转

前端根据：

- 当前用户 ID。
- 消息的 `mentions`。
- 当前群已读 sequence。

计算未处理的 @ 消息。消息区底部显示“有人 @ 你”跳转条，并显示未处理消息数量。点击后滚动到目标消息并临时高亮，键盘 Enter 和 Space 也可以触发。

## 6. 实时消息同步

### 6.1 为什么不是只依赖 WebSocket

SSE 或 WebSocket 只作为“有事件发生”的通知通道，真实消息通过 REST 增量接口获取。这种设计可以处理：

- WebSocket 断线。
- 浏览器标签页进入后台。
- 消息重复推送。
- 多条消息同时到达。
- sequence 中间缺失。

### 6.2 增量同步链路

```text
收到 SSE / WebSocket 事件
  -> 读取当前缓存最大 sequence
  -> GET /messages/incremental?afterSequence=...
  -> 按 message id 去重
  -> 合并到 TanStack Query 缓存
  -> 消息列表重新渲染
```

在重新连接、窗口从后台恢复和实时连接恢复时，前端都会进行一次消息校准。

### 6.3 任务卡片更新

Task 状态卡片按原消息在消息流中的时间位置展示，不会被移动到顶部。收到 `message.updated` 或任务领域事件后，前端刷新任务和消息缓存，使原卡片内容更新。

## 7. @Agent 发起任务

### 7.1 自动触发

```text
用户在需求群 @Agent 并发送需求
  -> 先发送消息
  -> 判断是否包含有效 Agent mention
  -> 获取项目已绑定仓库
  -> 调用任务触发接口
  -> 任务进入 PLANNING
  -> 刷新任务 Query
```

前端不会把一个公共 `baseRef` 强行套到所有仓库，而是允许后端按照每个仓库的默认分支处理，避免多仓库默认分支不同导致任务创建失败。

### 7.2 引用 Diff 的增量任务

```text
回复/引用 Diff 卡
  -> 发送 QUOTE 消息
  -> 使用 quotedMessageId 调用任务触发接口
  -> 后端复用源 Workspace
  -> 刷新任务列表和消息状态
```

前端会针对 `QUOTED_DIFF_INVALID`、`QUOTED_DIFF_NOT_ACCESSIBLE` 等错误给出明确提示。

### 7.3 显式发起任务

需求群头部的“发起任务”按钮打开任务触发弹窗。弹窗负责收集任务标题、需求描述、仓库和分支等信息，并调用后端受控任务接口。前端不直接创建 Workspace、不操作 Git 凭据，也不在浏览器执行代码。

### 7.4 任务状态展示原则

任务状态由后端返回，前端负责展示、刷新和跳转：

```text
PLANNING -> PENDING -> RUNNING
         -> WAITING_DIFF_CONFIRMATION
         -> DELIVERING
         -> SUCCEEDED / FAILED / DELIVERY_FAILED
```

前端不自行维护一套与后端冲突的任务状态映射。

## 8. 图片和文件上传

### 8.1 上传完整链路

```text
选择文件
  -> POST /projects/{projectId}/attachments
  -> 返回 attachmentId、uploadUrl、headers
  -> PUT uploadUrl 上传原始二进制
  -> 携带 Authorization 和 Idempotency-Key
  -> POST /attachments/{attachmentId}/confirm
  -> 附件变为 READY
  -> 发送 IMAGE / FILE 消息
```

后端代理 PUT 属于 `/projects/**` 写接口，因此必须携带 `Idempotency-Key`。当前前端在 `src/api/attachment.ts` 中对后端相对上传地址生成唯一 UUID；如果是绝对 OSS 预签名地址，则不额外添加该请求头，避免影响签名。

### 8.2 图片展示

私有附件的 content 地址需要鉴权，普通 `<img>` 标签无法稳定添加 Bearer Token。因此 `AuthedImage` 使用：

```text
图片 URL
  -> fetch + Authorization
  -> 读取 Blob
  -> URL.createObjectURL
  -> Ant Design Image 展示
```

组件卸载或 URL 变化时会取消请求并释放 objectURL，避免内存泄漏。

### 8.3 附件预览

文件消息点击后打开 `AttachmentPreviewModal`，根据后端返回的预览类型选择：

- 图片预览。
- PDF iframe。
- 文本或代码预览。
- 不支持预览时提供下载回退。

## 9. Skill 页面

Skill 页面入口是 `/app/projects/:projectId/skills`。

### 9.1 列表链路

```text
进入页面
  -> GET /projects/{projectId}/skills
  -> TanStack Query 缓存
  -> 本地按状态筛选
  -> 卡片展示名称、内容摘要、可见性、状态、标签和创建者
```

支持的状态筛选包括：

```text
全部、草稿、待审核、已发布、已拒绝、已归档
```

### 9.2 创建、编辑和归档

```text
新建/编辑弹窗
  -> Ant Design Form 校验
  -> POST create 或 PATCH update
  -> 成功后 invalidateQueries
  -> 重新加载列表
```

已发布 Skill 可以执行归档操作。审核相关动作统一放在交付中心或由后端权限控制。

## 10. Memory 页面

Memory 页面入口是 `/app/projects/:projectId/memory`。

### 10.1 双栏布局

页面由两部分组成：

```text
左侧：Memory 列表和筛选
右侧：当前选中 Memory 的详情
```

当前详情栏使用普通布局，不再使用 sticky，避免和项目详情外层滚动容器产生嵌套滚动冲突。窄屏时自动变成单栏。

### 10.2 列表和详情

```text
GET /projects/{projectId}/memories
  -> 获取 Memory 列表
  -> 按状态筛选
  -> 点击条目设置 detailId
  -> 右侧展示完整内容、标签、创建者、审核者和来源
```

### 10.3 手动创建和编辑

```text
打开表单
  -> 输入标题、内容、分类、标签
  -> 标签由逗号分隔字符串转换为 string[]
  -> POST create 或 PATCH update
  -> 成功后刷新 memories Query
```

### 10.4 AI 沉淀

```text
点击 AI 沉淀
  -> 查询项目需求群
  -> 选择有消息的需求群
  -> POST 生成 Memory 草稿
  -> 刷新 Memory 列表
```

前端只负责选择群和展示生成结果，Memory 的实际内容提取和草稿生成由后端完成。

## 11. 项目动态面板

项目总群页面右侧显示项目动态面板。面板通过 Query 获取项目相关群、任务和 MR 摘要，并在实时事件或任务变化后失效对应 Query。

```text
项目总群
  -> ProjectActivityPanel
  -> 查询群、任务和 MR 摘要
  -> 按时间展示动态
  -> 实时事件到达后 invalidate 对应 Query
```

需求群页面不显示右侧项目动态面板，避免把项目级动态和单个需求群内容混在一起。

## 12. 响应式布局和滚动处理

### 12.1 项目详情布局

项目详情采用左侧导航、中间内容和项目总群右侧动态面板的布局。侧栏和动态面板支持拖拽调整宽度，并设置最小/最大宽度，避免内容被挤压到不可读。

### 12.2 群聊窄屏处理

群聊头部操作按钮可以换行，消息内容设置最大宽度和断词规则，输入区使用弹性布局，附件按钮、输入框和发送按钮不会互相挤压。

### 12.3 滚动原则

- 聊天消息区使用独立滚动容器。
- 用户查看历史消息时，新消息不强制把页面拉到底部。
- 用户本来位于底部时，新消息自动跟随到底部。
- 加载历史消息后恢复原滚动锚点。
- Memory 页面避免详情栏 sticky 与外层滚动容器叠加。

## 13. 权限和安全边界

前端不会把用户传入的 `userId` 或 `role` 当作授权依据。前端根据后端接口返回结果展示操作，真正权限由后端校验。

前端不直接处理：

- GitHub Access Token。
- Git 凭据。
- Workspace 文件系统。
- Sandbox 宿主机文件。
- Agent 实际执行过程。

前端只通过受控 API 创建任务、读取任务状态、查看 Diff、提交审核动作和展示交付结果。

## 14. 已实现与当前边界

### 14.1 当前已经落地

- 登录、Token 刷新和退出。
- 团队和项目入口。
- 项目详情三栏布局。
- 群聊列表、搜索、置顶和未读提示。
- 文本、代码、图片、文件、引用、Diff 和任务状态消息。
- @ 成员、@Agent、回复和引用。
- 历史消息分页、乐观发送和实时增量同步。
- 任务触发和任务状态卡展示。
- 图片/文件上传、确认和鉴权展示。
- Skill 列表、筛选、创建、编辑、详情和归档。
- Memory 列表、筛选、创建、编辑、详情、归档和 AI 沉淀入口。
- 项目总群项目动态面板。

### 14.2 当前不能夸大为完整实现

答辩时不要把当前仍是页面框架或由其他成员负责的部分说成已经由 A 完整实现：

- 任务中心的完整看板和高级筛选。
- Agent 团队管理页的完整业务流程。
- 后端尚未提供的消息搜索、语音、表情反应、消息编辑删除和输入中状态。
- 前端直接控制 Workspace、Git 或 Agent 执行过程。

## 15. 常见答辩问题

### 为什么使用 TanStack Query？

因为群聊、任务、Skill、Memory 等都是后端资源，需要缓存、重新请求、失效和跨组件共享。TanStack Query 可以统一处理加载、错误、缓存和刷新，避免手动把服务器数据复制到全局状态。

### 为什么不用 Zustand 保存消息列表？

消息列表属于后端数据状态，不是纯 UI 状态。放进 TanStack Query 可以直接配合分页、失效、增量合并和重新请求；Zustand 只保留当前项目、导航等跨页面 UI 状态。

### 为什么实时消息还需要 REST 增量接口？

SSE/WebSocket 可能断线、重复或丢事件，因此实时通道只通知“有变化”，REST 增量接口根据 sequence 拉取可靠数据，并按消息 ID 去重。

### 为什么发送消息要乐观更新？

减少用户等待感。消息先以 pending 状态展示，后端成功后替换为真实消息，失败时移除并保留输入内容供用户重试。

### 为什么图片不能直接用 `<img src>`？

私有附件接口需要 Bearer Token，而普通图片标签不方便携带自定义 Authorization，所以前端用带 Token 的 fetch 获取 Blob，再生成 objectURL 展示。

### 为什么上传 PUT 还要 Idempotency-Key？

后端对 `/projects/**` 的写请求统一做幂等校验。图片上传使用原生 fetch，绕过了普通 API 请求层，因此前端需要手动给代理 PUT 请求生成唯一幂等键。

### 前端如何保证权限安全？

前端只做界面层的可见性控制，最终权限由后端根据 Token 和资源归属判断。前端不信任用户自行传入的角色和用户 ID，也不直接接触 Git 凭据或服务器文件。

### 为什么 Memory 详情栏不使用 sticky？

项目详情外层已经有纵向滚动容器，Memory 页面再使用 sticky 容易形成复杂的滚动上下文，导致滚动跳动或体验不稳定。因此改为普通双栏布局，移动端切换为单栏。

## 16. 一分钟总结版

> Qgents 前端采用 React、TypeScript、Ant Design 和 TanStack Query 实现。用户登录后由 AuthContext 管理 Token，所有业务请求经过统一 API 层完成鉴权、错误处理、Token 刷新和幂等控制。项目详情页由统一布局管理项目导航、群聊和项目动态。群聊使用游标分页获取历史消息，使用 SSE/WebSocket 接收实时事件，再通过 sequence 增量接口可靠同步消息，并支持 @ 成员、@Agent、回复、附件、Diff 和任务状态卡。@Agent 消息可以触发后端受控任务，前端只负责创建请求、状态展示和结果刷新。图片采用创建附件、PUT 上传、confirm、发送 IMAGE 消息的链路，展示时用带 Token 的 Blob 加载。Skill 和 Memory 使用 TanStack Query 管理列表和详情，表单提交成功后通过 Query 失效重新获取数据。整体上前端负责交互和展示，后端负责权限、任务执行、Git、Workspace 和数据持久化。
