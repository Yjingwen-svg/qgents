# 需求群聊最小可用链路设计

- 日期：2026-08-12
- 负责人：A（15）
- 对齐接口文档：`Qgents 接口文档 (3).md` v1.1.8

## Context

A 负责平台最核心的 IM 协作入口。当前演示主链路「登录 → 进入项目总群 → 创建需求群 → 发送消息 → @Agent → 跳转任务 → 收到通知」中，只有「登录」是通的。群聊部分全是空壳：`RequirementChatPage` 消息区为空、输入框 disabled，且 MSW 里没有 group/message 的 mock handler。

本轮目标是打通最短主链路：「登录 → 进项目 → 进群 → 看消息 → 发消息」。

## 目标

1. 群聊 mock 数据层补齐（group/message）
2. 项目详情左侧群列表动态化（从写死的 `PROJECT_REQUIREMENTS` 改为拉接口）
3. 需求群聊页真实渲染消息 + 发送

## 范围

### 本轮做

- `GET /projects/:id/groups` + `GET/POST .../messages` 的 MSW mock
- 消息列表渲染（TEXT / CODE 气泡，区分 USER / AGENT / SYSTEM）
- 发送文本消息
- 项目详情左侧群列表动态拉取
- 默认落地改为项目总群（PROJECT_MAIN，服务端保证必有）

### 本轮不做（后续批次补）

- 创建需求群、会话列表增强（新建群、搜索、置顶）
- @提及 / @Agent（依赖 B 的任务创建）
- 图片 / 文件 / Diff 卡片 / 任务状态卡片渲染
- 项目总群结构化动态
- 通知中心（接口文档明确「持久通知中心不在本轮范围」）
- Memory
- 游标分页的真实翻页

## 关键设计决策

| 决策 | 说明 |
|------|------|
| 群 id 用 UUID | 严格对齐文档「所有资源 ID 为 UUID」，前端不假设格式 |
| 分页结构对齐 `page` | mock 本轮返回全量 + `hasMore:false`，但结构按文档 `{ data, page: {nextCursor, hasMore} }` 对齐 |
| 默认落地项目总群 | 替代当前硬编码的 `req-chat/login` 假需求 |
| 删旧 `types/message.ts` | 与新的 `types/group.ts` 模型重复且无人使用，统一用 group 模型 |

## 改动清单

1. `src/types/group.ts` — 加 `Page<T>` 分页类型
2. `src/types/index.ts` — 移除旧 message.ts 的导出
3. `src/api/client.ts` — 支持解出 `page` 层
4. `src/api/group.ts` — `listMessages` 返回 `{ messages, page }`
5. `src/mocks/handlers.ts` — 补 group/message mock
6. `src/pages/ProjectDetail/ProjectDetailLayout.tsx` — 左侧群列表动态化
7. `src/pages/ProjectDetail/RequirementChatPage.tsx` — 真实消息渲染 + 发送
8. 删除 `src/types/message.ts`、`src/pages/ProjectDetail/requirements.ts`

## 验证

1. `npm run dev`，登录 demo@qgents.dev
2. 进团队 → 进项目 → 默认落到项目总群，看到预置消息
3. 左侧群列表展示项目总群 + 需求群
4. 输入框发消息 → 消息出现在列表底部
5. `npm run lint` / `npm run build` 通过
