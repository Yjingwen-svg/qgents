# 测试集（Testset / Test Run / Dry Run）— 后端需给出的内容

> **已由** [`testset-frontend-confirm.md`](./testset-frontend-confirm.md) **取代为前端确认口径（2026-08-17）。**  
> 本文仅作历史对照；实现以确认项为准。

## 一句话

配方 CRUD 可用。Test Run 必须返回结构化 `summary.results[]`；Dry Run 必须返回嵌套 `report`（mergeable / conflicts / tests）。前端已按确认项接入展示与 SSE 刷新。

## 本轮空态 / 暂缓

见确认项第 3、5 节（taskId GET、failureReason、startedAt、cases、产物 URL、服务端历史列表）。
