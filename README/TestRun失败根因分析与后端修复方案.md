# TestRun 立即失败 + 时长显示"进行中"根因分析与后端修复方案

## 一、问题现象

1. 创建 Test Run 后，**立刻** 显示 `FAILED` 标签
2. 运行时长显示 **"进行中…"**（但状态已是 FAILED）
3. 浏览器控制台 **无报错**

## 二、根因分析

### 2.1 测试立即失败的根因：Sandbox Worker 未运行

**配置文件** `Qgents/src/main/resources/application.yaml`（第 72-75 行）：

```yaml
worker:
  base-url: ${SANDBOX_WORKER_URL:http://localhost:8091}
  enabled: ${SANDBOX_WORKER_ENABLED:false}   # ← 默认 false！
```

**执行链路**（`TestRunExecutionService.executeTestRun`）：

```
1. claimTestRun()     → 测试状态变为 RUNNING
2. worker.executeTests() → HTTP POST http://localhost:8091/internal/v1/test-executions
   ↑
   Worker 未运行 → RestClientException → SANDBOX_WORKER_UNAVAILABLE
3. catch 块捕获 → completeTest("FAILED") → 状态变为 FAILED
```

由于 `SandboxWorkerClient.execute()` 在 Worker 不可用时直接抛出 `ApiException(SANDBOX_WORKER_UNAVAILABLE)`，被 `executeTestRun` 的 catch 块捕获后，测试立即被标记为 FAILED。

**这是预期行为**——如果 Sandbox Worker 没有部署运行，测试就不可能成功执行。

### 2.2 时长显示"进行中"的根因：DTO 缺失时间字段

**后端 `TestRunResponse`**（`Qgents/src/main/java/qg/qgent/dto/TestRunResponse.java`）：

```java
public class TestRunResponse {
    private String id;
    private String projectId;
    private String repositoryId;
    private String ref;
    private List<String> testsetIds;
    private String status;
    private Map<String, Object> summary;
    private String createdBy;
    private String createdAt;     // ← 只有 createdAt，缺少 startedAt/finishedAt/updatedAt！
}
```

**对比** `TestRunListItemResponse`（列表项）是有这些字段的：
```java
public class TestRunListItemResponse {
    ...
    private String createdAt;
    private String startedAt;    // ← 有
    private String finishedAt;   // ← 有
}
```

**对比** `DryRunReportResponse` 也有：
```java
public class DryRunReportResponse {
    ...
    private String createdAt;
    private String updatedAt;    // ← 有
}
```

由于 `TestRunResponse` 没有返回 `startedAt`、`finishedAt`、`updatedAt`，前端 `mapTestRun` 映射后：
- `startedAt` = 回退到 `createdAt`（创建时间，非实际开始时间）
- `finishedAt` = `null`（因为 `updatedAt` 也没有返回）

前端 `testRunDurationText` 计算逻辑看到 `finishedAt` 为 null，就返回 "进行中…"。

## 三、后端需要修改的内容

### 修改 1：`TestRunResponse` 添加时间字段

**文件**: `Qgents/src/main/java/qg/qgent/dto/TestRunResponse.java`

```java
package qg.qgent.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestRunResponse {
    private String id;
    private String projectId;
    private String repositoryId;
    private String ref;
    private List<String> testsetIds;
    private String status;
    private Map<String, Object> summary;
    private String createdBy;
    private String createdAt;
    // ===== 新增以下 3 个字段 =====
    private String startedAt;     // 测试实际开始执行时间（claim 时写入）
    private String finishedAt;    // 测试实际结束时间（complete 时写入）
    private String updatedAt;     // 最后更新时间
}
```

### 修改 2：`TestRunService.toTestRun()` 映射新增字段

**文件**: `Qgents/src/main/java/qg/qgent/service/TestRunService.java`

**当前代码**（第 623-627 行）：
```java
private TestRunResponse toTestRun(TestRunEntity run) {
    return new TestRunResponse(id(run.getId()), id(run.getProjectId()), id(run.getProjectRepositoryId()),
            run.getRef(), run.getTestsetIds(), run.getStatus(), run.getSummary(),
            id(run.getCreatedBy()), iso(run.getCreatedAt()));
}
```

