import Resource from 'Resource'
import { copyFrameFragment } from 'companion-camera-fragment'
import { cameraFace, orientFrame } from 'companion-frame-orientation'
import { Request } from 'http'
import Modules from 'modules'
import Timer from 'timer'

export const COMPLETION_PITCH = -Math.PI / 4
export const ATTENTION_YAW_LIMIT = Math.PI / 6

export function companionRequest(settings, path, body, binary = false) {
  return new Promise((resolve, reject) => {
    let status = 0
    let done = false
    let request
    let timeout
    let offset = 0
    const finish = (error, value) => {
      if (done) return
      done = true
      if (timeout) Timer.clear(timeout)
      if (error) {
        request?.close()
        reject(error)
      } else resolve(value)
    }
    try {
      request = new Request({
        host: settings.host,
        port: settings.port,
        path,
        method: body ? 'POST' : 'GET',
        body: body ? true : undefined,
        headers: [
          'Authorization',
          `Bearer ${settings.token}`,
          ...(body ? ['Content-Type', 'application/octet-stream', 'Content-Length', String(body.byteLength)] : []),
        ],
        response: binary ? ArrayBuffer : String,
      })
      request.callback = (message, value) => {
        try {
          if (message === Request.requestFragment) {
            if (offset >= body.byteLength) return undefined
            const end = Math.min(body.byteLength, offset + value, offset + 2048)
            const fragment = copyFrameFragment(body, offset, end)
            offset = end
            return fragment
          }
          if (message === Request.status) status = value
          if (message === Request.responseComplete)
            finish(status === 200 ? null : new Error(`Completion HTTP ${status}`), value)
          if (message === Request.error) finish(new Error('Completion connection failed'))
        } catch (error) {
          finish(error)
        }
      }
      timeout = Timer.set(() => finish(new Error('Completion request timed out')), 3000)
    } catch (error) {
      finish(error)
    }
  })
}

function reportStage(settings, stage) {
  companionRequest(settings, `/v1/diagnostics?stage=${stage}`).catch(() => {})
}

export async function findFace(robot, settings, current, show) {
  const deadline = Date.now() + 8000
  let lastX
  let yaw = robot.motion.pose?.body?.rotation?.y ?? 0
  let moved = false
  let detector
  let orientation = 0
  try {
    if (!Modules.has('local-face-detector')) throw new Error('Experimental local detector host required')
    const FaceDetector = Modules.importNow('local-face-detector')
    detector = new FaceDetector()
    reportStage(settings, 'face-start')
    show('Looking for you...', 'finding')
    await robot.camera.start({ width: 176, height: 144, imageType: 'rgb565le' })
    while (current() && Date.now() < deadline) {
      let frame
      let detection
      try {
        frame = await robot.camera.capture({ width: 176, height: 144, imageType: 'rgb565le' })
        if (!frame || !current()) break
        reportStage(settings, 'frame-captured')
        const oriented = orientFrame(frame.buffer, 176, 144, orientation)
        detection = { face: cameraFace(detector.detect(oriented.buffer, oriented.width, oriented.height), orientation) }
        trace(
          `[companion] local face=${JSON.stringify(detection.face)} orientation=${orientation * 90} inferenceMs=${detector.inferenceMs}\n`,
        )
      } finally {
        frame?.close?.()
      }
      if (!current()) break
      const face = detection.face
      if (face && Number.isFinite(face.x) && face.x >= 0 && face.x <= 1 && face.confidence >= 0.5) {
        // Require two consistent detections, then move only horizontally.
        if (lastX !== undefined && Math.abs(lastX - face.x) < 0.15) {
          reportStage(settings, 'face-found')
          if (Math.abs(face.x - 0.5) < 0.12) return moved
          // This CoreS3 camera/servo pairing needs positive yaw for a face to image-right.
          const step = Math.max(-Math.PI / 18, Math.min(Math.PI / 18, (face.x - 0.5) * 0.6))
          const nextYaw = Math.max(-ATTENTION_YAW_LIMIT, Math.min(ATTENTION_YAW_LIMIT, yaw + step))
          if (Math.abs(nextYaw - yaw) < 0.005) return moved
          yaw = nextYaw
          trace(`[companion] attention yaw=${yaw} faceX=${face.x}\n`)
          await robot.motion.setTorque(true)
          if (!current()) break
          reportStage(settings, 'motion-start')
          await robot.motion.setPose({ rotation: { y: yaw, p: COMPLETION_PITCH, r: 0 } }, 0.8)
          moved = true
        }
        lastX = face.x
      } else {
        lastX = undefined
        orientation = (orientation + 1) % 4
      }
      await new Promise((resolve) => Timer.set(resolve, 250))
    }
  } catch (error) {
    trace(`[companion] face search unavailable: ${error}\n`)
  } finally {
    detector?.close()
    await robot.camera.stop()
  }
  return moved
}

export async function announce(robot, settings, current, show) {
  if (!current()) return
  show('Your research note is ready', 'ready')
  try {
    const wav = new Uint8Array(new Resource('research-ready.wav')).slice().buffer
    if (!current()) return
    if (wav.byteLength > 100044) throw new Error('Speech too large')
    reportStage(settings, 'speech-start')
    if (!(await robot.audio.playAudio(wav))) throw new Error('Playback failed')
    reportStage(settings, 'speech-finished')
    return true
  } catch (error) {
    trace(`[companion] speech unavailable: ${error}\n`)
    return false
  }
}
