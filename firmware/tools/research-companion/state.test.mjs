import assert from 'node:assert/strict'
import test from 'node:test'
import { ResearchState, SnapshotCursor } from '../../mods/research_companion/research-status.js'

const event = (sequence, phase, taskId = 'demo') => ({ version: 1, taskId, sequence, phase })

test('persisted state preserves active ownership, completion and retired-task rejection across restart', () => {
  const state = new ResearchState('persistent-service')
  state.accept(event(1, 'gathering'))
  const active = ResearchState.restore(JSON.parse(JSON.stringify(state.serialize())))
  assert.deepEqual(active.snapshot, state.snapshot)
  assert.equal(active.accept(event(2, 'ready')).status, 200)
  const finished = ResearchState.restore(active.serialize())
  assert.equal(finished.accept(event(2, 'ready')).duplicate, true)
  assert.equal(finished.accept(event(1, 'gathering', 'new')).status, 200)
  assert.equal(finished.accept(event(3, 'ready')).status, 409)
  assert.throws(() => ResearchState.restore({ version: 1, snapshot: state.snapshot, tasks: [] }))
  assert.throws(() => ResearchState.restore({ version: 1, snapshot: state.snapshot, tasks: ['demo', 'demo'] }))
})

test('progress and duplicate retries preserve one revision; stale/conflicting events do not mutate state', () => {
  const state = new ResearchState('server-a')
  assert.equal(state.accept(event(1, 'gathering'), 100).status, 200)
  assert.equal(state.accept(event(2, 'comparing'), 200).snapshot.phase, 'comparing')
  const before = { ...state.snapshot }
  assert.equal(state.accept(event(2, 'comparing'), 300).duplicate, true)
  assert.equal(state.accept(event(1, 'gathering')).status, 409)
  assert.equal(state.accept(event(2, 'ready')).status, 409)
  assert.deepEqual(state.snapshot, before)
})

test('one task owns the service until terminal; retired tasks cannot take it over', () => {
  const state = new ResearchState('server-a')
  assert.equal(state.accept(event(2, 'ready')).status, 409)
  state.accept(event(1, 'gathering'))
  assert.equal(state.accept(event(1, 'gathering', 'other')).status, 409)
  state.accept(event(2, 'needs-input'))
  state.accept(event(3, 'drafting'))
  state.accept(event(4, 'ready'))
  assert.equal(state.accept(event(5, 'gathering')).status, 409)
  assert.equal(state.accept(event(1, 'gathering', 'other')).status, 200)
  assert.equal(state.accept(event(5, 'ready')).status, 409)
})

test('invalid input cannot change the snapshot', () => {
  const state = new ResearchState('server-a')
  const before = { ...state.snapshot }
  for (const invalid of [
    null,
    [],
    { ...event(1, 'gathering'), version: 2 },
    event(-1, 'ready'),
    event(1, 'invented'),
    event(1, 'gathering', '../private'),
    { ...event(1, 'gathering'), text: 'x'.repeat(81) },
  ]) {
    assert.equal(state.accept(invalid).status, 400)
    assert.deepEqual(state.snapshot, before)
  }
})

test('robot cursor ignores retries, accepts reconnect state once and detects a service restart', () => {
  const state = new ResearchState('server-a')
  const cursor = new SnapshotCursor()
  assert.equal(cursor.accept(state.snapshot), true)
  state.accept(event(1, 'gathering'))
  state.accept(event(2, 'ready'))
  assert.equal(cursor.accept(state.snapshot), true)
  assert.equal(cursor.accept(state.snapshot), false)
  assert.equal(cursor.accept({ ...state.snapshot, revision: 1 }), false)
  assert.equal(cursor.accept({ ...state.snapshot, phase: 'unknown' }), false)
  assert.equal(cursor.accept(new ResearchState('server-b').snapshot), true)
})

test('session limit does not evict replay protection', () => {
  const state = new ResearchState('server-a')
  for (let i = 0; i < 128; i++) {
    assert.equal(state.accept(event(1, 'gathering', `task-${i}`)).status, 200)
    assert.equal(state.accept(event(2, 'ready', `task-${i}`)).status, 200)
  }
  assert.equal(state.accept(event(1, 'gathering', 'overflow')).status, 409)
  assert.equal(state.accept(event(1, 'gathering', 'task-0')).status, 409)
})
