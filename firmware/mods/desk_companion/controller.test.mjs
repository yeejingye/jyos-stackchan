import assert from 'node:assert/strict'
import test from 'node:test'
import { DeskCompanion, PettingGesture } from './controller.js'

function fixture() {
  let time = 0
  let busy = false
  const calls = []
  const waits = []
  const poses = []
  const holds = []
  const reactions = []
  const desk = new DeskCompanion({
    now: () => time,
    busy: () => busy,
    onPetting: (active) => reactions.push(active),
    motion: {
      async setTorque(value) {
        calls.push(['torque', value])
      },
      async setPose(pose) {
        calls.push(['yaw', pose.rotation.y])
        poses.push(pose.rotation)
      },
    },
    delay: (ms) => {
      holds.push(ms)
      return new Promise((resolve) =>
        waits.push(() => {
          time += ms
          resolve()
        }),
      )
    },
  })
  return {
    desk,
    calls,
    poses,
    holds,
    reactions,
    advance: (ms) => {
      time += ms
    },
    busy: (value) => {
      busy = value
    },
    async step() {
      for (let i = 0; i < 8; i++) await Promise.resolve()
    },
    async finish() {
      while (desk.running) {
        for (let i = 0; i < 8; i++) await Promise.resolve()
        waits.shift()?.()
      }
    },
  }
}
test('idle deadline resets on activity and completion; one sweep owns hardware', async () => {
  const f = fixture()
  f.advance(14 * 60 * 1000)
  await f.desk.tick()
  assert.equal(f.calls.length, 0)
  await f.desk.activity()
  f.advance(14 * 60 * 1000)
  await f.desk.tick()
  assert.equal(f.calls.length, 0)
  f.advance(60 * 1000)
  const pending = f.desk.tick()
  assert.equal(f.desk.running, true)
  assert.equal(f.desk.look(), pending)
  await f.finish()
  await pending
  assert.deepEqual(f.calls, [
    ['torque', true],
    ['yaw', 0.15],
    ['yaw', -0.15],
    ['yaw', 0.12],
    ['yaw', -0.12],
    ['yaw', 0],
    ['torque', false],
  ])
  assert.equal(f.poses.length, 5)
  for (const hold of f.holds.slice(0, -1)) assert.ok(hold >= 2000, 'each turn settles before the next movement')
  const sweeps = f.poses.slice(0, -1)
  for (const pose of sweeps) {
    const upwardDegrees = (-pose.p * 180) / Math.PI
    assert.ok(upwardDegrees >= 30 && upwardDegrees <= 45)
    assert.equal(pose.r, 0)
  }
  assert.equal(sweeps[0].p, sweeps[1].p)
  assert.deepEqual(f.poses.at(-1), { y: 0, p: 0, r: 0 })
  await f.desk.tick()
  assert.equal(f.calls.length, 7)
})
test('foreground activity suppresses idle and manual triggers; pause resets deadline', async () => {
  const f = fixture()
  f.advance(900000)
  f.busy(true)
  await f.desk.tick()
  await f.desk.look()
  assert.equal(f.calls.length, 0)
  f.busy(false)
  await f.desk.setPaused(true)
  f.advance(900000)
  await f.desk.tick()
  await f.desk.look()
  assert.equal(f.calls.length, 0)
  await f.desk.setPaused(false)
  await f.desk.tick()
  assert.equal(f.calls.length, 0)
})
test('interruption skips remaining turns but waits for neutral and torque release', async () => {
  const f = fixture()
  f.desk.look()
  await f.step()
  const stopped = f.desk.activity()
  assert.equal(f.desk.running, true)
  await f.finish()
  await stopped
  assert.deepEqual(f.calls, [
    ['torque', true],
    ['yaw', 0.15],
    ['yaw', 0],
    ['torque', false],
  ])
  assert.deepEqual(f.poses.at(-1), { y: 0, p: 0, r: 0 })
})
test('motor failure still returns neutral and releases torque', async () => {
  const calls = []
  const desk = new DeskCompanion({
    now: () => 0,
    delay: async () => {},
    motion: {
      async setTorque(value) {
        calls.push(value)
        if (value) throw new Error('motor')
      },
      async setPose(pose) {
        calls.push(pose.rotation.y)
      },
    },
  })
  await desk.look()
  assert.deepEqual(calls, [true, 0, false])
  assert.equal(desk.running, false)
})

