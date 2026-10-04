// Pure protocol logic shared by the XS MOD and the Node companion service.
export const PHASES = Object.freeze([
  'idle',
  'confirming',
  'gathering',
  'comparing',
  'drafting',
  'needs-input',
  'ready',
  'failed',
])

export const PRESENTATION = Object.freeze({
  idle: { emotion: 'NEUTRAL', text: 'Ready to research' },
  confirming: { emotion: 'DOUBTFUL', text: 'Planning research' },
  gathering: { emotion: 'NEUTRAL', text: 'Finding sources' },
  comparing: { emotion: 'DOUBTFUL', text: 'Thinking it through' },
  drafting: { emotion: 'NEUTRAL', text: 'Writing a note' },
  'needs-input': { emotion: 'DOUBTFUL', text: 'I need your input' },
  ready: { emotion: 'HAPPY', text: 'Ready to review' },
  failed: { emotion: 'SAD', text: 'Research needs help' },
})

export function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return 'Expected an event object'
  if (event.version !== 1) return 'Unsupported protocol version'
  if (typeof event.taskId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(event.taskId)) return 'Invalid task ID'
  if (event.flowId !== undefined && (typeof event.flowId !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(event.flowId)))
    return 'Invalid flow ID'
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) return 'Invalid sequence'
  if (!PHASES.includes(event.phase) || event.phase === 'idle') return 'Invalid event phase'
  if (event.text !== undefined && (typeof event.text !== 'string' || event.text.length > 80)) {
    return 'Status text must be at most 80 characters'
  }
  return null
}

export function isTerminal(phase) {
  return phase === 'ready' || phase === 'failed'
}

export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.version !== 1) return false
  if (typeof snapshot.serviceId !== 'string' || snapshot.serviceId.length < 1 || snapshot.serviceId.length > 80) {
    return false
  }
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) return false
  if (!Number.isSafeInteger(snapshot.updatedAt) || snapshot.updatedAt < 0) return false
  if (snapshot.phase === 'idle') return snapshot.taskId === null && snapshot.sequence === 0
  return validateEvent(snapshot) === null
}

export class ResearchState {
  constructor(serviceId) {
    this.snapshot = {
      version: 1,
      serviceId,
      revision: 0,
      taskId: null,
      sequence: 0,
      phase: 'idle',
      text: '',
      updatedAt: 0,
    }
    this.tasks = new Set()
  }

  serialize() {
    return { version: 1, snapshot: { ...this.snapshot }, tasks: [...this.tasks] }
  }

  static restore(record) {
    if (
      record?.version !== 1 ||
      !validateSnapshot(record.snapshot) ||
      !Array.isArray(record.tasks) ||
      record.tasks.length > 128 ||
      new Set(record.tasks).size !== record.tasks.length ||
      record.tasks.some((id) => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) ||
      (record.snapshot.taskId && !record.tasks.includes(record.snapshot.taskId))
    )
      throw new Error('Invalid persisted companion state')
    const state = new ResearchState(record.snapshot.serviceId)
    state.snapshot = { ...record.snapshot }
    state.tasks = new Set(record.tasks)
    return state
  }

  accept(event, now = Date.now()) {
    const invalid = validateEvent(event)
    if (invalid) return { status: 400, error: invalid }
    const current = this.snapshot
    if (event.taskId === current.taskId) {
      if ((event.flowId ?? 'research') !== (current.flowId ?? 'research'))
        return { status: 409, error: 'Task belongs to a different flow' }
      if (event.sequence < current.sequence) return { status: 409, error: 'Stale event' }
      if (event.sequence === current.sequence) {
        if (event.phase !== current.phase || (event.text ?? '') !== current.text) {
          return { status: 409, error: 'Sequence already used by a different event' }
        }
        return { status: 200, duplicate: true, snapshot: { ...current } }
      }
      if (isTerminal(current.phase)) return { status: 409, error: 'Task is already terminal; use a new task ID' }
    } else {
      if (this.tasks.has(event.taskId)) return { status: 409, error: 'Retired task' }
      if (current.phase !== 'idle' && !isTerminal(current.phase)) {
        return { status: 409, error: 'Another research task is active' }
      }
      if (event.sequence !== 1 || !['confirming', 'gathering'].includes(event.phase)) {
        return { status: 409, error: 'Start a task with sequence 1 and confirming or gathering' }
      }
      // Keep replay protection bounded without evicting old task IDs.
      if (this.tasks.size >= 128) return { status: 409, error: 'Session task limit reached; restart service' }
      this.tasks.add(event.taskId)
    }
    this.snapshot = {
      version: 1,
      serviceId: current.serviceId,
      revision: current.revision + 1,
      taskId: event.taskId,
      flowId: event.flowId ?? 'research',
      sequence: event.sequence,
      phase: event.phase,
      text: event.text ?? '',
      updatedAt: now,
    }
    return { status: 200, duplicate: false, snapshot: { ...this.snapshot } }
  }
}

export class SnapshotCursor {
  constructor() {
    this.serviceId = null
    this.revision = -1
  }

  accept(snapshot) {
    if (!validateSnapshot(snapshot)) return false
    if (this.serviceId === snapshot.serviceId && snapshot.revision <= this.revision) return false
    this.serviceId = snapshot.serviceId
    this.revision = snapshot.revision
    return true
  }
}
