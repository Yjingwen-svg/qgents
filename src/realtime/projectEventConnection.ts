import { EventStreamContentType, type EventSourceMessage } from '@microsoft/fetch-event-source'
import { connectProjectEvents } from '@/api/projectEvents'
import { parseProjectTaskEvent, type ProjectTaskEvent } from './eventParser'
import { browserEventCursorStore, type EventCursorStore } from './eventCursor'

export type ProjectEventConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export class EventCursorExpiredError extends Error {
  constructor() {
    super('Project event cursor expired')
    this.name = 'EventCursorExpiredError'
  }
}

export interface ProjectEventConnectionOptions {
  cursorStore?: EventCursorStore
  retryDelaysMs?: readonly number[]
  connect?: typeof connectProjectEvents
  onEvent: (event: ProjectTaskEvent) => void
  onCursorExpired: () => void
  onStatusChange?: (status: ProjectEventConnectionStatus) => void
}

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000] as const

export class ProjectEventConnection {
  private readonly projectId: string
  private readonly cursorStore: EventCursorStore
  private readonly retryDelaysMs: readonly number[]
  private readonly connect: typeof connectProjectEvents
  private readonly onEvent: (event: ProjectTaskEvent) => void
  private readonly onCursorExpired: () => void
  private readonly onStatusChange?: (status: ProjectEventConnectionStatus) => void
  private readonly seenEventIds = new Set<string>()
  private abortController: AbortController | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryAttempt = 0
  private running = false
  private status: ProjectEventConnectionStatus = 'idle'

  constructor(projectId: string, options: ProjectEventConnectionOptions) {
    this.projectId = projectId
    this.cursorStore = options.cursorStore ?? browserEventCursorStore
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
    this.connect = options.connect ?? connectProjectEvents
    this.onEvent = options.onEvent
    this.onCursorExpired = options.onCursorExpired
    this.onStatusChange = options.onStatusChange
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.connectNow()
  }

  stop(): void {
    this.running = false
    this.clearRetryTimer()
    this.abortController?.abort()
    this.abortController = null
    this.setStatus('idle')
  }

  private connectNow(): void {
    if (!this.running || this.abortController) return
    this.setStatus('connecting')
    const controller = new AbortController()
    this.abortController = controller
    const lastEventId = this.cursorStore.get(this.projectId) ?? undefined

    void this.connect({
      projectId: this.projectId,
      lastEventId,
      signal: controller.signal,
      onopen: async (response) => {
        if (response.status === 409) {
          throw new EventCursorExpiredError()
        }
        if (!response.ok) throw new Error(`Project event stream failed: ${response.status}`)
        const contentType = response.headers.get('content-type')
        if (!contentType?.startsWith(EventStreamContentType)) {
          throw new Error(`Expected content-type to be ${EventStreamContentType}`)
        }
        this.retryAttempt = 0
        this.setStatus('connected')
      },
      onmessage: (message) => this.handleMessage(message),
      onclose: () => {
        this.abortController = null
        if (this.running) {
          this.setStatus('disconnected')
          this.scheduleReconnect()
        }
      },
      onerror: (error: unknown) => {
        if (error instanceof EventCursorExpiredError) {
          this.cursorStore.clear(this.projectId)
          this.seenEventIds.clear()
          this.retryAttempt = 0
          this.onCursorExpired()
          throw error
        }
        if (this.running) this.setStatus('disconnected')
        return this.nextRetryDelay()
      },
    }).catch(() => {
      if (this.running) {
        this.abortController = null
        this.setStatus('disconnected')
        this.scheduleReconnect()
      }
    })
  }

  private handleMessage(message: EventSourceMessage): void {
    const eventId = message.id.trim()
    if (eventId) {
      if (this.seenEventIds.has(eventId) || this.cursorStore.get(this.projectId) === eventId) return
      this.seenEventIds.add(eventId)
      if (this.seenEventIds.size > 1000) {
        const oldest = this.seenEventIds.values().next().value
        if (oldest) this.seenEventIds.delete(oldest)
      }
      this.cursorStore.set(this.projectId, eventId)
    }
    const event = parseProjectTaskEvent(message)
    if (event) this.onEvent(event)
  }

  private scheduleReconnect(): void {
    if (!this.running || this.retryTimer) return
    const delay = this.nextRetryDelay()
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connectNow()
    }, delay)
  }

  private nextRetryDelay(): number {
    const index = Math.min(this.retryAttempt, this.retryDelaysMs.length - 1)
    const delay = this.retryDelaysMs[index] ?? 1000
    this.retryAttempt += 1
    return delay
  }

  private clearRetryTimer(): void {
    if (!this.retryTimer) return
    clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private setStatus(status: ProjectEventConnectionStatus): void {
    if (this.status === status) return
    this.status = status
    this.onStatusChange?.(status)
  }
}
