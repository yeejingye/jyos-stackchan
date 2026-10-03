import { SpeechBalloon } from 'effects/speech-balloon'
import { Emotion } from 'face-state'
import Timer from 'timer'

export function onContextCreated(robot) {
  robot.face.setEmotion(Emotion.HAPPY)
  let balloon
  const showStatus = (text) => {
    if (balloon) robot.ui.removeEffect(balloon)
    balloon = new SpeechBalloon({
      right: 20,
      top: 10,
      width: 120,
      font: 'k8x12-12',
      text,
    })
    robot.ui.addEffect(balloon)
  }
  showStatus('Hello JYOS!')

  const delay = (ms) => new Promise((resolve) => Timer.set(resolve, ms))
  const runGreeting = async () => {
    try {
      await robot.motion.setTorque(true)
      // Direct poses use radians and bypass lookAt's 30-degree threshold.
      for (const yaw of [0.15, -0.15, 0]) {
        await robot.motion.setPose({ rotation: { y: yaw, p: 0, r: 0 } }, 1)
        await delay(4000)
      }
      showStatus('Motion done')
    } catch (error) {
      trace(`[jyos_hello] motion failed: ${error}\n`)
      showStatus('Motor error')
    } finally {
      try {
        await robot.motion.setTorque(false)
      } catch (error) {
        trace(`[jyos_hello] torque release failed: ${error}\n`)
        showStatus('Motor error')
      }
    }
  }
  Timer.set(() => {
    void runGreeting()
  }, 4000)
}
