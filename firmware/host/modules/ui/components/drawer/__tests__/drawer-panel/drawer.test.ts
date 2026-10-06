import { Drawer } from 'drawer'
import { Application, type Container as PiuContainer, type Content as PiuContent } from 'piu/MC'
import { assert, equal } from 'testing/assert'
import Timer from 'timer'

const drawer = new Drawer({
  buttons: [
    { key: 'deskLook', label: 'Look around', group: 'Desk companion', tone: 'accent' },
    {
      key: 'deskPause',
      label: 'Auto look-around',
      subtitle: 'After 15 minutes idle',
      group: 'Desk companion',
      kind: 'toggle',
      active: true,
    },
    { key: 'joyStart', label: 'Start focus', subtitle: '20 min focus / 5 min rest', group: 'Pomodoro', tone: 'accent' },
    {
      key: 'joyMute',
      label: 'Listening',
      subtitle: 'Hi Joy voice commands',
      group: 'Voice',
      kind: 'toggle',
      active: true,
    },
    {
      key: 'face',
      label: 'Face',
      kind: 'choice',
      value: 'digital',
      options: [
        { value: 'digital', label: 'Digital' },
        { value: 'simple', label: 'Simple' },
      ],
    },
  ],
})
new Application(null, { width: 320, height: 240, displayListLength: 4096, commandListLength: 4096, contents: [drawer] })
const behavior = drawer.behavior as {
  setOpen: (content: PiuContainer, open: boolean) => void
  addButton: (content: PiuContainer, data: object) => void
  removeButton: (content: PiuContainer, key: string) => void
  setButtonState: (content: PiuContainer, key: string, active: boolean) => void
  onDrawerSettingsOpen: (content: PiuContainer) => void
  onDrawerHome: (content: PiuContainer) => void
  onDrawerChoiceOpen: (content: PiuContainer, key: string) => void
  onDrawerChoiceBack: (content: PiuContainer) => void
}
const list = (drawer.first as PiuContainer).first as PiuContainer
const find = (key: string) => {
  let child = list.first as PiuContent | null
  while (child) {
    if (child.name === key) return child as PiuContainer
    child = child.next as PiuContent | null
  }
  return null
}
assert(find('deskLook') && find('joyStart'), 'feature controls appear on home')
assert(!find('face'), 'appearance choices live on settings page')
assert(find('section:Desk companion'), 'feature has a section heading')
behavior.onDrawerSettingsOpen(drawer)
assert(find('face') && !find('deskLook'), 'settings page separates secondary controls')
behavior.setButtonState(drawer, 'deskPause', false)
behavior.onDrawerChoiceOpen(drawer, 'face')
const choiceFirst = list.first
behavior.removeButton(drawer, 'joyStart')
behavior.addButton(drawer, { key: 'joyPause', label: 'Pause', subtitle: 'Focus 19:59', group: 'Pomodoro' })
equal(list.first?.name, choiceFirst?.name, 'foreground updates keep the choice page open')
behavior.onDrawerChoiceBack(drawer)
assert(find('face') && !find('joyPause'), 'choice back returns to settings')
behavior.onDrawerHome(drawer)
assert(find('deskPause'), 'switch returns to home')
const switchNode = find('deskPause') as PiuContainer
const knob = switchNode.content('knob')
if (!knob) throw new Error('toggle has no switch knob')
const offRight = knob.coordinates.right
behavior.setButtonState(drawer, 'deskPause', true)
assert(knob.coordinates.right !== offRight, 'switch state changes knob position')
const pauseNode = find('joyPause')
if (!pauseNode) throw new Error('pause control missing')
behavior.addButton(drawer, { key: 'joyPause', label: 'Pause', subtitle: 'Focus 19:58', group: 'Pomodoro' })
equal(find('joyPause'), pauseNode, 'countdown updates retain the touch target')
equal(
  (pauseNode.content('subtitle') as PiuContent & { string: string }).string,
  'Focus 19:58',
  'countdown text updates',
)
behavior.setOpen(drawer, true)
Timer.set(() => trace('ok\n'), 500)
