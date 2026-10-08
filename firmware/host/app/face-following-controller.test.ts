import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createFaceFollowingSweepProfiles,
  type DetectedFace,
  FaceFollowingController,
  type FaceFollowingDependencies,
  type FollowRotation,
} from './face-following-controller.js'

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve()
}

function fixture(overrides: Partial<FaceFollowingDependencies> = {}) {
  const events: string[] = []
  const rotations: FollowRotation[] = []
  const errors: unknown[] = []
  const states: boolean[] = []
  const captures: ReturnType<typeof deferred<Awaited<ReturnType<FaceFollowingDependencies['capture']>>>>[] = []
  let face: DetectedFace | null = null
  const dependencies: FaceFollowingDependencies = {
    parameters: createFaceFollowingSweepProfiles()[0],
    createDetector: () => ({
      detect: () => face,
      close: () => {
        events.push('detector.close')
      },
    }),
    startCamera: () => {
      events.push('camera.start')
    },
    stopCamera: () => {
      events.push('camera.stop')
    },
    capture: () => {
      const capture = deferred<Awaited<ReturnType<FaceFollowingDependencies['capture']>>>()
      captures.push(capture)
      return capture.promise
    },
    setTorque: async (enabled) => {
      events.push(`torque.${enabled}`)
    },
    setRotation: async (rotation) => {
      events.push('move')
      rotations.push(rotation)
    },
    wait: async () => {},
    onActiveChanged: (active) => {
      states.push(active)
    },
    onError: (error) => {
      errors.push(error)
    },
    ...overrides,
  }
  const controller = new FaceFollowingController(dependencies)
  const feed = async (next: DetectedFace | null) => {
    face = next
    const pending = captures.shift()
    assert.ok(pending)
    pending.resolve({
      buffer: new ArrayBuffer(2),
      width: 1,
      height: 1,
      close: () => {
        events.push('frame.close')
      },
    })
    await flush()
  }
  const stop = async () => {
    const done = controller.stop()
    captures.shift()?.resolve(undefined)
    await done
  }
  return { controller, events, rotations, states, errors, captures, feed, stop }
}

test('tilts before camera capture, follows in both directions, and holds when centered or lost', async () => {
  const f = fixture()
  f.controller.start()
  f.controller.start()
  await flush()
  assert.equal(f.rotations.length, 1)
  assert.ok(f.rotations[0].p < 0)
  assert.ok(f.events.indexOf('move') < f.events.indexOf('camera.start'))
  const rightDown = { x: 0.8, y: 0.8, confidence: 0.9 }
  await f.feed(rightDown)
  assert.equal(f.rotations.length, 1, 'requires confirmation')
  await f.feed(rightDown)
  assert.ok(f.rotations[1].y > f.rotations[0].y)
  assert.ok(f.rotations[1].p > f.rotations[0].p)
  const leftUp = { x: 0.2, y: 0.2, confidence: 0.9 }
  await f.feed(leftUp)
  await f.feed(leftUp)
  assert.ok(f.rotations[2].y < f.rotations[1].y)
  assert.ok(f.rotations[2].p < f.rotations[1].p)
  const count = f.rotations.length
  await f.feed({ x: 0.5, y: 0.5, confidence: 0.9 })
  await f.feed({ x: 0.5, y: 0.5, confidence: 0.9 })
  await f.feed(null)
  await f.feed({ x: NaN, y: 1, confidence: 1 })
  await f.feed({ x: 0.9, y: 0.9, confidence: 0.1 })
  assert.equal(f.rotations.length, count)
  await f.stop()
  assert.deepEqual(f.states, [true, false])
  assert.equal(f.errors.length, 0)
  assert.ok(f.events.includes('camera.stop'))
  assert.ok(f.events.includes('detector.close'))
  assert.equal(f.events.at(-1), 'torque.false')
})

