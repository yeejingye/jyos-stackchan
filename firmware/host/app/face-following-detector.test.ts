import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OrientedFaceDetector } from './face-following-detector.js'

test('searches four frame orientations, preserves pixels, and maps detections to camera coordinates', () => {
  const source = new Uint16Array([1, 2, 3, 4, 5, 6])
  const expected = [
    [1, 2, 3, 4, 5, 6],
    [5, 3, 1, 6, 4, 2],
    [6, 5, 4, 3, 2, 1],
    [2, 4, 6, 1, 3, 5],
  ]
  const cameraPoint = { x: 0.25, y: 0.75 }
  const orientedPoints = [cameraPoint, { x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }]
  for (let target = 0; target < 4; target++) {
    let call = 0
    let closed = false
    const detector = new OrientedFaceDetector({
      detect(buffer, width, height) {
        const turn = Math.min(call++, target)
        assert.deepEqual([...new Uint16Array(buffer)], expected[turn])
        assert.equal(width, turn % 2 ? 3 : 2)
        assert.equal(height, turn % 2 ? 2 : 3)
        return turn === target ? { ...orientedPoints[target], confidence: 0.9 } : null
      },
      close() {
        closed = true
      },
    })
    for (let i = 0; i < target; i++) assert.equal(detector.detect(source.buffer, 2, 3), null)
    assert.deepEqual(detector.detect(source.buffer, 2, 3), { ...cameraPoint, confidence: 0.9 })
    assert.deepEqual(
      detector.detect(source.buffer, 2, 3),
      { ...cameraPoint, confidence: 0.9 },
      'keeps successful orientation',
    )
    assert.deepEqual([...source], [1, 2, 3, 4, 5, 6], 'does not mutate camera storage')
    detector.close()
    assert.equal(closed, true)
  }
})

test('holds the working orientation through brief and prolonged face loss', () => {
  let found = true
  const detector = new OrientedFaceDetector(
    {
      detect: () => (found ? { x: 0.5, y: 0.5, confidence: 0.99 } : null),
      close() {},
    },
    2,
  )
  const buffer = new ArrayBuffer(8)
  detector.detect(buffer, 2, 2)
  found = false
  for (let i = 0; i < 3; i++) detector.detect(buffer, 2, 2)
  assert.equal(detector.orientation, 180, 'brief loss should not trigger costly rotation search')
  found = true
  detector.detect(buffer, 2, 2)
  found = false
  for (let i = 0; i < 3; i++) detector.detect(buffer, 2, 2)
  assert.equal(detector.orientation, 180, 'reacquisition preserves orientation')
  const orientations = new Set<number>()
  for (let i = 0; i < 20; i++) {
    detector.detect(buffer, 2, 2)
    orientations.add(detector.orientation)
  }
  assert.deepEqual([...orientations], [180], 'sustained face loss does not change camera mounting')
})
