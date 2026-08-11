import { http, HttpResponse } from 'msw'
import { taskDomainHandlers } from '../task-domain/handlers'

export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok', source: 'msw' })),
  ...taskDomainHandlers,
]