test('stop during a pending capture closes the late frame without inference or motion', async () => {
  let inferences = 0
  const f = fixture({
    createDetector: () => ({
      detect: () => {
        inferences++
        return null
      },
      close() {},
    }),
  })
  f.controller.start()
  await flush()
  const done = f.controller.stop()
  f.controller.start() // Must not start a second session while the first is draining.
  assert.equal(f.controller.active, true)
  await f.feed({ x: 0.8, y: 0.8, confidence: 1 })
  await done
  assert.equal(inferences, 0)
  assert.equal(f.rotations.length, 1)
  assert.ok(f.events.includes('frame.close'))
  assert.equal(f.controller.active, false)
  f.controller.start()
  await flush()
  await f.stop()
  assert.deepEqual(f.states, [true, false, true, false])
})

test('stop during startup prevents camera startup and releases torque', async () => {
  const torque = deferred()
  const f = fixture({
    setTorque: (enabled) => {
      f.events.push(`torque.${enabled}`)
      return enabled ? torque.promise : Promise.resolve()
    },
  })
  f.controller.start()
  await flush()
  const done = f.controller.stop()
  torque.resolve()
  await done
  assert.equal(f.rotations.length, 0)
  assert.ok(!f.events.includes('camera.start'))
  assert.equal(f.events.at(-1), 'torque.false')
})

test('inference and cleanup failures still release all resources and allow restart', async () => {
  const f = fixture({
    createDetector: () => ({
      detect: () => {
        throw new Error('inference')
      },
      close: () => {
        f.events.push('detector.close')
        throw new Error('close')
      },
    }),
    stopCamera: () => {
      f.events.push('camera.stop')
      throw new Error('stop')
    },
  })
  f.controller.start()
  await flush()
  await f.feed(null)
  await flush()
  assert.equal(f.controller.active, false)
  assert.equal(f.errors.length, 3)
  assert.equal(f.events.at(-1), 'torque.false')
  assert.ok(f.events.includes('frame.close'))
  assert.ok(f.events.includes('detector.close'))
})

test('immediate stop and busy start never acquire resources', async () => {
  const f = fixture()
  f.controller.start()
  await f.controller.stop()
  assert.equal(f.events.length, 0)
  const busy = fixture({ canStart: () => false })
  busy.controller.start()
  assert.equal(busy.controller.active, false)
  assert.equal(busy.errors.length, 1)
})

test('continued off-center detections saturate safely instead of accumulating unbounded movement', async () => {
  const f = fixture()
  f.controller.start()
  await flush()
  for (let i = 0; i < 100; i++) await f.feed({ x: 1, y: 1, confidence: 1 })
  const last = f.rotations.at(-1)
  assert.ok(last)
  assert.ok(Math.abs(last.y) < Math.PI / 2)
  assert.ok(Math.abs(last.p) < Math.PI / 2)
  const count = f.rotations.length
  await f.feed({ x: 1, y: 1, confidence: 1 })
  assert.equal(f.rotations.length, count)
  await f.stop()
})

const servoTimeout = () => Object.assign(new Error('servo timeout'), { protocol: 'scservo', timeoutMs: 120 })

test('recovers from a missed servo acknowledgement without ending tracking', async () => {
  let attempts = 0
  let retries = 0
  const f = fixture({
    setTorque: async (enabled) => {
      if (enabled && ++attempts === 1) throw servoTimeout()
    },
    onMotionRetry: () => {
      retries++
    },
  })
  f.controller.start()
  await flush()
  assert.equal(attempts, 2)
  assert.equal(retries, 1)
  assert.equal(f.errors.length, 0)
  assert.ok(f.controller.active)
  await f.stop()
})

test('persistent servo failures are bounded and still release the session', async () => {
  let attempts = 0
  const f = fixture({
    setTorque: async (enabled) => {
      if (enabled) {
        attempts++
        throw servoTimeout()
      }
    },
  })
  f.controller.start()
  await flush()
  assert.equal(attempts, 3)
  assert.equal(f.errors.length, 1)
  assert.equal(f.controller.active, false)
})

