# TaskTriggerModal 接入说明

成员 A 在需求群页面引入 `@/components/task-domain/TaskTriggerModal`，由页面自行维护打开状态：

```tsx
<TaskTriggerModal
  open={triggerOpen}
  projectId={projectId}
  groupId={groupId}
  initialInstruction={currentRequirementDescriptionOrMessage}
  onClose={() => setTriggerOpen(false)}
/>
```

组件会调用 `POST /projects/{projectId}/orchestration-runs`，固定使用
`system-default-code-delivery`，成功后刷新任务 Query 缓存并导航到任务详情；需求群页面不需要读取 Mock fixture 或 Store，也不需要自行拼接请求。
