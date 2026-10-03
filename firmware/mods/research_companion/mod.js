import { announce, companionRequest, findFace } from 'companion-completion'
import { FlowRunner } from 'companion-flow-runner'
import { Emotion } from 'face-state'
import { Request } from 'http'
import config from 'mod/config'
import Preference from 'preference'
import { PRESENTATION, SnapshotCursor, validateSnapshot } from 'research-status'
import { createStatusCard } from 'research-status-card'
import Timer from 'timer'

const POLL_MS = 2000
const TIMEOUT_MS = 3000

export function onContextCreated(robot) {
  const settings = config.researchCompanion ?? {}
  const cursor = new SnapshotCursor()
  let phase = 'idle'
  let observedTask
  const card = createStatusCard()
  card.content.visible = false
  robot.ui.addEffect(card.content, 'research-status')
  let connected = false
  let activeRequest
  let watchdog
  let pulse = false

  const show = (text, emotion, displayPhase = 'setup') => {
    card.content.visible = true
    robot.face.setEmotion(emotion)
    card.update(text, displayPhase)
  }
  const hide = () => {
    card.content.visible = false
    robot.face.setEmotion(Emotion.NEUTRAL)
    robot.face.setEyeOpen('left', 1)
    robot.face.setEyeOpen('right', 1)
    if (runner?.key) void companionRequest(settings, '/v1/diagnostics?stage=cleared').catch(() => {})
  }
  const showPhase = (text, value) => {
    const presentation = PRESENTATION[value] ?? { text: 'Looking for you...', emotion: 'NEUTRAL' }
    show(text || presentation.text, Emotion[presentation.emotion], value)
  }
  let consumed = []
  try {
    consumed = JSON.parse(Preference.get('jyos', 'completed') ?? '[]')
  } catch {}
  if (!Array.isArray(consumed)) consumed = []
  const bounded = (operation, ms) =>
    new Promise((resolve, reject) => {
      const timeout = Timer.set(() => reject(new Error('Hardware operation timed out')), ms)
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
  const runner = new FlowRunner({
    schedule: (callback, ms) => Timer.set(callback, ms),
    cancel: (timer) => Timer.clear(timer),
    show: showPhase,
    hide,
    onError: (error) => trace(`[companion] completion failed: ${error}\n`),
    complete: async (snapshot, current) => {
      if (consumed.includes(snapshot.taskId) || observedTask !== snapshot.taskId) {
        runner.dismiss()
        return
      }
      // Consume before hardware effects: reconnect/reboot must not replay speech.
      consumed = [...consumed.slice(-15), snapshot.taskId]
      Preference.set('jyos', 'completed', JSON.stringify(consumed))
      let active = true
      let attentionActive = true
      const valid = () => active && current()
      try {
        if (settings.faceTracking !== false)
          await bounded(
            findFace(robot, settings, () => attentionActive && valid(), showPhase),
            11000,
          )
      } catch (error) {
        trace(`[companion] attention timeout: ${error}\n`)
      }
      attentionActive = false
      if (valid()) {
        try {
          await bounded(announce(robot, settings, valid, showPhase), 12000)
        } catch (error) {
          trace(`[companion] announcement timeout: ${error}\n`)
        }
      }
      active = false
      if (current()) {
        try {
          await bounded(robot.motion.setPose({ rotation: { y: 0, p: 0, r: 0 } }, 0.8), 2000)
        } catch {}
        try {
          await bounded(robot.motion.setTorque(false), 2000)
        } catch {}
      }
    },
  })
  const offline = (text = 'Mac disconnected') => {
    connected = false
    if (!runner.key || runner.dismissed || runner.completing) return
    robot.face.setEyeOpen('left', 1)
    robot.face.setEyeOpen('right', 1)
    show(text, Emotion.SAD, 'offline')
  }

  if (
    typeof settings.host !== 'string' ||
    !/^[a-zA-Z0-9.-]+$/.test(settings.host) ||
    typeof settings.token !== 'string' ||
    !/^[a-zA-Z0-9_-]{16,128}$/.test(settings.token) ||
    !Number.isInteger(settings.port) ||
    settings.port < 1 ||
    settings.port > 65535
  ) {
    show('Configure companion', Emotion.DOUBTFUL)
    return
  }

  const poll = () => {
    if (activeRequest) return
    let status = 0
    const finish = () => {
      if (watchdog) Timer.clear(watchdog)
      watchdog = undefined
      activeRequest = undefined
    }
    try {
      activeRequest = new Request({
        host: settings.host,
        port: settings.port,
        path: '/v1/state',
        headers: ['Authorization', `Bearer ${settings.token}`, 'X-StackChan-Client', 'robot'],
        response: String,
      })
      activeRequest.callback = (message, value) => {
        if (message === Request.status) {
          status = value
        } else if (message === Request.responseComplete) {
          finish()
          try {
            if (status !== 200 || value.length > 2048) throw new Error('Invalid service response')
            const snapshot = JSON.parse(value)
            if (!validateSnapshot(snapshot)) throw new Error('Invalid snapshot')
            if (snapshot.serviceId === cursor.serviceId && snapshot.revision < cursor.revision) {
              throw new Error('Stale snapshot')
            }
            cursor.accept(snapshot)
            {
              phase = snapshot.phase
              if (!['idle', 'ready', 'failed'].includes(phase)) observedTask = snapshot.taskId
              runner.apply(snapshot)
            }
            connected = true
          } catch {
            offline(status === 401 ? 'Check shared token' : 'Mac disconnected')
          }
        } else if (message === Request.error) {
          finish()
          offline()
        }
      }
      watchdog = Timer.set(() => {
        const request = activeRequest
        finish()
        request?.close()
        offline()
      }, TIMEOUT_MS)
    } catch {
      finish()
      offline()
    }
  }

  void robot.connectivity.network.ready
    .then((result) => {
      if (result.status !== 'connected') {
        show('Configure Wi-Fi', Emotion.DOUBTFUL)
        return
      }
      poll()
      Timer.repeat(poll, POLL_MS)
      // Gentle screen-only study animation; no continuous motor commands.
      Timer.repeat(() => {
        const studying =
          connected && !runner.dismissed && !runner.completing && ['gathering', 'comparing', 'drafting'].includes(phase)
        pulse = !pulse
        robot.face.setEyeOpen('left', studying && pulse ? 0.75 : 1)
        robot.face.setEyeOpen('right', studying && pulse ? 0.75 : 1)
      }, 1800)
    })
    .catch(() => show('Wi-Fi unavailable', Emotion.SAD))
}
