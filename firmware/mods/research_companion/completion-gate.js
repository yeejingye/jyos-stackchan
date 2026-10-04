const keyOf = (snapshot) => `${snapshot.flowId ?? 'research'}:${snapshot.taskId}`

export class CompletionGate {
  constructor({ consumed = [], save = () => {}, offlineExpiryMs = 300000 } = {}) {
    this.consumed = Array.isArray(consumed) ? consumed.filter((id) => typeof id === 'string').slice(-16) : []
    this.save = save
    this.offlineExpiryMs = offlineExpiryMs
  }
  observe(snapshot, now = Date.now()) {
    if (!['idle', 'ready', 'failed'].includes(snapshot.phase)) {
      this.observed = keyOf(snapshot)
      this.seenAt = now
    }
    if (snapshot.phase === 'idle') this.observed = undefined
  }
  consume(snapshot, now = Date.now()) {
    const key = keyOf(snapshot)
    if (
      this.observed !== key ||
      now - this.seenAt > this.offlineExpiryMs ||
      this.consumed.includes(key) ||
      this.consumed.includes(snapshot.taskId)
    )
      return false
    const next = [...this.consumed.slice(-15), key]
    // Persist before hardware: an interrupted attempt must not announce again.
    this.save(next)
    this.consumed = next
    return true
  }
}
