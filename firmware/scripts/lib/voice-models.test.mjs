import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { validateVoiceModels } from './voice-models.mjs'

function fixture() {
  const payload = Buffer.from('model coefficients')
  const data = Buffer.alloc(80 + payload.length)
  data.writeUInt32LE(1, 0)
  data.write('test-model', 4)
  data.writeUInt32LE(1, 36)
  data.write('weights', 40)
  data.writeUInt32LE(80, 72)
  data.writeUInt32LE(payload.length, 76)
  payload.copy(data, 80)
  const catalog = {
    models: [
      { name: 'test-model', files: [{ name: 'weights', sha256: createHash('sha256').update(payload).digest('hex') }] },
    ],
  }
  return { data, catalog }
}
test('valid resource has complete bounded payloads matching the independent catalog', () => {
  const { data, catalog } = fixture()
  assert.equal(validateVoiceModels(data, catalog), true)
})
test('bad counts, duplicates, corrupt data and native out-of-bounds indexes fail validation', () => {
  for (const change of [
    (data) => data.writeUInt32LE(2, 0),
    (data) => data.writeUInt32LE(0xffffffff, 72),
    (data) => data.writeUInt32LE(0xffffffff, 76),
    (data) => {
      data[80] ^= 1
    },
  ]) {
    const { data, catalog } = fixture()
    change(data)
    assert.throws(() => validateVoiceModels(data, catalog))
  }
  const { data, catalog } = fixture()
  assert.throws(() => validateVoiceModels(data.subarray(0, 39), catalog))
  assert.throws(() => validateVoiceModels(Buffer.concat([data, Buffer.from([0])]), catalog))
})
