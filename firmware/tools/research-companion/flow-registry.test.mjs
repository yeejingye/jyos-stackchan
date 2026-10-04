import assert from 'node:assert/strict'
import test from 'node:test'
import { FlowRegistry } from '../../mods/research_companion/flow-registry.js'
import { FlowRunner } from '../../mods/research_companion/flow-runner.js'
import { ResearchState } from '../../mods/research_companion/research-status.js'
import { timerFlow } from '../../mods/research_companion/timer-flow.js'

const flush = () => new Promise((resolve) => setImmediate(resolve))
test('registered timer flow reuses lifecycle, clears once and never invokes research hardware', async () => {
  const shown = [],
    timers = new Map()
  let hardware = 0,
    hidden = 0
  const registry = new FlowRegistry({
    Runner: FlowRunner,
    schedule: (fn, ms) => {
      timers.set(ms, fn)
      return ms
    },
    cancel: (id) => timers.delete(id),
  })
  registry.register('research', {
    show: () => {},
    hide: () => {},
    complete: async () => {
      hardware++
    },
  })
  registry.register(
    'timer',
    timerFlow({
      show: (...args) => shown.push(args),
      hide: () => {
        hidden++
      },
    }),
  )
  const state = { serviceId: 'service', flowId: 'timer', taskId: 'one' }
  registry.apply({ ...state, phase: 'gathering', text: 'Timer running' })
  registry.apply({ ...state, phase: 'ready', text: '' })
  await flush()
  assert.equal(shown.at(-1)[2], 'Timer finished')
  assert.equal(shown.at(-1)[0], 'Your timer has finished')
  assert.equal(hardware, 0)
  assert.equal(timers.size, 1)
  const before = hidden
  timers.get(5000)()
  registry.apply({ ...state, phase: 'ready' })
  assert.equal(hidden, before + 1)
  assert.equal(registry.apply({ ...state, flowId: 'unknown' }), false)
})

test('cancelled flow keeps hardware ownership until cleanup finishes before another definition can run', async () => {
  let finish,
    current,
    timerCalls = 0
  const registry = new FlowRegistry({ Runner: FlowRunner, schedule: () => 1, cancel: () => {} })
  registry.register('research', {
    show: () => {},
    hide: () => {},
    complete: (_, valid) => {
      current = valid
      return new Promise((resolve) => {
        finish = resolve
      })
    },
  })
  registry.register('timer', {
    show: () => {},
    hide: () => {},
    complete: async () => {
      timerCalls++
    },
  })
  registry.apply({ serviceId: 's', taskId: 'one', phase: 'ready' })
  await flush()
  registry.apply({ phase: 'idle' })
  assert.equal(current(), false)
  assert.equal(registry.apply({ serviceId: 's', flowId: 'timer', taskId: 'one', phase: 'ready' }), false)
  assert.equal(timerCalls, 0)
  finish()
  await flush()
  registry.apply({ serviceId: 's', flowId: 'timer', taskId: 'one', phase: 'ready' })
  await flush()
  assert.equal(timerCalls, 1)
})

test('protocol prevents changing a task flow and preserves legacy research events', () => {
  const state = new ResearchState('s')
  assert.equal(state.accept({ version: 1, taskId: 'one', sequence: 1, phase: 'gathering' }).snapshot.flowId, 'research')
  assert.equal(state.accept({ version: 1, flowId: 'timer', taskId: 'one', sequence: 2, phase: 'ready' }).status, 409)
  assert.equal(state.accept({ version: 1, flowId: '../bad', taskId: 'one', sequence: 2, phase: 'ready' }).status, 400)
})
