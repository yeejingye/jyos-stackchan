import { DeskCompanion } from 'desk-companion-controller'
import { Emoticon } from 'effects/emoticon'
import { Emotion } from 'face-state'
import Preference from 'preference'
import Time from 'time'
import Timer from 'timer'

export function createDeskCompanion(robot, busy) {
  let previous = Time.ticks >>> 0
  let elapsed = 0
  const now = () => {
    const ticks = Time.ticks >>> 0
    elapsed += (ticks - previous) >>> 0
    previous = ticks
    return elapsed
  }
  const bounded = (operation) =>
    new Promise((resolve, reject) => {
      const timeout = Timer.set(() => reject(new Error('Desk motion timed out')), 2000)
      Promise.resolve(operation).then(
        (value) => {
          Timer.clear(timeout)
          resolve(value)
        },
        (error) => {
          Timer.clear(timeout)
          reject(error)
        },
      )
    })
  let heart
  const desk = new DeskCompanion({
    now,
    motion: {
      setTorque: (value) => bounded(robot.motion.setTorque(value)),
      setPose: (pose, seconds) => bounded(robot.motion.setPose(pose, seconds)),
    },
    delay: (ms) => new Promise((resolve) => Timer.set(resolve, ms)),
    busy,
    onPetting: (active) => {
      if (heart) robot.ui.removeEffect(heart)
      heart = undefined
      if (active) {
        robot.face.setEmotion(Emotion.HAPPY)
        heart = new Emoticon({ key: 'heart', name: 'desk-petting' })
        robot.ui.addEffect(heart, 'desk-petting')
      } else if (!busy()) robot.face.setEmotion(Emotion.NEUTRAL)
    },
    onError: (error) => trace(`[desk-companion] ${error}\n`),
  })
  robot.ui.bindDrawerAction('deskLook', () => desk.look())
  robot.ui.bindDrawerAction('deskPause', () => {
    void desk.setPaused(!desk.paused)
    robot.ui.setDrawerButtonState('deskPause', !desk.paused)
  })
  robot.ui.addDrawerButton({ key: 'deskLook', label: 'Look around', group: 'Desk companion', tone: 'accent' })
  robot.ui.addDrawerButton({
    key: 'deskPause',
    label: 'Auto look-around',
    subtitle: 'After 15 minutes idle',
    group: 'Desk companion',
    kind: 'toggle',
    active: true,
  })
  desk.touchEvents = 0
  robot.touchPanel?.subscribe((event) => {
    desk.lastGesture = event.gesture
    desk.touchEvents += 1
    void desk.touch(event.gesture)
  })
  let diagnosticsVisible = false
  const showDiagnostics = () => {
    if (!diagnosticsVisible) return
    const panel = robot.touchPanel
    const sample = panel ? [...panel.sample].join(' ') : 'missing'
    const clock = new Date()
    robot.ui.showBalloon(
      `Touch: ${panel ? 'ready' : 'missing'} / ${sample}\nGesture: ${desk.lastGesture ?? 'none'} (${desk.touchEvents})\nBlocked: ${busy() || 'no'}\nTime: ${clock.toTimeString().slice(0, 8)}\nZone: ${Preference.get('time', 'timezone') ?? 'configured default'}`,
    )
  }
  robot.ui.bindDrawerAction('deskStatus', () => {
    diagnosticsVisible = !diagnosticsVisible
    robot.ui.setDrawerButtonState('deskStatus', diagnosticsVisible)
    if (!diagnosticsVisible) robot.ui.hideBalloon()
    else showDiagnostics()
  })
  robot.ui.addDrawerButton({ key: 'deskStatus', label: 'Touch & clock status', kind: 'toggle' })
  Timer.repeat(() => {
    void desk.tick()
    showDiagnostics()
  }, 1000)
  return desk
}
