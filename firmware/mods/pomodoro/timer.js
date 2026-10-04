// Platform-independent, monotonic deadline timer. The caller owns rendering and audio.
export class PomodoroTimer {
  constructor({ now, focusMs = 1200000, restMs = 300000 }) {
    if (typeof now !== 'function' || ![focusMs, restMs].every((n) => Number.isFinite(n) && n > 0))
      throw new Error('Invalid timer configuration')
    this.now = now
    this.focusMs = focusMs
    this.restMs = restMs
    this.phase = 'idle'
    this.paused = false
    this.remainingMs = 0
  }
  get active() {
    return this.phase !== 'idle'
  }
  snapshot() {
    const remainingMs = !this.active ? 0 : this.paused ? this.remainingMs : Math.max(0, this.deadline - this.now())
    return { phase: this.phase, paused: this.paused, remainingMs }
  }
  tick() {
    const events = []
    if (!this.active || this.paused) return events
    const now = this.now()
    if (this.phase === 'focus' && now >= this.deadline) {
      this.phase = 'rest'
      this.deadline += this.restMs
      events.push('rest')
    }
    if (this.phase === 'rest' && now >= this.deadline) {
      this.phase = 'idle'
      this.remainingMs = 0
      events.push('finished')
    }
    return events
  }
  command(command) {
    const events = this.tick()
    if (command === 'pomodoro' && !this.active) {
      this.phase = 'focus'
      this.paused = false
      this.deadline = this.now() + this.focusMs
      events.push('started')
    } else if (command === 'pause' && this.active && !this.paused) {
      this.remainingMs = Math.max(0, this.deadline - this.now())
      this.paused = true
      events.push('paused')
    } else if (command === 'resume' && this.active && this.paused) {
      this.deadline = this.now() + this.remainingMs
      this.paused = false
      events.push('resumed')
    } else if (command === 'cancel' && this.active) {
      this.phase = 'idle'
      this.paused = false
      this.remainingMs = 0
      events.push('cancelled')
    }
    return events
  }
}

export function countdown(remainingMs) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
