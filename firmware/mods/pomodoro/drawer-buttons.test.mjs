import assert from 'node:assert/strict'
import test from 'node:test'
import { PomodoroTimer, pomodoroDrawerButtons } from './timer.js'

test('drawer actions follow timer lifecycle and show remaining time', () => {
  let now = 0
  const timer = new PomodoroTimer({ now: () => now })
  const actions = () => pomodoroDrawerButtons(timer.snapshot())
  assert.deepEqual(
    actions().map((b) => b.key),
    ['joyStart'],
  )
  timer.command('pomodoro')
  now += 60000
  assert.deepEqual(
    actions().map((b) => b.key),
    ['joyPause', 'joyCancel'],
  )
  assert.equal(actions()[0].label, 'Pause')
  assert.ok(actions()[0].subtitle.includes('19:00'))
  timer.command('pause')
  assert.equal(actions()[0].label, 'Resume')
  const subtitle = actions()[0].subtitle
  now += 10000
  assert.equal(actions()[0].subtitle, subtitle)
  timer.command('resume')
  now += 19 * 60000
  timer.tick()
  assert.ok(actions()[0].subtitle.startsWith('Rest'))
  timer.command('cancel')
  assert.deepEqual(
    actions().map((b) => b.key),
    ['joyStart'],
  )
})
