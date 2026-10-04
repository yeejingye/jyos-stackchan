import { Container, Content, Label, Skin, Style } from 'piu/MC'

const COLORS = {
  surface: '#101b2880',
  border: '#d8e5f033',
  text: '#f3f7fc',
  muted: '#8193a7',
  track: '#8292a233',
  active: '#65d9ef',
  ready: '#52d99a',
  alert: '#ff927d',
}
const STAGES = ['gathering', 'comparing', 'drafting', 'ready']
const STATUS = {
  confirming: 'Getting started',
  gathering: 'Finding sources',
  comparing: 'Thinking it through',
  drafting: 'Writing a note',
  'needs-input': 'Needs your input',
  ready: 'Ready to review',
  failed: 'Needs attention',
  connecting: 'Connecting',
  offline: 'Offline',
  setup: 'Connect to Mac',
  finding: 'Looking for you',
}

export function createStatusCard() {
  const labelStyle = new Style({ font: 'OpenSans-Regular-16', color: COLORS.text, vertical: 'middle' })
  const label = new Label(null, { left: 34, right: 54, top: 0, bottom: 0, string: '', style: labelStyle })
  const activity = new Content(null, { left: 15, top: 19, width: 7, height: 7 })
  const markers = STAGES.map(
    (_stage, index) =>
      new Content(null, {
        right: 15 + (STAGES.length - index - 1) * 9,
        top: 20,
        width: 5,
        height: 5,
      }),
  )
  const card = new Container(null, {
    left: 24,
    right: 24,
    bottom: 12,
    height: 46,
    active: false,
    clip: true,
    skin: new Skin({ fill: COLORS.surface, stroke: COLORS.border, borders: { left: 1, right: 1, top: 1, bottom: 1 } }),
    contents: [activity, label, ...markers],
  })
  const skins = {}
  const skin = (color) => {
    if (!skins[color]) skins[color] = new Skin({ fill: color })
    return skins[color]
  }
  let statusColor = COLORS.active
  let pulseEnabled = false
  return {
    content: card,
    update(text, phase, titleOverride) {
      statusColor = ['failed', 'offline'].includes(phase)
        ? COLORS.alert
        : phase === 'ready'
          ? COLORS.ready
          : COLORS.active
      pulseEnabled = ['gathering', 'comparing', 'drafting'].includes(phase)
      const status = titleOverride ?? STATUS[phase] ?? text ?? 'Working'
      let detail = status
      const width = 180
      while (detail.length && labelStyle.measure(detail).width > width) detail = detail.slice(0, -1)
      label.string = detail.length < status.length ? `${detail.trimEnd()}…` : detail
      activity.skin = skin(statusColor)
      const stage = STAGES.indexOf(phase)
      markers.forEach((marker, index) => {
        marker.skin = skin(stage >= index ? statusColor : COLORS.track)
      })
    },
    setActivity(active) {
      activity.skin = skin(active || !pulseEnabled ? statusColor : COLORS.track)
    },
  }
}
