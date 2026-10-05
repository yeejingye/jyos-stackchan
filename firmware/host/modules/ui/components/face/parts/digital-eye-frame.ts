import { Outline } from 'commodetto/outline'
import { getStrokeSkin } from 'parts/shape-utils'
import { defineShapeTemplate } from 'template'

type DigitalEyeFrameOptions = { cx: number; cy: number; width: number; height: number; radius: number }
const DIGITAL_ACCENT = 0x12656c

/** A subtle theme-aware outline that gives the digital eyes a soft display bezel. */
export const DigitalEyeFrame = defineShapeTemplate((options: DigitalEyeFrameOptions) => {
  const { width, height, radius } = options
  const outline = Outline.stroke(Outline.RoundRectPath(0, 0, width, height, radius), 2)
  return {
    left: options.cx - width / 2,
    top: options.cy - height / 2,
    width,
    height,
    skin: getStrokeSkin(DIGITAL_ACCENT),
    strokeOutline: outline,
  }
})
