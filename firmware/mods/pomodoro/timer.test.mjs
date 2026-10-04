import assert from 'node:assert/strict'
import test from 'node:test'
import { CommandWindow } from './command-window.js'
import { countdown, PomodoroTimer } from './timer.js'

function fixture() {
  let time = 0
  return { timer: new PomodoroTimer({ now: () => time }), advance: (ms) => (time += ms) }
}
test('one cycle uses elapsed deadlines and returns to normal', () => {
  const { timer, advance } = fixture()
  assert.deepEqual(timer.command('pomodoro'), ['started'])
  advance(1200000 + 4000)
  assert.deepEqual(timer.tick(), ['rest'])
  assert.equal(timer.snapshot().remainingMs, 296000)
  advance(296000)
  assert.deepEqual(timer.tick(), ['finished'])
  assert.equal(timer.active, false)
  assert.deepEqual(timer.tick(), [])
})
test('a delayed tick crosses both boundaries once', () => {
  const { timer, advance } = fixture()
  timer.command('pomodoro')
  advance(1800000)
  assert.deepEqual(timer.tick(), ['rest', 'finished'])
  assert.deepEqual(timer.tick(), [])
})
test('pause and repeat-start preserve phase and remaining time', () => {
  const { timer, advance } = fixture()
  timer.command('pomodoro')
  advance(60000)
  timer.command('pause')
  const saved = timer.snapshot()
  advance(3600000)
  assert.deepEqual(timer.command('pomodoro'), [])
  assert.deepEqual(timer.snapshot(), saved)
  timer.command('resume')
  advance(1140000)
  assert.deepEqual(timer.tick(), ['rest'])
  advance(10000)
  timer.command('pause')
  advance(3600000)
  timer.command('resume')
  assert.equal(timer.snapshot().remainingMs, 290000)
})
test('cancel paused timer and reboot discard state', () => {
  const { timer } = fixture()
  timer.command('pomodoro')
  timer.command('pause')
  assert.deepEqual(timer.command('cancel'), ['cancelled'])
  assert.deepEqual(timer.snapshot(), { phase: 'idle', paused: false, remainingMs: 0 })
  assert.equal(fixture().timer.active, false)
  assert.deepEqual(timer.command('unknown'), [])
  assert.equal(countdown(1), '00:01')
  assert.equal(countdown(1200000), '20:00')
})
test('wake is required, one command per window, unknown speech is harmless', () => {
  let now = 0
  const commands = []
  const window = new CommandWindow({ now: () => now, execute: (c) => commands.push(c) })
  assert.equal(window.command('pomodoro'), false)
  window.wake()
  assert.equal(window.command('hello'), false)
  assert.equal(window.command('pomodoro'), true)
  assert.equal(window.command('cancel'), false)
  window.wake()
  now = 5000
  assert.equal(window.command('pause'), false)
  assert.deepEqual(commands, ['pomodoro'])
})
test('mute and own-audio suspension clear command authorization', () => {
  const window = new CommandWindow({ now: () => 0, execute: () => assert.fail('No command allowed') })
  window.wake()
  window.setMuted(true)
  assert.equal(window.wake(), false)
  window.setMuted(false)
  assert.equal(window.command('pause'), false)
  window.wake()
  window.setSuspended(true)
  assert.equal(window.wake(), false)
  window.setSuspended(false)
  assert.equal(window.command('pause'), false)
})
