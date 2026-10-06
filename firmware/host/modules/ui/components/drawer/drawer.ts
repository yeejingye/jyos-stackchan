import { Outline } from 'commodetto/outline'
import { localize } from 'localization'
import {
  Column,
  Container,
  Content,
  type Coordinates,
  Label,
  type Container as PiuContainer,
  type Content as PiuContent,
  Scroller,
  Skin,
  Style,
} from 'piu/MC'
import Timeline from 'piu/Timeline'
import { defineShapeTemplate } from 'template'
import { type IconName, IconView } from 'ui-controls'
import { UI, uiFont } from 'ui-theme'

export type { IconName } from 'ui-controls'

export type DrawerOption = {
  value: string
  label: string
  color?: string
}

export type DrawerButtonViewSpec = {
  key: string
  label: string
  kind?: 'action' | 'choice' | 'swatch' | 'toggle'
  active?: boolean
  value?: string
  options?: DrawerOption[]
  icon?: IconName
  group?: string
  subtitle?: string
  tone?: 'accent' | 'danger'
}

const drawerWidth = 220
const drawerHiddenOffset = -drawerWidth - 1
const SCROLL_THRESHOLD = 8

type DrawerSkins = {
  scrollerSkin: Skin
  drawerSkin: Skin
  drawerButtonSkin: Skin
  drawerButtonPressedSkin: Skin
  drawerButtonStyle: Style
  toggleOnSkin: Skin
  toggleOffSkin: Skin
  mutedStyle: Style
  sectionStyle: Style
  accentSkin: Skin
}

let cachedSkins: DrawerSkins | null = null
let cachedFont = ''

function getDrawerSkins(): DrawerSkins {
  const font = uiFont()
  if (cachedSkins && cachedFont === font) return cachedSkins
  cachedFont = font
  cachedSkins = {
    scrollerSkin: new Skin({ fill: UI.colors.background }),
    drawerSkin: new Skin({ fill: UI.colors.background }),
    drawerButtonSkin: new Skin({ fill: UI.colors.surface }),
    drawerButtonPressedSkin: new Skin({ fill: UI.colors.surfacePressed }),
    drawerButtonStyle: new Style({ font, color: UI.colors.text, horizontal: 'left' }),
    toggleOnSkin: new Skin({ fill: '#12656c' }),
    toggleOffSkin: new Skin({ fill: UI.colors.disabled }),
    mutedStyle: new Style({ font, color: UI.colors.textMuted, horizontal: 'left' }),
    sectionStyle: new Style({ font, color: '#9cbac0', horizontal: 'left' }),
    accentSkin: new Skin({ fill: '#12656c' }),
  }
  return cachedSkins
}

class DrawerScrollerBehavior extends Behavior {
  anchor = 0
  startY = 0
  waiting = false
  onTouchBegan(content: PiuContent, _id: number, _x: number, y: number) {
    const scroller = content as unknown as { scroll: { y: number } }
    this.anchor = scroller.scroll.y
    this.startY = y
    this.waiting = true
  }
  onTouchMoved(content: PiuContent, id: number, x: number, y: number, ticks: number) {
    const scroller = content as unknown as {
      scrollTo: (x: number, y: number) => void
      scroll: { y: number }
      captureTouch: (id: number, x: number, y: number, ticks: number) => void
    }
    const delta = y - this.startY
    if (this.waiting) {
      if (Math.abs(delta) < SCROLL_THRESHOLD) return
      this.waiting = false
      scroller.captureTouch(id, x, y, ticks)
    }
    scroller.scrollTo(0, this.anchor - delta)
  }
}

const RoundedSurface = defineShapeTemplate((data: { width: number; height: number; radius: number; skin: Skin }) => ({
  width: data.width,
  height: data.height,
  skin: data.skin,
  fillOutline: Outline.fill(Outline.RoundRectPath(0, 0, data.width, data.height, data.radius)),
}))

