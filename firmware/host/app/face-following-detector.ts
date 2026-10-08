import type { DetectedFace, FaceFollowingDependencies } from './face-following-controller.js'

type Detector = ReturnType<FaceFollowingDependencies['createDetector']>

// The camera can be mounted in different orientations. Search one orientation per
// frame until a face is found, then keep it. Motion always uses camera coordinates.
export class OrientedFaceDetector implements Detector {
  #detector: Detector
  #turns: number
  #locked = false
  constructor(detector: Detector, initialTurns = 0) {
    if (!Number.isInteger(initialTurns) || initialTurns < 0 || initialTurns > 3)
      throw new RangeError('invalid orientation')
    this.#detector = detector
    this.#turns = initialTurns
  }

  get orientation(): number {
    return this.#turns * 90
  }

  detect(buffer: ArrayBuffer, width: number, height: number): DetectedFace | null {
    const turns = this.#turns
    let pixels = buffer
    const rotatedWidth = turns % 2 ? height : width
    const rotatedHeight = turns % 2 ? width : height
    if (turns) {
      const source = new Uint16Array(buffer)
      const output = new Uint16Array(width * height)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const rx = turns === 1 ? height - 1 - y : turns === 2 ? width - 1 - x : y
          const ry = turns === 1 ? x : turns === 2 ? height - 1 - y : width - 1 - x
          output[ry * rotatedWidth + rx] = source[y * width + x]
        }
      }
      pixels = output.buffer
    }
    const face = this.#detector.detect(pixels, rotatedWidth, rotatedHeight)
    if (!face) {
      // Camera mounting stays fixed throughout a session. Once established, keep
      // this orientation even during prolonged face loss to reacquire quickly.
      if (!this.#locked) this.#turns = (turns + 1) % 4
      return null
    }
    this.#locked = true
    if (turns === 1) return { ...face, x: face.y, y: 1 - face.x }
    if (turns === 2) return { ...face, x: 1 - face.x, y: 1 - face.y }
    if (turns === 3) return { ...face, x: 1 - face.y, y: face.x }
    return face
  }

  close(): void {
    this.#detector.close()
  }
}
