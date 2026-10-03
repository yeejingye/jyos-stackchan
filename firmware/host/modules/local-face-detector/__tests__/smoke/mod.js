import Modules from 'modules'

function assert(value, message) {
  if (!value) throw new Error(message)
}
function throws(action) {
  try {
    action()
  } catch {
    return true
  }
  return false
}
export function onContextCreated(robot) {
  let detector
  try {
    const FaceDetector = Modules.importNow('local-face-detector')
    detector = new FaceDetector()
    const blank = new ArrayBuffer(176 * 144 * 2)
    assert(
      throws(() => detector.detect(blank, 1, 1)),
      'reject invalid dimensions',
    )
    assert(
      throws(() => detector.detect(new ArrayBuffer(2), 176, 144)),
      'reject incomplete frame',
    )
    assert(detector.detect(blank, 176, 144) === null, 'blank frame should have no face')
    assert(Number.isFinite(detector.inferenceMs), 'inference timing should be reported')
    trace(`[local-face-smoke] inferenceMs=${detector.inferenceMs}\n`)
    detector.close()
    detector.close()
    assert(
      throws(() => detector.detect(blank, 176, 144)),
      'closed detector should reject inference',
    )
    trace('[local-face-smoke] PASS\n')
    robot.ui.showBalloon('Local detector smoke passed')
  } catch (error) {
    trace(`[local-face-smoke] FAIL ${error}\n`)
    robot.ui.showBalloon('Local detector smoke failed')
  } finally {
    detector?.close()
  }
}