test('stop during retry backoff prevents further motor commands', async () => {
  const backoff = deferred()
  let attempts = 0
  const f = fixture({
    setTorque: async (enabled) => {
      if (enabled) {
        attempts++
        throw servoTimeout()
      }
    },
    wait: async (ms) => {
      if (ms === 80) await backoff.promise
    },
  })
  f.controller.start()
  await flush()
  const done = f.controller.stop()
  backoff.resolve()
  await done
  assert.equal(attempts, 1)
  assert.equal(f.controller.active, false)
})

test('a transient tracking correction failure retries the same goal and keeps capturing', async () => {
  let moves = 0
  const requested: FollowRotation[] = []
  const f = fixture({
    setRotation: async (rotation) => {
      requested.push(rotation)
      if (++moves === 2) throw servoTimeout()
    },
  })
  f.controller.start()
  await flush()
  const face = { x: 0.8, y: 0.8, confidence: 0.9 }
  await f.feed(face)
  await f.feed(face)
  assert.equal(moves, 3)
  assert.deepEqual(requested[1], requested[2], 'retry must not add another correction step')
  assert.equal(f.errors.length, 0)
  assert.ok(f.controller.active)
  assert.equal(f.captures.length, 1, 'tracking should capture another frame after recovery')
  await f.stop()
})

test('confident acquisition moves on the first frame and motion duration follows capture cadence', async () => {
  let time = 0
  const durations: number[] = []
  const waits: number[] = []
  const f = fixture({
    now: () => time,
    wait: async (ms) => {
      waits.push(ms)
    },
    setRotation: async (_rotation, duration) => {
      durations.push(duration)
    },
  })
  f.controller.start()
  await flush()
  waits.length = 0
  const face = { x: 0.8, y: 0.7, confidence: 0.99 }
  await f.feed(face)
  assert.equal(durations.length, 2, 'strong first detection should acquire immediately')
  time += 200
  await f.feed(face)
  const fast = durations.at(-1)
  assert.ok(fast)
  time += 400
  await f.feed(face)
  const slow = durations.at(-1)
  assert.ok(slow && slow > fast, 'slower inference should blend motion over a longer interval')
  assert.ok(
    waits.every((ms) => ms < fast * 1000),
    'tracking only yields briefly between frames',
  )
  await f.stop()
})

test('correction cadence limits motor writes without skipping detection or losing Stop', async () => {
  let time = 0
  let samples = 0
  const f = fixture({
    now: () => time,
    parameters: { correctionMs: 300 },
    onSample: () => {
      samples++
    },
  })
  f.controller.start()
  await flush()
  const face = { x: 0.8, y: 0.7, confidence: 0.99 }
  await f.feed(face)
  const count = f.rotations.length
  time += 100
  await f.feed(face)
  time += 100
  await f.feed(face)
  assert.equal(f.rotations.length, count, 'motor corrections are rate limited')
  assert.equal(samples, 3, 'every detection is still measured')
  time += 100
  await f.feed(face)
  assert.equal(f.rotations.length, count + 1)
  await f.stop()
})

test('a finished sweep releases resources through the same cleanup as Stop', async () => {
  let time = 0
  const parameters = { correctionMs: 200, gain: 0.4, alpha: 0.5, deadZone: 0.05, maxStep: 0.06, blend: 1.3 }
  const f = fixture({
    now: () => time,
    selectParameters: (elapsed) => (elapsed < 1000 ? parameters : null),
  })
  f.controller.start()
  await flush()
  time = 1100
  await f.feed(null)
  assert.equal(f.controller.active, false)
  assert.ok(f.events.includes('camera.stop'))
  assert.ok(f.events.includes('detector.close'))
  assert.equal(f.events.at(-1), 'torque.false')
})
