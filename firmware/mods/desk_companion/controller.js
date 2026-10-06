// Negative pitch tilts upward on CoreS3; keep a fixed 35-degree gaze during the sweep.
const LOOK_PITCH = -(35 * Math.PI) / 180

// Hardware and clock are injected so idle timing and ownership can be verified independently.
export class DeskCompanion {
  constructor({
    now,
    motion,
    delay,
    busy = () => false,
    idleMs = 15 * 60 * 1000,
    onError = () => {},
    onPetting = () => {},
  }) {
    Object.assign(this, { now, motion, delay, busy, idleMs, onError, onPetting })
    this.paused = false
    this.lastActivity = now()
    this.generation = 0
    this.gesture = new PettingGesture()
  }
  get running() {
    return !!this.pending
  }
  activity() {
    this.lastActivity = this.now()
    this.petRequested = false
    this.showPetting(false)
    return this.stop()
  }
  stop() {
    this.generation++
    this.interruptWait?.()
    return this.pending ?? Promise.resolve()
  }
  setPaused(value) {
    this.paused = !!value
    return this.activity()
  }
  tick() {
    if (this.busy()) return this.activity()
    if (!this.paused && !this.running && this.now() - this.lastActivity >= this.idleMs) return this.look()
    return Promise.resolve()
  }
  touch(gesture) {
    this.lastActivity = this.now()
    const matched = this.gesture.observe(gesture, this.now())
    if (matched) return this.pet()
    return Promise.resolve()
  }
  pet() {
    this.lastActivity = this.now()
    if (this.busy()) return Promise.resolve()
    this.showPetting(true)
    this.petDeadline = this.now() + 5000
    if (this.mode === 'petting') return this.pending
    if (this.running) {
      this.petRequested = true
      return this.stop().then(() => {
        if (!this.petRequested) return
        this.petRequested = false
        return this.pet()
      })
    }
    return this.run('petting')
  }
  showPetting(active) {
    if (!!this.petShown === active) return
    this.petShown = active
    this.onPetting(active)
  }
  async wait(ms) {
    let interrupt
    const cancelled = new Promise((resolve) => {
      interrupt = resolve
    })
    this.interruptWait = interrupt
    try {
      await Promise.race([this.delay(ms), cancelled])
    } finally {
      if (this.interruptWait === interrupt) this.interruptWait = undefined
    }
  }
  look() {
    return this.run('sweep')
  }
  run(mode) {
    this.lastActivity = this.now()
    if ((mode === 'sweep' && this.paused) || this.running || this.busy()) return this.pending ?? Promise.resolve()
    const generation = ++this.generation
    const current = () => generation === this.generation && (mode === 'petting' || !this.paused) && !this.busy()
    this.mode = mode
    // Own hardware through cleanup, including when interrupted by another feature.
    this.pending = Promise.resolve().then(async () => {
      try {
        if (!current()) return
        if (mode === 'petting') this.showPetting(true)
        await this.motion.setTorque(true)
        for (const yaw of mode === 'petting' ? [0.2, -0.2, 0.11, 0] : [0.15, -0.15, 0.12, -0.12]) {
          if (!current()) break
          await this.motion.setPose({ rotation: { y: yaw, p: LOOK_PITCH, r: 0 } }, mode === 'petting' ? 0.22 : 1)
          if (current()) await this.wait(mode === 'petting' ? 220 : 2500)
        }
        while (mode === 'petting' && current() && this.now() < this.petDeadline) {
          await this.wait(Math.min(250, this.petDeadline - this.now()))
        }
      } catch (error) {
        this.onError(error)
      } finally {
        try {
          await this.motion.setPose({ rotation: { y: 0, p: 0, r: 0 } }, 1)
          await this.delay(1500)
        } catch (error) {
          this.onError(error)
        }
        try {
          await this.motion.setTorque(false)
        } catch (error) {
          this.onError(error)
        }
        this.lastActivity = this.now()
        this.pending = undefined
        this.mode = undefined
        if (mode === 'petting') this.showPetting(false)
      }
    })
    return this.pending
  }
}

// Match an alternating pair without accepting isolated taps or stale swipes.
export class PettingGesture {
  observe(gesture, now) {
    if (gesture !== 'forwardSwipe' && gesture !== 'backwardSwipe') return false
    const matched = this.previous !== undefined && this.previous !== gesture && now - this.previousAt <= 1500
    this.previous = matched ? undefined : gesture
    this.previousAt = now
    return matched
  }
}
