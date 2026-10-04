const COMMANDS = ['pomodoro', 'pause', 'resume', 'cancel']

// Recognition adapters emit wake/command events; this policy never treats bare speech as a command.
export class CommandWindow {
  constructor({ now, windowMs = 5000, execute, acknowledge = () => {} }) {
    this.now = now
    this.windowMs = windowMs
    this.execute = execute
    this.acknowledge = acknowledge
    this.muted = false
    this.suspended = false
    this.deadline = undefined
  }
  setMuted(value) {
    this.muted = !!value
    this.deadline = undefined
  }
  setSuspended(value) {
    this.suspended = !!value
    this.deadline = undefined
  }
  get listening() {
    return !this.muted && !this.suspended && this.deadline !== undefined && this.now() < this.deadline
  }
  wake() {
    if (this.muted || this.suspended) return false
    this.deadline = this.now() + this.windowMs
    this.acknowledge()
    return true
  }
  command(value) {
    if (!this.listening || !COMMANDS.includes(value)) return false
    this.deadline = undefined
    this.execute(value)
    return true
  }
}
