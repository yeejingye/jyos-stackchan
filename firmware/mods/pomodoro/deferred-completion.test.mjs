import assert from 'node:assert/strict'
import test from 'node:test'
import { CompletionGate } from '../research_companion/completion-gate.js'
import { DeferredCompletion } from './deferred-completion.js'

test('eligible completion survives a long pause but is released once and never across reboot', () => {
  let now = 0
  let persisted = []
  const gate = new CompletionGate({ save: (ids) => (persisted = ids) })
  const queue = new DeferredCompletion((snapshot) => gate.consume(snapshot, now))
  const snapshot = { taskId: 'a', flowId: 'research', phase: 'gathering' }
  gate.observe(snapshot, now)
  const ready = { ...snapshot, phase: 'ready' }
  assert.equal(queue.offer(ready), true)
  now += 3600000
  assert.equal(queue.offer(ready), false)
  assert.equal(queue.take(), ready)
  assert.equal(queue.take(), undefined)
  const rebootGate = new CompletionGate({ consumed: persisted })
  rebootGate.observe(snapshot, now)
  assert.equal(rebootGate.consume(ready, now), false)
  assert.equal(new DeferredCompletion(() => true).take(), undefined)
})
test('only latest eligible completion remains; a rejected notice cannot replace it', () => {
  const queue = new DeferredCompletion((snapshot) => snapshot.valid)
  queue.offer({ taskId: 'a', valid: true })
  queue.offer({ taskId: 'b', valid: true })
  queue.offer({ taskId: 'c', valid: false })
  assert.equal(queue.take().taskId, 'b')
})
