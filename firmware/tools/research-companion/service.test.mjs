import assert from 'node:assert/strict'
import test from 'node:test'
import { createCompanionServer } from './service.mjs'

const token = 'test-token-not-for-production'

test('polls cannot observe an event until persistence has completed', async (t) => {
  let release, entered
  const writing = new Promise((resolve) => {
    entered = resolve
  })
  const request = await fixture(t, {
    saveState: () => {
      entered()
      return new Promise((resolve) => {
        release = resolve
      })
    },
  })
  const pending = request('/v1/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: 1, taskId: 'one', sequence: 1, phase: 'gathering' }),
  })
  await writing
  assert.equal((await (await request('/v1/state')).json()).phase, 'idle')
  release()
  assert.equal((await pending).status, 200)
  assert.equal((await (await request('/v1/state')).json()).phase, 'gathering')
})

test('event persistence precedes acknowledgement; failed writes roll back and retries remain valid', async (t) => {
  let fail = true,
    saved
  const request = await fixture(t, {
    saveState: async (record) => {
      if (fail) throw new Error('disk full')
      saved = record
    },
  })
  const event = { version: 1, taskId: 'persistent', sequence: 1, phase: 'gathering' }
  const post = () =>
    request('/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
  assert.equal((await post()).status, 503)
  assert.equal((await (await request('/v1/state')).json()).phase, 'idle')
  fail = false
  assert.equal((await post()).status, 200)
  const restarted = await fixture(t, { stateRecord: saved })
  assert.equal((await (await restarted('/v1/state')).json()).taskId, 'persistent')
  const result = await restarted('/v1/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, sequence: 2, phase: 'ready' }),
  })
  assert.equal(result.status, 200)
})

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

test('authenticated robot status helps diagnose touch and clock without changing research state', async (t) => {
  const request = await fixture(t)
  assert.equal((await request('/v1/device-status', { headers: { Authorization: 'invalid' } })).status, 401)
  const before = await (await request('/v1/state')).json()
  await request('/v1/state', {
    headers: {
      'X-StackChan-Client': 'robot',
      'X-StackChan-Runtime': JSON.stringify({
        touchPresent: true,
        touchSamples: [0, 1, 0],
        utcMs: 1700000000000,
        timezone: 'tokyo',
        blockedBy: '',
      }),
    },
  })
  const status = await (await request('/v1/device-status')).json()
  assert.equal(status.touchPresent, true)
  assert.deepEqual(status.touchSamples, [0, 1, 0])
  assert.equal(status.timezone, 'tokyo')
  for (const header of ['{', JSON.stringify(['bad']), 'x'.repeat(1025)]) {
    await request('/v1/state', { headers: { 'X-StackChan-Client': 'robot', 'X-StackChan-Runtime': header } })
    assert.deepEqual(await (await request('/v1/device-status')).json(), status)
  }
  assert.deepEqual(await (await request('/v1/state')).json(), before)
})