**修改后**：
```java
private TestRunResponse toTestRun(TestRunEntity run) {
    return new TestRunResponse(id(run.getId()), id(run.getProjectId()), id(run.getProjectRepositoryId()),
            run.getRef(), run.getTestsetIds(), run.getStatus(), run.getSummary(),
            id(run.getCreatedBy()), iso(run.getCreatedAt()),
            iso(run.getStartedAt()), iso(run.getFinishedAt()), iso(run.getUpdatedAt()));
}
```

注意：`iso()` 方法已经存在（第 735-737 行），会将 `LocalDateTime` 转为 ISO 字符串，`null` 时返回 `null`。

### 修改 3（可选增强）：Worker 不可用时给出更明确的错误提示

**文件**: `Qgents/src/main/java/qg/qgent/service/TestRunExecutionService.java`

**当前代码**（第 50-68 行）：
```java
public void executeTestRun(UUID runId) {
    TestRunEntity candidate = testRuns.selectById(runId);
    if (candidate == null) return;
    String token = claimTestRun(candidate);
    if (token == null) return;
    TestRunEntity run = testRuns.selectById(runId);
    publishTest(run);
    try {
        prepareSnapshot(run);
        String expectedHeadCommit = resolveExecutionRef(run);
        WorkerTestExecutionResponse response = worker.executeTests(testRequest(run, expectedHeadCommit));
        requirePassedTestContext(expectedHeadCommit, response);
        Map<String, Object> summary = testSummary(response);
        String status = response != null && "PASSED".equals(response.getStatus()) ? "PASSED" : "FAILED";
        if (completeTest(run, token, status, summary)) cleanupSnapshot(run);
    } catch (RuntimeException failure) {
        if (completeTest(run, token, "FAILED", failureSummary(failure))) cleanupSnapshot(run);
    }
}
```

**建议增强**：在 catch 块中区分 Worker 不可用和其他错误：

```java
} catch (RuntimeException failure) {
    Map<String, Object> summary = failureSummary(failure);
    // 如果是 Worker 不可用，添加更明确的提示
    if ("SANDBOX_WORKER_UNAVAILABLE".equals(failureCode(failure))) {
        summary.put("message", "Sandbox Worker 服务不可用，请确认 Worker 是否已部署启动");
    }
    if (completeTest(run, token, "FAILED", summary)) cleanupSnapshot(run);
}
```

## 四、前端已完成的修改

### 修改 1：`QualityGateReviewPage.tsx` - `testRunDurationText`

**文件**: `web/src/pages/ProjectDetail/Testset/QualityGateReviewPage.tsx`

- 新增终态检查（`PASSED`/`FAILED`/`CANCELLED`），终态时显示 `0s` 而非 `进行中…`
- 当状态为终态但 `finishedAt` 缺失时，显示 `0s` 兜底
- `dryRunDurationText` 同样修复

### 修改 2：`testset.ts` - `mapTestRun`

**文件**: `web/src/api/testset.ts`

- 优化时间字段的 fallback 逻辑
- 当只有 `updatedAt` 但没有 `startedAt` 时，用 `createdAt` 作为开始时间

## 五、完整数据流（修复后）

```
┌─────────────────────────────────────────────────────────────┐
│  后端 TestRunEntity (数据库)                                    │
│  started_at ──→ claim 时写入（RUNNING 状态）                     │
│  finished_at ──→ complete 时写入（PASSED/FAILED 终态）            │
│  updated_at ──→ 每次状态变更时更新                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    toTestRun() 映射
                    （添加 startedAt/finishedAt/updatedAt）
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  TestRunResponse (JSON)                                       │
│  { status: "FAILED", startedAt: "...", finishedAt: "..." }   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    mapTestRun() 映射
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  前端 TestRun 对象                                             │
│  { status: "FAILED", startedAt: "...", finishedAt: "..." }   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    testRunDurationText 计算
                    （终态时优先展示时长）
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  UI 显示                                                      │
│  状态: ❌ FAILED | 时长: 3s  ✅（不再显示"进行中"）               │
└─────────────────────────────────────────────────────────────┘
```

## 六、关于 Sandbox Worker 的补充说明

测试立即失败的根本原因是 **Sandbox Worker 没有运行**。如果希望测试真正执行，需要：

1. 启动 Sandbox Worker 服务（默认端口 8091）
2. 设置环境变量 `SANDBOX_WORKER_ENABLED=true`
3. 或者如果暂时不需要 Worker 功能，至少让前端能正确显示终态

当前前端修改已经能正确显示终态（即使 Worker 不可用，也会显示 `0s` 而非 `进行中…`），但要让测试真正执行，必须启动 Sandbox Worker。
