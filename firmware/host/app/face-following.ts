import type { RobotCamera } from 'camera'
import {
  createFaceFollowingSweepProfiles,
  FaceFollowingController,
  type FaceFollowingDependencies,
  type FaceFollowingParameters,
  type FollowRotation,
  registerFaceFollowing,
  startFaceFollowing,
  stopFaceFollowing,
} from 'face-following-controller'
import { OrientedFaceDetector } from 'face-following-detector'
import config from 'mc/config'
import Modules from 'modules'
import type { Content as PiuContent } from 'piu/MC'
import { wait } from 'stackchan-util'
import { ActionButton } from 'ui-controls'

export { isFaceFollowing, startFaceFollowing, stopFaceFollowing } from 'face-following-controller'

type FaceFollowingRobot = {
  camera: RobotCamera
  motion: {
    pose: { body: { position: { x: number; y: number; z: number } } }
    setTorque(enabled: boolean): Promise<void>
    setPose(
      pose: { position: { x: number; y: number; z: number }; rotation: FollowRotation },
      seconds: number,
    ): Promise<void>
  }
  showBalloon(text: string): void
}

export function installFaceFollowing(
  robot: FaceFollowingRobot,
  onActiveChanged: (active: boolean) => void,
  canStart?: () => boolean,
): boolean {
  if (robot.camera.available === false || !Modules.has('local-face-detector')) return false
  const options = { width: 176, height: 144, imageType: 'rgb565le' as const }
  const tuning = (config as { faceFollowing?: { sweep?: boolean; parameters?: Partial<FaceFollowingParameters> } })
    .faceFollowing
  const sweep = tuning?.sweep === true
  const profiles = createFaceFollowingSweepProfiles()
  const sequence = [...profiles, ...[...profiles].reverse()]
  let stage = -1
  let sweepPhase = ''
  let completed = false
  const emit = (event: object) => trace(`[FaceSweep] ${JSON.stringify(event)}\n`)
  let preferredTurns = 0
  const controller = new FaceFollowingController({
    canStart,
    parameters: tuning?.parameters,
    selectParameters: sweep
      ? (elapsedMs) => {
          const next = Math.floor(elapsedMs / 20000)
          if (next >= sequence.length) {
            completed = true
            return null
          }
          if (stage !== next) {
            stage = next
            sweepPhase = ''
            emit({ event: 'stage', stage, elapsedMs, profile: sequence[stage], seconds: 20 })
          }
          const phase = elapsedMs % 20000 < 5000 || elapsedMs % 20000 >= 15000 ? 'HOLD still' : 'MOVE left/right'
          if (phase !== sweepPhase) {
            sweepPhase = phase
            robot.showBalloon(`${stage + 1}/8 ${sequence[stage].name}: ${phase}`)
          }
          return sequence[stage]
        }
      : undefined,
    onSample: sweep ? (sample) => emit({ event: 'sample', stage, ...sample }) : undefined,
    createDetector: () => {
      const Detector = Modules.importNow('local-face-detector') as new () => ReturnType<
        FaceFollowingDependencies['createDetector']
      >
      const nativeDetector = new Detector()
      const oriented = new OrientedFaceDetector(nativeDetector, preferredTurns)
      let lastReport = 0
      let frames = 0
      let detectedFrames = 0
      return {
        detect(buffer, width, height) {
          const orientation = oriented.orientation
          const started = Date.now()
          const face = oriented.detect(buffer, width, height)
          const elapsed = Date.now() - started
          frames++
          if (face) {
            detectedFrames++
            preferredTurns = orientation / 90
          }
          if (Date.now() - lastReport >= 1000) {
            trace(
              `[FaceFollowing] frames=${frames} detected=${detectedFrames} size=${width}x${height} orientation=${orientation} inferenceMs=${elapsed} face=${JSON.stringify(face)}\n`,
            )
            lastReport = Date.now()
          }
          return face
        },
        close: () => oriented.close(),
      }
    },
    startCamera: () => robot.camera.start(options),
    capture: () => robot.camera.capture(options),
    stopCamera: () => robot.camera.stop(),
    setTorque: async (enabled) => {
      trace(`[FaceFollowing] torque=${enabled} begin\n`)
      await robot.motion.setTorque(enabled)
      trace(`[FaceFollowing] torque=${enabled} acknowledged\n`)
    },
    setRotation: async (rotation, seconds) => {
      const yaw = ((rotation.y * 180) / Math.PI).toFixed(1)
      const pitch = ((rotation.p * 180) / Math.PI).toFixed(1)
      trace(`[FaceFollowing] move yaw=${yaw} pitch=${pitch} duration=${seconds} begin\n`)
      await robot.motion.setPose({ position: { ...robot.motion.pose.body.position }, rotation }, seconds)
      trace(`[FaceFollowing] move yaw=${yaw} pitch=${pitch} acknowledged\n`)
    },
    wait,
    onActiveChanged: (active) => {
      trace(`[FaceFollowing] active=${active}\n`)
      if (sweep) {
        if (active) {
          stage = -1
          completed = false
          emit({ event: 'start', stages: sequence.length, stageSeconds: 20 })
        } else emit({ event: 'end', completed })
      }
      onActiveChanged(active)
    },
    onMotionRetry: (error, attempt) => {
      if (sweep) emit({ event: 'retry', stage, attempt, error: String(error) })
      trace(`[FaceFollowing] transient servo timeout, retry=${attempt}: ${error}\n`)
    },
    onError: (error) => {
      if (sweep) emit({ event: 'error', stage, error: String(error) })
      trace(`[FaceFollowing] ${error}\n`)
      robot.showBalloon('Face following unavailable')
    },
  })
  registerFaceFollowing(robot, controller)
  return true
}

type FaceFollowingModeRobot = FaceFollowingRobot & {
  lookAway(): void
  hideBalloon(): void
  ui: {
    showFace(): void
    closeDrawer(): void
    addEffect(effect: PiuContent): void
    removeEffect(effect: PiuContent): void
  }
  drawer: {
    addDrawerButton(button: { key: string; label: string; icon: 'camera'; callback: () => void }): void
  }
}
let installedModes: WeakSet<object> | undefined

/** Host-owned menu mode; also installed when a MOD overrides the default behavior. */
export function installFaceFollowingMode(
  robot: FaceFollowingModeRobot,
  options: { canStart?: () => boolean; onStart?: () => void } = {},
): void {
  if (installedModes?.has(robot)) return
  let stopButton: PiuContent | undefined
  const available = installFaceFollowing(
    robot,
    (active) => {
      if (active) {
        options.onStart?.()
        robot.lookAway()
        robot.ui.showFace()
        robot.hideBalloon()
        robot.ui.closeDrawer()
        stopButton = new ActionButton(
          {
            name: 'stopFaceFollowing',
            icon: 'stop',
            label: 'Stop',
            tone: 'danger',
            onTap: () => {
              void stopFaceFollowing(robot)
            },
          },
          { right: 8, bottom: 8, width: 96 },
        )
        robot.ui.addEffect(stopButton)
      } else if (stopButton) {
        robot.ui.removeEffect(stopButton)
        stopButton = undefined
      }
    },
    options.canStart,
  )
  if (!available) {
    trace('[FaceFollowing] mode unavailable: camera or local detector missing\n')
    return
  }
  robot.drawer.addDrawerButton({
    key: 'followMyFace',
    label: 'Follow my Face',
    icon: 'camera',
    callback: () => startFaceFollowing(robot),
  })
  installedModes ??= new WeakSet()
  installedModes.add(robot)
  trace('[FaceFollowing] Follow my Face menu installed\n')
}
