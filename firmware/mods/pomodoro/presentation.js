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

// Temporary recognition diagnostics; candidates are not a general speech transcript.
export function createVoiceDebugStrip() {
  const style = new Style({ font: 'OpenSans-Regular-16', color: '#f3f7fc', horizontal: 'center' })
  const title = new Label(null, { left: 4, right: 4, top: 4, height: 20, style, string: '' })
  const detail = new Label(null, { left: 4, right: 4, top: 26, height: 20, style, string: '' })
  const content = new Container(null, {
    left: 8,
    right: 8,
    bottom: 54,
    height: 50,
    active: false,
    visible: false,
    skin: new Skin({ fill: '#101b28a0' }),
    contents: [title, detail],
  })
  return {
    content,
    update(message, diagnostics = '') {
      title.string = message
      detail.string = diagnostics
      content.visible = !!message
    },
  }
}
