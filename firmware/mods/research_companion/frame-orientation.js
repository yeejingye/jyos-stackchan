// Rotate RGB565 words without changing color bytes. Camera storage stays owned by its caller.
export function orientFrame(buffer, width, height, turns) {
  if (!Number.isInteger(turns) || turns < 0 || turns > 3) throw new RangeError('invalid orientation')
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    buffer.byteLength !== width * height * 2
  ) {
    throw new RangeError('invalid RGB565 frame')
  }
  if (turns === 0) return { buffer, width, height }
  const source = new Uint16Array(buffer)
  const output = new Uint16Array(width * height)
  const rotatedWidth = turns % 2 ? height : width
  const rotatedHeight = turns % 2 ? width : height
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rx, ry
      if (turns === 1) {
        rx = height - 1 - y
        ry = x
      } else if (turns === 2) {
        rx = width - 1 - x
        ry = height - 1 - y
      } else {
        rx = y
        ry = width - 1 - x
      }
      output[ry * rotatedWidth + rx] = source[y * width + x]
    }
  }
  return { buffer: output.buffer, width: rotatedWidth, height: rotatedHeight }
}

export function cameraFace(face, turns) {
  if (!face) return null
  let x = face.x,
    y = face.y
  if (turns === 1) {
    x = face.y
    y = 1 - face.x
  } else if (turns === 2) {
    x = 1 - face.x
    y = 1 - face.y
  } else if (turns === 3) {
    x = 1 - face.y
    y = face.x
  }
  return { ...face, x, y }
}
