# Qgents Web（React）

当前阶段只搭好**登录 / 团队引导 / Banner 主壳**相关路由与页面框架。

## 本地启动

```bash
cd web
npm install
npm run dev
```

## 页面流程

1. `/login` — 登录 / 注册
2. `/welcome` — 尚未加入团队时：创建或加入
3. `/app/teams` — 团队首页（顶部 Banner，含「团队首页」入口）
4. `/app/teams/create` — 创建团队
5. `/app/teams/join` — 加入团队

## 目录说明

| 路径 | 职责 |
|------|------|
| `src/routes` | 路由表、路径常量、鉴权守卫 |
| `src/layouts/MainLayout` | 顶部 Banner 主壳 |
| `src/pages/*` | 各页面（含 TODO 注释） |
| `src/api` | 后端联调 API 封装 |
| `src/types` | 与后端 DTO 对齐的类型 |
| `src/context` | 登录态（框架阶段为 demo） |

## 演示路径

登录页点「登录」→ 欢迎页 →「立即创建」→ 创建团队表单。