const DrawerButton = Container.template(($: DrawerButtonViewSpec) => {
  const skins = getDrawerSkins()
  const isToggle = $.kind === 'toggle'
  const isChoice = $.kind === 'choice' || $.kind === 'swatch'
  const contents: PiuContent[] = []
  const rowHeight = isChoice || $.subtitle ? 56 : 48
  contents.push(
    new RoundedSurface(
      {
        width: drawerWidth - 16,
        height: rowHeight - 4,
        radius: 8,
        skin: $.tone === 'accent' ? skins.accentSkin : skins.drawerButtonSkin,
      },
      { name: 'card', left: 0, top: 0 },
    ),
  )
  if (isToggle) {
    contents.push(
      new RoundedSurface(
        { width: 32, height: 18, radius: 9, skin: $.active ? skins.toggleOnSkin : skins.toggleOffSkin },
        { name: 'toggle', right: 12, top: 14 },
      ),
    )
    contents.push(
      new RoundedSurface(
        { width: 14, height: 14, radius: 7, skin: new Skin({ fill: UI.colors.text }) },
        { name: 'knob', right: $.active ? 14 : 28, top: 16 },
      ),
    )
  }
  if (!isToggle && !isChoice && $.icon) {
    contents.push(
      new IconView({ icon: $.icon, enabled: true, selected: false }, { left: 4, top: 6, width: 32, height: 32 }),
    )
  }
  contents.push(
    new Label(null, {
      name: 'label',
      left: !isChoice && $.icon ? 36 : 12,
      right: isToggle ? 50 : 12,
      top: isChoice || $.subtitle ? 6 : 0,
      height: isChoice || $.subtitle ? 20 : undefined,
      bottom: isChoice || $.subtitle ? undefined : 4,
      string: $.label ?? 'Button',
      style:
        $.tone === 'danger'
          ? new Style({ font: uiFont(), color: UI.colors.error, horizontal: 'left' })
          : skins.drawerButtonStyle,
    }),
  )
  if ($.subtitle && !isChoice)
    contents.push(
      new Label(null, {
        name: 'subtitle',
        left: 12,
        right: 12,
        top: 29,
        height: 16,
        string: $.subtitle,
        style: skins.mutedStyle,
      }),
    )
  if (isChoice) {
    const selected = $.options?.find((option) => option.value === $.value)
    if ($.kind === 'swatch' && selected?.color) {
      contents.push(
        new Content(null, { left: 12, top: 27, width: 16, height: 16, skin: new Skin({ fill: selected.color }) }),
      )
    }
    contents.push(
      new Label(null, {
        name: 'value',
        left: $.kind === 'swatch' ? 36 : 20,
        right: 12,
        top: 24,
        height: 24,
        string: `${selected?.label ?? ''}  >`,
        style: skins.drawerButtonStyle,
      }),
    )
  }
  return {
    name: $.key,
    left: 8,
    right: 8,
    height: rowHeight,
    active: true,
    contents,
    Behavior: class extends Behavior {
      action?: string
      kind?: DrawerButtonViewSpec['kind']
      icon?: PiuContent | null
      label?: PiuContent | null
      startX = 0
      startY = 0
      moved = false
      onCreate(content: PiuContainer, data: DrawerButtonViewSpec) {
        this.action = data.key
        this.kind = data.kind
        this.icon = data.kind === 'toggle' ? (content.content('toggle') as PiuContent) : null
        this.label = content.content('label') as PiuContent
        if (this.icon && data.active !== undefined) {
          this.icon.skin = data.active ? skins.toggleOnSkin : skins.toggleOffSkin
        }
      }
      onTouchBegan(content: PiuContainer, _id: number, x: number, y: number) {
        this.startX = x
        this.startY = y
        this.moved = false
        if (content.first) content.first.skin = skins.drawerButtonPressedSkin
      }
      onTouchMoved(content: PiuContainer, _id: number, x: number, y: number) {
        const dx = Math.abs(x - this.startX)
        const dy = Math.abs(y - this.startY)
        if (!this.moved && (dx > 6 || dy > 6)) {
          this.moved = true
          if (content.first) content.first.skin = $.tone === 'accent' ? skins.accentSkin : skins.drawerButtonSkin
        }
      }
      onTouchCancelled(content: PiuContainer) {
        this.moved = false
        if (content.first) content.first.skin = $.tone === 'accent' ? skins.accentSkin : skins.drawerButtonSkin
      }
      onTouchEnded(content: PiuContainer) {
        if (content.first) content.first.skin = $.tone === 'accent' ? skins.accentSkin : skins.drawerButtonSkin
        if (!this.moved && this.action) {
          trace(`[DrawerButton] onTouchEnded action=${this.action}\n`)
          if (this.action === 'drawerHome') {
            content.bubble('onDrawerHome')
          } else if (this.action === 'drawerSettings') {
            content.bubble('onDrawerSettingsOpen')
          } else if (this.kind === 'choice' || this.kind === 'swatch') {
            content.bubble('onDrawerChoiceOpen', this.action)
          } else {
            content.bubble(this.action)
          }
        }
        this.moved = false
      }
      setDetails(content: PiuContainer, data: DrawerButtonViewSpec) {
        const label = content.content('label') as PiuContent & { string: string }
        if (label) label.string = data.label
        const subtitle = content.content('subtitle') as PiuContent & { string: string }
        if (subtitle) subtitle.string = data.subtitle ?? ''
        if (data.active !== undefined) this.setActive(content, data.active)
      }
      setActive(content: PiuContainer, active: boolean) {
        if (!this.icon) return
        this.icon.skin = active ? skins.toggleOnSkin : skins.toggleOffSkin
        const knob = content.content('knob')
        if (knob) knob.coordinates = { right: active ? 14 : 28, top: 16 } as Coordinates
      }
    },
  }
})