test('petting requires a recent alternating swipe pair, rather than isolated taps', () => {
  const gesture = new PettingGesture()
  assert.equal(gesture.observe('tap', 0), false)
  assert.equal(gesture.observe('forwardSwipe', 0), false)
  assert.equal(gesture.observe('forwardSwipe', 100), false)
  assert.equal(gesture.observe('backwardSwipe', 1700), false)
  assert.equal(gesture.observe('forwardSwipe', 1800), true)
  assert.equal(gesture.observe('backwardSwipe', 1850), false)
})
test('petting restores a happy reaction and raised head shake even with automatic desk mode off', async () => {
  const f = fixture()
  await f.desk.setPaused(true)
  await f.desk.touch('forwardSwipe')
  f.advance(100)
  const reaction = f.desk.touch('backwardSwipe')
  await f.finish()
  await reaction
  assert.deepEqual(f.reactions, [true, false])
  assert.deepEqual(
    f.calls.map((call) => call[1]),
    [true, 0.2, -0.2, 0.11, 0, 0, false],
  )
  assert.ok(f.holds.reduce((sum, value) => sum + value, 0) >= 5000)
  assert.deepEqual(f.poses.at(-1), { y: 0, p: 0, r: 0 })
})
test('foreground work suppresses petting and interrupts an existing reaction safely', async () => {
  const f = fixture()
  f.busy(true)
  await f.desk.touch('forwardSwipe')
  await f.desk.touch('backwardSwipe')
  assert.deepEqual(f.reactions, [])
  f.busy(false)
  await f.desk.touch('forwardSwipe')
  const reaction = f.desk.touch('backwardSwipe')
  await f.step()
  f.busy(true)
  const stopped = f.desk.activity()
  await f.finish()
  await Promise.all([reaction, stopped])
  assert.deepEqual(f.reactions, [true, false])
  assert.deepEqual(f.calls.at(-1), ['torque', false])
  assert.deepEqual(f.poses.at(-1), { y: 0, p: 0, r: 0 })
})
test('petting during a sweep waits for its cleanup before taking hardware', async () => {
  const f = fixture()
  f.desk.look()
  await f.step()
  await f.desk.touch('forwardSwipe')
  const reaction = f.desk.touch('backwardSwipe')
  await f.finish()
  await reaction
  assert.deepEqual(f.reactions, [true, false])
  const release = f.calls.findIndex((call) => call[0] === 'torque' && call[1] === false)
  assert.equal(f.calls[release + 1][0], 'torque')
  assert.equal(f.calls[release + 1][1], true)
})

test('stroke detection stays live through an automatic sweep and reacts before hardware handover', async () => {
  const f = fixture()
  f.advance(15 * 60 * 1000)
  f.desk.tick()
  await f.step()
  const generation = f.desk.generation
  await f.desk.touch('forwardSwipe')
  assert.equal(f.desk.generation, generation, 'one swipe does not cancel the automatic sweep')
  f.advance(100)
  const reaction = f.desk.touch('backwardSwipe')
  assert.deepEqual(f.reactions, [true], 'happy feedback appears immediately, while sweep still owns motors')
  await f.step()
  assert.deepEqual(f.poses.at(-1), { y: 0, p: 0, r: 0 }, 'sweep leaves its long hold immediately and starts cleanup')
  await f.finish()
  await reaction
  assert.deepEqual(f.reactions, [true, false])
  const release = f.calls.findIndex((call) => call[0] === 'torque' && call[1] === false)
  assert.deepEqual(f.calls[release + 1], ['torque', true], 'petting waits until sweep cleanup releases hardware')
  await f.desk.tick()
  const completedCalls = f.calls.length
  f.advance(15 * 60 * 1000 - 1)
  await f.desk.tick()
  assert.equal(f.calls.length, completedCalls)
  f.advance(1)
  const nextSweep = f.desk.tick()
  await f.finish()
  await nextSweep
  assert.equal(f.calls.length, completedCalls + 7, 'automatic look-around remains enabled after petting')
})
