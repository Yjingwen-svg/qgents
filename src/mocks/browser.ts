import { setupWorker } from 'msw/browser'
import { agentHandlers } from './agent/handlers'
import { handlers } from './handlers'
import { taskModelHandlers } from './task-model/handlers'
import { testsetHandlers } from './testset/handlers'

export const worker = setupWorker(...handlers, ...taskModelHandlers, ...agentHandlers, ...testsetHandlers)