type DrawerChoiceData = {
  key: string
  option: DrawerOption
  selected: boolean
}

const DrawerChoice = Container.template(($: DrawerChoiceData) => {
  const skins = getDrawerSkins()
  const contents: PiuContent[] = []
  if ($.option.color) {
    contents.push(
      new Content(null, { left: 12, top: 14, width: 16, height: 16, skin: new Skin({ fill: $.option.color }) }),
    )
  }
  contents.push(
    new Label(null, {
      left: $.option.color ? 38 : 12,
      right: 12,
      top: 0,
      bottom: 0,
      string: `${$.selected ? '> ' : ''}${$.option.label}`,
      style: skins.drawerButtonStyle,
    }),
  )
  return {
    left: 0,
    right: 0,
    height: 44,
    active: true,
    skin: $.selected ? skins.drawerButtonPressedSkin : skins.drawerButtonSkin,
    contents,
    Behavior: class extends Behavior {
      startX = 0
      startY = 0
      moved = false
      onTouchBegan(_content: PiuContainer, _id: number, x: number, y: number) {
        this.startX = x
        this.startY = y
        this.moved = false
      }
      onTouchMoved(_content: PiuContainer, _id: number, x: number, y: number) {
        if (Math.abs(x - this.startX) > 6 || Math.abs(y - this.startY) > 6) this.moved = true
      }
      onTouchCancelled() {
        this.moved = false
      }
      onTouchEnded(content: PiuContainer) {
        if (!this.moved) content.bubble('onDrawerChoiceSelected', { key: $.key, value: $.option.value })
        this.moved = false
      }
    },
  }
})

const DrawerChoiceBack = Container.template(() => {
  const skins = getDrawerSkins()
  return {
    left: 0,
    right: 0,
    height: 44,
    active: true,
    skin: skins.drawerButtonSkin,
    contents: [
      new Label(null, {
        left: 12,
        right: 12,
        top: 0,
        bottom: 0,
        string: localize('drawer.back'),
        style: skins.drawerButtonStyle,
      }),
    ],
    Behavior: class extends Behavior {
      startX = 0
      startY = 0
      moved = false
      onTouchBegan(_content: PiuContainer, _id: number, x: number, y: number) {
        this.startX = x
        this.startY = y
        this.moved = false
      }
      onTouchMoved(_content: PiuContainer, _id: number, x: number, y: number) {
        if (Math.abs(x - this.startX) > 6 || Math.abs(y - this.startY) > 6) this.moved = true
      }
      onTouchCancelled() {
        this.moved = false
      }
      onTouchEnded(content: PiuContainer) {
        if (!this.moved) content.bubble('onDrawerChoiceBack')
        this.moved = false
      }
    },
  }
})

type DrawerDictionary = { buttons?: DrawerButtonViewSpec[] }
type DrawerBehavior = {
  isOpen: boolean
  toggle: (container: PiuContainer) => void
  setOpen: (container: PiuContainer, open: boolean) => void
  setButtons?: (container: PiuContainer, buttons: DrawerButtonViewSpec[]) => boolean
  addButton?: (container: PiuContainer, button: DrawerButtonViewSpec) => boolean
  removeButton?: (container: PiuContainer, key: string) => boolean
  setButtonState?: (container: PiuContainer, key: string, active: boolean) => boolean
}

type DrawerTemplateCtor = { new (behaviorData?: unknown, dictionary?: DrawerDictionary): PiuContainer }

