import { copyFrameFragment } from 'companion-camera-fragment'
import { Request } from 'http'
import Timer from 'timer'

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

export async function findFace(robot, settings, current, show) {
  const deadline = Date.now() + 8000
  let lastX
  let yaw = robot.motion.pose?.rotation?.y ?? 0
  let moved = false
  try {
    await companionRequest(settings, '/v1/diagnostics?stage=face-start')
    show('Looking for you...', 'finding')
    await robot.camera.start({ width: 176, height: 144, imageType: 'rgb565le' })
    while (current() && Date.now() < deadline) {
      let frame
      let detection
      try {
        frame = await robot.camera.capture({ width: 176, height: 144, imageType: 'rgb565le' })
        if (!frame || !current()) break
        await companionRequest(settings, '/v1/diagnostics?stage=frame-captured')
        detection = JSON.parse(await companionRequest(settings, '/v1/face', frame.buffer))
      } finally {
        frame?.close?.()
      }
      if (!current()) break
      const face = detection.face
      if (face && Number.isFinite(face.x) && face.x >= 0 && face.x <= 1 && face.confidence >= 0.5) {
        // Require two consistent detections, then move only horizontally.
        if (lastX !== undefined && Math.abs(lastX - face.x) < 0.15) {
          await companionRequest(settings, '/v1/diagnostics?stage=face-found')
          if (Math.abs(face.x - 0.5) < 0.12) return moved
          yaw = Math.max(-0.15, Math.min(0.15, yaw + (0.5 - face.x) * 0.3))
          await robot.motion.setTorque(true)
          if (!current()) break
          await companionRequest(settings, '/v1/diagnostics?stage=motion-start')
          await robot.motion.setPose({ rotation: { y: yaw, p: 0, r: 0 } }, 0.8)
          moved = true
        }
        lastX = face.x
      } else lastX = undefined
      await new Promise((resolve) => Timer.set(resolve, 250))
    }
  } catch (error) {
    trace(`[companion] face search unavailable: ${error}\n`)
  } finally {
    await robot.camera.stop()
  }
  return moved
}

export async function announce(robot, settings, current, show) {
  if (!current()) return
  show('Your research note is ready', 'ready')
  try {
    await companionRequest(settings, '/v1/diagnostics?stage=speech-fetch')
    const wav = await companionRequest(settings, '/v1/completion.wav', undefined, true)
    if (!current()) return
    if (wav.byteLength > 100044) throw new Error('Speech too large')
    await companionRequest(settings, '/v1/diagnostics?stage=speech-start')
    if (!(await robot.audio.playAudio(wav))) throw new Error('Playback failed')
    await companionRequest(settings, '/v1/diagnostics?stage=speech-finished')
  } catch (error) {
    trace(`[companion] speech unavailable: ${error}\n`)
  }
}
