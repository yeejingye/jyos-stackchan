// Apply bounded gain to signed little-endian PCM without wrapping clipped samples.
export function amplifyPCM(buffer, gain = 1) {
  if (!Number.isFinite(gain) || gain < 1 || gain > 8) throw new RangeError('PCM gain must be between 1 and 8')
  if (buffer.byteLength % 2) throw new RangeError('PCM requires complete 16-bit samples')
  const view = new DataView(buffer)
  let peak = 0
  for (let offset = 0; offset < view.byteLength; offset += 2) {
    const value = Math.max(-32768, Math.min(32767, Math.round(view.getInt16(offset, true) * gain)))
    view.setInt16(offset, value, true)
    peak = Math.max(peak, Math.abs(value))
  }
  return peak
}
