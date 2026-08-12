# Workflow Viewer FE-API 待确认

本页只读消费 `system-default-code-delivery`。流程定义是前端集中维护的系统配置，不代表后端运行实例：

- 运行实例：`GET /projects/{projectId}/orchestration-runs` 与 `GET /projects/{projectId}/orchestration-runs/{runId}`。
- WorkPackage：由运行的 `workPackageIds` 读取 `GET /projects/{projectId}/work-packages/{workPackageId}`。
- TaskRun：按 WorkPackage 读取 `GET /projects/{projectId}/work-packages/{workPackageId}/task-runs`。
- Agent：按项目上下文取得 `teamId` 后读取现有 Agent Query；工作流页面不直接读取 fixture 或 Mock Store。

## 临时展示字段

当前正式接口尚未明确节点与 Agent、Skill、Testset 的完整关联 DTO。Mock/API 响应暂时在 TaskRun 上提供 `agentId`、`skillNames`、`testsetNames`、`currentStep`、`waitingMessage`，并保留现有 `agentNode`、`agentRole`、`startedAt`、`finishedAt`、`errorSummary`。这些字段仅用于只读展示，待后端提供正式字段后收敛。

待确认：

1. workflow template 的节点定义、节点顺序和连线是否由服务端提供。
2. TaskRun 与 Agent、Skill、Testset 的正式关联字段及权限裁剪规则。
3. 门禁汇总节点的正式状态、错误与执行摘要字段。
4. OrchestrationRun、WorkPackage、TaskRun 的状态优先级及跳过节点表达方式。
