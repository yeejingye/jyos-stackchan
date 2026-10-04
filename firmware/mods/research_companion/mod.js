import { ATTENTION_YAW_LIMIT, announce, COMPLETION_PITCH, companionRequest, findFace } from 'companion-completion'
import { CompletionGate } from 'companion-completion-gate'
import { FlowRegistry } from 'companion-flow-registry'
import { FlowRunner } from 'companion-flow-runner'
import { timerFlow } from 'companion-timer-flow'
import { Emotion } from 'face-state'
import { Request } from 'http'
import config from 'mod/config'
import { createPomodoro } from 'pomodoro-controller'
import { DeferredCompletion } from 'pomodoro-deferred-completion'
import { attachLocalVoice } from 'pomodoro-voice-adapter'
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
  let flowId = 'research'
  let expressionRevision = 0
  const card = createStatusCard()
  card.content.visible = false
  robot.ui.addEffect(card.content, 'research-status')
  let connected = false
  let activeRequest
  let watchdog
  let pulse = false
  let pomodoro
  let admittedCompletion

  const show = (text, emotion, displayPhase = 'setup', title) => {
    if (pomodoro?.foreground) return
    expressionRevision += 1
    card.content.visible = true
    robot.face.setEmotion(emotion)
    robot.face.setEyeOpen('left', 1)
    robot.face.setEyeOpen('right', 1)
    card.update(text, displayPhase, title)
  }
  const hide = () => {
    card.content.visible = false
    if (pomodoro?.foreground) return
    robot.face.setEmotion(Emotion.NEUTRAL)
    robot.face.setEyeOpen('left', 1)
    robot.face.setEyeOpen('right', 1)
    if (runner?.key) void companionRequest(settings, '/v1/diagnostics?stage=cleared').catch(() => {})
  }
  const showPhase = (text, value, title) => {
    const presentation = PRESENTATION[value] ?? { text: 'Looking for you...', emotion: 'NEUTRAL' }
    show(text || presentation.text, Emotion[presentation.emotion], value, title)
  }
  const showResearchPhase = (text, value, title) => {
    if (pomodoro?.foreground) return
    showPhase(text, value, title)
    switch (value) {
      case 'confirming':
        robot.face.setEyeOpen('left', 0.84)
        robot.face.setEyeOpen('right', 0.84)
        break
      case 'comparing':
        robot.face.setEyeOpen('left', 0.76)
        robot.face.setEyeOpen('right', 0.94)
        break
      case 'drafting':
        robot.face.setEyeOpen('left', 0.8)
        robot.face.setEyeOpen('right', 0.8)
        break
    }
  }
  let consumed = []
  try {
    consumed = JSON.parse(Preference.get('jyos', 'completed') ?? '[]')
  } catch {}
  if (!Array.isArray(consumed)) consumed = []
  const gate = new CompletionGate({ consumed, save: (ids) => Preference.set('jyos', 'completed', JSON.stringify(ids)) })
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
  const flows = new FlowRegistry({
    Runner: FlowRunner,
    schedule: (callback, ms) => Timer.set(callback, ms),
    cancel: (timer) => Timer.clear(timer),
    onError: (error) => trace(`[companion] completion failed: ${error}\n`),
  })
  const runner = flows.runner
  const register = (id, definition) =>
    flows.register(id, {
      ...definition,
      complete: async (snapshot, current) => {
        const admitted = admittedCompletion === snapshot
        if (admitted) admittedCompletion = undefined
        if (!admitted && !gate.consume(snapshot)) {
          runner.dismiss()
          return
        }
        await pomodoro.suspendCompletion(true)
        try {
          await definition.complete(snapshot, current)
        } finally {
          await pomodoro.suspendCompletion(false)
        }
      },
    })
  register('timer', timerFlow({ show: showPhase, hide }))
  register('research', {
    show: showResearchPhase,
    hide,
    readyText: 'Research note ready for review',
    complete: async (_snapshot, current) => {
      let active = true
      let attentionActive = true
      const valid = () => active && current()
      // Tilt upward first, then start detecting faces once the move has settled.
      try {
        await bounded(robot.motion.setTorque(true), 2000)
        if (valid()) {
          const yaw = robot.motion.pose?.body?.rotation?.y ?? 0
          await bounded(
            robot.motion.setPose(
              {
                rotation: {
                  y: Math.max(-ATTENTION_YAW_LIMIT, Math.min(ATTENTION_YAW_LIMIT, yaw)),
                  p: COMPLETION_PITCH,
                  r: 0,
                },
              },
              1.5,
            ),
            2000,
          )
          await new Promise((resolve) => Timer.set(resolve, 1500))
        }
      } catch (error) {
        trace(`[companion] upward attention pose failed: ${error}\n`)
      }
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
      try {
        await bounded(robot.motion.setPose({ rotation: { y: 0, p: 0, r: 0 } }, 1.5), 2000)
        await new Promise((resolve) => Timer.set(resolve, 1500))
      } catch {}
      try {
        await bounded(robot.motion.setTorque(false), 2000)
      } catch {}
    },
  })
  const deferred = new DeferredCompletion((snapshot) => gate.consume(snapshot))
  pomodoro = createPomodoro(robot, {
    canStart: () => !runner.runningHardware,
    onStart: () => {
      expressionRevision += 1
      runner.reset()
      card.content.visible = false
      robot.face.setEyeOpen('left', 1)
      robot.face.setEyeOpen('right', 1)
    },
    onEnd: () => {
      if (pomodoro.active) return
      const pending = deferred.take()
      if (pending) {
        admittedCompletion = pending
        runner.reset()
        flows.apply(pending)
      }
    },
  })
  if (config.joyVoice?.enabled !== false) attachLocalVoice(robot, pomodoro, config.joyVoice)
  const offline = (text = 'Mac disconnected') => {
    connected = false
    if (pomodoro.foreground) return
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
            phase = snapshot.phase
            flowId = snapshot.flowId ?? 'research'
            gate.observe(snapshot)
            if (pomodoro.foreground) {
              if (snapshot.phase === 'ready' && flowId === 'research') deferred.offer(snapshot)
            } else flows.apply(snapshot)
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
      // The activity marker pulses, and source gathering gets a brief blink every few seconds.
      Timer.repeat(() => {
        const studying =
          !pomodoro.foreground &&
          connected &&
          !runner.dismissed &&
          !runner.completing &&
          ['gathering', 'comparing', 'drafting'].includes(phase)
        pulse = !pulse
        card.setActivity(studying && pulse)
        if (studying && flowId === 'research' && phase === 'gathering' && pulse) {
          const revision = expressionRevision
          robot.face.setEyeOpen('left', 0.12)
          robot.face.setEyeOpen('right', 0.12)
          Timer.set(() => {
            if (
              revision === expressionRevision &&
              !pomodoro.foreground &&
              connected &&
              flowId === 'research' &&
              phase === 'gathering' &&
              !runner.dismissed &&
              !runner.completing
            ) {
              robot.face.setEyeOpen('left', 1)
              robot.face.setEyeOpen('right', 1)
            }
          }, 140)
        }
      }, 1200)
    })
    .catch(() => show('Wi-Fi unavailable', Emotion.SAD))
}
