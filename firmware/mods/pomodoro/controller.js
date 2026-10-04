import { Emotion } from 'face-state'
import { CommandWindow } from 'pomodoro-command-window'
import { createTimerStrip } from 'pomodoro-presentation'
import { PomodoroTimer } from 'pomodoro-timer'
import Time from 'time'
import Timer from 'timer'

export function createPomodoro(robot, { canStart = () => true, onStart = () => {}, onEnd = () => {} } = {}) {
  // Accumulate unsigned tick deltas so the 32-bit platform counter can wrap safely.
  let previous = Time.ticks >>> 0
  let elapsed = 0
  const now = () => {
    const current = Time.ticks >>> 0
    elapsed += (current - previous) >>> 0
    previous = current
    return elapsed
  }
  const timer = new PomodoroTimer({ now })
  const strip = createTimerStrip()
  robot.ui.addEffect(strip.content, 'pomodoro')
  let adapter
  let audio = Promise.resolve()
  let audioDepth = 0
  const window = new CommandWindow({
    now,
    execute: (command) => controller.command(command),
    acknowledge: () => chime(880),
  })
  const chime = (hz) => {
    audioDepth += 1
    adapter?.suspend(true)
    audio = audio
      .then(() => robot.audio.tone(hz, 120, 0.2))
      .catch((error) => trace(`[pomodoro] chime: ${error}\n`))
      .then(() => {
        audioDepth -= 1
        if (!audioDepth) adapter?.suspend(false)
      })
  }
  const render = (events) => {
    for (const event of events) {
      trace(`[pomodoro] ${event}\n`)
      if (event === 'started') onStart()
      if (event === 'rest' || event === 'finished') chime(event === 'rest' ? 660 : 880)
    }
    const snapshot = timer.snapshot()
    strip.update(snapshot)
    if (timer.active)
      robot.face.setEmotion(
        snapshot.paused ? Emotion.NEUTRAL : snapshot.phase === 'focus' ? Emotion.DOUBTFUL : Emotion.HAPPY,
      )
    robot.ui.setDrawerButtonState('joyPause', snapshot.paused)
    if (events.includes('finished') || events.includes('cancelled')) {
      robot.face.setEmotion(Emotion.NEUTRAL)
      // Return to normal presentation before handing back completion hardware.
      void audio.then(onEnd).catch((error) => trace(`[pomodoro] release: ${error}\n`))
    }
  }
  const controller = {
    get active() {
      return timer.active
    },
    get snapshot() {
      return timer.snapshot()
    },
    window,
    command(command) {
      if (command === 'pomodoro' && !timer.active && !canStart()) return false
      render(timer.command(command))
      return true
    },
    attachVoice(value) {
      adapter = value
    },
    setMuted(value) {
      window.setMuted(value)
      adapter?.mute(value)
      robot.ui.setDrawerButtonState('joyMute', value)
    },
    close() {
      Timer.clear(ticker)
      adapter?.close()
      robot.ui.removeEffect('pomodoro')
      for (const key of ['joyStart', 'joyPause', 'joyCancel', 'joyMute']) {
        robot.ui.removeDrawerButton(key)
        robot.ui.unbindDrawerAction(key)
      }
    },
  }
  robot.ui.bindDrawerAction('joyStart', () => controller.command('pomodoro'))
  robot.ui.bindDrawerAction('joyPause', () => controller.command(timer.paused ? 'resume' : 'pause'))
  robot.ui.bindDrawerAction('joyCancel', () => controller.command('cancel'))
  robot.ui.bindDrawerAction('joyMute', () => controller.setMuted(!window.muted))
  for (const button of [
    { key: 'joyStart', label: 'Pomodoro' },
    { key: 'joyPause', label: 'Pause / resume', kind: 'toggle' },
    { key: 'joyCancel', label: 'Cancel timer' },
    { key: 'joyMute', label: 'Mute Hi Joy', kind: 'toggle' },
  ])
    robot.ui.addDrawerButton(button)
  const ticker = Timer.repeat(() => render(timer.tick()), 250)
  return controller
}
