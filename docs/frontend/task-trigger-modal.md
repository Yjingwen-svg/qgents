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

组件调用新模型 `useCreateTask`，请求为 `POST /projects/{projectId}/tasks`。表单提交 `requirementGroupId`、`title`、`requirement`、`repositoryIds` 和 `baseRef`；仓库选项来自项目仓库 Query。没有可用仓库时禁止提交，不包含 AUTO/MANUAL、workflowId、startMode、testsetIds 或 WorkPackage 操作。

创建成功后使用服务端返回的 Task，更新 Task detail/list Query，导航到 `/app/projects/{projectId}/tasks?taskId={taskId}`，并提示“任务已提交至云端，可以安全离开页面”。TaskDetail 迁移完成前，任务详情入口保持禁用；不要将新 taskId 传给旧 TaskDetail。
