// Admission persists deduplication immediately. Only an admitted, volatile notice can be released.
export class DeferredCompletion {
  constructor(admit) {
    this.admit = admit
  }
  offer(snapshot) {
    if (!this.admit(snapshot)) return false
    this.pending = snapshot
    return true
  }
  take() {
    const pending = this.pending
    this.pending = undefined
    return pending
  }
}
