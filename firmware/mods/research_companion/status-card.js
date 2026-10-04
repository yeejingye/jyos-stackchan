import { Container, Content, Label, Skin, Style, Text } from 'piu/MC'

const COLORS = { surface: '#17212c99', border: '#2b394899', text: '#f3f7fc', muted: '#bdcad8', track: '#354353' }
const STAGES = ['gathering', 'comparing', 'drafting', 'ready']
const TITLES = {
  idle: 'Ready when you are',
  confirming: 'Planning',
  gathering: 'Studying',
  comparing: 'Reviewing',
  drafting: 'Writing',
  'needs-input': 'Your turn',
  ready: 'Research ready',
  failed: 'Needs attention',
  connecting: 'Connecting',
  offline: 'Connection lost',
  setup: 'Let’s connect',
  finding: 'Looking for you',
}

export function createStatusCard() {
  const titleStyle = new Style({ font: 'OpenSans-Regular-24', color: COLORS.text, horizontal: 'left' })
  const bodyStyle = new Style({ font: 'OpenSans-Regular-16', color: COLORS.muted, horizontal: 'left' })
  const title = new Label(null, { left: 16, right: 16, top: 10, height: 30, string: '', style: titleStyle })
  const body = new Text(null, { left: 16, right: 16, top: 42, height: 38, string: '', style: bodyStyle })
  const accent = new Content(null, { left: 0, right: 0, top: 0, height: 3 })
  const bars = STAGES.map(
    (_stage, index) =>
      new Content(null, {
        left: 16 + index * 68,
        bottom: 7,
        width: 62,
        height: 3,
      }),
  )
  const card = new Container(null, {
    left: 8,
    right: 8,
    bottom: 8,
    height: 94,
    active: false,
    clip: true,
    skin: new Skin({ fill: COLORS.surface, stroke: COLORS.border, borders: { left: 1, right: 1, top: 1, bottom: 1 } }),
    contents: [accent, title, body, ...bars],
  })
  const skins = {}
  const skin = (color) => {
    if (!skins[color]) skins[color] = new Skin({ fill: color })
    return skins[color]
  }
  return {
    content: card,
    update(text, phase, titleOverride) {
      const color = phase === 'ready' ? '#52d99a' : ['failed', 'offline'].includes(phase) ? '#ff927d' : '#65d9ef'
      title.string = titleOverride ?? TITLES[phase] ?? 'Research'
      // Fit two lines in the compact card; retain the full status in the Mac snapshot.
      let detail = text
      const width = 272
      while (detail.length && bodyStyle.measure(detail).width > width * 1.65) detail = detail.slice(0, -1)
      body.string = detail.length < text.length ? `${detail.trimEnd()}...` : detail
      accent.skin = skin(color)
      const stage = STAGES.indexOf(phase)
      bars.forEach((bar, index) => {
        bar.skin = skin(stage >= index ? color : COLORS.track)
      })
    },
  }
}
