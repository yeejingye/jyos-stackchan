import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createChime } from './chime.js'

test('soft cue has valid PCM sizing, silent endpoints, a smooth envelope and headroom', () => {
  const buffer = createChime()
  const view = new DataView(buffer)
  const samples = new Int16Array(buffer, 44)
  assert.equal(view.getUint32(40, true), buffer.byteLength - 44)
  assert.equal(samples.length * 2, view.getUint32(24, true) * 0.16 * 2)
  assert.equal(samples[0], 0)
  assert.equal(samples.at(-1), 0)
  const peak = (values) => Math.max(...Array.from(values, Math.abs))
  assert.ok(peak(samples) < 32767 * 0.2)
  assert.ok(peak(samples.subarray(0, samples.length / 10)) < peak(samples) / 4)
  assert.ok(peak(samples.subarray(samples.length * 0.9)) < peak(samples) / 4)
})
test('cue allocation and frequency stay bounded', () => {
  assert.throws(() => createChime(Infinity))
  assert.throws(() => createChime(440, 100000))
})

test('local greeting is an audible canonical PCM WAV bounded to a short prompt', () => {
  const data = readFileSync(new URL('./assets/wake-ready.wav', import.meta.url))
  assert.equal(data.subarray(0, 4).toString(), 'RIFF')
  assert.equal(data.subarray(8, 12).toString(), 'WAVE')
  assert.equal(data.subarray(36, 40).toString(), 'data')
  assert.equal(data.readUInt32LE(40), data.length - 44)
  const byteRate = data.readUInt32LE(28)
  const seconds = (data.length - 44) / byteRate
  assert.ok(seconds > 1 && seconds < 5)
  let audible = false
  for (let i = 44; i < data.length; i += 2) {
    if (Math.abs(data.readInt16LE(i)) > 1000) {
      audible = true
      break
    }
  }
  assert.ok(audible, 'Speech synthesis must not produce an empty/silent asset')
})
