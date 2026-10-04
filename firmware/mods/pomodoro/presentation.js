import { Container, Label, Skin, Style } from 'piu/MC'
import { countdown } from 'pomodoro-timer'

export function createTimerStrip() {
  const label = new Label(null, {
    left: 8,
    right: 8,
    top: 0,
    bottom: 0,
    string: '',
    style: new Style({ font: 'OpenSans-Regular-16', color: '#f3f7fc', horizontal: 'center', vertical: 'middle' }),
  })
  const content = new Container(null, {
    left: 42,
    right: 42,
    bottom: 12,
    height: 36,
    active: false,
    skin: new Skin({ fill: '#101b2880', stroke: '#65d9ef66', borders: { left: 1, right: 1, top: 1, bottom: 1 } }),
    contents: [label],
    visible: false,
  })
  return {
    content,
    update(snapshot) {
      content.visible = snapshot.phase !== 'idle'
      label.string = `${snapshot.paused ? 'PAUSED' : snapshot.phase === 'focus' ? 'Focus' : 'Rest'}  ${countdown(snapshot.remainingMs)}`
    },
  }
}