export const Drawer: DrawerTemplateCtor = Container.template((d: DrawerDictionary) => {
  const skins = getDrawerSkins()
  return {
    name: 'drawer',
    top: 0,
    bottom: 0,
    width: drawerWidth,
    clip: true,
    active: true,
    skin: skins.drawerSkin,
    contents: [
      new Scroller(null, {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        clip: true,
        active: true,
        backgroundTouch: true,
        skin: skins.scrollerSkin,
        Behavior: DrawerScrollerBehavior,
        contents: [
          new Column(null, {
            left: 0,
            right: 0,
            top: 0,
            contents: d.buttons?.map((b) => new DrawerButton(b)) ?? [],
          }),
        ],
      }),
    ],
    Behavior: class extends Behavior {
      coordinates = { right: drawerHiddenOffset, width: drawerWidth, top: 0, bottom: 0 } as unknown as Coordinates
      isOpen = false
      buttonList: PiuContainer | null = null
      timeline: Timeline | null = null
      offset = drawerHiddenOffset
      buttons: DrawerButtonViewSpec[] = []
      settingsPage = false
      choiceKey?: string

      onCreate(container: PiuContainer, data?: DrawerDictionary) {
        container.interval = 16
        this.buttons = [...(data?.buttons ?? [])]
        this.buttonList = this.findButtonList(container)
        if (this.buttonList) this.renderButtons(this.buttonList)
        this.applyPosition(container, this.offset)
      }
      onTimeChanged(container: PiuContainer) {
        if (this.timeline) {
          this.timeline.seekTo(container.time)
          this.applyPosition(container, this.offset)
        }
      }
      onFinished(_container: PiuContainer) {
        this.timeline = null
      }
      applyPosition(container: PiuContainer, right: number) {
        this.coordinates.right = right
        container.coordinates = this.coordinates
      }
      startAnimation(container: PiuContainer, to: number) {
        const from = this.offset
        if (from === to && !this.timeline) {
          this.applyPosition(container, this.offset)
          return
        }
        container.stop?.()
        this.timeline = null
        const tl = new Timeline()
        this.timeline = tl
        tl.on(this, { offset: [from, to] }, 180, Math.quadEaseOut, 0)
        tl.seekTo(0)
        container.duration = tl.duration
        container.time = 0
        container.start()
      }
      setOpen(container: PiuContainer, open: boolean) {
        trace(`[Drawer] setOpen ${open}\n`)
        if (this.isOpen === open && !this.timeline) return
        this.isOpen = open
        const to = this.isOpen ? 0 : drawerHiddenOffset
        this.startAnimation(container, to)
      }
      toggle(container: PiuContainer) {
        this.setOpen(container, !this.isOpen)
      }
      setButtons(container: PiuContainer, buttons: DrawerButtonViewSpec[]) {
        const list = this.getButtonList(container)
        if (!list) return false
        this.buttons = [...buttons]
        this.renderButtons(list)
        return true
      }
      addButton(container: PiuContainer, button: DrawerButtonViewSpec) {
        const list = this.getButtonList(container)
        if (!list) return false
        const previous = this.buttons.find((item) => item.key === button.key)
        const buttonIndex = this.buttons.findIndex((item) => item.key === button.key)
        if (buttonIndex >= 0) this.buttons[buttonIndex] = button
        else this.buttons.push(button)
        const existing = this.findButtonInList(list, button.key)
        if (!existing) {
          if (previous || this.settingsPage) return true
          this.renderButtons(list)
          return true
        }
        if (
          previous &&
          previous.kind === button.kind &&
          previous.group === button.group &&
          !!previous.subtitle === !!button.subtitle &&
          previous.tone === button.tone &&
          button.kind !== 'choice' &&
          button.kind !== 'swatch'
        ) {
          const behavior = existing.behavior as {
            setDetails?: (content: PiuContainer, data: DrawerButtonViewSpec) => void
          }
          behavior?.setDetails?.(existing, button)
          return true
        }
        const next = existing?.next as PiuContent | null | undefined
        if (existing) {
          list.remove(existing)
        }
        const node = new DrawerButton(button)
        if (next) list.insert(node, next)
        else list.add(node)
        return true
      }
      removeButton(container: PiuContainer, key: string) {
        const list = this.getButtonList(container)
        if (!list) return false
        if (!this.buttons.some((item) => item.key === key)) return false
        this.buttons = this.buttons.filter((item) => item.key !== key)
        this.renderButtons(list)
        return true
      }
      onDrawerChoiceOpen(container: PiuContainer, key: string) {
        const list = this.getButtonList(container)
        const button = this.buttons.find((item) => item.key === key)
        if (!list || !button?.options) return true
        this.choiceKey = key
        this.renderButtons(list)
        this.resetScroll(container)
        return true
      }
      onDrawerSettingsOpen(container: PiuContainer) {
        this.choiceKey = undefined
        this.settingsPage = true
        this.resetScroll(container)
        const list = this.getButtonList(container)
        if (list) this.renderButtons(list)
        return true
      }
      onDrawerHome(container: PiuContainer) {
        this.choiceKey = undefined
        this.settingsPage = false
        this.resetScroll(container)
        const list = this.getButtonList(container)
        if (list) this.renderButtons(list)
        return true
      }
      onDrawerChoiceBack(container: PiuContainer) {
        this.choiceKey = undefined
        this.resetScroll(container)
        const list = this.getButtonList(container)
        if (list) this.renderButtons(list)
        return true
      }
      onDrawerChoiceSelected(container: PiuContainer, selection: { key: string; value: string }) {
        const button = this.buttons.find((item) => item.key === selection.key)
        if (button) button.value = selection.value
        this.choiceKey = undefined
        this.resetScroll(container)
        const list = this.getButtonList(container)
        if (list) this.renderButtons(list)
        container.bubble(selection.key, selection.value)
        return true
      }
      resetScroll(container: PiuContainer) {
        const scroller = container.first as PiuContent & { scrollTo?: (x: number, y: number) => void }
        scroller?.scrollTo?.(0, 0)
      }
      renderButtons(list: PiuContainer) {
        list.empty()
        const choice = this.buttons.find((button) => button.key === this.choiceKey)
        if (choice?.options) {
          list.add(new DrawerChoiceBack())
          for (const option of choice.options)
            list.add(new DrawerChoice({ key: choice.key, option, selected: option.value === choice.value }))
          return
        }
        const grouped = this.buttons.some((button) => button.group)
        if (!grouped) {
          for (const button of this.buttons) list.add(new DrawerButton(button))
          return
        }
        list.add(
          new Label(null, {
            left: 16,
            right: 8,
            height: 36,
            string: this.settingsPage ? 'Appearance & settings' : 'Joy controls',
            style: getDrawerSkins().sectionStyle,
          }),
        )
        if (this.settingsPage) {
          list.add(new DrawerButton({ key: 'drawerHome', label: 'Back to controls', icon: 'back' }))
          for (const button of this.buttons.filter((button) => !button.group)) list.add(new DrawerButton(button))
        } else {
          for (const group of [
            'Desk companion',
            'Pomodoro',
            'Voice',
            ...new Set(this.buttons.map((button) => button.group).filter(Boolean)),
          ]) {
            if (!group || list.content(`section:${group}`)) continue
            const buttons = this.buttons.filter((button) => button.group === group)
            if (!buttons.length) continue
            list.add(
              new Label(null, {
                name: `section:${group}`,
                left: 16,
                right: 8,
                height: 28,
                string: group,
                style: getDrawerSkins().sectionStyle,
              }),
            )
            for (const button of buttons) list.add(new DrawerButton(button))
          }
          list.add(new DrawerButton({ key: 'drawerSettings', label: 'Appearance & settings', icon: 'settings' }))
        }
      }
      setButtonState(container: PiuContainer, key: string, active: boolean) {
        const list = this.getButtonList(container)
        const button = list ? this.findButtonInList(list, key) : null
        const spec = this.buttons.find((item) => item.key === key)
        if (spec) spec.active = active
        if (!button) return !!spec
        const behavior = button.behavior as { setActive?: (content: PiuContainer, state: boolean) => void } | undefined
        behavior?.setActive?.(button, active)
        return true
      }
      getButtonList(container: PiuContainer): PiuContainer | null {
        if (this.buttonList) return this.buttonList
        this.buttonList = this.findButtonList(container)
        return this.buttonList
      }
      findButtonList(container: PiuContainer): PiuContainer | null {
        const scroller = container.first as PiuContainer | null
        return (scroller?.first as PiuContainer | null) ?? null
      }
      findButtonInList(list: PiuContainer, key: string): PiuContainer | null {
        let current: PiuContent | null = list.first as PiuContent | null
        while (current) {
          if ((current as PiuContainer).name === key) {
            return current as PiuContainer
          }
          current = current.next as PiuContent | null
        }
        return null
      }
    },
  }
}) as unknown as DrawerTemplateCtor

export const drawerConstants = { drawerWidth }

export type { DrawerBehavior }
