# Qgents V3 前端协作规范

- 修改前先阅读 `docs/api/qgents-api-current.md` 和 `docs/frontend/tech-stack.md`。
  - 权威 API 契约以项目根目录最新版《Qgents 接口文档vX.Y.Z.md》为准（当前 v1.9.4）；`docs/api/qgents-api-current.md` 为前端维护的对接汇总，旧版本见 `docs/api/archive/`。
- 全程使用 TypeScript strict 约束，不使用 `any`。
- 只修改当前职责范围内的业务，不重写其他成员负责的页面或流程。
- 不覆盖、删除或还原已有修改；发现来源不明的未提交修改时先停止并汇报。
- 不直接提交或推送代码。
- Mock 和真实接口必须使用相同的 API 调用链，组件不得直接读取 Mock fixture。
- 完成修改后必须运行 `npm run lint`、`npm run test` 和 `npm run build`。
- 后端数据使用 TanStack Query，全局 UI 状态使用 Zustand，局部状态使用 `useState`。
