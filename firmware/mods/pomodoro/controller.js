import Resource from 'Resource'
import { Emotion } from 'face-state'
import { createChime } from 'pomodoro-chime'
import { CommandWindow } from 'pomodoro-command-window'
import { createTimerStrip, createVoiceDebugStrip } from 'pomodoro-presentation'
import { PomodoroTimer, pomodoroDrawerButtons } from 'pomodoro-timer'
import Time from 'time'
import Timer from 'timer'

export function createPomodoro(
  robot,
  { canStart = () => true, onStart = () => {}, onEnd = () => {}, onActivity = () => {} } = {},
) {
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
  const voiceDebug = createVoiceDebugStrip()
  robot.ui.addEffect(voiceDebug.content, 'joy-voice-debug')
  let debugDeadline = 0
  let adapter
  let audio = Promise.resolve()
  let audioDepth = 0
  let releasing = false
  let closed = false
  const window = new CommandWindow({
    now,
    execute: (command) => controller.command(command),
    acknowledge: () => cue(new Resource('wake-ready.wav')),
  })
  const cue = (buffer) => {
    onActivity()
    audioDepth += 1
    adapter?.suspend(true)
    audio = audio
      .then(() => robot.audio.playAudio(buffer))
      .catch((error) => trace(`[pomodoro] chime: ${error}\n`))
      .then(() => {
        audioDepth -= 1
        if (!audioDepth) adapter?.suspend(false)
      })
    return audio
  }
  const chime = (hz) => cue(createChime(hz))
  const render = (events) => {
    for (const event of events) {
      trace(`[pomodoro] ${event}\n`)
      if (event === 'started') onStart()
      if (event === 'rest' || event === 'finished') chime(event === 'rest' ? 523 : 659)
    }
    const snapshot = timer.snapshot()
    strip.update(snapshot)
    if (timer.active)
      robot.face.setEmotion(
        snapshot.paused ? Emotion.NEUTRAL : snapshot.phase === 'focus' ? Emotion.DOUBTFUL : Emotion.HAPPY,
      )
    const buttons = pomodoroDrawerButtons(snapshot)
    const keys = new Set(buttons.map((button) => button.key))
    for (const key of ['joyStart', 'joyPause', 'joyCancel']) {
      if (!keys.has(key)) robot.ui.removeDrawerButton(key)
    }
    for (const button of buttons) robot.ui.addDrawerButton(button)
    if (events.includes('finished') || events.includes('cancelled')) {
      releasing = true
      robot.face.setEmotion(Emotion.NEUTRAL)
      // Return to normal presentation before handing back completion hardware.
      void audio
        .then(() => {
          releasing = false
          if (!closed) onEnd()
        })
        .catch((error) => trace(`[pomodoro] release: ${error}\n`))
    }
  }
  const controller = {
    get active() {
      return timer.active
    },
    get voiceBusy() {
      return audioDepth > 0 || window.listening
    },
    get foreground() {
      return timer.active || releasing
    },
    get snapshot() {
      return timer.snapshot()
    },
    window,
    command(command) {
      onActivity()
      if (command === 'pomodoro' && !timer.active && (releasing || !canStart())) return false
      render(timer.command(command))
      return true
    },
    attachVoice(value) {
      adapter = value
    },
    voiceDebug(message, detail = '') {
      voiceDebug.update(message, detail)
      debugDeadline = now() + 6000
    },
    async suspendCompletion(value) {
      if (value) {
        window.setSuspended(true)
        await audio.catch(() => {})
        adapter?.releaseForCompletion(true)
      } else {
        adapter?.releaseForCompletion(false)
        window.setSuspended(false)
      }
    },
    setMuted(value) {
      window.setMuted(value)
      adapter?.mute(value)
      robot.ui.setDrawerButtonState('joyMute', !value)
    },
    close() {
      closed = true
      window.setMuted(true)
      Timer.clear(ticker)
      adapter?.close()
      adapter = undefined
      robot.ui.removeEffect(strip.content)
      robot.ui.removeEffect(voiceDebug.content)
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
    ...pomodoroDrawerButtons(timer.snapshot()),
    {
      key: 'joyMute',
      label: 'Listening',
      subtitle: 'Hi Joy voice commands',
      group: 'Voice',
      kind: 'toggle',
      active: true,
    },
  ])
    robot.ui.addDrawerButton(button)
  const ticker = Timer.repeat(() => {
    render(timer.tick())
    if (debugDeadline && now() >= debugDeadline) {
      voiceDebug.update('')
      debugDeadline = 0
    }
  }, 250)
  return controller
}
