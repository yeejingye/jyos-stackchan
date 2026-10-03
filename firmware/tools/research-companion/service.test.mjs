import assert from 'node:assert/strict'
import test from 'node:test'
import { createCompanionServer } from './service.mjs'

const token = 'test-token-not-for-production'

async function fixture(t, options = {}) {
  const server = createCompanionServer({ token, serviceId: 'test-service', ...options })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeAllConnections()
      }),
  )
  const url = `http://127.0.0.1:${server.address().port}`
  return (path, options = {}) =>
    fetch(url + path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
    })
}

test('HTTP service authenticates reads and writes and acknowledges duplicate completion once', async (t) => {
  const request = await fixture(t)
  assert.equal((await request('/v1/state', { headers: { Authorization: 'Bearer wrong' } })).status, 401)
  const post = (sequence, phase) =>
    request('/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1, taskId: 'demo', sequence, phase }),
    })
  assert.equal((await post(1, 'gathering')).status, 200)
  assert.equal((await post(2, 'ready')).status, 200)
  assert.equal((await (await post(2, 'ready')).json()).duplicate, true)
  assert.equal((await post(1, 'gathering')).status, 409)
  const state = await (await request('/v1/state')).json()
  assert.equal(state.phase, 'ready')
  assert.equal(state.revision, 2)
})

test('completion endpoints authenticate and bound in-memory face frames', async (t) => {
  const frames = []
  const request = await fixture(t, {
    speech: Buffer.from('wav-fixture'),
    detectFace: async (frame) => {
      frames.push(frame.length)
      return { face: { x: 0.4, confidence: 0.9 } }
    },
  })
  assert.equal((await request('/v1/completion.wav', { headers: { Authorization: 'wrong' } })).status, 401)
  assert.equal(await (await request('/v1/completion.wav')).text(), 'wav-fixture')
  const post = (body) =>
    request('/v1/face', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body })
  assert.equal((await post(Buffer.alloc(2))).status, 400)
  assert.equal((await post(Buffer.alloc(60000))).status, 413)
  assert.equal((await (await post(Buffer.alloc(176 * 144 * 2))).json()).face.x, 0.4)
  assert.deepEqual(frames, [176 * 144 * 2])
  assert.equal((await (await request('/v1/state')).json()).phase, 'idle')
})

test('malformed, oversized, unsupported requests do not mutate service state', async (t) => {
  const request = await fixture(t)
  const post = (body, headers = { 'Content-Type': 'application/json' }) =>
    request('/v1/events', {
      method: 'POST',
      headers,
      body,
    })
  assert.equal((await post('{')).status, 400)
  assert.equal((await post('{}', { 'Content-Type': 'text/plain' })).status, 415)
  assert.equal((await post('x'.repeat(5000))).status, 413)
  assert.equal((await request('/missing')).status, 404)
  assert.equal((await request('/v1/events', { method: 'GET' })).status, 404)
  assert.equal((await (await request('/v1/state')).json()).phase, 'idle')
})
