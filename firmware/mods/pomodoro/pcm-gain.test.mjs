import assert from 'node:assert/strict'
import test from 'node:test'
import { amplifyPCM } from './pcm-gain.js'

const pcm = (samples) => {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)
  samples.forEach((value, index) => {
    view.setInt16(index * 2, value, true)
  })
  return buffer
}
const samples = (buffer) => {
  const view = new DataView(buffer)
  return Array.from({ length: buffer.byteLength / 2 }, (_, i) => view.getInt16(i * 2, true))
}
test('command gain preserves silence and scales both polarities without clipping quiet input', () => {
  const buffer = pcm([0, 500, -1000, 2000])
  assert.equal(amplifyPCM(buffer, 4), 8000)
  assert.deepEqual(samples(buffer), [0, 2000, -4000, 8000])
})
test('loud PCM saturates rather than wrapping sign; unity leaves input unchanged', () => {
  const buffer = pcm([15000, -15000, 32767, -32768])
  const original = samples(buffer)
  amplifyPCM(buffer)
  assert.deepEqual(samples(buffer), original)
  amplifyPCM(buffer, 4)
  assert.deepEqual(samples(buffer), [32767, -32768, 32767, -32768])
})
test('invalid gain and incomplete samples fail before mutating PCM', () => {
  const buffer = pcm([1000])
  for (const gain of [0, 9, NaN, Infinity]) assert.throws(() => amplifyPCM(buffer, gain), RangeError)
  assert.deepEqual(samples(buffer), [1000])
  assert.throws(() => amplifyPCM(new ArrayBuffer(3), 4), RangeError)
})
