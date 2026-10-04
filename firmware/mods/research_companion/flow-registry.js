export class FlowRegistry {
  constructor({ Runner, ...options }) {
    this.definitions = new Map()
    this.runner = new Runner({
      ...options,
      show: (text, phase) => this.active?.show(text || (phase === 'ready' ? this.active.readyText : '') || '', phase),
      hide: () => this.active?.hide(),
      complete: (snapshot, current) => this.active.complete(snapshot, current),
    })
  }
  register(id, definition) {
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(id) || this.definitions.has(id)) throw new Error('Invalid or duplicate flow')
    for (const handler of ['show', 'hide', 'complete']) {
      if (typeof definition[handler] !== 'function') throw new Error(`Missing flow ${handler}`)
    }
    this.definitions.set(id, definition)
  }
  apply(snapshot) {
    if (snapshot.phase === 'idle') {
      this.runner.apply(snapshot)
      return true
    }
    const id = snapshot.flowId ?? 'research'
    const definition = this.definitions.get(id)
    if (!definition) return false
    if (this.runner.runningHardware && definition !== this.active) return false
    if (definition !== this.active) {
      this.runner.reset()
      this.active = definition
      this.runner.readyMs = definition.readyMs ?? 15000
    }
    this.runner.apply({ ...snapshot, flowId: id })
    return true
  }
}
