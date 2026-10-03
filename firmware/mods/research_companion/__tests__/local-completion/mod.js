import { announce, COMPLETION_PITCH, findFace } from 'companion-completion'
import { FlowRunner } from 'companion-flow-runner'
import { createStatusCard } from 'research-status-card'
import Timer from 'timer'

const delay = (ms) => new Promise((resolve) => Timer.set(resolve, ms))
async function bounded(action, ms) {
  let timer
  try {
    return await Promise.race([
      action,
      new Promise((_, reject) => {
        timer = Timer.set(() => reject(new Error('test deadline')), ms)
      }),
    ])
  } finally {
    if (timer) Timer.clear(timer)
  }
}
export function onContextCreated(robot) {
  const card = createStatusCard()
  robot.ui.addEffect(card.content, 'local-completion-test')
  const show = (text, phase) => {
    card.content.visible = true
    card.update(text, phase)
  }
  // Intentionally unreachable: this device test must finish without Mac helpers.
  const settings = { host: '127.0.0.1', port: 8787, token: 'offline_local_test' }
  const runner = new FlowRunner({
    show,
    hide: () => {
      card.content.visible = false
      trace('[local-completion-test] CLEARED\n')
    },
    schedule: (fn, ms) => Timer.set(fn, ms),
    cancel: (id) => Timer.clear(id),
    complete: async (_, current) => {
      let searching = true
      try {
        await bounded(robot.motion.setTorque(true), 2000)
        await bounded(robot.motion.setPose({ rotation: { y: 0, p: COMPLETION_PITCH, r: 0 } }, 1.5), 2000)
        await delay(1500)
        try {
          await bounded(
            findFace(robot, settings, () => searching && current(), show),
            11000,
          )
        } finally {
          searching = false
        }
        const spoken = await bounded(announce(robot, settings, current, show), 12000)
        trace(`[local-completion-test] AUDIO ${spoken ? 'PASS' : 'FAIL'}\n`)
      } catch (error) {
        trace(`[local-completion-test] FAIL ${error}\n`)
      } finally {
        try {
          await bounded(robot.motion.setPose({ rotation: { y: 0, p: 0, r: 0 } }, 1.5), 2000)
          await delay(1500)
        } catch {}
        try {
          await bounded(robot.motion.setTorque(false), 2000)
        } catch {}
        trace('[local-completion-test] HARDWARE FINISHED\n')
      }
    },
  })
  show('Local completion test soon', 'gathering')
  Timer.set(() => {
    const state = { serviceId: 'offline-device-test', taskId: 'local-test', text: 'Studying locally' }
    runner.apply({ ...state, phase: 'gathering' })
    Timer.set(() => runner.apply({ ...state, phase: 'ready', text: 'Research ready' }), 3000)
  }, 12000)
}

export function onLaunch() {
  trace('[local-completion-test] LOADED\n')
  return true
}
