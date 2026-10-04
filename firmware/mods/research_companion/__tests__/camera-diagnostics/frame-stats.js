export function frameStats(buffer) {
  const pixels = new Uint16Array(buffer)
  let sum = 0,
    squares = 0,
    dark = 0,
    bright = 0
  let min = 255,
    max = 0
  const rgb = [0, 0, 0]
  for (const word of pixels) {
    const r = (((word >> 11) & 31) * 255) / 31
    const g = (((word >> 5) & 63) * 255) / 63
    const b = ((word & 31) * 255) / 31
    const luminance = (2126 * r + 7152 * g + 722 * b) / 10000
    rgb[0] += r
    rgb[1] += g
    rgb[2] += b
    sum += luminance
    squares += luminance * luminance
    min = Math.min(min, luminance)
    max = Math.max(max, luminance)
    if (luminance < 12) dark++
    if (luminance > 243) bright++
  }
  const count = pixels.length
  if (!count) throw new RangeError('empty camera frame')
  const mean = sum / count
  return {
    mean: Math.round(mean),
    min: Math.round(min),
    max: Math.round(max),
    deviation: Math.round(Math.sqrt(Math.max(0, squares / count - mean * mean))),
    darkPercent: Math.round((dark * 100) / count),
    brightPercent: Math.round((bright * 100) / count),
    rgbMean: rgb.map((value) => Math.round(value / count)),
  }
}
