import { frameStats } from 'camera-frame-stats'
import { pixelVariant } from 'camera-pixel-variants'
import { createCameraPreviewDialog, prepareCameraPreviewFrame } from 'camera-preview'
import { cameraFace, orientFrame } from 'companion-frame-orientation'
import Modules from 'modules'
import Timer from 'timer'

const delay = (ms) => new Promise((resolve) => Timer.set(resolve, ms))
async function bounded(action, ms) {
  let timer
  try {
    return await Promise.race([
      action,
      new Promise((_, reject) => {
        timer = Timer.set(() => reject(new Error('diagnostic deadline')), ms)
      }),
    ])
  } finally {
    if (timer) Timer.clear(timer)
  }
}
export function onLaunch() {
  trace('[camera-diagnostics] LOADED\n')
  return true
}
export function onContextCreated(robot) {
  robot.ui.showBalloon('Camera diagnostics in 8 seconds')
  Timer.set(() => {
    void run(robot)
  }, 8000)
}
async function run(robot) {
  let detector
  try {
    const FaceDetector = Modules.importNow('local-face-detector')
    detector = new FaceDetector()
    for (const [name, pitch] of [['45deg', -Math.PI / 4]]) {
      await bounded(robot.motion.setTorque(true), 2000)
      await bounded(robot.motion.setPose({ rotation: { y: 0, p: pitch, r: 0 } }, 1.5), 2000)
      await delay(1500)
      await bounded(robot.camera.start({ width: 176, height: 144, imageType: 'rgb565le' }), 3000)
      // Consume fresh frames during auto-exposure warm-up.
      for (let i = 0; i < 8; i++) {
        const warm = await bounded(robot.camera.capture({ width: 176, height: 144, imageType: 'rgb565le' }), 2000)
        warm?.close?.()
        await delay(250)
      }
      let frame
      let preview
      try {
        frame = await bounded(robot.camera.capture({ width: 176, height: 144, imageType: 'rgb565le' }), 2000)
        if (!frame) throw new Error('no camera frame')
        trace(
          `[camera-diagnostics] ${name} ${frame.width}x${frame.height} ${frame.imageType} bytes=${frame.buffer.byteLength} stats=${JSON.stringify(frameStats(frame.buffer))}\n`,
        )
        // Copy once, release the native frame, and stop capture before the comparison.
        const copied = pixelVariant(frame.buffer, frame.width, frame.height)
        frame.close?.()
        await robot.camera.stop()
        for (const [color, options] of [
          ['normal', {}],
          ['bytes-swapped', { swapBytes: true }],
          ['red-blue-swapped', { swapRedBlue: true }],
          ['bytes-and-red-blue-swapped', { swapBytes: true, swapRedBlue: true }],
        ]) {
          for (const mirror of [false, true]) {
            const pixels = pixelVariant(copied, frame.width, frame.height, { ...options, mirror })
            for (let turn = 0; turn < 4; turn++) {
              const input = orientFrame(pixels, frame.width, frame.height, turn)
              const face = cameraFace(detector.detect(input.buffer, input.width, input.height), turn)
              trace(
                `[camera-diagnostics] ${name} color=${color} mirror=${mirror} orientation=${turn * 90} face=${JSON.stringify(face)} inferenceMs=${detector.inferenceMs}\n`,
              )
            }
          }
        }
        preview = prepareCameraPreviewFrame({
          width: frame.width,
          height: frame.height,
          imageType: frame.imageType,
          buffer: copied,
        })
      } finally {
        frame?.close?.()
      }
      robot.ui.hideBalloon()
      robot.ui.setMain(
        createCameraPreviewDialog(preview, {
          caption: `${name}: camera snapshot`,
          onRender: (mode) => trace(`[camera-diagnostics] ${name} preview=${mode}\n`),
          onDismiss: () => robot.ui.showFace(),
        }),
      )
      await delay(150)
      await robot.camera.stop()
      trace(`[camera-diagnostics] ${name} preview visible for 25 seconds\n`)
      await delay(25000)
    }
  } catch (error) {
    trace(`[camera-diagnostics] ERROR ${error}\n`)
    robot.ui.showBalloon('Camera diagnostics failed')
  } finally {
    try {
      await robot.camera.stop()
    } catch {}
    detector?.close()
    try {
      await bounded(robot.motion.setPose({ rotation: { y: 0, p: 0, r: 0 } }, 1.5), 2000)
      await delay(1500)
    } catch {}
    try {
      await bounded(robot.motion.setTorque(false), 2000)
    } catch {}
    robot.ui.showFace()
    trace('[camera-diagnostics] FINISHED\n')
  }
}
