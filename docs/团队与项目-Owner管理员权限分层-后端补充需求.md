# 团队与项目「Owner / 管理员权限分层」后端补充需求

> 前端反馈文档 · 供后端补字段与权限校验（2026-08-20）
> 关联：群聊成员管理已按 owner/admin 分层落地（前端 `GroupMemberSettings`），团队侧需同步支持。

---

## 1. 需求背景

群聊成员管理（需求群）已按 **owner / admin** 分层：

- **owner**：可设/撤管理员、可把所有人（含管理员）移出群聊；
- **admin**（项目管理员）：只能移出普通成员，不能动 owner 和其他管理员。

现在要把同一套逻辑延伸到**团队**，并补全**项目 owner 判定**所需字段。

## 2. 角色语义

| 层级 | owner | admin | 普通成员 |
|---|---|---|---|
| 团队 | Team Owner（创建团队的人，现有 `TEAM_OWNER`） | **团队管理员（新增 `TEAM_ADMIN`）** | `TEAM_MEMBER` |
| 项目 | 项目创建者（**需后端补 `createdBy` 字段**） | `PROJECT_ADMIN` | `PROJECT_MEMBER` |

## 3. 权限矩阵

### 3.1 团队

| 操作 | Team Owner | Team Admin（新增） | 普通成员 |
|---|---|---|---|
| 设置/移除团队管理员（角色调整） | ✅ | ❌ | ❌ |
| 创建项目 | ✅ | ✅（与 Owner 一致） | ❌ |
| 添加普通成员（邀请） | ✅ | ✅ | ❌ |
| 移除普通成员 | ✅ | ✅ | ❌ |
| 移除其他管理员 | ✅ | ❌ | ❌ |
| 移除 Owner | ❌（Owner 唯一不可被操作） | ❌ | ❌ |
| 解散团队 / 团队资料编辑 | ✅ | ❌（如需，由产品定） | ❌ |

### 3.2 项目群聊（已有前端实现，后端需同步校验）

| 操作 | 项目 Owner（创建者） | 项目 Admin | 普通成员 |
|---|---|---|---|
| 设置/移除项目管理员（项目角色调整） | ✅ | ❌ | ❌ |
| 移出群聊：所有成员（含管理员） | ✅ | ❌ | ❌ |
| 移出群聊：仅普通成员 | ✅ | ✅ | ❌ |
| 移出 Owner | ❌ | ❌ | ❌ |

## 4. 需要后端补的字段 / 接口

### 4.1 项目侧（用于项目 Owner 判定）

**P1. `GET /projects/{projectId}` 响应补 `createdBy`**

```json
{
  "data": {
    "id": "01…",
    "teamId": "01…",
    "name": "…",
    "createdBy": "user-uuid",
    "role": "PROJECT_ADMIN",
    "…现有字段…"
  }
}
```

- `createdBy`：项目创建者的 userId（创建项目时自动成为 PROJECT_ADMIN，此字段用于识别"项目 Owner"）。
- 前端 `Project` 类型将新增 `createdBy?: string`，群聊成员管理据此判定 owner（替代当前用"主群创建者"的代理方案）。

**P2. 项目角色调整接口权限收紧**

`PATCH /projects/{projectId}/members/{userId}`（body `{ role: "PROJECT_ADMIN" | "PROJECT_MEMBER" }`）：

- 仅**项目 Owner（创建者）**可调用（现在文档写的是"Project Admin"，需收紧为创建者，否则管理员能给自己/别人升职）；
- Owner 本人不可被降级/移除。

### 4.2 团队侧（新增团队管理员角色）

**T1. 团队角色枚举增加 `TEAM_ADMIN`**

```
TeamRole = TEAM_OWNER | TEAM_ADMIN（新增） | TEAM_MEMBER
```

涉及返回 `role` 的接口：

- `GET /teams/{teamId}`（当前用户角色，`TeamResponse.role`）
- `GET /teams/{teamId}/members`（成员列表，`TeamMemberResponse.role`）
- 邀请：`POST /teams/{teamId}/invitations`（body `role` 允许传 `TEAM_ADMIN`；受邀者接受后成为管理员）

**T2. `PATCH /teams/{teamId}/members/{userId}` 角色调整（已有接口，放开角色值 + 收紧权限）**

- 现：仅 Team Owner 可调；`role` 取值 `TEAM_OWNER | TEAM_MEMBER`。
- 改：`role` 新增 `TEAM_ADMIN`；
  - **仅 Team Owner 可调用**（管理员不能调整任何人的角色）；
  - Team Owner 本人不可被调整（owner 唯一，不可降级）。

**T3. `DELETE /teams/{teamId}/members/{userId}` 移除成员（已有接口，权限分层）**

- 现：仅 Team Owner。
- 改：
  - Team Owner：可移除除自己外的所有成员（含管理员）；
  - Team Admin：只能移除 `TEAM_MEMBER` 普通成员；移除 `TEAM_OWNER` / `TEAM_ADMIN` 返回 403；
  - 普通成员：无权限。

**T4. 创建项目权限放开**

创建项目入口（`POST /teams/{teamId}/projects`）目前由前端按 `role === 'TEAM_OWNER'` 控制显示。

- 后端校验：`TEAM_OWNER` 或 `TEAM_ADMIN` 均可创建项目；
- 前端同步：`TeamDetailPage` 的「创建项目」按钮对 `TEAM_ADMIN` 也显示。

## 5. 前端配合点（后端确认后可落地）

| 文件 | 改动 |
|---|---|
| `src/types/project.ts` | `Project` 增加 `createdBy?: string` |
| `src/types/team.ts` | `TeamRole` 增加 `'TEAM_ADMIN'` |
| `src/pages/ProjectDetail/GroupMemberSettings.tsx` | owner 判定由 `group.createdBy === user.id` 改为 `project?.createdBy === user.id`（对所有需求群生效） |
| `src/pages/TeamDetail/TeamDetailPage.tsx` | 「创建项目」按钮对 `TEAM_ADMIN` 显示 |
| `src/pages/TeamDetail/TeamSettingsPage.tsx` | 成员管理：Owner 可设/撤管理员（`TEAM_ADMIN ↔ TEAM_MEMBER`）；Admin 只能移除普通成员；成员行显示角色标签 |

## 6. 错误码建议（可选）

- 非 owner 调整项目/团队角色 → `403 TEAM_ROLE_ADMIN_REQUIRED` / `403 PROJECT_ROLE_OWNER_REQUIRED`
- 管理员尝试移除其他管理员 / owner → `403 TEAM_ADMIN_CANNOT_REMOVE_MANAGER`
- 对 Owner 本人降级/移除 → `409 OWNER_IMMUTABLE`

## 7. 验证方式

1. 团队：Owner 将成员设为 `TEAM_ADMIN` → 该成员可创建项目、可移除普通成员、不可移除其他管理员/Owner、不可调整角色；
2. 项目：项目详情返回 `createdBy`；创建者（非 PROJECT_ADMIN 时）仍可设/撤管理员；管理员不能给自己升职；
3. 群聊：项目 Owner 在任意需求群（含他人建的）都拥有 owner 管理权限。
