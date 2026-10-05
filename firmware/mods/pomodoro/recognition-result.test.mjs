import assert from 'node:assert/strict'
import test from 'node:test'
import { CommandWindow } from './command-window.js'
import { dispatchRecognition } from './recognition-result.js'
import { PomodoroTimer } from './timer.js'

test('native IDs pass through wake authorization to timer state transitions', () => {
  let time = 0
  const timer = new PomodoroTimer({ now: () => time })
  const window = new CommandWindow({ now: () => time, execute: (command) => timer.command(command) })
  assert.equal(dispatchRecognition(window, 1).accepted, false)
  assert.equal(timer.active, false)
  window.wake()
  assert.deepEqual(dispatchRecognition(window, 1), { command: 'pomodoro', accepted: true })
  assert.equal(timer.snapshot().phase, 'focus')
  assert.equal(timer.snapshot().remainingMs, 1200000)
  time += 1000
  window.wake()
  assert.equal(dispatchRecognition(window, 2).accepted, true)
  const paused = timer.snapshot()
  assert.equal(paused.paused, true)
  time += 10000
  assert.deepEqual(timer.snapshot(), paused)
  window.wake()
  assert.equal(dispatchRecognition(window, 3).accepted, true)
  assert.equal(timer.snapshot().paused, false)
  window.wake()
  assert.equal(dispatchRecognition(window, 4).accepted, true)
  assert.equal(timer.active, false)
})

test('unknown, stale, and duplicate results never bypass command authorization', () => {
  let time = 0
  const timer = new PomodoroTimer({ now: () => time })
  const window = new CommandWindow({ now: () => time, execute: (command) => timer.command(command) })
  window.wake()
  for (const id of [-2, -1, 0, 5, 100, 1.5, '1', undefined])
    assert.equal(dispatchRecognition(window, id).accepted, false)
  time = 5000
  assert.equal(dispatchRecognition(window, 1).accepted, false)
  assert.equal(timer.active, false)
  window.wake()
  assert.equal(dispatchRecognition(window, 1).accepted, true)
  assert.equal(dispatchRecognition(window, 4).accepted, false)
  assert.equal(timer.active, true)
})
