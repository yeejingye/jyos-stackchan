import { Emotion } from 'face-state'
import { Request } from 'http'
import config from 'mod/config'
import { PRESENTATION, SnapshotCursor, validateSnapshot } from 'research-status'
import Timer from 'timer'

const POLL_MS = 2000
const TIMEOUT_MS = 3000

export function onContextCreated(robot) {
  const settings = config.researchCompanion ?? {}
  const cursor = new SnapshotCursor()
  let phase = 'idle'
  let label = ''
  let connected = false
  let activeRequest
  let watchdog
  let pulse = false

  const show = (text, emotion) => {
    robot.face.setEmotion(emotion)
    if (text !== label) {
      robot.ui.showBalloon(text, { right: 10, top: 10, width: 150 })
      label = text
    }
  }
  const offline = (text = 'Mac disconnected') => {
    connected = false
    robot.face.setEyeOpen('left', 1)
    robot.face.setEyeOpen('right', 1)
    show(text, Emotion.SAD)
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
            const changed = cursor.accept(snapshot)
            if (changed || !connected) {
              phase = snapshot.phase
              const presentation = PRESENTATION[phase]
              show(snapshot.text || presentation.text, Emotion[presentation.emotion])
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

  show('Connecting to Mac', Emotion.NEUTRAL)
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
        const studying = connected && ['gathering', 'comparing', 'drafting'].includes(phase)
        pulse = !pulse
        robot.face.setEyeOpen('left', studying && pulse ? 0.75 : 1)
        robot.face.setEyeOpen('right', studying && pulse ? 0.75 : 1)
      }, 1800)
    })
    .catch(() => show('Wi-Fi unavailable', Emotion.SAD))
}
