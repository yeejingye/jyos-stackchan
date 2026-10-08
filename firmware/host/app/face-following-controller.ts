// Platform-independent session logic. The host supplies camera, inference, and scheduling.
export type DetectedFace = { x: number; y: number; confidence: number }
export type FollowRotation = { y: number; p: number; r: number }
export type FollowFrame = { buffer: ArrayBuffer; width: number; height: number; close?: () => void }
export type FaceFollowingParameters = {
  correctionMs: number
  gain: number
  alpha: number
  deadZone: number
  maxStep: number
  blend: number
}
export const defaultFaceFollowingParameters: FaceFollowingParameters = {
  correctionMs: 300,
  gain: 0.3,
  alpha: 0.4,
  deadZone: 0.06,
  maxStep: 0.05,
  blend: 1.5,
}
// XS preloaded objects cannot be serialized directly; allocate telemetry profiles at runtime.
export function createFaceFollowingSweepProfiles() {
  return [
    // Preserve the pre-sweep baseline for comparisons even after tuning the defaults.
    { name: 'baseline', correctionMs: 0, gain: 0.45, alpha: 0.7, deadZone: 0.05, maxStep: Math.PI / 36, blend: 1.1 },
    { name: 'balanced', correctionMs: 200, gain: 0.4, alpha: 0.5, deadZone: 0.05, maxStep: 0.06, blend: 1.3 },
    { name: 'smooth', correctionMs: 300, gain: 0.3, alpha: 0.4, deadZone: 0.06, maxStep: 0.05, blend: 1.5 },
    { name: 'responsive', correctionMs: 150, gain: 0.5, alpha: 0.65, deadZone: 0.05, maxStep: 0.07, blend: 1.15 },
  ]
}
export type FaceFollowingSample = {
  elapsedMs: number
  face: DetectedFace | null
  inferenceMs: number
  commandMs: number
  rotation: FollowRotation
  commanded: boolean
  duration: number
}
export type FaceFollowingDependencies = {
  canStart?(): boolean
  createDetector(): { detect(buffer: ArrayBuffer, width: number, height: number): DetectedFace | null; close(): void }
  startCamera(): void | Promise<void>
  capture(): Promise<FollowFrame | undefined>
  stopCamera(): void | Promise<void>
  setTorque(enabled: boolean): Promise<void>
  setRotation(rotation: FollowRotation, seconds: number): Promise<void>
  wait(milliseconds: number): Promise<void>
  onActiveChanged(active: boolean): void
  onError(error: unknown): void
  now?(): number
  onMotionRetry?(error: unknown, attempt: number): void
  parameters?: Partial<FaceFollowingParameters>
  // Returning null finishes a diagnostic session through the ordinary cleanup path.
  selectParameters?(elapsedMs: number): FaceFollowingParameters | null
  onSample?(sample: FaceFollowingSample): void
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const validFace = (face: DetectedFace | null): face is DetectedFace =>
  !!face &&
  Number.isFinite(face.x) &&
  Number.isFinite(face.y) &&
  face.x >= 0 &&
  face.x <= 1 &&
  face.y >= 0 &&
  face.y <= 1 &&
  face.confidence >= 0.5

export class FaceFollowingController {
  #dependencies: FaceFollowingDependencies
  #task: Promise<void> | undefined
  #running = false

  constructor(dependencies: FaceFollowingDependencies) {
    this.#dependencies = dependencies
  }

  // Remains active through cleanup, preventing another mode from taking the camera/servos early.
  get active(): boolean {
    return this.#task !== undefined
  }

  start(): void {
    if (this.active) return
    if (this.#dependencies.canStart?.() === false) {
      this.#dependencies.onError(new Error('Another camera or motion action is running'))
      return
    }
    this.#running = true
    this.#task = Promise.resolve().then(() => this.#run())
    this.#dependencies.onActiveChanged(true)
  }

  async stop(): Promise<void> {
    this.#running = false
    await this.#task
  }

  async #motionCommand(command: () => Promise<void>): Promise<boolean> {
    const d = this.#dependencies
    for (let attempt = 1; attempt <= 3 && this.#running; attempt++) {
      try {
        await command()
        return this.#running
      } catch (error) {
        const timeout =
          error &&
          typeof error === 'object' &&
          'protocol' in error &&
          error.protocol === 'scservo' &&
          'timeoutMs' in error
        if (!timeout || attempt === 3) throw error
        d.onMotionRetry?.(error, attempt)
        // The servo queue needs time to discard a late acknowledgement before retrying.
        await d.wait(80)
      }
    }
    return false
  }

  async #run(): Promise<void> {
    const d = this.#dependencies
    let detector: ReturnType<FaceFollowingDependencies['createDetector']> | undefined
    let cameraStarted = false
    let torqueEnabled = false
    let rotation: FollowRotation = { y: 0, p: -Math.PI / 4, r: 0 }
    let previous: DetectedFace | null = null
    let filtered: DetectedFace | null = null
    let lastSampleAt: number | undefined
    let lastCommandAt: number | undefined
    let previousParameters: FaceFollowingParameters | undefined
    const now = () => d.now?.() ?? Date.now()
    try {
      if (!this.#running) return
      torqueEnabled = true
      await d.wait(20)
      if (!(await this.#motionCommand(() => d.setTorque(true)))) return
      if (!(await this.#motionCommand(() => d.setRotation(rotation, 0.6)))) return
      // Track only after the initial upward movement has settled.
      detector = d.createDetector()
      await d.wait(600)
      if (!this.#running) return
      cameraStarted = true
      await d.startCamera()
      const trackingStarted = now()
      while (this.#running) {
        const elapsedMs = now() - trackingStarted
        const parameters = d.selectParameters
          ? d.selectParameters(elapsedMs)
          : (previousParameters ?? {
              ...defaultFaceFollowingParameters,
              ...d.parameters,
            })
        if (!parameters) break
        if (parameters !== previousParameters) {
          previous = null
          filtered = null
          lastCommandAt = undefined
          previousParameters = parameters
        }
        let frame: FollowFrame | undefined
        let face: DetectedFace | null = null
        let inferenceMs = 0
        try {
          frame = await d.capture()
          if (frame && this.#running) {
            const started = now()
            face = detector.detect(frame.buffer, frame.width, frame.height)
            inferenceMs = now() - started
          }
        } finally {
          frame?.close?.()
        }
        if (!this.#running) break
        // Inference is synchronous. Let queued camera/UART/UI events drain before commanding servos.
        await d.wait(20)
        if (!this.#running) break
        const sampledAt = now()
        const interval = lastSampleAt === undefined ? 0.25 : (sampledAt - lastSampleAt) / 1000
        lastSampleAt = sampledAt
        let commanded = false
        let duration = 0
        let commandMs = 0
        if (validFace(face)) {
          const consistent = previous && Math.abs(previous.x - face.x) < 0.25 && Math.abs(previous.y - face.y) < 0.25
          // Very confident detections can acquire immediately. Lower confidence or
          // discontinuous detections require confirmation before moving.
          if (consistent || (!previous && face.confidence >= 0.95)) {
            filtered =
              filtered && consistent
                ? {
                    ...face,
                    x: filtered.x * (1 - parameters.alpha) + face.x * parameters.alpha,
                    y: filtered.y * (1 - parameters.alpha) + face.y * parameters.alpha,
                  }
                : face
            const step = (error: number) => {
              const magnitude = Math.max(0, Math.abs(error) - parameters.deadZone)
              return Math.sign(error) * Math.min(magnitude * parameters.gain, parameters.maxStep)
            }
            const next = {
              // CoreS3: image-right requires positive yaw; image-down requires positive pitch.
              y: clamp(rotation.y + step(filtered.x - 0.5), -Math.PI / 3, Math.PI / 3),
              p: clamp(rotation.p + step(filtered.y - 0.5), -Math.PI / 3, 0),
              r: 0,
            }
            if (
              (lastCommandAt === undefined || sampledAt - lastCommandAt >= parameters.correctionMs) &&
              (Math.abs(next.y - rotation.y) > 0.005 || Math.abs(next.p - rotation.p) > 0.005)
            ) {
              // Blend over approximately one inference interval, so the next goal
              // arrives near the end of the preceding movement instead of after a pause.
              duration = clamp(Math.max(interval, parameters.correctionMs / 1000) * parameters.blend, 0.18, 0.6)
              const commandStarted = now()
              if (!(await this.#motionCommand(() => d.setRotation(next, duration)))) break
              commandMs = now() - commandStarted
              commanded = true
              lastCommandAt = sampledAt
              rotation = next
            }
          } else filtered = null
          previous = face
        } else {
          previous = null
          filtered = null
        }
        d.onSample?.({ elapsedMs, face, inferenceMs, commandMs, rotation: { ...rotation }, commanded, duration })
        // The 20 ms yield above services UI/UART. Do not add another fixed delay.
      }
    } catch (error) {
      d.onError(error)
    } finally {
      // Always attempt every release, even if one resource fails to close.
      const cleanup = async (release: () => void | Promise<void>) => {
        try {
          await release()
        } catch (error) {
          d.onError(error)
        }
      }
      if (cameraStarted) await cleanup(() => d.stopCamera())
      if (detector) await cleanup(() => detector.close())
      if (torqueEnabled) await cleanup(() => d.setTorque(false))
      this.#running = false
      this.#task = undefined
      d.onActiveChanged(false)
    }
  }
}

// Runtime-context is preloaded by XS. Allocate mutable registries after firmware startup.
let controllers: WeakMap<object, FaceFollowingController> | undefined
export function registerFaceFollowing(robot: object, controller: FaceFollowingController): void {
  controllers ??= new WeakMap()
  controllers.set(robot, controller)
}
export function isFaceFollowing(robot: object): boolean {
  return controllers?.get(robot)?.active ?? false
}
/** Shared entry points for the drawer, stop overlay, and future voice commands. */
export function startFaceFollowing(robot: object): void {
  const controller = controllers?.get(robot)
  if (!controller) throw new Error('Face following is unavailable on this host')
  controller.start()
}
export async function stopFaceFollowing(robot: object): Promise<void> {
  await controllers?.get(robot)?.stop()
}
