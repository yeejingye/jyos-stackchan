import assert from 'node:assert/strict'
import test from 'node:test'
import { CompletionGate } from '../../mods/research_companion/completion-gate.js'

const active = (taskId = 'one', flowId = 'research') => ({ taskId, flowId, phase: 'gathering' })
const ready = (taskId = 'one', flowId = 'research') => ({ taskId, flowId, phase: 'ready' })

test('completion requires observed activity and persistent consumption prevents reconnect/reboot replay for all flows', () => {
  let saved
  const gate = new CompletionGate({
    save: (ids) => {
      saved = ids
    },
  })
  assert.equal(gate.consume(ready(), 100), false)
  gate.observe(active(), 100)
  assert.equal(gate.consume(ready(), 101), true)
  assert.equal(gate.consume(ready(), 102), false)
  const rebooted = new CompletionGate({ consumed: saved })
  rebooted.observe(active(), 103)
  assert.equal(rebooted.consume(ready(), 104), false)
  rebooted.observe(active('two', 'timer'), 105)
  assert.equal(rebooted.consume(ready('two', 'timer'), 106), true)
  assert.equal(rebooted.consume(ready('two', 'timer'), 107), false)
})

test('offline expiry, idle and a different flow cannot revive a pending completion', () => {
  const gate = new CompletionGate({ offlineExpiryMs: 1000 })
  gate.observe(active(), 100)
  assert.equal(gate.consume(ready(), 1101), false)
  gate.observe(active(), 1200)
  assert.equal(gate.consume(ready('one', 'timer'), 1201), false)
  gate.observe({ phase: 'idle' }, 1202)
  assert.equal(gate.consume(ready(), 1203), false)
})

test('consumption stays bounded, preserves legacy task IDs and does not authorize effects when persistence fails', () => {
  const gate = new CompletionGate({ consumed: ['legacy'] })
  gate.observe(active('legacy'), 0)
  assert.equal(gate.consume(ready('legacy'), 1), false)
  for (let i = 0; i < 30; i++) {
    gate.observe(active(`task${i}`), i)
    assert.equal(gate.consume(ready(`task${i}`), i), true)
  }
  assert.equal(gate.consumed.length, 16)
  const broken = new CompletionGate({
    save: () => {
      throw new Error('storage failed')
    },
  })
  broken.observe(active(), 0)
  assert.throws(() => broken.consume(ready(), 1), /storage failed/)
  assert.equal(broken.consumed.length, 0)
})
