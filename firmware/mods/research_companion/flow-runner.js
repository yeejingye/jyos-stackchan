// Platform-independent foreground lifecycle. Hardware is injected by the MOD.
export class FlowRunner {
  constructor({ schedule, cancel, show, hide, complete, readyMs = 15000, onError = () => {} }) {
    Object.assign(this, { schedule, cancel, show, hide, complete, readyMs, onError })
    this.generation = 0
    this.key = null
    this.dismissed = false
  }
  apply(snapshot) {
    if (snapshot.phase === 'idle') {
      this.reset()
      return
    }
    const key = `${snapshot.serviceId}:${snapshot.taskId}`
    // A newer snapshot waits until the current hardware operation releases ownership.
    if (key !== this.key && this.runningHardware) return
    if (key !== this.key) {
      this.reset()
      this.key = key
    }
    if (this.dismissed || this.completing) return
    if (snapshot.phase === 'ready') {
      this.completing = true
      this.runningHardware = true
      const generation = this.generation
      const current = () => generation === this.generation
      void Promise.resolve()
        .then(() => this.complete(snapshot, current))
        .catch((error) => this.onError(error))
        .then(() => {
          this.runningHardware = false
          if (!current() || this.dismissed) return
          this.show(snapshot.text || 'Research note ready for review', 'ready')
          this.timer = this.schedule(() => this.dismiss(), this.readyMs)
        })
    } else {
      this.show(snapshot.text, snapshot.phase)
      if (snapshot.phase === 'failed' && !this.timer) this.timer = this.schedule(() => this.dismiss(), this.readyMs)
    }
  }
  dismiss() {
    if (this.timer !== undefined) this.cancel(this.timer)
    this.timer = undefined
    this.dismissed = true
    this.hide()
  }
  reset() {
    this.generation++
    this.dismiss()
    this.key = null
    this.dismissed = false
    this.completing = false
  }
}
