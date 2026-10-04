// A soft PCM cue with a raised-cosine envelope; avoids the click of an abrupt tone.
export function createChime(hz = 440, durationMs = 160) {
  if (
    !Number.isFinite(hz) ||
    hz < 100 ||
    hz > 2000 ||
    !Number.isFinite(durationMs) ||
    durationMs < 40 ||
    durationMs > 1000
  )
    throw new Error('Invalid chime')
  const sampleRate = 24000
  const samples = Math.round((sampleRate * durationMs) / 1000)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, buffer.byteLength - 8, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) {
    const envelope = Math.sin((Math.PI * i) / (samples - 1)) ** 2
    view.setInt16(44 + i * 2, Math.round(4000 * envelope * Math.sin((2 * Math.PI * hz * i) / sampleRate)), true)
  }
  return buffer
}
