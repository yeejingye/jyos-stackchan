import Foundation
import Vision
import CoreGraphics
import ImageIO

// Fixed camera format. Frames are processed in memory, never saved.
let width = 176
let height = 144
let raw = FileHandle.standardInput.readDataToEndOfFile()
guard raw.count == width * height * 2 else { exit(1) }
var pixels = [UInt8](repeating: 255, count: width * height * 4)
for i in 0..<(width * height) {
    let value = UInt16(raw[i * 2]) | (UInt16(raw[i * 2 + 1]) << 8)
    pixels[i * 4] = UInt8((value >> 11) * 255 / 31)
    pixels[i * 4 + 1] = UInt8(((value >> 5) & 63) * 255 / 63)
    pixels[i * 4 + 2] = UInt8((value & 31) * 255 / 31)
}
let data = Data(pixels) as CFData
guard let provider = CGDataProvider(data: data),
      let image = CGImage(width: width, height: height, bitsPerComponent: 8,
                          bitsPerPixel: 32, bytesPerRow: width * 4,
                          space: CGColorSpaceCreateDeviceRGB(),
                          bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
                          provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
else { exit(1) }
var output: [String: Any] = ["face": NSNull()]
for orientation: CGImagePropertyOrientation in [.up, .down, .left, .right] {
    let request = VNDetectFaceRectanglesRequest()
    try VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:]).perform([request])
    let best = (request.results ?? []).filter { $0.confidence >= 0.5 }.max {
        $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height
    }
    if let face = best {
        let x: CGFloat
        switch orientation {
        case .down: x = 1 - face.boundingBox.midX
        case .left: x = face.boundingBox.midY
        case .right: x = 1 - face.boundingBox.midY
        default: x = face.boundingBox.midX
        }
        output["face"] = ["x": x, "confidence": face.confidence]
        break
    }
}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: output))
