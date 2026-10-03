import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { copyFrameFragment } from '../../mods/research_companion/camera-fragment.js'
import { FlowRunner } from '../../mods/research_companion/flow-runner.js'
import { canonicalWav } from './completion.mjs'

test('upload copies buffer bytes without relying on a buffer slice method', () => {
  const buffer = new ArrayBuffer(6)
  new Uint8Array(buffer).set([1, 2, 3, 4, 5, 6])
  buffer.slice = undefined
  const fragment = copyFrameFragment(buffer, 1, 4)
  assert.deepEqual([...new Uint8Array(fragment)], [2, 3, 4])
  new Uint8Array(buffer)[1] = 99
  assert.equal(new Uint8Array(fragment)[0], 2)
})

const snapshot = (phase, taskId = 'one') => ({ serviceId: 'service', taskId, phase, text: 'status' })
function fixture(complete = async () => {}) {
  const visible = []
  const timers = new Map()
  let counter = 0
  const runner = new FlowRunner({
    show: (text, phase) => visible.push([text, phase]),
    hide: () => visible.push(['hidden']),
    complete,
    schedule: (callback) => {
      timers.set(++counter, callback)
      return counter
    },
    cancel: (key) => timers.delete(key),
  })
  return { runner, visible, timers }
}
const flush = () => new Promise((resolve) => setImmediate(resolve))

test('completion runs once, waits for hardware, expires and stays hidden on duplicate polls', async () => {
  let finish
  let calls = 0
  const f = fixture(() => {
    calls++
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  f.runner.apply(snapshot('gathering'))
  f.runner.apply(snapshot('ready'))
  f.runner.apply(snapshot('ready'))
  await flush()
  assert.equal(calls, 1)
  assert.equal(f.timers.size, 0)
  finish()
  await flush()
  assert.equal(f.visible.at(-1)[1], 'ready')
  assert.equal(f.timers.size, 1)
  Array.from(f.timers.values())[0]()
  f.runner.apply(snapshot('ready'))
  assert.deepEqual(f.visible.at(-1), ['hidden'])
  assert.equal(calls, 1)
})

test('a newer flow waits for hardware ownership and then replaces the ready presentation', async () => {
  let finish
  const f = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  f.runner.apply(snapshot('ready'))
  await flush()
  f.runner.apply(snapshot('gathering', 'two'))
  assert.equal(f.runner.key, 'service:one')
  finish()
  await flush()
  f.runner.apply(snapshot('gathering', 'two'))
  assert.equal(f.visible.at(-1)[1], 'gathering')
  assert.equal(f.timers.size, 0)
})

test('completion failure still reaches visible ready and cleanup', async () => {
  const f = fixture(async () => {
    throw new Error('camera unavailable')
  })
  f.runner.apply(snapshot('ready'))
  await flush()
  assert.equal(f.visible.at(-1)[1], 'ready')
  assert.equal(f.timers.size, 1)
})

test('consumed completion can suppress presentation and idle cancels timers', async () => {
  const f = fixture(() => f.runner.dismiss())
  f.runner.apply(snapshot('ready'))
  await flush()
  assert.deepEqual(f.visible.at(-1), ['hidden'])
  assert.equal(f.timers.size, 0)
  f.runner.apply(snapshot('failed', 'two'))
  assert.equal(f.timers.size, 1)
  f.runner.apply({ phase: 'idle' })
  assert.equal(f.timers.size, 0)
})

test('WAV conversion preserves PCM across extra padded metadata chunks', () => {
  const fmt = Buffer.alloc(16)
  fmt.writeUInt16LE(1, 0)
  fmt.writeUInt16LE(1, 2)
  fmt.writeUInt32LE(8000, 4)
  fmt.writeUInt32LE(16000, 8)
  fmt.writeUInt16LE(2, 12)
  fmt.writeUInt16LE(16, 14)
  const chunk = (name, data) => {
    const header = Buffer.alloc(8)
    header.write(name)
    header.writeUInt32LE(data.length, 4)
    return Buffer.concat([header, data, Buffer.alloc(data.length & 1)])
  }
  const pcm = Buffer.from([0, 0, 255, 127])
  const body = Buffer.concat([chunk('JUNK', Buffer.from([1])), chunk('fmt ', fmt), chunk('data', pcm)])
  const header = Buffer.alloc(12)
  header.write('RIFF')
  header.writeUInt32LE(body.length + 4, 4)
  header.write('WAVE', 8)
  const canonical = canonicalWav(Buffer.concat([header, body]))
  assert.equal(canonical.length, 48)
  assert.deepEqual(canonical.subarray(44), pcm)
  assert.equal(canonical.readUInt32LE(4), 40)
  assert.throws(() => canonicalWav(Buffer.from('invalid')), /Expected WAV/)
})

test('bundled completion WAV has a canonical PCM header and a bounded aligned payload', () => {
  const wav = readFileSync(new URL('../../mods/research_companion/assets/research-ready.wav', import.meta.url))
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF')
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE')
  assert.equal(wav.toString('ascii', 12, 16), 'fmt ')
  assert.equal(wav.readUInt32LE(16), 16)
  assert.equal(wav.readUInt16LE(20), 1)
  assert.equal(wav.readUInt16LE(22), 1)
  assert.equal(wav.readUInt16LE(34), 16)
  assert.equal(wav.toString('ascii', 36, 40), 'data')
  assert.equal(wav.readUInt32LE(4) + 8, wav.length)
  assert.equal(wav.readUInt32LE(40) + 44, wav.length)
  assert.equal(wav.readUInt32LE(40) % wav.readUInt16LE(32), 0)
  assert.ok(wav.length > 44 && wav.length <= 100044)
})
