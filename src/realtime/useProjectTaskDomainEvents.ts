import { useEffect, useState } from 'react'
import { invalidateProjectTaskDomain, invalidateProjectTaskEvent } from './queryInvalidation'
import { ProjectEventConnection, type ProjectEventConnectionStatus } from './projectEventConnection'

type StatusListener = (status: ProjectEventConnectionStatus) => void

interface SharedProjectConnection {
  connection: ProjectEventConnection | null
  listeners: Set<StatusListener>
  refCount: number
  status: ProjectEventConnectionStatus
}

const connections = new Map<string, SharedProjectConnection>()

function createSharedConnection(projectId: string): SharedProjectConnection {
  const shared: SharedProjectConnection = {
    connection: null,
    listeners: new Set<StatusListener>(),
    refCount: 0,
    status: 'idle',
  }
  shared.connection = new ProjectEventConnection(projectId, {
    onEvent: (event) => invalidateProjectTaskEvent(projectId, event),
    onCursorExpired: () => invalidateProjectTaskDomain(projectId),
    onStatusChange: (status) => {
      shared.status = status
      for (const listener of shared.listeners) listener(status)
    },
  })
  return shared
}

export function subscribeProjectTaskDomainEvents(
  projectId: string,
  listener: StatusListener,
): () => void {
  let shared = connections.get(projectId)
  if (!shared) {
    shared = createSharedConnection(projectId)
    connections.set(projectId, shared)
  }
  shared.refCount += 1
  shared.listeners.add(listener)
  listener(shared.status)
  shared.connection?.start()

  return () => {
    const current = connections.get(projectId)
    if (!current) return
    current.listeners.delete(listener)
    current.refCount -= 1
    if (current.refCount <= 0) {
      current.connection?.stop()
      connections.delete(projectId)
    }
  }
}

export function useProjectTaskDomainEvents(projectId: string): ProjectEventConnectionStatus {
  const [status, setStatus] = useState<ProjectEventConnectionStatus>('idle')

  useEffect(() => {
    if (!projectId) return undefined
    return subscribeProjectTaskDomainEvents(projectId, setStatus)
  }, [projectId])

  return status
}
