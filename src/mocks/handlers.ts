import { http, HttpResponse } from 'msw'

/**
 * MSW 请求处理器（占位）
 * TODO[后端联调]: 按接口文档 § 各模块补充 mock handler，开发环境可启用
 */
export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ ok: true })),
]
