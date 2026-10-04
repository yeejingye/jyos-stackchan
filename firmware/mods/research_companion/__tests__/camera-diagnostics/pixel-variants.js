// Diagnostic copies only: never mutate or retain the camera's disposable buffer.
export function pixelVariant(buffer, width, height, { swapBytes = false, swapRedBlue = false, mirror = false } = {}) {
  if (buffer.byteLength !== width * height * 2 || width <= 0 || height <= 0) throw new RangeError('invalid frame')
  const source = new Uint16Array(buffer)
  const output = new Uint16Array(source.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let word = source[y * width + x]
      if (swapBytes) word = ((word & 255) << 8) | (word >> 8)
      if (swapRedBlue) word = ((word & 31) << 11) | (word & 0x07e0) | (word >> 11)
      output[y * width + (mirror ? width - 1 - x : x)] = word
    }
  }
  return output.buffer
}
